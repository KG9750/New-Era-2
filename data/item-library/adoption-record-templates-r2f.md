# 候选物品库 R2-F 采纳决策记录模板

**来源 R2-E 报告：** `4ad843af92c46409189f93258c6ca0eb319f19e97d2dc32b6361c099d50e3e3d`
**Schema 状态：** `reference_only`
**记录状态：** `template_only`
**提交就绪：** `false`
**运行时授权：** `NONE`
**报告 SHA-256：** `2a0eaafcac2d400d864f1f541fe2c1c3ba814c00599d3fe7e37d0143b05c42f3`

## 1. 结论

- `ADOPTION_RECORDS=PASS`
- `TEMPLATE_COUNT=4`
- `STABLE_ID_DECISION_SLOT_COUNT=151`
- `UNRESOLVED_DECISION_SLOT_COUNT=171`

四份模板均为未填写 draft。结构校验通过不代表主干采纳、运行时授权或 Gate 通过。

## 2. 模板概览

| 模板 | 候选 ID | 校准决定 | 异常确认 | 质量复核 | 未解决 | 提交就绪 |
|---|---:|---:|---:|---:|---:|---|
| `template.r2f.civic_domestic` | 30 | 3 | 1 | 0 | 34 | `false` |
| `template.r2f.industry_maintenance` | 48 | 3 | 1 | 0 | 52 | `false` |
| `template.r2f.security_low_tech` | 32 | 3 | 2 | 1 | 38 | `false` |
| `template.r2f.survival_medical` | 41 | 4 | 1 | 1 | 47 | `false` |

## 3. 固定边界

- 所有决定均为 `unresolved`；
- 所有 evidence 均为 `null`；
- `record_origin=template`；
- `record_status=draft`；
- `adoption_state=not_adopted`；
- `runtime_authorization=NONE`；
- 本轮没有 submitted 记录。

## 4. 验证命令

    ruby scripts/validate_item_library_adoption_records.rb --write
    ruby scripts/validate_item_library_adoption_records.rb
    ruby scripts/validate_item_library_adoption_records.rb --record path/to/record.json
