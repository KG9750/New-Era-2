# Gate 1A RC8 最终代理验证报告

| 字段 | 值 |
|---|---|
| cohort | `g1a-20260726-rc8-01` |
| manifest SHA-256 | `9897d8ec7b23d33212c753b47a209de604bd148c21ce3677c4bee839e6a679e2` |
| build | `g1-rc-20260726.8` |
| RC Git SHA | `03973fcfc0c244555e7e4a4c623eec3fb8b8e032` |
| artifact SHA-256 | `e0cf7c78251642a54f88845c61aa214e9e91076b3e432fb8399bd873ef0fe49b` |
| 场景 | `gate1-two-week-management / 0.4.0` |
| 种子 / 初态 | `104729 / fnv1a32-33a16fbf` |
| 协议 | `gate1a-agent-proxy-v6` |
| 玩家包 | `gate1a-neutral-player-packet-v6` |
| 结束访谈 | `gate1a-post-session-interview-v4` |
| 视口 / 输入 | `1440×900 / Chrome UI mouse and keyboard only` |
| 汇总证据基线 | `7d85df7fbf4b29f40ccf28127fd27fdca2b468fe` |
| 最终结论 | `AGENT_PROXY_FAIL` |
| Gate 1H | `PENDING` |
| Gate 2 | `LOCKED` |

## 1. 结论

RC8 的 Gate 1A 最终裁定为：

`AGENT_PROXY_FAIL`

七个有效 agent 样本均完成两周、保存、浏览器下载、逐字节证据核验、清空和
冻结访谈 V4。摘要识别、预测解释、人物影响、第二周继承和地图决策均通过
冻结阈值；失败的决定性原因是两周有效编辑密度：

- Week 1 有效编辑中位数：`2`，目标 `3–5`；
- Week 2 有效编辑中位数：`0`，目标 `3–5`。

两项独立计数指标同时失败，且差距超过“仅一项、仅差一个 agent”的
`AGENT_PROXY_CONDITIONAL` 范围，因此不能给出 conditional 或 pass。

这不是 Gate 1H 或真人 UX 结论。没有生成真人乐趣、情绪、认知负担、继续
游玩意愿、真人用时或真人原话。

## 2. 样本、批次与替补

| 执行段 | 样本 | 最终状态 |
|---|---|---|
| Batch 1 | A30 | `INVALID_TECHNICAL_CONCURRENT_SESSION_CONTAMINATION`，永久排除 |
| Batch 1 | A31 | `VALID` |
| Batch 1 | A32 | `VALID` |
| Batch 2 | A33 | `VALID` |
| Batch 2 | A34 | `VALID` |
| Batch 2 | A35 | `VALID` |
| Batch 3 | A36 | `VALID` |
| Replacement 1 | A37 | `VALID`，替补 A30 |

最终分母固定为 A31–A37，共 `7/7` 个有效样本。A30 的原始证据和并发污染
裁定永久保留，但不进入阈值计算，也不把技术污染记作产品失败。

## 3. 原始证据索引

每个样本目录均包含 `sample-record.json`、`validity-decision.md` 和
`agent-verbatim-output.md`；captures 目录保存服务端 raw、SHA sidecar 与
canonical receipt。下表 SHA-256 同时匹配服务端 raw 与浏览器下载。

| 样本 | Issue | Session | bytes | raw / download SHA-256 |
|---|---:|---|---:|---|
| A31 | #33 | `f9e86c89-f669-46ea-9d80-107062deb67a` | 64,904 | `c6f1ca46ca42dfd535ccef755b2a7bc5d68907e4dd4b3f0a1306f5967624ed16` |
| A32 | #34 | `d561d15a-c02a-4b7b-9677-37335b63effe` | 63,246 | `c379be96dff1989bb8c9de03cda1f911fdbf4f68b3d3b0eeb9517d88ad5e5414` |
| A33 | #35 | `b9f37d56-7a5a-42b3-9188-cda1e52ab365` | 62,493 | `d8f1130f977020eab71a49eda3b69b18461eeacf2a0db1c69d28ecb78f09a7d9` |
| A34 | #36 | `8d9c74ab-ccc0-4655-8b8c-d185cdb3eb92` | 64,483 | `ae6a42443270c17fe92cbdcd85384ff7ee58a3e7d7c234b36196273ece101115` |
| A35 | #37 | `90ec180b-bb7d-4f51-9338-b6e4f3f9faf1` | 64,903 | `4c676f24c2c576494ccb3e7f80fdca3cab1f0af4044e2e9d5861208d51270b7b` |
| A36 | #38 | `657ff8b3-8d9d-4414-9ea0-381a44849ab1` | 62,752 | `a8e5250e4de3b6737c2de560296f9e0bb00de3c21607b34f0f79d63920f97a2d` |
| A37 | #39 | `5be20eb7-504c-452d-a212-4bbfdc5d392c` | 63,485 | `7fc68d63d0691499022fe93ee1fe31ec070d8ea8cc86999451b5f01afe7107a1` |

七场均满足：

