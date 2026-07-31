# 候选物品库 R2-E 审查状态

**日期：** 2026-07-31
**范围：** 四份主干消费交接 manifest、显式稳定 ID allowlist、默认排除面、供应接口、采纳决策队列、上游哈希绑定与接受边界
**实现验证：** `PASS`
**独立 subagent 首审：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=0`）
**独立 subagent 第二轮：** `REVIEW_FAIL`（`P0=0 / P1=0 / P2=1`）
**独立 subagent 第三轮：** `REVIEW_PASS`（`P0=0 / P1=0 / P2=0`）
**最终状态：** `R2E_REVIEW_PASS`
**运行时授权：** `NONE`

## 1. 当前结论

R2-E 已生成四份 `reference_only` 主干消费交接 manifest，并在本地通过生成器自检。独立 subagent 首审发现一项 P1：R2-D PASS 门禁没有把当前选择报告 SHA 与审查状态文档中已认证的报告 SHA 绑定；第二轮确认 P1 已修复，同时发现本状态文档手工记录的 R1 Bundle SHA 被截断。两项均已按最小范围修正，第三轮全新 subagent 在提交 `108a8858acee2e6dff9c209705fec1dbd3306a7c` 上完成只读复审，未发现真实缺陷。

R2-E 没有创建主干采纳记录、运行时 schema 或导入包，也没有修改 R1、采纳 R2-C 数值、改变 R2-D 选择、改变 Gate 或替代真人试玩。

## 2. 本地实现结果

```text
CONSUMER_HANDOFF=PASS
MANIFEST_COUNT=4
UNIQUE_EXPLICIT_ID_COUNT=107
UNIQUE_DEFAULT_EXCLUDED_ID_COUNT=35
REPORT_SHA256=4ad843af92c46409189f93258c6ca0eb319f19e97d2dc32b6361c099d50e3e3d
R1_BUNDLE_FILE_SHA256=32f9d9c41e7271e4da0f037167ad94023d050ee1b7471fdec98495393d9ff361
R1_PAYLOAD_SHA256=02918459ef17e42ed5e2151660873f6a4e88e12dff29730a013f1d062fe554ad
R2D_REPORT_SHA256=31fd6fe6d0ba1ec2901b053ed341e7d08ee5c83eeb2549e7d198b950df1edbec
ADOPTION_STATE=not_adopted
RUNTIME_AUTHORIZATION=NONE
```

四份 manifest：

- `handoff.r2e.survival_medical`；
- `handoff.r2e.industry_maintenance`；
- `handoff.r2e.security_low_tech`；
- `handoff.r2e.civic_domestic`。

## 3. 首审发现与修正

首审结论：

```text
P0=0
P1=1
P2=0
REVIEW_FAIL
```

修正内容：

- 唯一、精确解析 R2-D“本地实现结果”代码块；
- 将 `REPORT_SHA256`、R1 文件 SHA、Payload SHA、包数、根数和两类联合节点数全部绑定到当前输入；
- 新增过期、缺失、重复和 fenced 伪报告 SHA 负向回归；
- 当前 R2-D JSON 即使内部自洽，只要不是审查状态文档认证的报告，也必须拒绝。

第二轮复审结论：

```text
P0=0
P1=0
P2=1
REVIEW_FAIL
```

第二轮确认首审 P1 修正有效；唯一 P2 是本状态文档的 R1 Bundle SHA 被截断为 33 位。现已替换为生成器与实际文件共同给出的完整 64 位 SHA，不修改任何机器报告或选择内容。

## 4. 第三轮独立复审

第三轮全新 subagent 只读检查了：

1. R2-D 审查门禁是否只能接受权威顶部元数据和第三轮 PASS 结论；
2. 每份显式选择是否与对应 R2-D 推荐路径逐字相等；
3. 默认排除面是否逐字继承且与 allowlist 不相交；
4. 根、供应行、指定与顺带生产者是否都位于正确类型和选择面；
5. R2-B/R2-C 决策队列是否无漏项、误传播或伪造决定；
6. manifest、总报告和所有上游 SHA 是否可独立复算；
7. `candidate_only / reference_only / not_adopted / blocked / NONE` 边界是否不可绕过。

复审结果：

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

第三轮另外使用合法稳定 ID 替换 civic 权利根并由 R2-D 生成器完整重建，确认 R2-E 会拒绝未经审查状态文档认证的新报告；四份 manifest、供应行、风险队列、阻塞项和全部 SHA 均可独立复算。

## 5. 接受边界

最终状态：

```text
R2E_REVIEW_PASS
```

`R2E_REVIEW_PASS` 只表示交接清单满足当前合同并可确定性复算，不表示主干已采纳、运行时已授权、Gate 已解锁或真人试玩已完成。
