# Gate 1A RC9 测试运营合同

| 字段 | 内容 |
|---|---|
| 项目 | Project-004-New Era 2 |
| 状态 | `C04_RECOVERY_ACTIVE / NOT_RELEASED` |
| 日期 | 2026-07-27 |
| cohort | `g1a-20260727-rc9-01` |
| 测试运营负责人 | 根 agent `/root` |
| RC9 基线计划 authority | `2026-07-27-gate1a-rc9-remediation-plan.md` |
| C04 当前计划 authority | `2026-07-29-gate1a-rc9-c04-recovery-plan.md` |
| C04 当前 `plan_ref` | `f0ba061250d8633669eff625f7aa8809b789e682`，supersedes `31c05fee5130cd25f6273037468928d9196858f0` |
| 协议 authority | `../../product-specs/weekly-management-slice-playtest-v0.2.md` |
| 设计 authority | `../../design-docs/weekly-plan-production-forecast-slice-v0.2.md` |

## 1. 目的与边界

本合同规定 RC9 从候选制备到七个正式 agent 样本的证据、隔离、编号与裁定流程。
它不授权提前实现 Gate 2，不授权恢复 Gate 1H，也不把代理结果解释为真人证明。

固定状态：

```text
Gate 1H = PENDING
Gate 2  = LOCKED
```

RC8 cohort、V0.1 协议和 `AGENT_PROXY_FAIL` 永久只读。RC9 是新的责任承诺模型，
不能追溯改写或替换 RC8 结论。

## 2. 职责分离

### 2.1 测试运营负责人 `/root`

负责：

- 维护编号、Issue 和依赖 integration SHA 台账；
- 核验候选 authority、构建和证据；
- 串行调度 anti-pass、诊断和正式样本；
- 保存 raw、sidecar、receipt、download、agent 原文和运营记录；
- 逐组人工裁定 legacy 编辑与 v2 管理承诺；
- 聚类缺陷并发布唯一 Gate 1A 结论。

不得：

- 在场次中修改源码、数值、协议、玩家包或构建；
- 向 player agent 泄露目标、答案、anti-pass 或其他样本；
- 代操作、筛掉负面结果或虚构缺失字段；
- 代表 Owner 解锁 Gate 1H 或 Gate 2。

### 2.2 候选制备、review 与 seal

以下责任单元必须不同：

1. freeze-preparation agent：制备 candidate attempt、诊断和 manifest；
2. independent review agent：只读审查 candidate；
3. seal agent：只引用通过 review 的不可变 hashes 生成 seal；
4. player agents：不继承上述上下文。

review 发现实质 P0/P1 后，不得更换 reviewer 为同一候选重判。修复必须新 source
SHA、新 candidate attempt、新诊断、新 manifest、新 review 和新 seal。

## 3. Authority 与版本

所有 RC9 候选固定：

```text
scenarioVersion=0.5.0
schemaVersion=gate1-playtest-v2
protocolVersion=weekly-management-slice-playtest-v0.2
playerPacketVersion=gate1a-rc9-player-packet-v0.2
postSessionInterviewVersion=gate1a-rc9-interview-v0.2
```

Issue 的 `plan_ref` 固定为计划提交 SHA；`base_ref` 只引用所有依赖已整合并验证的
精确 SHA；`output_ref` 在关闭时填写本 Issue 的验收提交。分支名、裸 `HEAD`、
工作树或占位符不是 authority。

## 4. 命名与不可复用

| 对象 | 命名 |
|---|---|
| candidate attempt | C01、C02…… |
| anti-pass | TECH-RC9-P01 起 |
| 盲诊断 | TECH-RC9-D01 起 |
| candidate manifest | CM01、CM02…… |
| independent review | IR01、IR02…… |
| seal attempt | S01、S02…… |
| 正式主样本 | A38–A44 |
| 正式替补 | A45、A46 起 |

