# TECH-RC9-D01 诊断有效性与人工裁定

## 结论

`VALIDITY=VALID_DIAGNOSTIC`

- candidate attempt：`C01`
- sample：`TECH-RC9-D01`
- Issue：#49
- 两周完整完成：是
- 诊断用途：只用于 C01 盲诊断，永久排除 Gate 1A 与 Gate 1H 正式分母
- 编号永久保留，不复用

## 证据链

- agent 使用 `fork_turns=none` 的全新上下文；
- agent 只收到中性玩家包、D01 编号和候选入口；
- 候选会话创建前发生两次浏览器启动故障，但未打开候选页、未创建应用会话；
- 恢复后使用全新隔离的 Playwright browser/context/page；
- source、build、artifact、场景、种子和初态与 C01 manifest 一致；
- 完成两周，终局 `tick=2010`、`isComplete=true`、两份 recap；
- 服务端 raw、SHA sidecar、canonical receipt 与浏览器下载均为 68,660 bytes，
  SHA-256 `9a4bf63e493e1117539f556023412b7abc8c683ca3c1e45b9309f6574835e34c`；
- 保存与下载核验后清空，清空后才发统一访谈。

## `legacyEffectiveEdits` 人工裁定

- Week 1：`1`
  - `legacy:w0:transport-route` / `action-0004`：开启南侧短通路；
- Week 2：`1`
  - `legacy:w1:lin-he-study` / `action-0008`：接受林禾学习请求。

机器 legacy 候选与人工裁定一致。维修日程不在 legacy 白名单内，不补记。

## `effectiveManagementCommitmentsV2` 人工裁定

- Week 1：`2`
  - `w0:repair-responsibility:pump-incident-day-3` / `action-0002`；
  - `w0:transport-route` / `action-0004`。
- Week 2：`2`
  - `w1:character-request:lin-he-study` / `action-0008`；
  - `w1:asset-use:fertilizer` / `action-0009`。

四组均有至少两个可达、后果可见且未被严格支配的选项；agent 明确选择，最终投影
相对 before 持久改变，后果在预测、日程、人物记录、库存、地图或 recap 中兑现。
没有 CTA-only 承诺，没有同意图重复堆数，也没有撤销后伪保留。

## 反刷与流程观察

- 没有必须点完卡片才能运行；
- 第二周没有完整检查或完整重排；
- agent 能说明一次预测变化、一名人物影响和地图动作；
- 第一周额外补足水泵检修块，但该动作没有合格的独立 v2 choice set，运营负责人
  不得补记 raw 候选组之外的管理承诺。

## 症状

- `D01-SYM-01 / POST_COMMIT_COMPARISON_REMAINS_VISIBLE`：提交后比较控件仍显示，
  未测试重复点击，暂记 P2 观察；
- `D01-SYM-02 / RESOLVED_REQUEST_SUMMARY_TITLE_STALE`：请求已回应后摘要标题仍称
  “待回应”，卡片状态已正确，暂记 P2；
- `D01-SYM-03 / SCHEDULE_LABEL_BLOCK_ID_MISMATCH`：人类日程标签与导出 block ID
  被 agent 视为不一致，暂记 P2。

本场无 P0、无 P1、无原型阻断。单场 `2/2` 不提前判定五场中位数。

## 状态边界

- `Gate 1A=PRE_DIAGNOSTIC`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
