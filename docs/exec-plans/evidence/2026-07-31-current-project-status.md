# Project-004 New Era 2 当前状态对账

| 字段 | 值 |
|---|---|
| 对账日期 | 2026-07-31 |
| 对账范围 | 本地入口、远端 refs、GitHub Issues、C04/C05 临时治理现场 |
| 当前结论 | `NOT_READY_FORMAL_COHORT` |
| Gate 1H | `PENDING / DEFERRED` |
| Gate 2 | `LOCKED` |

## 1. 产品与实现

- 概念设计 V0.4 是当前设计主线，但尚未冻结为正式 GDD。
- Gate 0 已 `PASS`；它只证明验证合同成立。
- React + TypeScript + Vite 两周经营灰盒、纯 TypeScript 模拟内核、测试与
  匿名导出已经存在，但尚未形成当前可用于正式 cohort 的冻结 RC。
- `main@428b5ff329888bb8016408c6b519542d042285ae` 仍只到概念设计 V0.4；
  实现与证据分布在功能、RC9 和临时治理分支。

## 2. C04 最终处置

最终有效身份：

```text
plan_ref=441f7d96635e9176c8aea3ff21454d596c287c49
source=3f2b7c4b22055b3e1d9076e65abd0ed00271c528
integration=f181340cfebb0434bb977296f483328e32dda171
phase6_evidence=df3cc72a03b522098e3836dae66aac443f758c92
rejection=d9b0d6a3c3d333011a4bef34d0bc91ee17c96b40
```

Source 与 Integration Phase 6 的 Vitest `387/387`、RC E2E `26/26` 和独立
复审继续有效，但唯一 P07 场次在浏览器 context/page/application session
创建前因 `PLAYWRIGHT_CHROMIUM_ICU_DATA_UNAVAILABLE` 失败。冻结合同禁止重跑，
因此最终处置为：

```text
C04=REJECTED_PRE_DIAGNOSTIC
P07=TECHNICAL_EXECUTION_FAILURE_CONSUMED
P08=NOT_STARTED_CONSUMED_BY_ATTEMPT_FAILURE
D16-D20=NOT_STARTED_CONSUMED_BY_ATTEMPT_FAILURE
CM01=UNALLOCATED
output_ref=UNSET
```

## 3. C05 当前边界

```text
plan_only_ref=8eff11ea4b5b9c6b017c690610d16a0574503300
X5=UNSET
C05/S5/I5/E5=UNSET
P09/P10/D21-D25=UNALLOCATED_NOT_STARTED
FORMAL_RC_REF=MISSING
COHORT_MANIFEST=MISSING
```

X5 V3 executable-contract 提案虽然得到 Owner hash-bound preauthority，但两份
独立复审均存在 P1/P2 findings，因此发布条件未满足。后续 CLI 隔离诊断只证明
外部 Terminal 能捕获 `codex-cli 0.146.0-alpha.3.1`；原始证据没有持久化为可逐
字节复算的文件，不能升级为 executable-contract PASS。

文件化 version diagnostic V3 随后获得
`C05_CODEX_VERSION_DIAGNOSTIC_EXTERNAL_EVIDENCE_PREAUTH_V3`，绑定 plan
SHA-256 `54f33e8df794b1a303c9d1bf28e78a47f45d5ab64043b4987a0f66785381077b`
及 transitive script SHA-256
`1db7c150762d6a826ad6695ffd0e780799ce955976ca9104dc02b2b70711438a`。
唯一独立 pre-run review 结论为 `P0=0 / P1=2 / P2=0 / FAIL`：代码没有机械
绑定实际 plan 文件、`/usr/bin/env` 与完整 outer argv；部分异步 stream/signal/
process-group 异常也可能在 authority/root 已消费后绕过 durable FAIL receipt。
因此 V3 未执行、输出根保持缺席，原 plan/script 不得执行或原地修补。

后继 V4 绑定 plan SHA-256
`91effe82b788abb30f14258e42ccd9cf5a7b5aa235a719eec23de4fe95e9e272`
与 script SHA-256
`e1cb29c8d7a7bdc48d0bd525df7f1a55e9e0485fa4c28a3cd35db83f3ebe4ffc`。
其唯一 pre-run review 结论为 `P0=0 / P1=3 / P2=0 / FAIL`：完整可观察
Node argv 仍未覆盖 `process.execArgv/process.argv0`；root creation/setup 失败
阶段可能被误写为 `PRECHECK_FAIL`；terminal sink 异常无法保证一行输出。
固定 Node 24 的 `node --check` 也被审查沙箱以 `operation not permitted`
拒绝，不能记为 syntax PASS。V4 正文未运行，`-04` 输出根保持缺席。

任何后续工作必须依次满足：

1. 以全新 plan/script binding 修复 V4 的三项 P1，并为固定 Node 24
   `node --check` 提供可执行但不启动脚本正文的审查环境，再取得新的独立
   hash-bound preauthority；
2. 新版 pre-run review 达到零 finding 后，才允许零污染执行并保存 raw evidence；
3. 修正 X5，获得双零 finding 复审；
4. 发布 X5；
5. Owner 另行签发绑定 X5 commit 的 `C05_IMPLEMENTATION_AUTHORITY`；
6. 创建 S5/I5 并执行冻结 Phase 6；
7. 串行执行 P09、P10、D21–D25；
8. 通过后才允许讨论 CM01、独立复核、seal、正式 RC 与 cohort。

## 4. Gate 矩阵

| 层级 | 状态 | 不得误写为 |
|---|---|---|
| Gate 0 | `PASS` | 玩法或玩家验证通过 |
| 自动/代理验证 | 有大量有效局部证据 | 正式 Gate 1A cohort |
| C04 | `REJECTED_PRE_DIAGNOSTIC` | 因 `387/387` 而被接受 |
| C05 | `NOT_CREATED` | X5 或实现已获准 |
| Gate 1A | `NOT_READY_FORMAL_COHORT` | 已开跑或已通过 |
| Gate 1H | `PENDING / DEFERRED` | 被 agent 代理证据替代 |
| Gate 2 | `LOCKED` | 可以提前实现主题豁免 |

## 5. 权威来源与历史保留

- Owner 最新的精确 hash/ref 授权优先。
- GitHub #58 最新登记与远端 ref 优先于 Issue 早期正文、RC4 入口和旧审计。
- `2026-07-30-rc9-readiness-audit.md` 保留为当日历史快照，不删除、不改写其
  原始审计结论，只增加 supersession banner。
- 旧 RC、失败 namespace、技术试玩和 agent 证据均保留，但不得重包装进入正式
  cohort 分母。

## 6. 当前允许的下一动作

当前只允许继续状态/authority 收口及准备全新、未授权的诊断修订提案。失败 V3
不得执行或原地修补；X5 发布、C05 实现、正式样本和 Gate 变更均必须分别满足
其冻结授权条件，不得由本状态对账自动授权。