编号一经分配不得复用。失败、技术无效、被拒或 superseded 的目录与记录永久保留。

## 5. RC8 只读守卫

守卫路径：

```text
data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01
```

失败基线：

```text
c0f4269bc3fef56962199629bad8db041aafc5f0
```

RC9-01 在本脚本创建后及退出前运行。RC9-02 起，每个实施 Issue 开始和结束、
每次 candidate 制备及 seal 前必须运行：

```bash
cd prototype
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npm run guard:rc8 -- \
  --baseline c0f4269bc3fef56962199629bad8db041aafc5f0 \
  --path ../data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01
```

守卫同时比较：

- baseline 与当前 `HEAD` 的 Git subtree tree ID；
- baseline blob 内容与当前工作目录的逐文件 SHA-256 inventory，包括新增、缺失和
  内容变化。

任一差异立即停止 RC9，不得通过重建 RC8、复制相似文件或更新基线绕过。

## 6. Fixture 与 schema 冻结

Phase 0 的统一入口：

```bash
cd prototype
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npm run schema:fixtures
```

规则：

- 所有 JSON fixture 必须在 `fixture-expectations.json` 登记；
- 每项明确 expected accept/reject、失败码、候选组、decision hash 或关系；
- 未登记 fixture 使命令失败；
- 脚本内固定 outcome 矩阵必须覆盖全部 fixture，并与 expectations 的
  accept/reject 和失败码逐项一致；不得通过同时删除或改写 fixture 与 expectation
  绕过；
- V0.1/V0.2 混合字段必须拒绝；
- `TECH-RC9-Dxx/Pxx` 只按严格格式额外允许；
- 每个可提交 option 必须核验专属 action type/payload、完整可见后果和最终投影
  谓词；`north-loop`、`keep-fertilizer` 在没有显式非默认 action 前不得
  `committed`；
- `EDIT_SCHEDULE` 与 accepted study 必须携带成员、日期、规范格子和前后活动；
  food、repair、study 的 action、option、projection 与 schedule consequence
  必须精确指向协议规定的同一对象；
- committed group 必须完整包含 option 的 `requiredConsequenceRefs`，仅保留
  非核心 forecast 不得通过；
- `committed:schedule:<hash>` 的 hash 必须精确等于
  `finalDecisionStateHash`；
- legacy group 只接受白名单 ID/action 合同；当前不授权 repair legacy group，
  未知或拆分伪造 group 必须拒绝；
- Phase 4 的 production export 与 capture host 必须消费同一套 fixtures，不能复制
  第二套字段规则。

## 7. Candidate attempt

每次候选位于：

```text
data/playtests/weekly-management-slice/gate1a/
  g1a-20260727-rc9-01/candidates/Cxx/
```

attempt 固定：

- source 与 dependency integration SHA；
- 唯一 build ID；
- artifact、确定性 UTC archive 及 hashes；
- 协议、运营合同、玩家包、访谈、schema 与 capture host hashes；
- Phase 6 命令输出；
- anti-pass 和诊断证据。

attempt core 封存后不可改写。只允许向此前不存在的 `diagnostics/**`、
`evidence/**` 或 `rejection-record.*` 追加文件。修复必须创建下一个 Cxx。

## 8. Anti-pass

每个 attempt 在盲诊断前运行两条排除正式分母的确定性路径：

1. 显眼 CTA：只点击每张摘要卡最显眼按钮，不进入反事实或确认日程；
2. 最小干预：只做完成流程必需操作，不逐卡处理。

必须机械断言：

- CTA 自身 authority mutation 为 0；
- CTA 自身 committed candidate 为 0；
- comparison 无推荐、预选、提交焦点或 Enter/Space 误提交；
- 第一次 mutation 只发生在明确方案提交后；
- 两条路径都不能机械获得三项有效承诺。

失败时在当前 attempt 追加 `rejection-record.json/.sha256`，状态
`REJECTED_PRE_DIAGNOSTIC`，然后回到最早产生差异的实施 Phase。

