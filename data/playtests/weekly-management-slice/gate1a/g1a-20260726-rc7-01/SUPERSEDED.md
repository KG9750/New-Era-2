# RC7 cohort 历史化说明

`g1a-20260726-rc7-01` 在正式样本启动前作废，不得创建或启动 A23–A29，也不得
把其冻结材料重新引用为开跑许可。

## 作废原因

RC7 的独立冻结复核发现两项问题：

1. `rc-dist.tar` 的制备说明声称条目时间为 UTC `2000-01-01T00:00:00Z`，
   实际 tar header 继承了制备机时区并记录为 UTC
   `1999-12-31T16:00:00Z`，跨时区不可复现；
2. blocked 保存失败重试虽在实现中冻结 payload，但缺少专属的同 bytes 回归
   断言。

UTC archive 配方后来曾在提交 `8984d76` 中作历史修正：在显式 `TZ=UTC`
下设置全部条目 mtime，得到 archive SHA-256
`f849b14a26673ea6b50f58d32c53a00282de780323cfcd4845b93570101c1b89`，
header epoch 为 `946684800`。该提交没有进入当前远端主线。

随后候选提交 `03973fcfc0c244555e7e4a4c623eec3fb8b8e032` 又修复了第二周使用
化肥时界面仍误写“第一周使用”的玩家可见证据，并为 blocked 失败重试加入
两次 POST bytes 完全相同的回归测试。远端提交 `dd94419` 曾用该最终源重建
RC7 archive 并把 RC7 ref 更新到 `03973fc`；但这会在玩家可见 UI 已改变后
复用同一 RC/cohort 标识，无法与先前已审计失败的 RC7 身份清晰区分。

因此 `dd94419` 的 RC7 重建只保留为历史证据，不恢复 A23–A29 开跑许可。
正式候选改用新的 RC8 ref、build ID、cohort、端口、玩家包和样本编号；RC8
archive 使用显式 UTC 配方并由双 clean clone 独立复算。

## 历史处置

- A23–A29 只存在于 RC7 冻结 manifest，未创建 GitHub Issue；
- 未实例化 player agent、应用会话、capture 或正式样本；
- A23–A29 编号永久不复用；
- RC8 从 A30–A36 建立全新七样本 roster，技术无效替补从 A37 开始；
- RC7 的 ref、构建、manifest、玩家包、代码审查和冻结审计原样保留，只作历史。

状态边界：

- Gate 1A：`RESTART_PENDING_RC8_FREEZE`
- Gate 1H：`PENDING`
- Gate 2：`LOCKED`
