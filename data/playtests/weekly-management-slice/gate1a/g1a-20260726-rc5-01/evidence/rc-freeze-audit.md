# Gate 1A RC5 冻结审计记录

## 结论

`g1-rc-20260726.5` 已关闭 RC4 A01 暴露的匿名 JSON 不可核验证据风险，
满足进入新的独立冻结复核的技术条件。

本记录不是最终 `RC_FREEZE=YES` 决定，也不是正式代理样本。只有未参与 RC5
实现、技术场和冻结制备的独立 agent 给出 `RC_FREEZE=YES` 后，才允许开始
A09–A15。

## RC 身份

| 字段 | 冻结值 |
|---|---|
| RC ref | `refs/heads/codex/gate1-rc-20260726.5` |
| Git SHA | `2d40aa102bd51107c07cbe176f798a93a37663f3` |
| Git tree | `c152f1487ec370a4b6534adf0bac92336b8186d8` |
| source-tree hash | `9a81cf360f9b9efd80e67327ba0fc0d4723ed3865421eaded81219f198502d27` |
| source-tree algorithm | `sha256-git-blob-path-manifest-v1` |
| source-tree file count | 39 |
| build ID | `g1-rc-20260726.5` |
| artifact hash | `ec09284f9dfb7976356a510b1039092f85dc91dd6eb94e649ca138040431d65f` |
| initial state | `fnv1a32-33a16fbf` |
| scenario | `gate1-two-week-management` / `0.4.0` |
| fixed seed | `104729` |

源树规范输入为 RC 提交中全部已跟踪 `prototype/` 文件，按路径升序，每行
`<path><TAB>Git blob object ID<LF>`，包含最终 LF。

## RC4 证据风险关闭

RC5 新增：

- 完整场次才允许向 loopback host 提交；
- 原始 UTF-8 JSON POST 到 `/__gate1/capture`；
- 客户端核对返回字节、SHA、build、Git 和 artifact 后才显示成功；
- 保存失败保留会话、禁止清空，并允许复用完全相同的 raw JSON 重试；
- host 严格校验 tick 2010、两周完成、两份 recap、完整终态和唯一终局
  `export-created`；
- raw JSON、`.sha256`、`.receipt.json` 三件套；
- sidecar 与 receipt 先原子落位，raw 最后作为 commit marker；
- 缺失、篡改、非规范 receipt 或同名异内容均 fail closed。

实现的独立代码复审结果为 `COMMIT_GO=YES`、P0=0、P1=0、P2=2。两个 P2
分别为极端断电时未显式 `fsync`，以及 409 错误未直接指出缺失文件；均不影响
本地 Gate 1A 的 fail-closed 证据合同。

## 双 clean clone 复算

两个独立 clone 均从远端检出 `codex/gate1-rc-20260726.5`：

- clone A：`/tmp/new-era-g1a-rc5-a.GNhAjo/repo`
- clone B：`/tmp/new-era-g1a-rc5-b.fP6CZ3/repo`

两者均执行：

```bash
npm ci
npm run rc:build -- \
  --build-id g1-rc-20260726.5 \
  --git-sha 2d40aa102bd51107c07cbe176f798a93a37663f3
npm run lint
npm run test:run
npm run rc:verify
node --check dist/playtest-host.mjs
```

结果：

- Node `v24.18.0`；
- Vite 8.1.5、plugin-react 6.0.4、Vitest 4.1.10、vite-node 6.0.0；
- 两次 `npm ci` 均成功，0 vulnerabilities；
- 两次构建得到相同 artifact hash 和初态 hash；
- 两份 fresh dist 与冻结 `rc-dist/` 文件集合和字节完全一致；
- lint 通过；
- Vitest 7 个文件、47 项测试通过；
- `rc:verify` 与 host `node --check` 通过。

clone A 另执行 `npm run e2e:rc`，Chromium 在 `1440×900` 与 `1280×720`
共 10/10 通过，覆盖真实 capture、合同拒绝、已提交 sidecar 篡改、受控中断恢复、
完整两周保存下载和内存清空。

## 确定性 archive

`rc-dist/` 全部条目统一为 UTC `2000-01-01 00:00:00`，按路径排序，以 ustar、
uid/gid 0、owner/group `root`、无 macOS metadata 和 `--no-recursion` 生成
`rc-dist.tar`。

冻结文件：

| 文件 | SHA-256 |
|---|---|
| `rc-dist/artifact-manifest.json` | `da92f5489601f7a17fc805753d8aba881ee851eee0220f3a2faab970e2cf850d` |
| `rc-dist/rc-build.json` | `8945aed3b344a97ea1e48d97100dee95156fefc4bf53ecb21e66cd0f22120f40` |
| `rc-dist/playtest-host.mjs` | `29c676e4804499a2a01beded4c55d1d2098c0340d7c5ec80475e12874a1c7388` |
| `rc-dist.tar` | `c449247c34615e7fb2f19e8372588f70a26dba55b7203c1faac31f25721b52c3` |

两个 clean clone 分别重建 archive，均得到同一 SHA，并与冻结 archive 逐字节一致。

## TECH-P98 真实 Chrome 验证

TECH-P98 使用 `1440×900` Chrome 玩家界面完成两周并保存 tick 2010。
浏览器下载事件最终状态为 `completed`，字节数为 62761。下载文件与服务端 raw
的 SHA-256 均为：

`5319377ce23276fa41e40d0be873d01f44d3f68380bf8e90eb11ebb60f42e498`

服务端 raw、SHA sidecar 与 canonical receipt 在网页结束清空后继续存在并完全
自洽。记录见 `evidence/TECH-P98-capture-audit.md`；本场排除在正式分母之外。

## 正式运行条件

从仓库根目录只允许用 manifest 中冻结的命令启动 host，并必须显式提供：

```text
--capture-dir data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc5-01/captures
```

A09–A15 每场保存、下载并核验三件套后，才允许结束清空、发送结束访谈并开始
下一场。任一三件套缺失、SHA 不一致或保存确认失败，按冻结有效性规则处理。

## 正式样本协议

- 主样本：A09–A15；
- 批次：A09–A11、A12–A14、A15；
- 替补从 A16 开始；
- 所有样本使用相同玩家包、结束访谈、RC、host 命令、视口和隔离规则；
- RC4 的 A01 及 A02–A08 席位不得转入 RC5。

## 边界

- 当前状态为 `FROZEN_PENDING_INDEPENDENT_REVIEW`；
- A09 前必须由未参与实现、构建、TECH-P98 和本记录制备的新 agent 从远端复核；
- Gate 1H 保持 `PENDING`；
- Gate 2 保持 `LOCKED`；
- Gate 1A 的任何结论均不能解锁 Gate 2。