- RC8 build、Git SHA、artifact、场景、种子、初态和视口一致；
- `finalTick=2010`、`isComplete=true`、`completedWeekCount=2`、两份 recap；
- 服务端 raw、SHA sidecar、receipt 和浏览器下载一致；
- 保存与下载核验成功后才清空，清空后才发放 V4；
- agent 使用全新上下文，未接收其他样本结果或 Gate 阈值。

## 4. 冻结阈值复算

| 冻结指标 | 实际结果 | 阈值 | 判定 |
|---|---:|---:|---|
| 有效且指纹、隔离合规 | 7/7 | 7/7 | PASS |
| 三问题复述 + 两周完成 + 导出 | 7/7 | ≥6/7 | PASS |
| Week 1 有效编辑 | `3,1,1,2,3,2,2`，中位数 `2` | 中位数 3–5 | **FAIL** |
| Week 2 有效编辑 | `1,0,0,1,1,0,0`，中位数 `0` | 中位数 3–5 | **FAIL** |
| W2 未完整检查且未完整重排 | 7/7 | ≥6/7 | PASS |
| 能解释预测变化 | 7/7 | ≥6/7 | PASS |
| 能复述人物影响 | 7/7 | ≥6/7 | PASS |
| 地图进入决策 | 7/7 | ≥5/7 | PASS |
| 实际执行地图动作 | 5/7 | 无独立冻结阈值 | 诊断值 |
| 未解决 P0 | 0 | 0 | PASS |
| 同根因独立 P1 | 0 | <3 | PASS |

机器原始候选编辑序列为：

- Week 1：`4,1,1,3,4,2,2`；
- Week 2：`0,0,0,0,0,0,0`。

A31、A34、A35 在 tick 1002 换周后执行的第二周日程编辑被机器误归为 Week 1。
运营依据换周动作顺序和第 8 日目标格执行 override，得到正式序列；纠正后两个
周中位数仍分别为 2 和 0。

## 5. 逐样本代理指标

| 样本 | W1 编辑 | W2 编辑 | 三问题 | 预测 | 人物 | 地图进入 | 地图动作 | W2 完整检查/重排 |
|---|---:|---:|---:|---|---|---|---|---|
| A31 | 3 | 1 | 3 | 是 | 是 | 是 | 是 | 否 / 否 |
| A32 | 1 | 0 | 3 | 是 | 是 | 是 | 否 | 否 / 否 |
| A33 | 1 | 0 | 3 | 是 | 是 | 是 | 否 | 否 / 否 |
| A34 | 2 | 1 | 3 | 是 | 是 | 是 | 是 | 否 / 否 |
| A35 | 3 | 1 | 3 | 是 | 是 | 是 | 是 | 否 / 否 |
| A36 | 2 | 0 | 3 | 是 | 是 | 是 | 是 | 否 / 否 |
| A37 | 2 | 0 | 3 | 是 | 是 | 是 | 是 | 否 / 否 |

## 6. 缺陷与根因聚类

- `P0=0`
- `P1=0`
- 系统性 P2 根因聚类：`2`
- P2 有效样本发生次数：`7`

| 根因聚类 | 有效独立复现 | 严重度 | 影响 |
|---|---:|---|---|
| `WEEK2_PRESTART_TIME_LABEL_TRANSITION` | 4：A33、A34、A36、A37 | P2 | 第二周页面已切换但暂停时钟仍显示周日 23:00；未造成阻断或误操作 |
| `CANDIDATE_EDIT_WEEK_ATTRIBUTION_AT_BOUNDARY` | 3：A31、A34、A35 | P2 | tick 1002 后的第二周编辑被机器记入第一周；需运营 override，不影响玩法完成 |

两个聚类均为系统性 P2，不存在独立 P1，因此不触发“同一根因包含 3 个或以上
独立 P1”的失败条件。复现频率提高修复优先级，但不自动提高影响等级。

## 7. 支持与反对 RC8 的证据

支持证据：

- 7/7 完成两周、保存、下载和清空；
- 7/7 能复述三个问题、解释预测变化、指出人物影响；
- 7/7 没有在第二周完整检查或重排全部日程；
- 地图进入决策 7/7，实际地图动作 5/7；
- 无 P0、无 P1，计划—预测—事件—复盘因果成立。

反对且具有决定性的证据：

- Week 1 与 Week 2 有效编辑中位数均低于冻结目标；
- 第二周中位数为 0，多数 agent 只处理人物请求、物资等例外，没有形成目标
  要求的 3–5 次有效计划编辑；
- Week 1 需要至少两个额外样本达到 3 次编辑，Week 2 需要至少四个样本达到
  3 次编辑，差距远超 conditional 范围。

## 8. 后续边界

1. RC8 不得作为已通过候选交给 Gate 1H；
2. Gate 1H 保持 `PENDING`，其真人样本、用时、情绪与乐趣均未验证；
3. Gate 2 保持 `LOCKED`；
4. 是否修改交互、编辑定义或数值，需要项目 Owner 另行授权；
5. 任何影响决策的修复都必须形成新 RC、新 cohort，并从头取得七个全新独立
   agent 样本，不能局部补测升级旧结论。
