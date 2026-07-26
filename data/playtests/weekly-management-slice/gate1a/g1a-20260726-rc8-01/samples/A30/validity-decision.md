# A30 有效性最终裁定

## 最终结论

`VALIDITY=INVALID_TECHNICAL_CONCURRENT_SESSION_CONTAMINATION`

- 主样本编号：`A30`
- Issue：#32
- cohort：`g1a-20260726-rc8-01`
- Batch：`Batch 1`
- 不纳入当前七个有效样本分母
- A30 编号永久保留，不复用
- 首个替补：`A37`

这不是产品玩法失败。无效原因严格限定为应用会话身份无法归属和并发隔离失效。

## 推翻先前裁定

本文件最初曾在只看到 `A30 / 6e3bad8c…` 三件套和结束访谈时裁定
`VALID`。后续技术审计发现同一 host 同时存在 `M-C / 0809d5c5…`，并取得
受委派 agent 的矛盾陈述，因此先前裁定已被本最终裁定 supersede。旧结论仍在
Git 历史和 `sample-record.json.decisionHistory` 中保留，不能作为当前状态引用。

## 并发证据

| 字段 | A30 标记的 candidate capture | 未授权 M-C capture |
|---|---|---|
| Session | `6e3bad8c-234f-4171-a843-8bd815ea7e6c` | `0809d5c5-8f73-48ca-a25e-0cb73d8dc625` |
| 开始 | `2026-07-26T15:59:25.221Z` | `2026-07-26T16:00:44.511Z` |
| 结束 | `2026-07-26T16:02:43.969Z` | `2026-07-26T16:04:19.103Z` |
| 重叠 | 119,458 ms | 119,458 ms |
| bytes | 62,403 | 63,176 |
| SHA-256 | `1cc1e64092013ea3264558cb2814b2c2bd9a8b404ac32b49d2db3a0f9942b016` | `f6b62ac9cdea9525df8670e679a4a2a0577d3474f2d883ff8cb6bd157bbde2c4` |
| 技术状态 | complete / tick 2010 / 2 recaps | complete / tick 2010 / 2 recaps |

两场时间重叠，不能解释为同一页面先后完成。受委派 agent 的技术审计答复为：

- 只创建和控制了一个 Chrome 游戏标签页；
- 创建前匿名编号默认显示 `M-C`；
- 整场元数据始终显示 `M-C`，从未看到 `A30`；
- 没有创建、控制或看到第二个游戏页面；
- 未收到其他玩家结果或提示。

因此：

1. `A30 / 6e3bad8c…` 虽然三件套技术完整，但不能归属于受委派 agent；
2. `M-C / 0809d5c5…` 只具有 agent 陈述归属，且 `M-C` 被 RC8 manifest
   排除，禁止改名或晋升为 A30；
3. 上述两场均不得进入 Gate 1A 分母；
4. 结束访谈与技术审计关于编号和 Session 的冲突陈述全部保留，但其中的产品
   指标不参与 Gate 汇总。

## 证据处置

- 六个 raw / SHA sidecar / canonical receipt 文件原字节保留；
- `A30` capture 标记为 `UNATTRIBUTED_A30_LABELED_CANDIDATE_CAPTURE`；
- `M-C` capture 标记为 `QUARANTINED_UNAUTHORIZED_CONCURRENT_SESSION`；
- 不删除、不改名、不合并、不从 M-C 补造 A30；
- 产品观察只作为未归属技术证据保留，不形成聚合指标或缺陷计票。

详见
`../../evidence/A30-MC-concurrent-session-incident.md`。

## 后续隔离

A31 及以后每场必须严格串行：重启 4197 host、确认没有旧页面、只允许一个
player agent 和一个游戏页面、场前记录 capture inventory、创建后核对当场
编号、场后只接受一个预期编号的新增三件套。任何第二 session 或非预期编号都
立即暂停并进入技术审计。

## 状态边界

- `Gate 1A=RUNNING_0_OF_7_VALID_A37_PENDING`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
