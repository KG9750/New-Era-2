# Gate 1A RC4 cohort 已作废

## 结论

`g1a-20260726-rc4-01` 已永久作废，不再接收新的正式样本，也不得与后续 cohort
合并计算 Gate 1A 结论。替代候选为 `g1a-20260726-rc5-01`；只有 RC5 独立冻结
复核给出 `RC_FREEZE=YES` 后，才视为正式替代完成。

## 原因

RC4 的首场正式样本 A01 虽完成两周、页面导出回执和结束清空，但浏览器控制层没有
保留匿名 JSON，导致动作、事件、遥测和机器时长无法独立核验。A01 已按冻结合同裁定
为 `INVALID_TECHNICAL`，不是因策略、理解或负面观察而排除。

为消除后续场次相同的证据风险，提交
`2d40aa102bd51107c07cbe176f798a93a37663f3` 增加了 RC 内置 loopback
write-once capture、客户端字节与 SHA 校验、服务端完整终局校验和证据三件套。
这改变了 Git SHA、构建内容和正式运行条件，因此按运营合同第 8.4 节作废整个 RC4
cohort，并从新的七样本 cohort 重新开始。

## 永久保留

- RC4 manifest、archive、冻结审计和独立复核原样保留；
- A01 的 agent 原始输出、样本记录和有效性裁定原样保留；
- A01 编号永久保留，不复用，也不进入任何 RC5 分母；
- A01 原 Issue #10 与 RC4 替补 Issue #17 只用于历史追踪，不转作 RC5 席位；
- RC4 的 `RC_FREEZE=YES` 只证明当时冻结合同成立，不覆盖 A01 后暴露的证据采集风险。

## 状态边界

- `Gate 1A=RC5_FREEZE_PENDING`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
