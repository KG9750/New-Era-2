# Gate 1 RC8 独立代码复审证据

## 结论

`CODE_REVIEW=PASS`

- P0：0
- P1：0
- P2：0

审查员未参与 RC8 候选修复，只读检查
`03973fcfc0c244555e7e4a4c623eec3fb8b8e032` 相对 RC7 的玩家可见证据与测试
改动。该审查不等同于 cohort 独立冻结复核。

## 第二周化肥证据

- `USE_FERTILIZER` 只能成功一次，并按顺序追加至 `actionLog`；
- `UNDO_SCHEDULE` 只撤销日程事务，不删除或重排 `actionLog`；
- 第一周边界 tick 为 1002；进入第二周和同 tick 使用化肥时，动作顺序可区分
  化肥发生在第二周；
- 新代码同时比较 tick 与 action index，正确显示“化肥已在第二周使用”；
- 单测实际经过第一周 recap，在 tick 1002 进入第二周后使用化肥，确认 UI
  显示“化肥已在第二周使用 / 本周已使用化肥，库存为 0”。

## blocked 失败重试证据

- 首次保存时 `pendingCaptureRef` 冻结序列化后的 raw JSON、tick 与 capture kind；
- 409 后不重建 payload，第二次 POST 继续使用同一个 `pendingCapture.rawJson`；
- 冻结期间原因输入、自动推进和清空均禁用，成功前不触发下载；
- 新测试确认两次 POST bytes 完全相同、唯一 `blocked-capture-created`、零
  `export-created`，成功后只下载一次并启用清空。

## 作用域与回归

候选提交只修改：

- `prototype/src/app/App.tsx`
- `prototype/tests/App.test.tsx`

未修改模拟 reducer、数值、场景、Gate 阈值、capture host 或 Gate 2。
使用 Node 24.18.0 的独立回归结果：

- lint：PASS；
- Vitest：7 files / 48 tests PASS；
- RC build / verify：PASS；
- Chromium 1440×900：11/11；
- Chromium 1280×720：11/11；
- 总计：22/22；
- `git diff --check`：PASS。

残余风险仅为测试分层：第一周已使用和第二周仍未使用的两条 UI 文案没有各自
单独断言，但对应分支无状态变更，且 actionLog/reducer 不变量已确认，不构成
P2。

## 边界

本记录只证明 RC8 代码复审没有 P0/P1/P2。RC8 仍须完成 cohort manifest、
archive 复算和独立 `RC_FREEZE=YES`，才允许创建或启动 A30–A36。
