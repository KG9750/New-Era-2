# Gate 1A RC6 冻结审计记录

## 结论

`g1-rc-20260726.6` 已关闭 RC5 无法保存中途产品阻断证据的 P1，满足进入新的
独立冻结复核的技术条件。

本记录不是最终 `RC_FREEZE=YES` 决定，也不是正式代理样本。只有未参与 RC6
实现和本次冻结制备的独立 agent 对远端证据给出
`RC_FREEZE=YES` 后，才允许开始 A16–A22。

## RC 身份

| 字段 | 冻结值 |
|---|---|
| RC ref | `refs/heads/codex/gate1-rc-20260726.6` |
| Git SHA | `affc5d8a0c9664a3724d1c31cb3d67682c818af9` |
| Git tree | `58d37186e6cc0491c7c819ed5e2ddda760d77e4f` |
| source-tree hash | `33c9ad2eb1b586790497445313d61905646a0aebdc741f085c68ea7ea95c9576` |
| source-tree algorithm | `sha256-git-blob-path-manifest-v1` |
| source-tree file count | 39 |
| build ID | `g1-rc-20260726.6` |
| artifact hash | `096a4cd2d971be5b0503f1727ec02505f3d3a1a54a2c01d2afa0ff369d1df2ee` |
| initial state | `fnv1a32-33a16fbf` |
| scenario | `gate1-two-week-management` / `0.4.0` |
| fixed seed | `104729` |

源树规范输入为 RC 提交中全部已跟踪 `prototype/` 文件，按路径升序，每行
`<path><TAB>Git blob object ID<LF>`，包含最终 LF。

## RC5 后置 P1 的关闭

RC6 在不放宽完整场次合同的前提下新增：

- 未完成会话可保存独立的 blocked capture；
- 阻断原因必须为 trim 后 1–240 字；
- blocked raw 记录 `captureKind=blocked`、`blockedAtTick`、
  `isComplete=false`；
- blocked 使用唯一 `blocked-capture-created`，禁止 `export-created`；
- blocked receipt 明确回传 capture kind、blocked tick 和未完成状态；
- 保存成功前禁止清空，失败重试复用同一 raw；
- 原完整场次仍严格要求 tick 2010、两周、两份 recap 和唯一终局
  `export-created`。

独立代码复审为 `CODE_REVIEW=YES`、P0=0、P1=0、P2=1。唯一 P2 是 blocked
专属 UI 失败重试缺少单独的字节一致性断言；实现与完整场次共用
`pendingCaptureRef`，不阻断冻结。详见 `evidence/rc6-code-review.md`。

## 双 clean clone 复算

两个 clean clone 均从同一 RC SHA 构建：

- clone A：`/tmp/new-era-g1a-rc6-a.riTbGy/repo`
- clone B：`/tmp/new-era-g1a-rc6-b.hxIdkh/repo`

两者均使用 Node `v24.18.0`，并通过：

- `npm ci`，0 vulnerabilities；
- lint；
- Vitest 7 个文件、47/47；
- RC build 与 `rc:verify`；
- host source/dist `node --check`；
- fresh dist 与冻结 `rc-dist/` 的文件集合和字节比对。

Chromium 在 `1440×900` 与 `1280×720` 各 8/8，共 16/16 通过。覆盖完整场
保存、blocked 保存、原因边界、模式隔离、receipt 校验、保存前禁止清空和
host 拒绝逻辑。

## 确定性 archive

`rc-dist/` 全部条目统一为 UTC `2000-01-01 00:00:00`，按路径排序，以 ustar、
uid/gid 0、owner/group `root`、无 macOS metadata 生成 `rc-dist.tar`。

| 文件 | SHA-256 |
|---|---|
| `rc-dist/artifact-manifest.json` | `d9944fbb7b48baf9f607cf43f72f862cd3ec4f3933f409d4ef55bfa3de099b6c` |
| `rc-dist/rc-build.json` | `a97c634469e4b1e985f1568d86eb5024f43ad810eb5f9ad892d43e9dbb85399b` |
| `rc-dist/playtest-host.mjs` | `b5173afb1fe4bd98d70ed8f96d249eb6234f94c8ac7e263d191bfb35e4a150fb` |
| `rc-dist.tar` | `a8de5f7ab63e1afc5d16c3279e6db37602779a90d3d44dec2e17df0a68394385` |

两个 clean clone 分别重建 archive，均得到同一 SHA，并与冻结 archive 逐字节
一致。

## 正式运行条件

从仓库根目录只允许用 manifest 中冻结的命令启动 loopback host：

```text
node data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc6-01/rc-dist/playtest-host.mjs --host 127.0.0.1 --port 4195 --capture-dir data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc6-01/captures
```

每场必须先核验服务端 raw、SHA sidecar、canonical receipt 与浏览器下载，保存
成功后才允许清空并发放结束访谈：

- 完整场：`captureKind=complete`、tick 2010、两周和两份 recap；
- 阻断场：`captureKind=blocked`、`blockedAtTick<2010`、非空原因、
  `isComplete=false`。

任一三件套缺失、SHA 不一致或保存确认失败，必须保留当前会话，按冻结有效性
规则裁定，不得把原型自身可复现阻断改判为技术无效。

## 正式样本协议

- 主样本：A16–A22；
- 批次：A16–A18、A19–A21、A22；
- 技术无效替补从 A23 开始；
- 运营负责人：当前根 agent `/root`；
- 所有样本使用相同玩家包 V4、结束访谈 V2、RC、host 命令、视口和隔离规则；
- A01–A15 永久保留历史，编号不复用，不进入 RC6 分母。

## 边界

- 当前状态为 `FROZEN_PENDING_INDEPENDENT_REVIEW`；
- A16 前必须由未参与实现和冻结制备的独立 agent 从远端复核；
- #7 保持 `OPEN`，#9 保持 `OPEN`；
- Gate 1H 保持 `PENDING`；
- Gate 2 保持 `LOCKED`；
- Gate 1A 的任何结论均不能解锁 Gate 2。