## 9. 五个盲诊断样本

每个 candidate attempt 使用五个全新 agent，严格串行：

```text
C01 → TECH-RC9-D01 ... D05
C02 → TECH-RC9-D06 ... D10
```

每名 agent：

- `fork_turns=none`；
- 只收到中性玩家包、编号和候选入口；
- 不读取设计、协议、阈值、源码、Issue、anti-pass 或其他样本；
- 使用全新应用会话；
- 完成保存、下载、清空和统一访谈。

诊断最低条件：

- 五场完成两周；
- 无 P0；
- 两周人工 v2 承诺中位数分别在 3–5；
- 双报 legacy 编辑；
- 无必须点完卡片才能运行；
- 无同意图重复刷数。

诊断通过只表示未发现明显反证。任一失败拒绝当前 attempt；修改后必须重跑
Phase 6、anti-pass 和全新五场诊断。

## 10. Candidate manifest、review 与 seal

### 10.1 Manifest

选中诊断通过的 Cxx 后生成：

```text
candidate-manifests/CMxx/candidate-manifest.json
candidate-manifests/CMxx/candidate-manifest.sha256
candidate-manifests/CMxx/freeze-preparation-audit.md
```

初态固定 `PENDING_INDEPENDENT_REVIEW`。manifest 必须列出当前 attempt 的全部
authority、artifact、archive、diagnostic、anti-pass、RC8 guard 和先前 rejected
attempt，并以 `priorManifests` 列出此前每份 CM 的 ID、对应 C、manifest hash 与
拒绝状态。生成后不得原地修改。

CM 序列与 C 序列分别独立推进：

- `priorManifests` 必须按序精确覆盖 `CM01..CM(n-1)`；
- `rejectedAttempts` 必须按序精确覆盖当前 C 之前的 `C01..C(n-1)`；
- prior CM 对应的 C 必须唯一，且为 rejected attempts 的子集；
- current C 不能被 prior CM 使用，也不能已在 rejected attempts；
- `CM01 + C02` 合法，表示 C01 在生成第一份 manifest 前已拒绝；
- `CM02 + C02` 合法时，C01 同时出现在 prior manifest 和 rejected attempts；
- 已被 prior CM 使用并拒绝的 C 不得由新 CM 重新包装。

### 10.2 Independent review

review 位于 `evidence/reviews/IRxx/`，只读核验：

- source、artifact 和 archive 一致；
- manifest ID/hash；
- schema、host、capture；
- anti-pass、五场诊断和玩家包中立性；
- RC8 不变；
- `P0=0 / P1=0`。

技术中断且没有形成实质结论时，可以记录 `INVALID_TECHNICAL` 后分配新 IR；
已有实质 P0/P1 时当前 CM/C 永久拒绝，不能更换 reviewer 取得第二次实质结论。
同一 CM/C 的每个 IR 都必须保留 ID、状态、review record 与 hash；后续 seal
必须枚举全部 IR 历史，并证明：

- 所有技术无效 IR 都保存了中断原因与 hash；
- 没有任何实质失败 IR；
- 获准 IR 的 candidate manifest ID/hash 与当前 CM 完全一致。

若存在实质失败 IR，在该 review 目录保存
`rejection-record.json/.sha256`，状态 `REJECTED_INDEPENDENT_REVIEW`，并从新
source SHA → 新 Cxx → 新诊断 → 新 CMxx → 新 IRxx 重走。

### 10.3 Seal

不同 seal agent 在 `seals/Sxx/` 只引用：

- 获准 CM/hash；
- review/hash；
- source SHA；
- artifact/archive hashes；
- freeze、review、seal 三个 agent task ID。

