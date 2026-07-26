# A30 有效性裁定

## 结论

`VALIDITY=VALID`

- 主样本编号：`A30`
- Issue：#32
- cohort：`g1a-20260726-rc8-01`
- Batch：`Batch 1`
- 纳入当前七个有效样本分母
- A30 编号永久保留，不复用

## 协议核验

- agent 使用 `fork_turns=none` 的全新上下文；
- 只收到冻结玩家包 V6 和自己的编号，未读取仓库、Issue、设计、阈值或前序样本；
- 只通过 `1440×900` 浏览器玩家界面操作；
- 首次操作前保留 `INITIAL_OBSERVATION`；
- RC SHA、build、artifact、场景、种子和初态均与 RC8 manifest 一致；
- 完成两周，终局 tick 为 `2010`，`isComplete=true`，有两份连续 recap；
- 唯一 `export-created`，不存在 `blocked-capture-created`；
- 服务端 raw、SHA sidecar、canonical receipt 与浏览器下载的 62,403 bytes
  和 SHA-256 `1cc1e640…` 完全一致；
- 保存成功后清空，并回到“开始匿名新会话”；
- 结束访谈只在保存、浏览器下载与清空均由运营核验后发放；
- Week 1 有效编辑 `1`，Week 2 有效编辑 `0`。

浏览器工具没有暴露 profile UUID，但 A30 使用新 agent 浏览器标签页从空白入口
创建新应用会话；正式样本此前为零，运营预检确认入口 `localStorage` 为空。未
发现跨样本状态或上下文污染，不构成技术无效。

## 产品观察

`A30-SYM-01 / WEEK2_PRESTART_TIME_LABEL_TRANSITION`

进入第二周后、开始运行前，时间标签仍显示“周日 23:00”；点击运行后变为
“第 8 日 23:00”。A30 短暂注意到该切换，但未误操作、未改变策略，也未影响
完成、保存或清空。单场建议为 P2，尚不构成独立 P1 或 Gate 阻断。

## 代理指标原始值

- 完成两周：是；
- 首次观察识别问题数：2；访谈整体能复述 3 个问题；
- 可见预测变化及原因：是；
- 人物与决策影响：是，林禾；
- 地图进入决策：是；
- 地图动作执行：否；
- 第二周完整检查：否；
- 第二周完整重排：否。

上述是单场原始值，不提前计算 Gate 1A 最终结论。

## 状态边界

- `Gate 1A=IN_PROGRESS_1_OF_7_VALID`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
