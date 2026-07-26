# Cohort superseded

`g1a-20260726-rc2-02` 已修正首个 cohort 的玩家包诱导风险，但在 A01 启动前
又由独立冻结复核判定为 `RC_FREEZE=NO`。原因是其冻结 RC 实际使用
Vite 7.3.6，而权威开发计划固定 Vite 8 技术基线。

本目录、原始 manifest、构建归档和审计证据保留且不修改，但不得用于
Gate 1A 正式样本或汇总结论。替代 cohort 为
`g1a-20260726-rc3-01`，其 RC 基于提交
`57621e670e69a2b4c7c283a6614ab1bdefd71ca1`，并继承本 cohort 的
“中性试玩包 → 完成并清空 → 统一结束访谈”两阶段协议。

Gate 1H 保持 `PENDING`，Gate 2 保持 `LOCKED`。