seal 必须读取同一 CM/C 的全部 IR 历史；存在任何实质失败 IR 时不得成功。Sxx
只有在纯技术写入失败且 CM、review、source、artifact、archive 的全部引用 hash
完全不变时，才能分配新 Sxx 重试。任何 authority/hash 不匹配都永久拒绝当前
CM/C，并从新 Cxx 完整重走，不能只换 reviewer 或 seal agent。

每个失败 Sxx 都在自己的 `seals/Sxx/rejection-record.json/.sha256` 保存原因、
引用 hashes 与状态，目录不可改写。成功 seal 还要枚举当前 CM/C 的全部既有 Sxx
及其 rejection hashes，证明没有被选择性忽略的非技术失败。

成功后只能生成一次 `sealed-candidate-index.json/.sha256`，只引用获准 CM/hash
与成功 seal/hash。若根 index 生成后发现 seal 无效，整个 cohort 作废，必须新建
cohort ID，不能覆盖 index。

## 11. 正式 A38–A44 调度

正式场次严格按 A38 到 A44 串行：

1. 前一场 raw、sidecar、receipt、download、agent 原文、sample record 和
   validity decision 已落盘；
2. 运营负责人完成人工裁定并提交；
3. 核验没有并发 RC9 浏览器场次；
4. 才能启动下一名全新 player agent。

技术无效时停止序列，先完成无效裁定与证据提交，再分配 A45 起的替补。主编号与
替补编号均不复用。

正式 player agent 只收到：

- 自己的匿名编号；
- sealed candidate 入口；
- `player-packet-v0.2.md`；
- 保存并清空后的 `post-session-interview-v0.2.md`。

## 12. 单场证据

最低文件：

```text
captures/<capture>.json
captures/<capture>.json.sha256
captures/<capture>.json.receipt.json
samples/<sampleId>/sample-record.json
samples/<sampleId>/validity-decision.md
samples/<sampleId>/agent-verbatim-output.md
```

`sample-record.json` 至少保存：

- agent task、隔离、只读与污染检查；
- source/build/artifact/archive/authority hashes；
- candidate manifest、完整 IR history、seal record 与 sealed index hashes；
- session、机器时间、tick、complete/blocked；
- raw 实际 hash/bytes、sidecar 与 receipt 对 raw 的声明值、浏览器下载实际
  hash/bytes，以及 `allClaimsMatchServerRaw`；
- candidate edit 与 management groups；
- `legacyEffectiveEdits` 人工裁定；
- `effectiveManagementCommitmentsV2` 人工裁定；
- comparison、预测、人物、地图和第二周行为证据；
- 主持提示、技术中断、症状、根因聚类；
- validity 和 Gate 锁。

agent 原文只能标为 agent 输出。真人情绪、乐趣、认知负担、游玩时长和继续意愿
统一记为 `not_applicable_agent_proxy`。

## 13. 有效性裁定

有效与无效只按协议 V0.2 §10。负面结果、理解失败、P0/P1、低/高承诺数或不符合
设计者偏好不能作为无效理由。

机器候选不是最终权威。运营负责人逐个 `decisionIntentId + weekIndex` 对照 raw、
choice set、decision hashes、consequence refs、recap 和 agent 观察。人工可以
否决机器候选，不得补记 raw 不存在的行为。

## 14. Cohort 作废

以下任一发生，尚未完成的正式 cohort 整体作废：

- source、构建、场景、数值或领域规则变化；
- schema、classifier、capture host、协议、玩家包或访谈变化；
- manifest/review/seal authority 不匹配；
- 样本间策略或上下文泄漏；
- overlap 违反严格串行；
- sealed index 生成后发现 seal 无效。

不得把已跑样本迁入修复后的新 cohort，也不得只补跑“受影响”的部分。

## 15. 汇总与结论

最终报告必须：

- 只纳入七个有效正式样本；
- 双报两周 legacy 编辑与 v2 管理承诺；
- 给出逐项人工—机器差异；
- 给出完成、摘要、预测、人物、地图、第二周检查/重排；
- 列出 P0/P1/P2、症状和根因聚类；
- 发布唯一 `AGENT_PROXY_PASS`、`AGENT_PROXY_CONDITIONAL` 或
  `AGENT_PROXY_FAIL`；
