# RC6 cohort 历史化说明

`g1a-20260726-rc6-01` 的开跑许可已被后置 P1 撤回，不得继续启动样本，也不得
与后续 cohort 合并计算。

后置独立只读复核发现，RC6 capture host 会拒绝两类合法终局产品阻断：

1. `blockedAtTick=2010 / isComplete=false / completedWeekCount=0`；
2. `blockedAtTick=2010 / isComplete=false / completedWeekCount=2 /
   recap=[0,1]`。

第二类代表两份复盘已经形成、唯独完成标志未生效的终局状态转换故障。RC6
冻结记录只验证了 `blockedAtTick<2010`，因此不能证明所有原型自身可复现阻断
都能保留 raw、SHA sidecar 和 canonical receipt。

历史处置：

- A16–A22 只有 #25–#31 Issue 席位，没有实例化 player agent、应用会话、
  capture 或正式样本；
- #25–#31 固定为 `CLOSED + wontfix`；
- A16–A22 编号永久不复用；
- RC7 从 A23–A29 建立全新七样本 roster，替补从 A30 开始。

RC6 的 ref、构建、manifest、玩家包、代码复审和冻结审查记录均原样保留。原
`RC_FREEZE=YES` 只作历史，不得重新引用为开跑许可。

状态边界：

- Gate 1A：`RESTART_PENDING_RC7_FREEZE`
- Gate 1H：`PENDING`
- Gate 2：`LOCKED`
