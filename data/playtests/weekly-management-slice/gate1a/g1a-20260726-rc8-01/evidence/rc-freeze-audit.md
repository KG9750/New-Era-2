# Gate 1A RC8 冻结审计记录

## 结论

`g1-rc-20260726.8` 已修复 RC7 的第二周化肥证据错误，并为 blocked 保存失败
重试补上同 bytes 回归断言，满足进入新的独立冻结复核的技术条件。

本记录不是最终 `RC_FREEZE=YES` 决定，也不是正式代理样本。只有未参与 RC8
实现和本次冻结制备的独立 agent 对远端证据给出 `RC_FREEZE=YES` 后，才允许
创建或启动 A30–A36。

## RC 身份

| 字段 | 冻结值 |
|---|---|
| RC ref | `refs/heads/codex/gate1-rc-20260726.8` |
| Git SHA | `03973fcfc0c244555e7e4a4c623eec3fb8b8e032` |
| Git tree | `341e0de0352181ce84067c45bff99248f03a5b70` |
| source-tree hash | `22133fccaa2459d9d3414a1728fdb332ccdfc344dd126f444b67a3c3224d5adb` |
| source-tree algorithm | `sha256-git-blob-path-manifest-v1` |
| source-tree file count | 39 |
| build ID | `g1-rc-20260726.8` |
| artifact hash | `e0cf7c78251642a54f88845c61aa214e9e91076b3e432fb8399bd873ef0fe49b` |
| initial state | `fnv1a32-33a16fbf` |
| scenario | `gate1-two-week-management` / `0.4.0` |
| fixed seed | `104729` |

## RC7 后置问题的关闭

RC8 在不改变模拟规则和完整/阻断合同的前提下：

- 第二周在 tick 1002 使用化肥时，按动作顺序正确显示“化肥已在第二周使用”；
- blocked 首次保存冻结 raw JSON，409 后重试复用完全相同的 POST bytes；
- 冻结期间禁止改写原因、推进或清空，成功后只下载一次；
- 完整场仍要求 tick 2010、`isComplete=true`、两周、两份 recap 和唯一
  `export-created`；
- 阻断场仍要求 `54<=blockedAtTick=finalTick<=2010`、`isComplete=false`、
  非空 1–240 字原因和唯一 `blocked-capture-created`。

独立代码复审为 `CODE_REVIEW=PASS`、P0=0、P1=0、P2=0。详见
`evidence/rc8-code-review.md`。

## 双 clean clone 复算

两个 clean clone 均从远端提交 `03973fcf…` 构建：

- clone A：`/tmp/new-era-g1a-rc8-a.Apnime/repo`
- clone B：`/tmp/new-era-g1a-rc8-b.DH70n9/repo`

两者均使用 Node `v24.18.0`、npm `11.16.0`，并通过：

- `npm ci`，0 vulnerabilities；
- lint；
- Vitest 7 个文件、48/48；
- RC build 与 `rc:verify`；
- host source/dist `node --check`；
- fresh dist 的文件集合和字节比对。

clone A 的 Chromium 在 `1440×900` 与 `1280×720` 各 11/11，共 22/22 通过。
新增回归覆盖第二周化肥证据和 blocked 409 重试同 bytes；原 complete、blocked、
原因边界、模式矛盾、sidecar 篡改、恢复、完整两周下载和清空均继续通过。

## 确定性 archive

`rc-dist/` 全部条目先在显式 `TZ=UTC` 环境中设置为
`2000-01-01 00:00:00Z`，再按路径排序，以 ustar、uid/gid 0、
owner/group `root`、无 xattrs 和 macOS metadata 生成 `rc-dist.tar`。tar
header epoch 为 `946684800`，不继承制备机本地时区。

| 文件 | SHA-256 |
|---|---|
| `rc-dist/artifact-manifest.json` | `01648a718eecac743aa60e7c94f73f1c71bdfb02086056d15ad4e7104541c407` |
| `rc-dist/rc-build.json` | `ea4a65c0cccc0e590e0d309dd802d80a008bf8b703ba8786725fbf1936882521` |
| `rc-dist/playtest-host.mjs` | `84859a4840b54580162b709d52beacd5fa550ec318c6830d1a8cdb6df1b97f05` |
| `rc-dist.tar` | `ad963ce348527d588865fc7891e0207859456a61e8fa65a0d4c6bcc1fc10617e` |

两个 clean clone 分别重建 archive，得到相同 SHA，并与冻结 archive 逐字节一致。

## 正式运行条件

从仓库根目录只允许用 manifest 中冻结的命令启动 loopback host：

```text
node data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01/rc-dist/playtest-host.mjs --host 127.0.0.1 --port 4197 --capture-dir data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01/captures
```

每场必须先核验服务端 raw、SHA sidecar、canonical receipt 与浏览器下载，保存
成功后才允许清空并发放结束访谈：

- 完整场：`captureKind=complete`、tick 2010、两周和两份 recap；
- 阻断场：`captureKind=blocked`、`54<=blockedAtTick=finalTick<=2010`、非空
  原因、`isComplete=false`，包括终局完成状态未生效。

## 正式样本协议

- 主样本：A30–A36；
- 批次：A30–A32、A33–A35、A36；
- 技术无效替补从 A37 开始；
- 运营负责人：当前根 agent `/root`；
- 所有样本使用相同玩家包 V6、结束访谈 V4、RC、host 命令、视口和隔离规则；
- A01–A29 永久保留历史，编号不复用，不进入 RC8 分母。

## 边界

- 当前状态为 `FROZEN_PENDING_INDEPENDENT_REVIEW`；
- A30 前必须由未参与实现和冻结制备的独立 agent 从远端复核；
- #7 保持 `OPEN`，#9 保持 `OPEN`；
- Gate 1H 保持 `PENDING`；
- Gate 2 保持 `LOCKED`；
- Gate 1A 的任何结论均不能解锁 Gate 2。