- 明确保留 `Gate 1H=PENDING`、`Gate 2=LOCKED`。

## 16. RC9-01 退出检查

RC9-01 只在以下命令均通过且 `prototype/src/**`、旧 cohort 零变化时完成：

```bash
git diff --check

cd prototype
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npm run schema:fixtures
npm run guard:rc8 -- \
  --baseline c0f4269bc3fef56962199629bad8db041aafc5f0 \
  --path ../data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01
```

RC9-01 失败时保持 RC9-02 阻塞，不得先写生产代码。

## 17. C04 场前修订（2026-07-29）

本节只前向适用于 C04，不追认或改写 C01–C03、P01–P06、D01–D15。发生冲突时：

- C01/C02 继续由本合同原 §3/§9 的 v0.2 与 `fork_turns=none` 规则解释；
- C03 继续由其已拒绝的 recovery contract 与 rejection record 解释；
- C04 由已推送的
  `2026-07-29-gate1a-rc9-c04-recovery-plan.md`、当前
  `plan_ref=f0ba061250d8633669eff625f7aa8809b789e682` 和本节共同解释；
  `31c05fee5130cd25f6273037468928d9196858f0` 只保留为 compatibility v2
  父权威，`c085bb63a2cbce790e47859ec49ff05c58283c74` 只保留为更早历史。

### 17.1 C04 authority

```text
candidateAttempt=C04
authorityProfile=rc9-v03
scenarioVersion=0.5.1
schemaVersion=gate1-playtest-v2
protocolVersion=weekly-management-slice-playtest-v0.3
antiPass=TECH-RC9-P07,TECH-RC9-P08
diagnostics=TECH-RC9-D16..TECH-RC9-D20
candidateManifest=CM01_UNALLOCATED
```

candidate manifest 必须显式声明 `authorityProfile` 与 `protocolVersion`，并由共享
versioned contract 对 scenario、protocol、exact role/path set 做逐字匹配。C04
只能使用 `rc9-v03`；真实 C03 rejection-history 必须作为反例，不能把 C03
重包装为 CM01。

### 17.2 C04 diagnostic isolation

D16–D20 在任何场次开始前统一冻结：

```text
diagnosticIsolationProfile=standalone-codex-cli-v2
codexCliBinary=/Applications/ChatGPT.app/Contents/Resources/codex
codexCliVersion=codex-cli 0.146.0-alpha.3.1
codexCliBinarySha256=6d8be49e49751554df16572369e636cbe02c84b208cad3dc35528c846eeca223
codexCliTeamIdentifier=2DC432GLL2
codexCliAuthority=Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)
nodeBinary=/opt/homebrew/opt/node@24/bin/node
nodeVersion=v24.18.0
nodeBinarySha256=72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f
model=gpt-5.6-sol
reasoning=xhigh
browserProvider=direct-tools-playwright-mcp
playwrightMcpVersion=0.0.76
allowedOrigin=http://127.0.0.1:4202
```

compatibility/version 决策只接受以下 artifact pair，并必须复算 sidecar：

```text
docs/exec-plans/evidence/2026-07-29-c04-cli-compatibility-probe.json
docs/exec-plans/evidence/2026-07-29-c04-cli-compatibility-probe.json.sha256
```

isolation grammar 迁移只接受以下三组 artifact pair；必须复算每个 JSON、sidecar
文件及 sidecar 声明值，并逐字匹配下表：

