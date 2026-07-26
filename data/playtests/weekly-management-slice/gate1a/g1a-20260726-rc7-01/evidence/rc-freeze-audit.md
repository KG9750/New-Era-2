# Gate 1A RC7 冻结审计记录

## 结论

`g1-rc-20260726.7` 已关闭 RC6 无法保存终局状态转换阻断证据的 P1，满足进入
新的独立冻结复核的技术条件。

本记录不是最终 `RC_FREEZE=YES` 决定，也不是正式代理样本。只有未参与 RC7
实现和本次冻结制备的独立 agent 对远端证据给出 `RC_FREEZE=YES` 后，才允许
开始 A23–A29。

## RC 身份

| 字段 | 冻结值 |
|---|---|
| RC ref | `refs/heads/codex/gate1-rc-20260726.7` |
| Git SHA | `03973fcfc0c244555e7e4a4c623eec3fb8b8e032` |
| Git tree | `341e0de0352181ce84067c45bff99248f03a5b70` |
| source-tree hash | `22133fccaa2459d9d3414a1728fdb332ccdfc344dd126f444b67a3c3224d5adb` |
| source-tree algorithm | `sha256-git-blob-path-manifest-v1` |
| source-tree file count | 39 |
| build ID | `g1-rc-20260726.7` |
| artifact hash | `e0cf7c78251642a54f88845c61aa214e9e91076b3e432fb8399bd873ef0fe49b` |
| initial state | `fnv1a32-33a16fbf` |
| scenario | `gate1-two-week-management` / `0.4.0` |
| fixed seed | `104729` |

## RC6 后置 P1 的关闭

RC7 在不放宽完整场次合同的前提下：

- 接受 `54<=blockedAtTick=finalTick<=2010` 的非完整证据；
- 接受 tick 2010、`isComplete=false`、completedWeekCount 0 的终局阻断；
- 接受 tick 2010、两份 recap 已生成但完成标志未生效的终局状态转换故障；
- 要求 completedWeekCount 为 0–2，recapCount 和 recap 数量一致，week index
  从 0 连续；
- 拒绝 tick 0 等场景开始前的不可能 blocked 证据；
- 保留非空 1–240 字原因、唯一 `blocked-capture-created`、禁止
  `export-created`、receipt 和三件套合同；
- 完整场次仍严格要求 tick 2010、`isComplete=true`、两周、两份 recap 和
  唯一 `export-created`。

未参与实现和冻结制备的独立 source reviewer 对最终源给出
`CODE_REVIEW=PASS`、P0=0、P1=0、P2=0：确认第二周化肥使用证据按 action
顺序正确派生；blocked capture 保存失败后以同一 raw 重试，保持唯一 blocked
marker、零 complete marker、失败时冻结输入和禁止清空、成功后才允许清空。
代码复审不等于独立冻结裁定，当前仍等待 `RC_FREEZE=YES`。详见
`evidence/rc7-code-review.md`。

## 双 clean clone 复算

两个 clean clone 均从远端提交
`03973fcfc0c244555e7e4a4c623eec3fb8b8e032` 构建：

- clone A：`/tmp/new-era-rc7-final-a2.DMTjvX/repo`
- clone B：`/tmp/new-era-rc7-final-b2.o18Z8X/repo`

两者均使用 Node `v24.18.0`、npm `11.16.0`，并通过：

- `npm ci`，各安装并审计 129 个 packages，0 vulnerabilities；
- 独立 `npm audit`，两边均为 0 vulnerabilities；
- lint；
- Vitest 7 个文件、48/48；
- RC build 与 `rc:verify`；
- host source/dist `node --check`；
- fresh dist 的文件集合和字节比对。

两个 clone 的 Chromium 均在 `1440×900` 与 `1280×720` 各 11/11，每个 clone
共 22/22 通过。覆盖两类终局 blocked payload、tick 0 拒绝、complete、普通
blocked、原因边界、模式矛盾、sidecar 篡改、恢复、完整两周下载和清空。

## 确定性 archive

`rc-dist/` 全部条目统一为 UTC `2000-01-01 00:00:00`，按路径排序，以 ustar、
uid/gid 0、owner/group `root`、无 xattrs 和 macOS metadata 生成
`rc-dist.tar`。

| 文件 | SHA-256 |
|---|---|
| `rc-dist/artifact-manifest.json` | `01648a718eecac743aa60e7c94f73f1c71bdfb02086056d15ad4e7104541c407` |
| `rc-dist/rc-build.json` | `1168c752e0324c2a73cb1f89a8a15dd7b9ae04e8bcca1c6074eede4bbb11a58a` |
| `rc-dist/playtest-host.mjs` | `84859a4840b54580162b709d52beacd5fa550ec318c6830d1a8cdb6df1b97f05` |
| `rc-dist.tar` | `6c38cccbb4c315c3d322c111e4303d5ab52e0ded68935290ca7abd907af37157` |

两个 clean clone 分别重建 archive，得到相同 SHA，并与冻结 archive 逐字节一致。

## 正式运行条件

从仓库根目录只允许用 manifest 中冻结的命令启动 loopback host：

```text
node data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc7-01/rc-dist/playtest-host.mjs --host 127.0.0.1 --port 4196 --capture-dir data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc7-01/captures
```

每场必须先核验服务端 raw、SHA sidecar、canonical receipt 与浏览器下载，保存
成功后才允许清空并发放结束访谈：

- 完整场：`captureKind=complete`、tick 2010、两周和两份 recap；
- 阻断场：`captureKind=blocked`、`54<=blockedAtTick=finalTick<=2010`、非空
  原因、`isComplete=false`，包括终局完成状态未生效。

## 正式样本协议

- 主样本：A23–A29；
- 批次：A23–A25、A26–A28、A29；
- 技术无效替补从 A30 开始；
- 运营负责人：当前根 agent `/root`；
- 所有样本使用相同玩家包 V5、结束访谈 V3、RC、host 命令、视口和隔离规则；
- A01–A22 永久保留历史，编号不复用，不进入 RC7 分母。

## 边界

- 当前状态为 `FROZEN_PENDING_INDEPENDENT_REVIEW`；
- A23 前必须由未参与实现和冻结制备的独立 agent 从远端复核；
- #7 保持 `OPEN`，#9 保持 `OPEN`；
- Gate 1H 保持 `PENDING`；
- Gate 2 保持 `LOCKED`；
- Gate 1A 的任何结论均不能解锁 Gate 2。
