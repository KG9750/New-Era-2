# Gate 1A RC4 独立冻结复核

## 最终裁定

`RC_FREEZE=YES`

- P0：0
- P1：0
- P2：0

审查员使用 fresh clone 和 GitHub 只读 API，未修改文件或远端状态，未启动任何
A01–A07 会话。

## 核验结果

- RC4 ref 精确指向 `a769877871f232b3722c02a184ccbc3426950887`；
- Git tree 为 `efcc989c7f84883242b9fabe99030feca8c60c0a`；
- 37 个 `prototype/` 文件独立复算 source-tree hash 为
  `59f67b4e698a3f72e54522c5da479da711c252b95d304fda1c7ca714b6a6baf1`；
- fresh build 使用 Node 24.18.0、Vite 8.1.5，`npm ci` 为 0 vulnerabilities；
- artifact hash 为
  `0c84ce60f0fd3305a90fac23fcdfbd47cd67b16a6a0b2b72751da11de6cb6b58`；
- initial-state hash 为 `fnv1a32-33a16fbf`；
- cohort manifest SHA
  `4678db2f881d41777a1824a4e91df9eaaf1e9e7a39d586bbd621c676fd5f93d9`
  及全部引用文件 SHA 均匹配；
- `rc-dist.tar` SHA
  `008ea767eb9bf0dac567cf2917d3c19537d4257585ebfc0f2fcadad61764d01a`
  正确，解包后与 `rc-dist/` 文件集合和字节完全一致；
- fresh build 与冻结 `rc-dist/` 完全一致；
- lint、7 文件 / 46 项测试、`rc:verify` 通过；
- Chromium E2E 在 `1440×900` 与 `1280×720` 共 2/2 通过；
- 玩家包与结束访谈物理分离，访谈只在试玩、下载并清空后发放；
- TECH-A97 有效且明确排除正式分母；
- rc3 的 `RC_FREEZE=NO`、`SUPERSEDED` 和排除记录完整；
- 开发分支晚于 RC4 的提交只包含冻结运营证据，`prototype/` 零差异；
- 审查时 #7、#9–#16 均 OPEN，#9–#16 零评论，无正式样本；
- Gate 1H 为 `PENDING`，Gate 2 为 `LOCKED`，未发现 Gate 2 功能代码。

## 开跑边界

- 允许关闭 #7；
- 允许启动 A01，并按 `3 + 3 + 1` 和逐场封存纪律继续；
- 技术审计 agent 不得改作正式样本；
- Gate 1A 结果不能替代 Gate 1H 或解锁 Gate 2。
