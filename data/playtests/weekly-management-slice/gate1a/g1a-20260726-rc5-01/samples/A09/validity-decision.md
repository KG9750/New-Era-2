# A09 有效性与后置治理裁定

## 场内结论

`AS_RUN_VALIDITY=VALID`

- 主样本编号：`A09`
- 原 Issue：#18
- cohort：`g1a-20260726-rc5-01`
- Batch：`Batch 1`
- A09 编号永久保留，不复用
- 本场不是技术无效或协议违规

## 核验结果

- 使用 `fork_turns=none` 的全新 agent 上下文；
- 无先前原型或正式样本暴露，无上下文污染；
- 只通过玩家 UI 操作；
- RC5 全部可见指纹和 `1440×900` 视口一致；
- 首次操作前保留 `INITIAL_OBSERVATION`；
- 完成两周，终局 tick 为 `2010`；
- payload、SHA sidecar 与 receipt 的 63,518 bytes 和 SHA-256 完全一致；
- 保存成功后执行清空并回到“开始匿名新会话”；
- Week 1 有效编辑 `2`，Week 2 有效编辑 `0`。

## 产品症状

A09 在进入第二周后使用化肥。机器证据将 `USE_FERTILIZER` 和
`fertilizer-used` 记录在 `week-1-ended` 与进入第二周之后，且第二周预测从
`12–13` 提升为 `18–19`。但第二周摘要显示“化肥已在第一周使用”。

该症状登记为 `A09-SYM-01 / FERTILIZER_WEEK_ATTRIBUTION_MISMATCH`，
单场严重度建议为 `P2`。它不阻断流程、不破坏导出，也不构成技术无效。

## 后置治理复裁

`COHORT_DISPOSITION=SUPERSEDED_RC_REVOKED_AFTER_SESSION`

A09 于 2026-07-26T13:20:30Z–13:29:19Z 完成，早于 #7 在
2026-07-26T13:40:49Z 撤回 RC5 开跑许可。原场内有效性裁定不变；
本次不是技术无效或协议违规改判。

由于 RC5 cohort 在场次结束后被整体撤回：

- A09 不进入任何七个有效样本分母；
- A09 的编辑、症状和严重度建议只作为 RC5 历史证据保留；
- A09 不参与新 RC 的计数或 P1 聚类；
- A09 编号永久保留，不得复用；
- A10–A15 未实例化，但作为 RC5 历史 roster 不迁入新 cohort。

## 状态边界

- `Gate 1A=RESTART_PENDING_NEW_RC_FREEZE`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