| artifact pair | JSON SHA-256 | sidecar 文件 SHA-256 |
|---|---|---|
| `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-discovery.json` / `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-discovery.json.sha256` | `3e03c15d3af68430a885c19d37b30126de4b29d80608889a05570a7da228ac30` | `aa59eb2264d11d25825d4e3f2b961fb43c34b1d346785ca7e08812475a0742f3` |
| `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-recapture.json` / `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-recapture.json.sha256` | `70997d22e8a4d1c37bdd39aca49543527825d714e941c03f823822c19fdebbf7` | `dc04668fe7b1273e9321dfff9067caf8d925456de9210e87ed888758d8763e86` |
| `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-amendment-review.json` / `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-amendment-review.json.sha256` | `0e8ac887fc5cf17c4e688ef345c58cf9677a618e92e0b175cf92ed4df845011f` | `c8e83b93c74254a9b0aa44b69b23aef23ffe590b28967cd7ff8c67ae4ae30c02` |

grammar review receipt 必须绑定当前 recovery plan 内容 SHA-256
`7b1b657c7c2bed5c8c8524b059149e52db9ba39bbecb7ffb91b4dfa706e4ef3e`
且 `finalStatus=PASS`。discovery 的
`FAIL_INCOMPLETE_REQUIRED_COVERAGE` 只触发 amendment；recapture v3 才是
exact grammar/native-type/correlation authority。三者都不是 golden、diagnostic、
C04 admission 或 Gate PASS 证据。

唯一有效启动命令如下；`TEMP_WORKSPACE`、`NEUTRAL_PLAYER_PROMPT` 与
`CLI_EVENT_STREAM` 只能替换为场次专属绝对路径，其他 token 不得重排、合并、补省略
或通过 alias/wrapper 改写：

```bash
PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin" \
/Applications/ChatGPT.app/Contents/Resources/codex \
  exec --json --strict-config --ignore-user-config \
  --skip-git-repo-check --sandbox read-only \
  --cd "$TEMP_WORKSPACE" \
  --model gpt-5.6-sol \
  --disable memories \
  --disable hooks \
  --ignore-rules \
  -c 'plugins."browser@openai-bundled".enabled=false' \
  -c 'plugins."chrome@openai-bundled".enabled=false' \
  -c 'plugins."computer-use@openai-bundled".enabled=false' \
  -c 'mcp_servers.playwright.enabled=true' \
  -c 'mcp_servers.playwright.command="npx"' \
  -c 'mcp_servers.playwright.args=["-y","@playwright/mcp@0.0.76"]' \
  -c 'mcp_servers.playwright.default_tools_approval_mode="auto"' \
  -c 'model_reasoning_effort="xhigh"' \
  -c 'approval_policy="never"' \
  - < "$NEUTRAL_PLAYER_PROMPT" > "$CLI_EVENT_STREAM"
```

以下两组 config token 已由 strict-config probe 证明会在 0.142/0.146 触发
`CONFIG_INVALID_TRANSPORT`，不得出现在有效 argv，也不得添加替代的 disabled MCP
entry：

```text
-c mcp_servers.chrome-devtools.enabled=false
-c mcp_servers.node_repl.enabled=false
```

每场 preflight 必须从上述绝对 binary 现场复算 path、version、SHA-256、codesign
TeamIdentifier、完整 Authority 及 Node absolute path/version/SHA-256。六类单字段
身份漂移必须分别命中以下唯一失败码：

| 单一漂移 | 精确失败码 |
|---|---|
| absolute binary path | `C04_CLI_BINARY_PATH` |
| CLI version | `C04_CLI_VERSION` |
| binary SHA-256 | `C04_CLI_BINARY_SHA256` |
| codesign TeamIdentifier | `C04_CLI_TEAM_IDENTIFIER` |
| 完整 codesign Authority | `C04_CLI_AUTHORITY` |
| Node 24 identity | `C04_NODE_IDENTITY` |

两套 golden 必须分别来自上述唯一 binary、recapture v3 fixed private handoff 的
persisted rollout 与 `codex exec --json` stream，exact path 与 grammar ID 为：

