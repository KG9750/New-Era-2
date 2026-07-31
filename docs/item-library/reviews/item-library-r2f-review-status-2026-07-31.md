# 候选物品库 R2-F 审查状态

**日期：** 2026-07-31
**范围：** 采纳决策记录结构 schema、四份空白 draft 模板、只读记录校验器、R2-E 绑定、提交就绪规则与授权边界
**实现验证：** `PASS`
**独立 subagent 首审：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=0`）
**独立 subagent 第二轮复审：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=0`）
**独立 subagent 第三轮复审：** `REVIEW_PASS`（`P0=0 / P1=0 / P2=0`）
**当前状态：** `R2F_REVIEW_PASS`
**运行时授权：** `NONE`

## 1. 当前结论

R2-F 已生成结构 schema 与四份 `template_only / draft` 采纳记录模板，并在本地通过自校验。独立 subagent 首审发现畸形决策 ID 会触发 Ruby backtrace；第二轮复审发现 consumer-origin draft 可预填决定、理由与 evidence。两项 P1 均已按最小范围修正，第三轮全新 subagent 在提交 `2eb6abf0fc7b22bc59985c89631dac04b1ab0a99` 上完成只读复审，未发现真实缺陷。

所有决定、理由和证据槽均未填写；本轮没有 submitted 记录，没有主干采纳、运行时 schema、Gate 变更或真人试玩证据。

## 2. 本地实现结果

```text
ADOPTION_RECORDS=PASS
TEMPLATE_COUNT=4
STABLE_ID_DECISION_SLOT_COUNT=151
ALL_DECISION_SLOT_COUNT=171
UNRESOLVED_DECISION_SLOT_COUNT=171
SUBMITTED_RECORD_COUNT=0
SCHEMA_FILE_SHA256=7a066cd491e382532444a23735213fd5c61f0fd2452b8ed5ff5ac2137062dc50
REPORT_SHA256=2a0eaafcac2d400d864f1f541fe2c1c3ba814c00599d3fe7e37d0143b05c42f3
SOURCE_R2E_REPORT_SHA256=4ad843af92c46409189f93258c6ca0eb319f19e97d2dc32b6361c099d50e3e3d
SUBMISSION_READY=false
RUNTIME_AUTHORIZATION=NONE
```

## 3. 两轮发现与修正

首审结论：

```text
P0=0
P1=1
P2=0
REVIEW_FAIL
```

修正内容：

- 每个决策项的 `id` 必须是非空字符串；
- 派生 selected/rejected 列表只处理字符串 ID，不再对畸形值排序；
- Hash、null 和 Array 三类畸形 ID 必须受控返回 `ADOPTION_RECORD_VALIDATION=FAIL`，不得输出 Ruby backtrace。

第二轮复审结论同为 `P0=0 / P1=1 / P2=0 / REVIEW_FAIL`。修正内容：

- 所有 draft 无论来自 template 还是 consumer，全部决定都必须保持 `unresolved`；
- 所有 draft 的六类 evidence 都必须保持 `null`；
- `consumer_id / target_branch` 为 `null` 仍只作为 template-origin draft 的附加约束。

## 4. 第三轮独立复审

第三轮独立 subagent 只读检查：

1. R2-E 审查门禁是否绑定当前 handoff 报告、计数、R1 与 R2-D SHA；
2. 四份模板是否与四份 manifest 一一对应并完整覆盖所有决策 ID；
3. schema 与 Ruby 校验器的字段、枚举和 draft/submitted 规则是否一致；
4. 模板是否全部 unresolved/null 且派生选择列表为空；
5. submitted 记录是否必须完整决定、提供理由和六类证据，同时仍不获得授权；
6. 非法 ID、缺失/重复决定、伪来源 SHA、错误派生列表和伪 submission_ready 是否被拒绝；
7. schema、模板、report、record 与 source SHA 是否可复算，JSON/Markdown 是否可重建；
8. `template_only / draft / not_adopted / submission_ready=false / NONE` 边界是否不可绕过。

实际结果：

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

审查实际执行 C1–C7、R2-A 至 R2-F 和 71 个独立夹具：12 个正向夹具全部通过，59 个负向夹具全部受控拒绝。四类决定队列的 null、Hash、Array ID 均无 backtrace；所有 consumer draft 预填决定、理由或任一 evidence 均被拒绝；完整 submitted 仍输出 `AUTHORIZATION_GRANTED=false`。独立 `git archive` 副本执行 `--write` 后，schema、JSON 与 Markdown 均与固定提交逐字一致。

## 5. 接受边界

第三轮独立审查已满足 `P0=0 / P1=0` 且不存在冻结阻断项，当前状态为：

```text
R2F_REVIEW_PASS
```

`R2F_REVIEW_PASS` 只表示记录结构、空白模板和校验器满足当前合同，不表示主干已采纳、运行时已授权、Gate 已解锁或真人试玩已完成。
