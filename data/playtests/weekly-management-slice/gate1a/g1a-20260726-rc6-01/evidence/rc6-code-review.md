# Gate 1 RC6 独立代码复审证据

## 结论

`CODE_REVIEW=YES`

- P0：0
- P1：0
- P2：1

审查员未参与 RC6 实现，只读检查提交
`affc5d8a0c9664a3724d1c31cb3d67682c818af9` 相对 RC5 的七个
`prototype/` 修改文件。该审查不等同于 cohort 独立冻结复核。

## 通过项

- 未完成会话只允许以 1–240 字非空阻断原因保存 `captureKind=blocked`。
- blocked raw 固定包含 `blockedAtTick`、`isComplete=false` 和唯一
  `blocked-capture-created`；不得混入完整场次的 `export-created`。
- host 要求 `finalTick=blockedAtTick<2010`、非完整状态、已完成周数与 recap
  数一致，并生成带 `captureKind`、`blockedAtTick`、`isComplete` 的 canonical
  receipt。
- 保存前禁止清空；第一次保存后冻结人物操作、速度和时钟。
- 保存失败重试复用 `pendingCaptureRef` 中同一 raw 字符串，不重新生成 marker
  或修改场次状态。
- 完整场次合同保持 tick 2010、两份 recap、`isComplete=true`、唯一
  `export-created`，且禁止 blocked 专属字段。
- 改动只涉及 capture host、capture UI、样式、遥测/导出和公开 E2E 合同；
  未修改模拟规则、场景、Gate 阈值或 Gate 2。

## 唯一 P2

blocked 专属 UI 测试没有再次注入一次 HTTP 失败并逐字节比较首次与重试 POST。
完整场次已有该公开断言，blocked 实现复用同一 `pendingCaptureRef`。建议后续补
一条回归测试，但不阻断 RC6 cohort 冻结。

## 复审边界

本记录只证明代码复审没有 P0/P1。RC6 仍须完成冻结审计、远端 manifest/ref/
archive 复算和独立 `RC_FREEZE=YES`，才允许创建或启动 A16–A22。
