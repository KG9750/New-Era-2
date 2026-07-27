# TECH-RC9-D02 技术无效裁定

## 结论

`VALIDITY=INVALID_TECHNICAL`

`REASON=UNRECOVERABLE_FIRST_SESSION_EVIDENCE_LOSS_AND_RESTART_CONTAMINATION`

- candidate attempt：`C01`
- sample：`TECH-RC9-D02`
- Issue：#49
- 编号永久保留，不复用
- 不进入五场诊断中位数
- 不进入 Gate 1A 或 Gate 1H 正式分母

## 为什么最终完整 raw 仍不能使样本有效

最终导出的第二局本身完整：

- `tick=2010`、`isComplete=true`、两份 recap；
- raw、sidecar、receipt、browser download 均为 69,305 bytes；
- SHA-256 均为
  `a4eddcf7028ea617595c643e0712556dcf5876b49c029745dd831394ade99965`。

但 agent 在第一局已经推进到第二周。其 Playwright 定位等待超时后，node REPL
内核被重置，浏览器句柄与第一局证据全部丢失；新浏览器只能看到新会话入口。agent
随后用同一 `TECH-RC9-D02` 和同一确定性初态重开第二局并导出。

因此：

1. 第一局核心证据不可核验；
2. 第二局开始时，agent 已经看过同一 candidate 的第一周和部分第二周；
3. 最终 agent 与应用会话不再共同满足“全新且相互隔离”；
4. 不能把第二局的完整证据包装成首次盲诊断。

这属于协议允许的技术无效理由：不可恢复工具故障造成证据丢失，并产生上下文污染。

## 迟发首次观察

agent 在已进入第二周后才发送：

> 我认为最需要先处理的是水泵的预防检修缺口并把维修责任落到具体成员；如果不处理，水泵逾期会同时压低粮食产出和维修保障，还可能把维修欠账带到下一周。

该内容作为 `LATE_OBSERVATION` 保留，不倒填为首次修改前证据。

## 仅作诊断的人工计数

以下值完整保留，但永久排除五场中位数：

- `legacyEffectiveEdits`：Week 1=`1`，Week 2=`1`；
- `effectiveManagementCommitmentsV2`：Week 1=`3`，Week 2=`1`。

V2 四组分别为：

- Week 1：维修责任日程、南侧短通路、使用化肥；
- Week 2：接受林禾学习请求。

第二周额外把乔磐休息改为维修，但 raw 没有为此生成合格的独立 v2 choice set，
运营负责人不得补记。

## 产品与流程

- 最终第二局无原型阻断；
- 无 CTA-only 承诺；
- 无同意图重复堆数；
- 无必须点完卡片；
- 产品 P0/P1/P2 均为 0；
- 技术无效不等于候选产品缺陷，也不能转化为有效样本。

## 状态边界

- `Gate 1A=DIAGNOSTIC_ATTEMPT_REJECTION_PENDING`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
