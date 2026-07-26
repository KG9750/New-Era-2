# Gate 1A RC8 独立冻结复核

## 最终裁定

`RC_FREEZE=YES`

- P0：0
- P1：0
- P2：0

reviewer 未参与 RC8 实现、源码复审或冻结制备，以无历史继承的新 agent
从 GitHub fresh clone 完成完全只读复算。审查未修改仓库、远端、Issue、RC
ref 或 manifest，未启动正式 host 或 player。

## 冻结身份

| 字段 | 复算值 |
|---|---|
| 受审提交 | `36f1d985c2e5cc63b404bc93e6c5ce12bef53676` |
| RC ref | `refs/heads/codex/gate1-rc-20260726.8` |
| RC SHA | `03973fcfc0c244555e7e4a4c623eec3fb8b8e032` |
| RC tree | `341e0de0352181ce84067c45bff99248f03a5b70` |
| source-tree hash | `22133fccaa2459d9d3414a1728fdb332ccdfc344dd126f444b67a3c3224d5adb` |
| manifest SHA-256 | `9897d8ec7b23d33212c753b47a209de604bd148c21ce3677c4bee839e6a679e2` |
| artifact hash | `e0cf7c78251642a54f88845c61aa214e9e91076b3e432fb8399bd873ef0fe49b` |
| archive SHA-256 | `ad963ce348527d588865fc7891e0207859456a61e8fa65a0d4c6bcc1fc10617e` |

RC8 是受审提交的祖先，二者的 39 个 tracked `prototype/` 文件完全一致。
审查开始和结束两次核验远端 ref，均未发生漂移。

## 独立复算

- manifest sidecar 通过，递归提取的 16 个 `path + sha256` 引用全部匹配；
- source-tree 39 个文件、Git tree、blob-path manifest hash 全部匹配；
- 两个 fresh RC clone 均使用 Node `24.18.0`、npm `11.16.0`；
- `npm ci`、`npm audit`、lint、Vitest 7 文件 / 48 项全部通过；
- 两个 clone 的 RC build、`rc:verify` 与冻结 `rc-dist` 逐字节一致；
- Chromium `1440×900` 与 `1280×720` 共 22/22 通过；
- 两个 clone 独立重建的 tar 与冻结 tar 逐字节一致；
- tar 的 8 个 raw header 均为 UTC epoch `946684800`、uid/gid 0、
  `root/root`、ustar、排序路径，且无扩展头、xattr 或 macOS metadata。

## 合同与治理

- 玩家包 V6 未泄露答案、指标阈值、已知缺陷或推荐策略；
- 访谈 V4 只在 capture、浏览器下载和会话清空均核验后释放；
- complete 仍严格要求 tick 2010、完成状态、两周、两份 recap 和唯一
  `export-created`；
- blocked 要求 `54<=blockedAtTick=finalTick<=2010`、未完成状态、连续
  recap、1–240 字原因和唯一 `blocked-capture-created`；
- blocked 保存失败后必须以同一 frozen raw bytes 重试，成功前冻结输入、
  模拟和清空；
- RC7 已预启动历史化，A23–A29 未创建且编号不复用；
- A30–A36 在审查时尚未创建 Issue、player、session、capture 或 sample；
- 正式端口 4197 在审查结束时无 listener；
- Gate 1H=`PENDING`，Gate 2=`LOCKED`，未发现 Gate 2 实现。

## 残余边界

本复核证明 RC8 可以进入 Gate 1A agent proxy，不证明正式 4197 capture 现场、
真实 Chrome 下载交接或任何真人 UX 结论。首个 A30 仍须完成空白会话预检，
每场仍须逐一核验 raw、SHA sidecar、canonical receipt、浏览器下载和清空。
Gate 1A 不能替代 Gate 1H，也不能解锁 Gate 2。
