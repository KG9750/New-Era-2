# RC5 cohort 历史化说明

`g1a-20260726-rc5-01` 已被 RC6 替代，不得继续启动新样本，也不得与后续
cohort 合并计算。

原因：独立后置审查确认 RC5 只能保存完整两周场次。若原型自身在中途产生可复现
阻断，RC5 无法保存 raw JSON、SHA sidecar 和 canonical receipt，可能把真实
负面 P0 误判为技术无效，形成选择偏差。

历史处置：

- A09 已发生，场内有效性裁定不在本文件重写；cohort disposition 固定为
  `SUPERSEDED_RC_REVOKED_AFTER_SESSION`，不进入 RC5 或后续 cohort 的七样本
  分母，也不参与后续 P1 聚类；
- A10–A15 未启动；
- #18–#24 作为 RC5 历史席位保持 `CLOSED + wontfix`；
- A01–A15 编号永久不复用；
- RC6 从 A16–A22 建立全新七样本 roster，替补从 A23 开始。

RC5 的 ref、构建、manifest、玩家包、审查记录和 TECH-P98 证据均原样保留。
本说明不把 RC5 技术证据改写为 RC6 证明。

状态边界：

- Gate 1A：`RESTART_PENDING_RC6_FREEZE`
- Gate 1H：`PENDING`
- Gate 2：`LOCKED`