```text
prototype/tests/fixtures/isolation/golden-codex-0.146.0-alpha.3.1-persisted-rollout.jsonl
codex-0.146.0-alpha.3.1-persisted-rollout-v2
prototype/tests/fixtures/isolation/golden-codex-0.146.0-alpha.3.1-exec-events.jsonl
codex-0.146.0-alpha.3.1-exec-events-v2
```

required coverage 严格等于 recapture v3
`grammar.*.variants + supplementalGrammar.*.variants` 的逐 variant 去重 union：
persisted 恰好五种顶层 envelope、17 种 payload subtype、19 个
exact-key/native-type variant；exec 恰好七种顶层 envelope、三种 item subtype。
exact keys、native types、lifecycle tuple、correlation、order 与 uniqueness 以当前
recovery plan §3.1–§3.2 的逐字合同为准，不得使用旧 incomplete discovery matrix
删减 shape。

golden source set 必须逐字为
`recapture-v3-private-handoff-A-B-C-B_EXTENSION-B_SUCCESS_PROBE`，并从 recapture
规定的固定 root 按 opaque object ID 读取五个 capture × 两个 stream。provenance
只写入
`prototype/tests/fixtures/fixture-expectations.json.isolationGoldenProvenance`，
每个 stream 必须冻结 `sourceSet` 与按
A、B、C、B_EXTENSION、B_SUCCESS_PROBE 排序的 `fixtureSourceCaptures`，逐行保留
source-line ordinal、event order、opaque object ID/commitment 与 read-back/privacy
状态；不得退回 volatile raw、原 session rollout、旧 discovery commitment、
projection 或手写副本。

`prototype/tests/fixtures/isolation/fixture-matrix.json` 必须至少包含 recovery plan
§3.1 冻结的 31 个单字段/单关系 negative fixtures，并逐项命中对应精确失败码。
任一 known grammar mutation 未 fail-closed，或 fixture-source/D16–D20 出现 matrix
外的新 type/subtype/key/native type、lifecycle 或 correlation shape，都必须立即
停止 C04，重新执行 discovery、amendment 与 external review；不得在实现、场次或
review/seal 中扩 grammar、改 golden 或放宽 allowlist。

Playwright 工具与参数 allowlist、两段 unsafe code、private raw evidence、公开结构
投影、preflight/verification 字段和其余失败码以当前 C04 恢复计划 §3 的逐字合同
为准；不得临场换成 collaboration subagent、Browser plugin、Chrome、Computer
Use、Node REPL 或另一种“等价”机制。

每场必须：

1. 使用全新、开始时为空的 `mktemp -d` 工作区与全新 standalone CLI process；
2. 产生唯一 session meta、rollout commitment、browser context/page ID 和唯一
   固定初态应用 Session；
3. 只通过固定 Playwright MCP 操作唯一 origin，不调用 shell、Git、文件、Issue、
   repo、协议、计划、阈值、anti-pass 或其他样本；
4. 在公开证据前把原始 rollout/event stream 写入本机 content-addressed private
   store，执行 `chmod 400`、`chflags uchg` 并以 `stat -f '%Sf'` 证明；
5. 保存公开 structural evidence、preflight、isolation verification、raw/
   sidecar/receipt/browser download、sample record、validity decision 与 agent
   原文；
6. 核验、清空并完成清空后访谈，再 commit/push；之后才可启动下一场。

任一 private raw 缺失、hash/flag 不符、工具或参数越界、origin 不符、第二
context/page/Session、刷新/重开/重置、身份字段不可复算，都使该样本技术无效并
立即停止 C04，不临场修订合同。

### 17.3 C04 admission 边界

五场全部技术有效且 W1/W2 人工 V2 中位数分别在 `3–5`、无 P0、无刷数反证，
只允许 C04 进入 CM01 制备。diagnostics PASS 不是 Gate 1A PASS，Gate 1H 继续
`PENDING`，Gate 2 继续 `LOCKED`。
