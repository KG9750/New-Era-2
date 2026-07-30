# Gate 1A RC9 C04 恢复计划

| 字段 | 内容 |
|---|---|
| 状态 | `ISOLATION_GRAMMAR_AMENDMENT_PROPOSED / NOT_STARTED` |
| candidate attempt | `C04` |
| anti-pass | `TECH-RC9-P07`、`TECH-RC9-P08` |
| blind diagnostics | `TECH-RC9-D16`–`TECH-RC9-D20` |
| candidate manifest | C04 诊断通过后才允许分配 `CM01` |
| 产品源码基线 | `cd2fc9716d98c160fe530c593347992f18bf96e4` |
| 证据谱系基线 | `5b9438cc5123ba35d8a703f3507bbf463e90176d` |
| C03 拒绝记录 | `5550936b5298269e16b53c40df7a597d6c839a6dda155298e6f0a99fd7f0df6f` |
| C03 拒绝原因 | candidate-manifest authority/version drift；D15 隔离机制未经合同授权 |
| Gate 边界 | Gate 1A 未获准；Gate 1H=`PENDING`；Gate 2=`LOCKED` |

## 1. 恢复目标

C03 的产品玩法、anti-pass 与原诊断数值门槛均已形成有效历史证据，但不能进入
candidate manifest：

1. 冻结 `manifest:verify` 仍只接受 v0.2 authority 与 scenario `0.5.0`，不能
   诚实验证 C03 的 protocol v0.3 / scenario `0.5.1`；
2. D15 使用独立 Codex CLI，而冻结合同逐字要求 `fork_turns=none`。独立 CLI
   可能具有同等或更强隔离，但合同没有在场次开始前授权该机制，不能事后追认。

C04 不改变 C03 的玩法、数值或 Gate 计数语义。它只修复冻结和运营链：

- 给 candidate manifest 增加显式、可验证的 authority profile；
- 让 CLI verifier 与 fixture verifier 使用同一 versioned contract；
- 在诊断开始前冻结唯一的 standalone Codex CLI 隔离 profile；
- 从新 source SHA 创建 C04，完整重跑 Phase 6、P07/P08 与 D16–D20。

C03、P05/P06、D11–D15、diagnostics manifest 与 rejection record 永久只读。

## 2. Candidate manifest versioned authority

### 2.1 显式 profile

candidate manifest 新增必填字段：

```text
authorityProfile
protocolVersion
candidateAttemptManifestPath
antiPass[].evidencePath
rejectedAttempts[].rejectionPath
commandResults[].outputPath
frozenEvidenceGuard
candidateEvidenceSnapshotSha
```

冻结两个 profile。以下 `role:path` 是逐字匹配合同，不能使用别名、目录或同内容
副本。

`rc9-v02`：

| role | exact path |
|---|---|
| `protocol` | `docs/product-specs/weekly-management-slice-playtest-v0.2.md` |
| `design` | `docs/design-docs/weekly-plan-production-forecast-slice-v0.2.md` |
| `operations` | `docs/exec-plans/active/2026-07-27-gate1a-rc9-test-operations.md` |
| `player-packet` | `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/player-packet-v0.2.md` |
| `interview` | `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/post-session-interview-v0.2.md` |
| `fixture-oracle` | `prototype/tests/fixtures/fixture-expectations.json` |
| `capture-host` | `prototype/scripts/playtest-host.mjs` |

`rc9-v03`：

| role | exact path |
|---|---|
| `protocol` | `docs/product-specs/weekly-management-slice-playtest-v0.3.md` |
| `c03-management-authority` | `docs/design-docs/gate1-c03-management-choice-authority.md` |
| `c03-branch-matrix` | `docs/design-docs/gate1-rc9-branch-matrix.md` |
| `c04-recovery-plan` | `docs/exec-plans/active/2026-07-29-gate1a-rc9-c04-recovery-plan.md` |
| `operations` | `docs/exec-plans/active/2026-07-27-gate1a-rc9-test-operations.md` |
| `player-packet` | `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/player-packet-v0.2.md` |
| `interview` | `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/post-session-interview-v0.2.md` |
| `fixture-oracle` | `prototype/tests/fixtures/fixture-expectations.json` |
| `capture-host` | `prototype/scripts/playtest-host.mjs` |

| profile | scenario | protocol |
|---|---|---|
| `rc9-v02` | `0.5.0` | `weekly-management-slice-playtest-v0.2` |
| `rc9-v03` | `0.5.1` | `weekly-management-slice-playtest-v0.3` |

profile 由 manifest 明确声明，不能从 `candidateAttempt`、build 名或 authority 路径
猜测。validator 必须验证：

```text
authorityProfile
= scenarioVersion
= protocolVersion
= exact role set
= exact path set
```

缺失或未知 profile 返回 `CANDIDATE_MANIFEST_AUTHORITY_PROFILE`；
scenario/protocol 交叉错配返回 `CANDIDATE_MANIFEST_AUTHORITY_VERSION`；
role/path/hash 错配或多余 authority 返回 `CANDIDATE_MANIFEST_AUTHORITY`。不得
为了让 C04 通过而把真实 `0.5.1/v0.3` 投影成旧 `0.5.0/v0.2`。

### 2.2 兼容性与单一真相

- 新增一个小型共享纯数据/纯校验模块
  `prototype/scripts/candidate-manifest-contract.mjs`；CLI verifier 与 fixture
  verifier 必须直接 import，禁止复制第二份 profile 或结构校验；
- fixture validator 只验证纯合同、reason code 与交叉矩阵；CLI verifier 除调用
  共享合同外，还必须从 repo root 读取并复算真实文件，禁止只检查 64 位 hash
  外形；
- CLI verifier 必须复算 authority、candidate-build manifest、diagnostics
  manifest 及其 sample records、P07/P08 evidence、artifact manifest、UTC
  archive、C01–C03 rejection records，并交叉核对 source/integration/build/
  scenario/protocol/schema；
- full manifest 必须要求 `--manifest-git-sha <M>`，只用 Git object API 从
  `M:data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidate-manifests/CM01/candidate-manifest.json`
  读取 CM01；`--manifest` 只声明这一个 repo-relative canonical path，不得读取
  工作树同名文件、其他 commit 或调用方提供的替代路径。输出必须绑定
  `manifestGitSha=M`、canonical manifest path 与 manifest blob SHA-256；
- full manifest 必须从 manifest 的 `candidateEvidenceSnapshotSha` 所指 Git
  commit 读取 candidate evidence blobs，不得从可变工作树或 CM commit 之后追加的
  freeze/review/seal output 取代 E 快照；
- full manifest 对 P07/P08 不能只核 `status=PASS` 或结果文件 hash，必须深核：
  P07 身份与 prominent-CTA/repeat-submit 路线、
  `w1TerminalCommitmentCount=1`、`w2TerminalCommitmentCount=1`；P08 身份与
  minimal-intervention/invalid-consequence 路线、
  `w1TerminalCommitmentCount=0`、`w2TerminalCommitmentCount=0`。两场必须从 raw
  actions 与 canonical ledger 重算 terminal count，并证明 CTA、默认焦点、
  reload、重复 export、重复提交、同意图拆分和底层直接编辑均未补计；
  raw/sidecar/receipt/browser download 同字节，host 与 ledger validator 均
  `PASS`；
- full manifest 必须读取 archive 原始字节并重新验证 UTC `SOURCE_DATE_EPOCH`、
  `ustar` header、规范 entry 顺序、无重复 entry name、终止双零 block 之后无
  非零 trailing data；若冻结 archive contract 允许末尾零 padding，其长度也
  必须符合该合同。archive 内容必须与 artifact manifest 一致，不能只信
  `rc:verify-archive` 的已存文本；
- full manifest 必须深核 `runtime:equivalence` 的完整 PASS 合同：
  `status=PASS_RUNTIME_EQUIVALENCE`、`errorCode=null`、
  `verificationInputSha=dependencyIntegrationSha`、
  `headSha=dependencyIntegrationSha`、`artifactGitSha=sourceSha`、禁止路径
  diff 为空、canonical file count 为 5、五文件逐字节相等、
  `artifactHash=9a7ddde0234d82798b2625c050710143f8f4b94bd6d14bd121910a76831abb65`、
  artifact manifest SHA-256=
  `c336706bf7193c07a7f552dfbfe77cf02ec36259c72cc08b8f0c6ee8fc84cc37`
  与 metadata identity 分离均成立，不能只核 output 文件 hash；
- 每个 `commandResults[]` 必须同时含 repo-relative `outputPath` 与
  `outputHash`；CLI verifier 逐文件复算，不接受只有 64 位字符串的结果；
- v0.2 fixture 保持通过，但必须显式声明 `rc9-v02` 与 protocol v0.2；
- profile 纯合同可使用明确标注 `synthetic` 的 v0.3 正例，但不得声明它是已接受
  C03；
- 新增 `CM01 + C04 + rc9-v03 + 0.5.1/v0.3` 合成完整正例，以及真实 C03
  rejection-history 反例，证明 C03 不可重包装；
- 新增 profile/scenario/protocol/role/path/额外 authority 的交叉反例；
- 唯一实际正例是 C04；必须以真实 candidate-build manifest、diagnostics
  manifest 与 P07/P08 文件运行实际 `manifest:verify`，不能只验证合成 fixture。

### 2.3 三种 verifier 模式与自引用边界

`manifest:verify` 只允许三种互斥模式：

```text
npm run manifest:verify -- --fixtures --output <repo-relative-json>
npm run manifest:verify -- --probe <probe-json> --repo-root .. --output <repo-relative-json>
npm run manifest:verify -- --manifest <canonical-candidate-manifest-path> --manifest-git-sha <M> --repo-root .. --output <repo-relative-json>
```

- source preflight 可以把 `--output` 写到场次专属外部绝对临时路径；只有进入
  dependency integration、`commandResults[]`、CM01 或 freeze audit 的输出才
  必须是 repo-relative；
- `--fixtures`：运行共享纯合同的 v0.2/v0.3 正反矩阵；
- `--probe`：在 CM01 尚不存在时，读取真实九个 authority 文件并复算 hashes；
  成功输出 `status=PASS_AUTHORITY_PREFLIGHT`、`fullManifestVerified=false`，不得
  接受 diagnostics/anti-pass/artifact 等尚未生成的证据；
- `--manifest`：CM01 生成后执行完整真实文件复算；缺少
  `--manifest-git-sha`、SHA 不等于本轮同一 M、canonical path 不等于上述 CM01
  path、M 中 path 缺失或 Git mode 不是普通 blob 均 fail-closed。成功输出
  `status=PASS_FULL_MANIFEST`、`manifestGitSha=M`、canonical manifest path、
  manifest blob SHA-256 和全部 binding 摘要。

`prototype/tests/playtest-manifest.test.ts` 是 manifest 三模式的外部测试入口：必须
以子进程启动真实 production CLI，分别断言 `--fixtures`、`--probe`、`--manifest`
的成功/失败 exit code、JSON output schema/status/error code、输出文件真实字节与
重复目标的 no-clobber 拒绝；full mode 还必须断言缺少/错误
`--manifest-git-sha` 失败、工作树同名文件不能替代 M，以及 PASS output 的
M/path/blob hash binding。production verifier 不得提供或调用 `--self-test`、
hidden legacy input 或内建“自报 PASS”分支；fixture validator 的结果也不能替代
该外部进程测试。

`prototype/tests/c04-verifier-cli.test.ts` 是 runtime-equivalence、
frozen-evidence 与 diagnostic-isolation 三类 production CLI 的统一外部测试入口。
它必须以独立子进程验证真实 argv parsing、成功/失败 exit code、JSON schema/status/
error code、input/output symlink 拒绝、no-clobber、两套 raw golden grammar 与
single-session/aggregate 路线；不得 import production `main` 后自报结果。
identity preflight 还必须包含六个彼此独立、每次只篡改一个字段的反例：

| 单一篡改 | 精确 error code |
|---|---|
| absolute binary path | `C04_CLI_BINARY_PATH` |
| CLI version | `C04_CLI_VERSION` |
| binary SHA-256 | `C04_CLI_BINARY_SHA256` |
| codesign TeamIdentifier | `C04_CLI_TEAM_IDENTIFIER` |
| 完整 `Authority=Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)` | `C04_CLI_AUTHORITY` |
| Node 24 identity | `C04_NODE_IDENTITY` |

每个反例必须在篡改后重新计算 canonical input hash/sidecar，证明失败命中对应身份
error 而非 stale-hash 校验；必须非零 exit、stderr/JSON 中出现唯一精确 error code、
全新 output path 不产生任何文件，预置 output sentinel 时字节/hash 不变。六例不得
合并成一个多字段错误 fixture，也不能由纯函数测试替代。
production verifier 禁止 `--self-test`、hidden bypass 或内建“自报 PASS”，纯函数
fixture 测试也不能替代该外部进程测试。

candidate manifest 的 required command IDs 用 `manifest-fixtures` 与
`manifest-probe` 替换旧 `manifest-verify`。最终 `--manifest` 输出产生在
candidate manifest 封存之后，只由 `freeze-preparation-audit.md` 引用，不能
回写 candidate manifest，避免 manifest → verification output → manifest 的
hash 自引用。

本轮新增的 manifest、frozen-evidence、diagnostic-isolation 与
runtime-equivalence 四类 verifier JSON output 在打开输入前必须解析 canonical
path 并拒绝 symlink；其 `--output` 不得等于输入、位于输入目录内或写入 candidate
core、candidate-build manifest、diagnostics、anti-pass、archive、authority、
旧 evidence 等 immutable input namespace。四类输出必须以
create-new/no-clobber 语义创建，已存在即失败，不能通过覆盖旧 PASS 结果取得新
结论。source preflight 允许写到场次专属外部绝对临时路径，但仍必须是尚不存在的
新文件。该 no-clobber 授权不扩展到其他既有命令。

本计划中新生成的每个 JSON/`.sha256` pair（包括 candidate manifest、四类
verifier、diagnostic isolation verification 与 review/seal record）必须作为一组
发布：

1. 先在最终父目录以两个唯一 staging 名分别 `O_CREAT|O_EXCL` 创建，写完 JSON 与
   sidecar 后对两个文件各自 `fsync`，再 `fsync` 父目录；
2. 只可用 `link`/等价 create-new 语义把两个 staging inode 分别发布到最终文件名；
   两个最终名都必须原先不存在，禁止 rename 覆盖、truncate 或先删后写；两者发布
   成功后 `fsync` 父目录，再删除 staging 名并再次 `fsync` 父目录；
3. 任一发布失败，必须立即尝试删除已经发布的组成员和两个 staging 文件并再次
   `fsync` 父目录；若仍有最终成员残留，或任何 verifier/reader 已观测到只存在
   JSON 或只存在 sidecar 的半套状态，返回 `PARTIAL_EVIDENCE_GROUP`，立即拒绝并
   消耗当前 candidate；
4. `PARTIAL_EVIDENCE_GROUP` 后不得原地补齐、覆盖或重跑同一 candidate。reader
   必须把单成员存在视为该错误，不能把半套当作可恢复的普通 no-clobber 失败。

## 3. D16–D20 隔离 profile

### 3.1 唯一允许机制

D16–D20 统一使用：

```text
diagnosticIsolationProfile=standalone-codex-cli-v2
```

版本决策的唯一现场 authority 是以下 exact artifact pair：

```text
docs/exec-plans/evidence/2026-07-29-c04-cli-compatibility-probe.json
docs/exec-plans/evidence/2026-07-29-c04-cli-compatibility-probe.json.sha256
```

计划不得转述 artifact 未记录的版本、exit 或失败原因；review 与迁移必须逐字读取
JSON、复算 sidecar，并只依据其中已封存的 argv、binary identity、exit、stdout/
stderr commitment 和 server acceptance 结论选择 v2。该 evidence 只授权
compatibility profile/version 决策；它不是 benign golden、D16–D20 diagnostic、
isolation verifier 或 Gate PASS 证据。

包含
`mcp_servers.chrome-devtools.enabled=false` 或
`mcp_servers.node_repl.enabled=false` 的旧模板已由现场 strict-config probe 证明在
0.142/0.146 均以 `invalid transport` exit 1，固定裁定为
`CONFIG_INVALID_TRANSPORT`，不得执行或作为 version/profile authority。review
只能绑定 D13 按当前 §3.1 修正后重新生成的 candidate probe pair；该 pair 尚未
通过 sidecar 与逐 token argv 核验前，不得生成 review receipt。

两位 independent reviewer 都必须把 probe 中每次 invocation 的 argv 作为 token
array，与 §3.1 的 absolute executable 及后续每个 argument 按顺序逐 token 比较；
除场次专属绝对路径变量外，不允许重排、补省略参数、合并 `-c`、alias 或字符串
normalize。`PATH`、stdin 与 stdout binding 必须分别逐字匹配 §3.1，但不伪装成
argv token；任一差异使 compatibility review 失败。

compatibility amendment review outcome 只由以下 exact receipt pair 表达，计划
本身保持 outcome-neutral：

```text
docs/exec-plans/evidence/2026-07-29-c04-compatibility-amendment-review.json
docs/exec-plans/evidence/2026-07-29-c04-compatibility-amendment-review.json.sha256
```

receipt schema 必须包含：

- exact `planPath` 与当前计划内容的 `planBlobSha256`；
- exact probe JSON/sidecar path，以及各自 SHA-256；
- 恰好两名不同 reviewer 的 `reviewerId`、精确整数 `P0`/`P1`/`P2` 与
  `outcome`；
- 与两名 reviewer 均不同的 `issuerAgentId`、UTC `createdAt` 和
  `finalStatus=PASS`；
- 不得包含或声称任何 Gate、C04、Gate 1A、Gate 1H 或 Gate 2 outcome。

只有两名 reviewer 对同一精确 plan blob 与同一 probe pair 都得到
`P0=0 / P1=0 / P2=0 / outcome=PASS` 后，第三名 agent 才能按既有 JSON/sidecar
create-new/no-clobber 成组发布规则生成 receipt；receipt 生成后不得再修改本计划。
任何 plan/probe hash 变化都使 receipt 无效，必须另立 amendment，不得回写本计划
“转为 PASS”。compatibility amendment 的 final seal 只验证 receipt pair 的
schema、sidecar、三 agent 身份分离与全部 binding，不再把审查 outcome 写回计划。

`31c05fee5130cd25f6273037468928d9196858f0` 中的 compatibility receipt 仍是
binary identity、strict-config argv 与 `standalone-codex-cli-v2` 决策的有效
历史 PASS receipt；它绑定的是当时的 plan blob，不覆盖随后发现的 isolation
grammar drift，也不能替代本轮 grammar amendment review。

isolation grammar authority 由以下两组 exact artifact pair 共同组成：

```text
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-discovery.json
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-discovery.json.sha256
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-recapture.json
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-recapture.json.sha256
```

review 与实现必须逐字读取两个 JSON、复算两个 sidecar。旧 discovery 的
`status` 与 `discovery.coverageStatus` 都是
`FAIL_INCOMPLETE_REQUIRED_COVERAGE`：它证明旧预写 required matrix 与真实输出不
一致，只触发本 amendment。它不是 golden、D16–D20 diagnostic、isolation
verification、C04 admission 或 Gate PASS 证据，且
`scope.authorizesGrammarChange=false`。

recapture 的 `schemaVersion=3`，状态固定为
`RECAPTURE_V3_PRIVATE_HANDOFF_COMPLETE_WITH_OBSERVED_GRAMMAR_DRIFT`，JSON
SHA-256 固定为
`70997d22e8a4d1c37bdd39aca49543527825d714e941c03f823822c19fdebbf7`，
sidecar 文件 SHA-256 固定为
`dc04668fe7b1273e9321dfff9067caf8d925456de9210e87ed888758d8763e86`。完整
grammar source of truth 是
`grammar.persisted.variants`、`grammar.exec.variants`、
`supplementalGrammar.persisted.variants` 与
`supplementalGrammar.exec.variants` 的逐 variant 去重 union；旧
`discovery.sourceGrammarDiscovery` 仅作为历史 drift/coverage 触发证据，不得覆盖
recapture 的 exact key、native type、lifecycle、correlation、
`toolSearchControlPlaneObservation` 或 `privateSourceHandoff`。recapture 同样不是
golden、diagnostic、C04 admission 或 Gate 证据；只有本计划经 external review
后才授权变更 grammar 合同。

recapture v3 已把五个 capture × 两个 stream 的十份 source raw 非破坏性复制到
固定 owner-only content-addressed store；原临时 raw 与原 session rollout 均未
删除。`privateSourceHandoff.status` 必须为 `COMPLETE`，
`rootPolicyId` 必须为 `new-era-2-c04-private-evidence-v3`，expected/object count
都必须为 10。公开 artifact 只保存
`privateSourceHandoff.objectsByCapture.<captureId>.<stream>.opaqueObjectId`、
commitment/bytes/lines/mode/immutable/read-back，不保存绝对 private path。
resolver 的唯一固定 root 为
`/Users/leo/.codex/private-evidence/new-era-2/c04-isolation-grammar-recapture-v3/objects`：
opaque ID 必须匹配
`^sha256-[0-9a-f]{64}\.jsonl$`，不得包含 slash、`..`、别名或调用方替代 root。
root 与 objects directory 必须为 `0500 + uchg` 的 non-symlink directory，每个
object 必须为 `0400 + uchg` 的 non-symlink regular file；从
`/Users/leo/.codex/private-evidence/new-era-2` 到最终 object 的每级 component
必须逐级 `lstat`。object ID 缺失、root escape、symlink、mode/flag/type 漂移返回
`ISOLATION_GOLDEN_SOURCE_UNAVAILABLE`；已解析 regular object 的 hash、bytes 或
lines 漂移返回 `ISOLATION_GOLDEN_SOURCE_COMMITMENT`。两者都不得退回 volatile
temp raw、原 session rollout、projection 或手写副本。

isolation grammar amendment 的 outcome 只由以下 exact receipt pair 表达，计划
本身保持 outcome-neutral：

```text
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-amendment-review.json
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-amendment-review.json.sha256
```

receipt schema 与 compatibility receipt 模式一致，并必须包含：

- exact `planPath` 与本计划待审内容的 `planBlobSha256`；
- discovery 与 recapture 两组 JSON/sidecar 的 exact path 与各自 SHA-256；
- 恰好两名不同 reviewer 的 `reviewerId`、精确整数 `P0`/`P1`/`P2` 与
  `outcome`；
- 与两名 reviewer 均不同的 `issuerAgentId`、UTC `createdAt` 与
  `finalStatus=PASS`；
- 不得包含或声称任何 C04、Gate 1A、Gate 1H、Gate 2 或其他 Gate outcome。

只有两名 reviewer 对同一 plan blob 与相同两组 authority pair 都得到
`P0=0 / P1=0 / P2=0 / outcome=PASS` 后，第三名 agent 才能用
create-new/no-clobber 成组发布 receipt。receipt 创建后不得再修改本计划；任何
plan/discovery/recapture hash 变化都使该 grammar receipt 无效，必须另立
amendment。

在启动 D16 前，必须先把该 profile 写入 RC9 测试运营合同，并冻结：

- 精确、无交互的 Codex CLI 启动命令模板（变量只能替换场次专属绝对路径）：

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

- CLI 只能使用绝对 binary
  `/Applications/ChatGPT.app/Contents/Resources/codex`；不得通过 `PATH`、alias、
  wrapper 或另一份安装解析 `codex`。上述 `PATH` 只用于冻结 Node/npm/npx，Node
  必须来自 `/opt/homebrew/opt/node@24/bin`。该 binary path 是公开冻结常量，也是
  preflight/verification 唯一允许明文保存的绝对 executable path；不得借此放宽
  workspace、private evidence 或其他本机绝对路径的脱敏规则；
- Node identity 必须绑定 compatibility artifact 已封存的 Node 24 absolute
  binary path、version 与 binary SHA-256；不得只检查版本主号或 `PATH` 字符串；
- 每场 preflight 都必须现场复算并逐字匹配：
  absolute binary path、`codex-cli 0.146.0-alpha.3.1`、binary SHA-256
  `6d8be49e49751554df16572369e636cbe02c84b208cad3dc35528c846eeca223`、
  codesign `TeamIdentifier=2DC432GLL2` 与完整
  `Authority=Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)`。任一
  path、version、hash、签名或 Node 24 identity 漂移都立即停止 C04，不允许临场
  更换 binary、版本或模型；
- `prototype/scripts/verify-diagnostic-isolation.mjs` 及其正反 fixtures；
- isolation fixture 必须冻结两套彼此独立、来自上述唯一 binary 的脱敏 golden
  raw，不能以一套 grammar 兼容另一套：
  - persisted rollout grammar ID 固定为
    `codex-0.146.0-alpha.3.1-persisted-rollout-v2`；
  - `codex exec --json` event grammar ID 固定为
    `codex-0.146.0-alpha.3.1-exec-events-v2`；
  - required coverage 严格等于 recapture
    `grammar.*.variants + supplementalGrammar.*.variants` 的去重 union：
    persisted 恰好五种顶层 envelope、17 种 payload subtype、19 个 payload
    exact-key/native-type variant；exec 恰好七种顶层 envelope、三种 item
    subtype。不得用旧 discovery 的 incomplete matrix 删除新 shape，也不得让
    supplemental 覆盖 primary；
  - 去重键必须同时包含 stream、container、subtype、exact key set 与完整
    `fieldNativeTypes`。同 exact key set 的 nullable/union 不能做字段级笛卡尔积；
    `mcp_tool_call` 必须按下文三个 lifecycle tuple 判定。

persisted rollout 的完整 known grammar 固定如下：

- 顶层 type 恰好为 `session_meta`、`event_msg`、`response_item`、
  `world_state`、`turn_context`；
- 五种顶层 envelope 的 exact keys 都恰好为 `payload,timestamp,type`，完整
  native type 签名都恰好为
  `payload:object,timestamp:string,type:string`；
- 下表逐行是 19 个允许的 payload variant。逗号分隔 key 与 type 签名都按 exact
  key order；除下表逐字段 native type 外不接受隐式 nullable、coercion 或
  alternative：

| payload subtype / variant | exact key set | exact field native types |
|---|---|---|
| `agent_message` | `memory_citation,message,phase,type` | `memory_citation:null,message:string,phase:string,type:string` |
| `function_call_output` | `call_id,id,internal_chat_message_metadata_passthrough,output,type` | `call_id:string,id:string,internal_chat_message_metadata_passthrough:object,output:string,type:string` |
| `function_call` | `arguments,call_id,id,internal_chat_message_metadata_passthrough,name,namespace,type` | `arguments:string,call_id:string,id:string,internal_chat_message_metadata_passthrough:object,name:string,namespace:string,type:string` |
| `mcp_tool_call_end` | `call_id,duration,invocation,result,type` | `call_id:string,duration:object,invocation:object,result:object,type:string` |
| `message / phase` | `content,id,internal_chat_message_metadata_passthrough,phase,role,type` | `content:array,id:string,internal_chat_message_metadata_passthrough:object,phase:string,role:string,type:string` |
| `message / no-phase` | `content,id,internal_chat_message_metadata_passthrough,role,type` | `content:array,id:string,internal_chat_message_metadata_passthrough:object,role:string,type:string` |
| `reasoning` | `encrypted_content,id,internal_chat_message_metadata_passthrough,summary,type` | `encrypted_content:string,id:string,internal_chat_message_metadata_passthrough:object,summary:array,type:string` |
| `session_meta` | `base_instructions,cli_version,context_window,cwd,history_mode,id,model_provider,originator,session_id,source,thread_source,timestamp` | `base_instructions:object,cli_version:string,context_window:object,cwd:string,history_mode:string,id:string,model_provider:string,originator:string,session_id:string,source:string,thread_source:string,timestamp:string` |
| `task_complete / failed` | `completed_at,duration_ms,error,last_agent_message,started_at,turn_id,type` | `completed_at:number,duration_ms:number,error:object,last_agent_message:null,started_at:number,turn_id:string,type:string` |
| `task_complete / success` | `completed_at,duration_ms,last_agent_message,started_at,time_to_first_token_ms,turn_id,type` | `completed_at:number,duration_ms:number,last_agent_message:string,started_at:number,time_to_first_token_ms:number,turn_id:string,type:string` |
| `task_started` | `collaboration_mode_kind,model_context_window,started_at,turn_id,type` | `collaboration_mode_kind:string,model_context_window:number,started_at:number,turn_id:string,type:string` |
| `token_count` | `info,rate_limits,type` | `info:object,rate_limits:object,type:string` |
| `tool_search_call` | `arguments,call_id,execution,id,internal_chat_message_metadata_passthrough,status,type` | `arguments:object,call_id:string,execution:string,id:string,internal_chat_message_metadata_passthrough:object,status:string,type:string` |
| `tool_search_output` | `call_id,execution,id,internal_chat_message_metadata_passthrough,status,tools,type` | `call_id:string,execution:string,id:string,internal_chat_message_metadata_passthrough:object,status:string,tools:array,type:string` |
| `turn_context` | `approval_policy,approvals_reviewer,collaboration_mode,comp_hash,current_date,cwd,effort,model,multi_agent_mode,multi_agent_version,permission_profile,personality,realtime_active,sandbox_policy,summary,timezone,turn_id,workspace_roots` | `approval_policy:string,approvals_reviewer:string,collaboration_mode:object,comp_hash:string,current_date:string,cwd:string,effort:string,model:string,multi_agent_mode:string,multi_agent_version:string,permission_profile:object,personality:string,realtime_active:boolean,sandbox_policy:object,summary:string,timezone:string,turn_id:string,workspace_roots:array` |
| `user_message` | `audio,images,local_audio,local_images,message,text_elements,type` | `audio:array,images:array,local_audio:array,local_images:array,message:string,text_elements:array,type:string` |
| `world_state` | `full,state` | `full:boolean,state:object` |
| `custom_tool_call_output` | `call_id,id,internal_chat_message_metadata_passthrough,output,type` | `call_id:string,id:string,internal_chat_message_metadata_passthrough:object,output:array,type:string` |
| `custom_tool_call` | `call_id,id,input,internal_chat_message_metadata_passthrough,name,status,type` | `call_id:string,id:string,input:string,internal_chat_message_metadata_passthrough:object,name:string,status:string,type:string` |

`function_call.arguments` 必须先以 raw string 通过上表 grammar，再恰好 JSON
parse 一次且结果必须为 object。`custom_tool_call.input` 的 grammar 合同只冻结
opaque string，不要求其可 JSON parse；只有 D16–D20 tool-policy 已先确认
`custom_tool_call.name` 是冻结 Playwright leaf allowlist 成员时，才额外要求该
input 恰好 parse 一次为 object 并通过对应 leaf 参数合同。B_SUCCESS_PROBE 中的
`custom_tool_call/name=exec` 只提供 custom-chain grammar/correlation 与 successful
lifecycle coverage，不授权 D16–D20 使用 `exec`，其 input 只能 commitment 化。
`tool_search_call.arguments` 已经是 object，不得再次 parse。
`function_call_output.output` 必须为 string，`custom_tool_call_output.output`
必须为 array，不得互相兼容。

`codex exec --json` 的完整 known grammar 固定如下：

| top-level type | exact envelope key set | exact field native types |
|---|---|---|
| `thread.started` | `thread_id,type` | `thread_id:string,type:string` |
| `turn.started` | `type` | `type:string` |
| `item.started` | `item,type` | `item:object,type:string` |
| `item.completed` | `item,type` | `item:object,type:string` |
| `turn.completed` | `type,usage` | `type:string,usage:object` |
| `error` | `message,type` | `message:string,type:string` |
| `turn.failed` | `error,type` | `error:object,type:string` |

exec item 恰好允许三种 subtype：

| envelope / item subtype | exact item key set | exact field native types |
|---|---|---|
| `item.completed / agent_message` | `id,text,type` | `id:string,text:string,type:string` |
| `item.completed / error` | `id,message,type` | `id:string,message:string,type:string` |
| `item.started 或 item.completed / mcp_tool_call` | `arguments,error,id,result,server,status,tool,type` | common：`arguments:object,id:string,server:string,status:string,tool:string,type:string`；`error/result` 只按下表 lifecycle tuple |

`mcp_tool_call` 只接受以下三种不可拆分 tuple；禁止把
`error:null|object` 与 `result:null|object` 做笛卡尔积：

| lifecycle | top-level / status | `error` type | `result` type |
|---|---|---|---|
| `started` | `item.started / in_progress` | `null` | `null` |
| `completed-failed` | `item.completed / failed` | `object` | `null` |
| `completed-success` | `item.completed / completed` | `null` | `object` |

grammar 与 correlation tests 还必须冻结 recapture v3 的以下合同：

- 每个 A/B/C/B_EXTENSION/B_SUCCESS_PROBE capture 中，
  `exec.thread.started.thread_id` = `persisted.session_meta.id` =
  `persisted.session_meta.session_id`；三者都是非空 string。不得主张 artifact
  没有观察到的其他跨 stream equality 或跨 stream order；
- 每个 capture 中，`task_started.turn_id` = `turn_context.turn_id` =
  `task_complete.turn_id`，且 persisted ordinal 严格满足
  `task_started < turn_context < task_complete`；
- B 与 B_EXTENSION 的 failed function chain 严格为
  `function_call < mcp_tool_call_end < function_call_output`，且三者
  `call_id` 全部相等；B_SUCCESS_PROBE 的 successful custom chain 严格为
  `custom_tool_call < mcp_tool_call_end < custom_tool_call_output`，
  call 与 output 的 `call_id` 相等，但 end 的 `call_id` 与二者不等；
- 三个 MCP capture 的 exec `item.started.id = item.completed.id` 且 started
  严格早于 completed；该 exec item ID 与 persisted chain ID/call_id 均不相等。
  B/B_EXTENSION 必须匹配 `completed-failed` tuple，B_SUCCESS_PROBE 必须匹配
  `completed-success` tuple；
- B/B_EXTENSION 的 `tool_search_call < tool_search_output`，两者 `call_id`
  相等，但两者 `id` 各自唯一且彼此、与该 call_id 都不相等；
- 每场所有 persisted `response_item.id` 都是非空 string 且场内唯一。除上述
  call_id equality 外，不推断其他 response-item equality。

任一 exact key、逐字段 native type、lifecycle tuple、status literal、ID
equality/inequality、strict order 或 uniqueness 被破坏的 fixture 都必须
fail-closed；unknown 顶层 type、subtype、额外/缺失 key 同样拒绝。

`prototype/tests/fixtures/isolation/fixture-matrix.json` 必须至少包含下表 31 个
单字段/单关系 mutation；每项只能破坏所列一处，不能把多个错误合并后碰巧失败：

| fixture ID | 唯一 mutation | 精确 error code |
|---|---|---|
| `G01` | 删除一个 required key | `ISOLATION_GRAMMAR_EXACT_KEYS` |
| `G02` | 增加一个 unknown key | `ISOLATION_GRAMMAR_EXACT_KEYS` |
| `G03` | 一个字段改为未允许 native type | `ISOLATION_GRAMMAR_NATIVE_TYPE` |
| `G04` | unknown top-level type | `ISOLATION_GRAMMAR_TOP_LEVEL` |
| `G05` | unknown payload/item subtype | `ISOLATION_GRAMMAR_SUBTYPE` |
| `L01` | `started` tuple 的 `error` 改为 object | `ISOLATION_MCP_LIFECYCLE` |
| `L02` | `completed-failed` tuple 的 `result` 改为 object | `ISOLATION_MCP_LIFECYCLE` |
| `L03` | `completed-success` tuple 的 `error` 改为 object | `ISOLATION_MCP_LIFECYCLE` |
| `L04` | MCP `status` 改为未允许 literal | `ISOLATION_MCP_STATUS` |
| `C01` | thread/session 三者中一个 ID 不等 | `ISOLATION_CORRELATION_THREAD` |
| `C02` | task/turn 三者中一个 ID 不等 | `ISOLATION_CORRELATION_TURN` |
| `C03` | failed function chain 中一个 `call_id` 不等 | `ISOLATION_CORRELATION_FUNCTION` |
| `C04` | successful custom call/output `call_id` 不等 | `ISOLATION_CORRELATION_CUSTOM_EQUALITY` |
| `C05` | successful custom end `call_id` 被改成与 call 相等 | `ISOLATION_CORRELATION_CUSTOM_INEQUALITY` |
| `C06` | exec MCP started/completed item ID 不等 | `ISOLATION_CORRELATION_MCP_EQUALITY` |
| `C07` | exec MCP item ID 被改成与 persisted chain ID 相等 | `ISOLATION_CORRELATION_MCP_INEQUALITY` |
| `O01` | persisted call/end/output 任意相邻次序倒置 | `ISOLATION_ORDER_PERSISTED_TOOL` |
| `O02` | exec MCP completed 早于 started | `ISOLATION_ORDER_EXEC_MCP` |
| `T01` | tool_search output 早于 call | `ISOLATION_ORDER_TOOL_SEARCH` |
| `T02` | tool_search provider/leaf nested shape 或 literal 漂移 | `ISOLATION_TOOL_SEARCH_PROVIDER` |
| `T03` | tool_search `execution/status` 漂移 | `ISOLATION_TOOL_SEARCH_STATUS` |
| `T04` | tool_search `limit` 从 `1` 改为同类型 `2` | `ISOLATION_TOOL_SEARCH_ARGUMENTS` |
| `T05` | tool_search query literal 单字符漂移 | `ISOLATION_TOOL_SEARCH_ARGUMENTS` |
| `T06` | tool_search call/output `call_id` 不等 | `ISOLATION_CORRELATION_TOOL_SEARCH_EQUALITY` |
| `T07` | tool_search call `id` 改成自己的 `call_id` | `ISOLATION_CORRELATION_TOOL_SEARCH_INEQUALITY` |
| `T08` | tool_search output `id` 改成对应 `call_id` | `ISOLATION_CORRELATION_TOOL_SEARCH_INEQUALITY` |
| `T09` | tool_search output `id` 改成 call `id` | `ISOLATION_CORRELATION_TOOL_SEARCH_INEQUALITY` |
| `R01` | 同场两个 response item 复用 ID | `ISOLATION_RESPONSE_ID_UNIQUENESS` |
| `S01` | fresh source object commitment/bytes/lines 任一不匹配 | `ISOLATION_GOLDEN_SOURCE_COMMITMENT` |
| `S02` | fresh source opaque object ID 缺失、symlink 或非 regular | `ISOLATION_GOLDEN_SOURCE_UNAVAILABLE` |
| `U01` | grammar-valid B_SUCCESS custom `name=exec` 进入 D16 mode | `ISOLATION_TOOL_POLICY_LEAF` |

`prototype/tests/c04-verifier-cli.test.ts` 必须对每项以独立子进程调用 production
isolation CLI，要求非零 exit、stderr/JSON 只出现该精确 error code、全新 output
path 不产生文件；预置 output sentinel 时 bytes/hash 不变。fixture validator 的
纯函数 PASS、多个 mutation 合并为一例、只断言“失败了”或产生 partial output
均不计覆盖。`U01` 还必须证明 verifier 在尝试 parse opaque input 或调用工具前
即以 `ISOLATION_TOOL_POLICY_LEAF` 拒绝，tool invocation count 为 0。matrix
必须机械报告 `requiredNegativeCases=31`、`executedNegativeCases=31`、31 个
fixture ID 唯一且逐项 PASS。

`tool_search_call/tool_search_output` 只是 direct-tools 的 control-plane discovery：
必须成对满足上述 call_id/order 合同，并逐项匹配 recapture v3
`toolSearchControlPlaneObservation`：

- call 与 output 的 `execution` 都恰好为 `client`，`status` 都恰好为
  `completed`；
- call arguments 的 nested exact keys/type/value 恰好为
  `limit:number=1` 与
  `query:string="Playwright MCP browser_navigate navigate to URL"`；
- output `tools` 是长度 1 的 array，不是字符串 token。唯一 provider object 的
  exact keys/type 必须为
  `description:string,name:string,tools:array,type:string`，
  `name="mcp__playwright"`、`type="namespace"`，nested tools 长度恰好为 1；
- 唯一 leaf object 的 exact keys/type 必须为
  `defer_loading:boolean,description:string,name:string,parameters:object,strict:boolean,type:string`，
  `name="browser_navigate"`、`type="function"`、`defer_loading=true`、
  `strict=false`；
- leaf `parameters` exact keys/type 必须为
  `additionalProperties:boolean,properties:object,required:array,type:string`，
  `type="object"`、`additionalProperties=false`、`required=["url"]`；
  `properties` 只含 `url`，其 exact keys/type 为
  `description:string,type:string` 且 `type="string"`。三个 description 只冻结
  string native type；recapture v3 不存明文、hash 或 value equality，sanitized
  golden 必须把实际值 commitment 化。

provider namespace 不是可执行 browser leaf tool；随后真正执行的 leaf tool仍只能
属于冻结的
`browser_navigate`、`browser_snapshot`、`browser_click`、
`browser_fill_form`、`browser_wait_for`、`browser_run_code_unsafe` allowlist。
tool_search 本身不计作玩家 browser action，不得增加浏览器动作计数、不得授权第二
provider、第二 MCP server 或额外工具。

- 两份 golden raw 固定为
  `prototype/tests/fixtures/isolation/golden-codex-0.146.0-alpha.3.1-persisted-rollout.jsonl`
  与
  `prototype/tests/fixtures/isolation/golden-codex-0.146.0-alpha.3.1-exec-events.jsonl`。
  它们必须分别从 recapture v3 fixed private handoff 中的 fresh
  A、B、C、B_EXTENSION、B_SUCCESS_PROBE 五段 persisted/exec raw 逐段单向
  sanitize 后，按该 source set 的 capture ordinal、source-line ordinal 合并；
  每段只可由 recapture 的 opaque object ID 经上述固定 root resolver 读取，
  volatile temp raw 与原 session rollout 只作保留副本，不是生成 fallback；
  不得使用已删除的旧 discovery raw、旧 discovery commitment、structural
  projection、预期 verification 或手写目标对象反向生成；
- 生成前必须从 fixed private store 独立 read-back 五段 × 两 stream 的十个
  objects，逐段匹配 recapture `privateSourceHandoff` 与 `raw` 中的 opaque object
  ID、SHA-256、bytes、lines、mode、immutable flag，并逐行匹配 event order、
  variant source namespace + ID、exact keys、完整 native types、lifecycle tuple
  与上述 equality/order/uniqueness。任一 mismatch 必须停止，不得生成 golden；
- 两份 golden 的 provenance 只写入
  `prototype/tests/fixtures/fixture-expectations.json.isolationGoldenProvenance`，
  schema 固定为恰好两个 key：`persistedRollout` 与 `execEvents`。每项必须恰好包含
  `sourceGrammar`、`codexCliVersion`、`sourceSet`、`fixtureSourceCaptures`、
  `sanitizerVersion`、`sanitizerRuleset`、`goldenPath`、`goldenSha256`、
  `goldenLineCount`、`independentReadBackStatus=PASS` 与
  `privacyScanStatus=PASS`。`sourceSet` 必须逐字为
  `recapture-v3-private-handoff-A-B-C-B_EXTENSION-B_SUCCESS_PROBE`；
  `fixtureSourceCaptures` 必须按
  A、B、C、B_EXTENSION、B_SUCCESS_PROBE 的 capture ordinal 为有序数组，每项恰好
  包含 `captureId`、正整数
  `ordinal`、`sourceOpaqueObjectId`、64 位小写十六进制
  `sourceOpaqueCommitment`、正整数 `sourceLineCount` 与有序
  `eventOrder`；`sourceOpaqueObjectId` 必须逐字匹配 recapture 对应 stream 的
  opaque object ID；`eventOrder` 每项恰好包含正整数
  `sourceLineOrdinal`、`topLevelType` 与 `subtype`，并覆盖该 source 的每一原始行。
  `sourceOpaqueCommitment` 只能逐字复制 recapture 当前 fresh source 对应 stream
  的 raw SHA-256，不得写旧 discovery commitment、真实敏感内容或任何绝对
  private path。两个 `sourceGrammar` 必须分别为冻结 grammar ID，
  `codexCliVersion` 必须逐字等于
  `codex-cli 0.146.0-alpha.3.1`，SHA 必须为 64 位小写十六进制，
  version/ruleset 必须为非空 versioned ID，golden path 必须为上述两个 exact
  path，line count 必须为正整数，两个 status 只接受 `PASS`；额外 provenance
  key、缺字段、sourceSet、capture/source-line ordinal、event order、commitment
  或 hash/line count 不匹配均失败；
- sanitizer 必须从两份新版本 raw 的独立 read-back 结果，为上述两个 grammar ID
  各冻结一份 deterministic field allowlist；旧 0.142.4 手写 schema、旧
  incomplete matrix 或 projection 不得作为生成输入：
  - sanitizer 在删除或 commitment 化任何字段前，必须先按上述完整 known grammar
    校验 raw。已知的 system/developer/user message、reasoning、绝对路径及其他
    敏感值允许存在于 private raw，但必须在公开输出中删除或 commitment 化；
    未知顶层 type、未知 payload/item subtype、未知 key 或 native type 错配必须
    fail-closed，不能靠 sanitizer 丢弃未知结构后继续；
  - persisted sanitized golden 保留 exact
    `payload,timestamp,type` envelope 与上表 payload keys；敏感字符串替换为同
    native type commitment，敏感数组/对象替换为同 native type 的 commitment
    容器。`world_state` 在 grammar golden 中仍保留 `full=boolean` 与
    `state=object` 类型，但任何公开 structural projection 只输出整个 payload 的
    SHA-256 commitment，不公开 `full` 或 `state` 内容；
  - `function_call.arguments` 在 raw grammar 通过后恰好 parse 一次为 object，再
    按 browser 工具参数 allowlist 生成公开投影；`custom_tool_call.input` 在
    grammar golden 中只保留 opaque string native type 与 commitment。D16–D20
    只有在 name 已通过 Playwright leaf allowlist 后才可 parse/投影 custom input；
    B_SUCCESS_PROBE 的 `exec` input 不得 parse、执行或授权；
    `function_call_output.output` 只保留 string native type 与 commitment，
    `custom_tool_call_output.output` 只保留 array native type 与 commitment。
    tool_search pair 只保留 control-plane correlation/order 和冻结工具集合；
    `mcp_tool_call_end` 只保留 call correlation、`invocation/result` object
    native type 与 commitment；
  - exec sanitized golden 按上表 exact envelope/item keys 保存；
    `agent_message.text` 删除或 commitment 化，`mcp_tool_call.arguments` 保持
    object native type，并只投影 allowlisted 参数；
  - sanitized 输出必须递归扫描 secret/token/key、PII、system/developer/user
    message、reasoning 内容和本机绝对路径；允许保留的 cwd/workspace 只能输出
    commitment/hash，不能输出原路径。输出必须在独立进程从磁盘 read-back，重新做
    grammar、hash/line count、sourceSet/order、lifecycle/correlation 与
    forbidden-content scan，全部 PASS 后才能成为 golden；generator 内存中的对象
    或 projection PASS 不能替代该 read-back；
- raw→golden/provenance→独立 read-back/privacy/hash/order 全部 PASS 后，golden
  即可使用；该 PASS 只建立“允许清理”的前置条件，不自动授权删除。fixed private
  handoff 的十个 `0400+uchg` objects、两个 `0500+uchg` directories、volatile
  temp raw/workspace 或对应 original session rollout 的任何解锁、移动或删除，
  仍必须先取得 Owner 对精确对象/路径的明确 cleanup 授权；未获授权时 fixed store
  继续按 recapture v3 的 mode/flags/commitment 保留，volatile 副本继续以
  `0600/0700` 保留，不得把“尚未清理”误报为 golden 失败。获明确授权并完成授权
  范围内的全部清理后，必须
  在 `fixture-expectations.json.isolationGoldenSourceCleanupAttestation` 写入
  exact `sourceSet`、`status=PASS`、
  `captureIds=["A","B","C","B_EXTENSION","B_SUCCESS_PROBE"]`、
  `privateHandoffObjectsAbsent=true`、`volatileRawAbsent=true`、
  `originalSessionRolloutsAbsent=true`、`temporaryWorkspacesAbsent=true` 与 UTC
  `attestedAt`；再由独立进程验证 raw/rollout absence、golden/provenance 字节未变
  和 attestation schema。attestation 只证明已授权 cleanup 的完成状态，不是
  golden 使用前置，也不得伪造为 cleanup 授权。本条只清理 grammar fixture 制备的
  五段 fresh source，不适用于 §3.2 要求保留到最终 review/seal 的 D16–D20
  private raw；
- D16–D20 private raw 出现上述 matrix 之外的新 type/subtype/key/native type
  shape 时，当前样本技术拒绝并立即停止 C04；必须重新执行 discovery、amendment
  与 external grammar review，禁止在实现、运行或 review/seal 阶段临场扩
  grammar；
- 唯一 provider 为 direct-tools Playwright MCP
  `@playwright/mcp@0.0.76`；preflight 必须保存已解析 package version、
  npm integrity、实际 server argv 与工具 inventory。`--ignore-user-config`、唯一
  显式 Playwright server 配置和逐场 tool/server inventory 共同证明 Chrome
  DevTools MCP 与 `node_repl` 未启用；禁止为未定义 server 传
  `enabled=false`。同时禁止 in-app Browser plugin、Chrome 与 Computer Use；
- 唯一允许 origin 为 `http://127.0.0.1:4202`，只允许
  `browser_navigate`、`browser_snapshot`、`browser_click`、
  `browser_fill_form`、`browser_wait_for`、`browser_run_code_unsafe`；
- 禁止集合：repo/Issue/计划/协议读取、shell、Git、文件读写、任意第二浏览器或
  第二应用 Session；
- 五场聚合唯一性规则。

参数 allowlist：

- `browser_navigate.url` 必须逐字等于 `http://127.0.0.1:4202/`，且整场恰好
  一次；
- `browser_snapshot` 只允许整数 `depth=1..12`；
- `browser_click` 只允许 `target` 与人类可读 `element`，不得携带 URL 或代码；
- `browser_fill_form` 只能填写一次“匿名编号”，value 必须等于本场 Dxx；
- `browser_wait_for` 只允许 `time=1..30`，不得等待或匹配外部 URL；
- `browser_run_code_unsafe` 全场只能执行下面两段逐字代码各一次；verifier 对
  解码后的 `code` 字符串取 SHA-256，并在 preflight 冻结两个 hash，任何字符
  差异均拒绝。

context/page 身份探针：

```js
async (page) => {
  const origin = 'http://127.0.0.1:4202'
  if (new URL(page.url()).origin !== origin) throw new Error('C04_ORIGIN')
  if (page.context().pages().length !== 1) throw new Error('C04_PAGE_COUNT')
  const cookies = await page.context().cookies(origin)
  if (cookies.some((cookie) => cookie.name === 'newEraC04ContextId')) {
    throw new Error('C04_CONTEXT_REUSED')
  }
  const ids = await page.evaluate(() => ({
    contextId: crypto.randomUUID(),
    pageId: crypto.randomUUID(),
  }))
  await page.context().addCookies([{
    name: 'newEraC04ContextId',
    value: ids.contextId,
    url: origin,
    httpOnly: true,
    sameSite: 'Strict',
  }])
  await page.evaluate((pageId) => {
    if (sessionStorage.getItem('newEraC04PageId') !== null) {
      throw new Error('C04_PAGE_REUSED')
    }
    sessionStorage.setItem('newEraC04PageId', pageId)
  }, ids.pageId)
  return { ...ids, origin, pageCount: 1 }
}
```

唯一下载探针：

```js
async (page) => {
  const origin = 'http://127.0.0.1:4202'
  if (new URL(page.url()).origin !== origin) throw new Error('C04_ORIGIN')
  if (page.context().pages().length !== 1) throw new Error('C04_PAGE_COUNT')
  const cookies = await page.context().cookies(origin)
  const contextId = cookies.find(
    (cookie) => cookie.name === 'newEraC04ContextId',
  )?.value
  const pageId = await page.evaluate(() =>
    sessionStorage.getItem('newEraC04PageId'),
  )
  if (!contextId || !pageId) throw new Error('C04_BROWSER_ID_MISSING')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载匿名 JSON' }).click(),
  ])
  return {
    contextId,
    pageId,
    origin,
    pageCount: 1,
    suggestedFilename: download.suggestedFilename(),
    absolutePath: await download.path(),
  }
}
```

每场必须同时满足：

- 新启动的独立 Codex CLI 进程；
- 新 `session_meta.id` 与新 rollout JSONL；
- `source=cli`；
- 新 `mktemp -d` 工作区，创建 CLI 时为空；
- `workspace_roots` 只能包含该临时目录；
- 玩家不读取 repo、Issue、计划、协议、阈值、anti-pass 或其他样本；
- 固定模型 `gpt-5.6-sol`、reasoning `xhigh`；
- 只通过浏览器读取中性玩家包允许看到的页面；
- 一个新 browser/context/page；
- 恰好一个固定初态应用 Session；
- 无刷新、重开、重置或第二 Session；
- 严格串行：上一场七类证据、裁定、commit 与 push 完成后才启动下一场；
- 保存、browser download、raw/sidecar/receipt 四方核验、清空之后才释放统一访谈。

不允许临场切换回 collaboration subagent，也不允许另一种“等价”隔离。若独立
CLI 无法运行，该样本判技术无效并停止 C04，不临场修改合同。

### 3.2 身份证据

每场开始前生成并封存
`diagnostic-isolation-preflight.json/.sha256`，内容包含有效 argv、非敏感环境
投影、prompt hash、CLI absolute path/version/binary SHA-256/codesign
TeamIdentifier/完整 Authority、Node 24 identity、Playwright MCP package
version/integrity/server argv、预期 tool inventory、两个 unsafe code hash、origin
和临时目录空态。

CLI 结束后，verifier 读取真实 rollout 与 `--json` event stream。原文件含系统
指令、内部推理和本机隐私，不得提交到公开仓库。两份原始文件必须立即写入本机
私有、内容寻址的 evidence store：

```text
/Users/leo/.codex/private-evidence/new-era-2/
  g1a-20260727-rc9-01/C04/<Dxx>/<sha256>
```

写入后逐文件 `chmod 400`、目录 `chmod 500`，再执行 `chflags uchg`。verifier
必须用 `stat -f '%Sf' <path>` 证明 `uchg` 存在，并保存 object ID、hash、bytes、
line count 和 flag 状态。私有 raw 至少保留到 Gate 1A 最终报告及其独立 seal
封存；在此之前不得清理，之后删除仍须 Owner 明确授权。IR 与 seal 必须直接读取
私有 raw 重新运行 verifier；缺失、hash 变化或 immutable flag 失效返回
`PRIVATE_EVIDENCE_UNAVAILABLE` 并拒绝 C04。当前不把未建立的离机备份写成已具备
能力；本机证据丢失只能 fail-closed。

private evidence 解析必须从固定 root
`/Users/leo/.codex/private-evidence/new-era-2` 开始，对 root 到最终 object 的每一
级 path component 逐级 `lstat`：中间项必须为非 symlink directory，最终项必须为
非 symlink regular file；任何 symlink、`..`、root escape 或类型变化都返回
`PRIVATE_EVIDENCE_UNAVAILABLE`。只对最终字符串做一次 `realpath` 检查不能替代
逐级 `lstat`。

同时生成可公开复验的逐行结构投影：

- `agent-rollout-structural-evidence.jsonl/.sha256`；
- `cli-events-structural-evidence.jsonl/.sha256`。

投影覆盖原文件每一行，保存 ordinal、persisted 来源的 timestamp、顶层 type、
结构关联 ID 与原始行 SHA-256。persisted projection 按完整已观测矩阵分别处理：
`session_meta`、`turn_context`、`world_state`；
`response_item/message`、`response_item/reasoning`、
`response_item/function_call`、`response_item/function_call_output`、
`response_item/custom_tool_call`、`response_item/custom_tool_call_output`、
`response_item/tool_search_call`、`response_item/tool_search_output`；以及
`event_msg/task_started|user_message|agent_message|token_count|task_complete`
与 `event_msg/mcp_tool_call_end`。其中 `world_state` 只输出整个 payload 的 SHA-256
commitment，不输出 `full` 或 `state` 内容；`function_call.arguments` 恰好 parse
一次为 object 后，才允许投影 allowlisted 工具参数。`custom_tool_call.input`
默认只输出 opaque string commitment；仅 D16–D20 中 name 已通过 Playwright leaf
allowlist 的 custom call 才可再 parse/投影，B_SUCCESS_PROBE 的 `exec` 永久只是
fixture-source coverage。tool_search pair 只投影 control-plane correlation、
order 与冻结工具名集合，不计 browser action；其他 output/invocation/result 只
保留 native type、关联 ID 与 commitment。

exec projection 只按
`thread.started`、`turn.started`、`item.completed/agent_message`、
`item.completed/error`、`item.started|item.completed/mcp_tool_call`、
`turn.completed`、`error` 与 `turn.failed` 输出；不得生成未观测的 started
agent message 或 reasoning item。
`mcp_tool_call.arguments` 必须为 object，只投影 allowlisted 参数。投影另存两次
unsafe 探针的成功状态、context/page ID、origin、pageCount 与下载 metadata；
删除其他 message、reasoning、system/developer/user 内容、绝对路径和无关 tool
output。projection
只能由已验证 raw 单向生成 allowlisted 结构，不能作为 raw 输入、不能补造 raw
字段，也不能反向生成 golden raw。raw 必须先通过对应来源的完整 known grammar；
已知敏感字段随后删除或 commitment 化；未知顶层 type、subtype、key 或 native
type 错配在生成 projection 前直接拒绝。投影输出自身再严格拒绝 projection
allowlist 外字段。投影头保存原
文件整体 SHA-256、line count 与逐行 commitment；真实 D16–D20 private raw 的每一
行仍须现场重新计算 SHA-256，golden 或 projection 不能替代 private raw
commitment。

公开 clean clone 只能复算投影自身、工具参数规则、探针公开结果与原始
commitment，不能声称独立证明私有 raw 没有被错误投影。完整 isolation
reverification 明确依赖同机挂载的 private evidence store；这是 candidate
admission、IR 与 seal 的硬依赖，不把运营证明包装成可移植证明。

随后生成
`diagnostic-isolation-verification.json/.sha256`。每份
`sample-record.json.identityAndIsolation` 的公开 artifact path 必须
repo-relative，private raw 只用 opaque object ID 引用；临时工作区绝对路径只作
运行事实保存。字段包括：

```text
diagnosticIsolationProfile
agentSessionId
privateRolloutObjectId
privateCliEventObjectId
agentRolloutSha256
agentRolloutStructuralEvidencePath
agentRolloutStructuralEvidenceHash
cliEventStructuralEvidencePath
cliEventStructuralEvidenceHash
agentModel
agentReasoningEffort
agentCliBinaryPath
agentCliVersion
agentCliBinarySha256
agentCliTeamIdentifier
agentCliAuthority
temporaryWorkspace
temporaryWorkspaceInitiallyEmpty
workspaceRoots
firstSessionMetaSummary
firstTurnContextSummary
toolCallPolicyScan
browserProvider
playwrightMcpVersion
playwrightMcpIntegrity
browserContextId
browserPageId
isolationPreflightHash
isolationVerificationHash
canonicalInputPath
canonicalInputHash
```

verifier 必须机械核验 session meta、首个 turn context、cwd、workspace roots、
rollout source、模型、reasoning、CLI absolute path/version/binary SHA-256/codesign
identity、Node 24 identity、临时目录初态、Playwright MCP 版本/integrity、origin、
逐工具参数 allowlist、context/page 探针与恰好一个应用 Session。

每场 canonical input 与 verification path 冻结为：

```text
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/diagnostics/TECH-RC9-<Dxx>/diagnostic-isolation-input.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/diagnostics/TECH-RC9-<Dxx>/diagnostic-isolation-input.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/diagnostic-isolation/TECH-RC9-<Dxx>-verification.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/diagnostic-isolation/TECH-RC9-<Dxx>-verification.json.sha256
```

其中 `<Dxx>` 只可展开为 `D16`、`D17`、`D18`、`D19`、`D20`。单场
verification 必须记录 input 的 repo-relative canonical path 与文件
SHA-256，并复算两个 sidecar；input、verification、sidecar 及它们逐项引用的公开
artifact 均不得为 symlink。

D20 后 aggregate 只接受 D16、D17、D18、D19、D20 上述二十个展开后的精确路径，
不能扫描目录、接受别名或由调用方另传文件。E 尚未创建时，operational aggregate
只从当前工作树上述 canonical path 读取，并要求 Git index mode 为普通文件；E
创建后，full manifest、IR 与 seal 只能从 `E:<canonical-path>` 读取同一 input、
verification 与 sidecar blobs，并拒绝 Git symlink mode。两种模式都必须逐场
重新运行 `verify-diagnostic-isolation.mjs` 的 single-session operational
validator，将新结果写入场次专属外部临时文件，并要求它与已封存 canonical
verification 逐字节相等；为此 verification JSON 不得包含输出目的地、运行时钟
或其他非确定字段。随后才核验五个 session ID、rollout commitments、临时目录、
browserContextId、browserPageId 均唯一。任一 symlink、字段缺失、hash/byte
mismatch、无法复算或 policy scan 失败，该样本技术无效并停止 C04。运营负责人
只保存身份与协议事实，不把内部推理或下载内容暴露给玩家。

## 4. C04 source 与证据谱系

### 4.1 Isolation grammar amendment 迁移

当前 `plan_ref=31c05fee5130cd25f6273037468928d9196858f0` 已有效冻结
compatibility v2/binary 决策，但不覆盖 discovery 揭示的 grammar drift。本计划
始终保持 `ISOLATION_GRAMMAR_AMENDMENT_PROPOSED / NOT_STARTED`，不会因外部审查
而修改自身。本 amendment 只替换 isolation grammar authority、coverage 与迁移
binding；compatibility v2/binary、I/E/M/F 拓扑、Gate 边界、模型、MCP profile、
P07/P08 与 D16–D20 编号及门槛均不变。implementation 必须按以下不可重排顺序完成
迁移：

1. 两名 external reviewer 逐字审查当前 plan blob、discovery pair 与 recapture
   pair，分别记录精确 `P0/P1/P2/outcome`；
2. 第三名 issuer 验证两份 review 均为
   `P0=0 / P1=0 / P2=0 / outcome=PASS` 后，以 create-new/no-clobber 生成并复算
   isolation grammar amendment review receipt pair；receipt 创建后本计划冻结，
   不得再修改；
3. 在 evidence-plan 分支创建恰好七个变更文件的 Phase 0 migration commit：
   本计划、discovery JSON/sidecar、recapture JSON/sidecar 与 grammar review
   receipt JSON/sidecar。推送后以该 commit 作为新 `plan_ref`；compatibility
   probe/receipt pair 已存在于父 `31c05fee...`，不得在该七文件 commit 中重写；
4. 在 #58 明确记录“新 `plan_ref` supersedes
   `31c05fee5130cd25f6273037468928d9196858f0`”，同时记录 discovery JSON、
   recapture JSON 与 grammar review receipt JSON 的 SHA-256；Issue 后续只引用新
   `plan_ref` 与这三个 hash；
5. 把该 Phase 0 migration commit cherry-pick 到
   `codex/rc9-08r3-c04-implementation` 当前
   `fc6237c21ac3e5a4ba839fdec73879aad92be923` 之后；此 cherry-pick 必须先于
   isolation grammar implementation commit；
6. cherry-pick 后先更新 `CONTEXT.md`、`PLANS.md` 的 active plan/profile
   入口，再依次更新测试运营合同/profile、isolation verifier、两份新版本
   fixture-source golden/provenance、manifest fixtures 与 C04 authority probe；
   随后重新计算 entrypoint 与九个 authority blob hashes，再从上述唯一绝对 CLI
   binary 重新运行 fixtures/probe；
7. `31c05fee...` plan_ref 下针对旧 incomplete grammar 产生的所有临时
   verification JSON、hash、golden、projection、stdout capture 一律作废，不得进入
   `commandResults[]`、E、CM、IR 或 seal。

新 source 与 dependency integration 必须包含与新 `plan_ref` 相同的 amendment
plan/discovery pair/recapture pair/grammar review receipt pair blobs，以及既有
compatibility probe/receipt pair、v2 entrypoint blobs 和重新绑定后的同一组九个
authority blobs；任一 hash 不同都不得构建 C04。

### 4.2 分支拓扑

- 产品实现从精确 source `cd2fc9716d98c160fe530c593347992f18bf96e4`
  创建 `codex/rc9-08r3-c04-implementation`；
- source change allowlist 冻结为下表逐字文件名；不接受目录、glob、类别名或替代
  文件：

| exact path | 本轮唯一授权 |
|---|---|
| `CONTEXT.md` | 既有 Phase 0 plan reference 更新 |
| `PLANS.md` | 既有 Phase 0 活跃计划入口更新 |
| `docs/exec-plans/active/2026-07-29-gate1a-rc9-c04-recovery-plan.md` | 本 amendment authority |
| `docs/exec-plans/evidence/2026-07-29-c04-cli-compatibility-probe.json` | version decision compatibility evidence |
| `docs/exec-plans/evidence/2026-07-29-c04-cli-compatibility-probe.json.sha256` | compatibility evidence sidecar |
| `docs/exec-plans/evidence/2026-07-29-c04-compatibility-amendment-review.json` | external compatibility review receipt |
| `docs/exec-plans/evidence/2026-07-29-c04-compatibility-amendment-review.json.sha256` | external review receipt sidecar |
| `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-discovery.json` | observed source grammar discovery authority |
| `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-discovery.json.sha256` | grammar discovery sidecar |
| `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-recapture.json` | fresh recapture grammar/native-type/correlation authority |
| `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-recapture.json.sha256` | grammar recapture sidecar |
| `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-amendment-review.json` | outcome-neutral external grammar review receipt |
| `docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-amendment-review.json.sha256` | grammar review receipt sidecar |
| `docs/exec-plans/active/2026-07-27-gate1a-rc9-test-operations.md` | 冻结 standalone CLI isolation profile |
| `prototype/package.json` | 仅 wiring 本计划命令 |
| `prototype/scripts/candidate-manifest-contract.mjs` | versioned manifest 共享纯合同 |
| `prototype/scripts/check-playtest-fixtures.mjs` | 调用共享合同并验证 fixture matrix |
| `prototype/scripts/verify-c04-runtime-equivalence.mjs` | runtime equivalence verifier |
| `prototype/scripts/verify-diagnostic-isolation.mjs` | 双 grammar isolation verifier |
| `prototype/scripts/verify-frozen-evidence.mjs` | source/evidence-lineage guard |
| `prototype/scripts/verify-playtest-manifest.mjs` | fixtures/probe/full 三模式 verifier |
| `prototype/scripts/create-deterministic-archive.mjs` | 只给目标文件增加 `O_EXCL`/no-clobber；成功产物字节必须不变 |
| `prototype/tests/playtest-manifest.test.ts` | 删除 hidden legacy manifest bypass；以外部进程真实断言三模式 exit/output/no-clobber |
| `prototype/tests/c04-verifier-cli.test.ts` | 外部子进程断言 runtime/frozen/isolation 的 argv/exit/symlink/no-clobber/raw golden/aggregate |
| `prototype/tests/deterministic-archive.test.ts` | 只验证 archive no-clobber 与成功产物字节不变 |
| `prototype/tests/fixtures/fixture-expectations.json` | 登记 manifest/isolation fixtures 与两份 golden provenance schema |
| `prototype/tests/fixtures/isolation/aggregate-valid.json` | isolation aggregate contract fixture |
| `prototype/tests/fixtures/isolation/fixture-matrix.json` | isolation 正反矩阵 |
| `prototype/tests/fixtures/isolation/sample-valid.json` | isolation single-sample contract fixture |
| `prototype/tests/fixtures/isolation/golden-codex-0.146.0-alpha.3.1-persisted-rollout.jsonl` | 脱敏真实 persisted rollout grammar golden |
| `prototype/tests/fixtures/isolation/golden-codex-0.146.0-alpha.3.1-exec-events.jsonl` | 脱敏真实 `codex exec --json` grammar golden |
| `prototype/tests/fixtures/manifests/candidate-c01-rewrapped-by-cm02-rejected.json` | v0.2 history rejection fixture |
| `prototype/tests/fixtures/manifests/candidate-c02-first-manifest-valid.json` | v0.2 manifest fixture |
| `prototype/tests/fixtures/manifests/candidate-c02-reuses-c01-evidence-rejected.json` | v0.2 history rejection fixture |
| `prototype/tests/fixtures/manifests/candidate-c02-second-manifest-valid.json` | v0.2 manifest fixture |
| `prototype/tests/fixtures/manifests/candidate-c03-rejection-history-rejected.json` | C03 不可重包装 fixture |
| `prototype/tests/fixtures/manifests/candidate-c04-authority-probe.json` | C04 九 authority probe |
| `prototype/tests/fixtures/manifests/candidate-c04-synthetic-valid.json` | synthetic v0.3 纯合同正例 |
| `prototype/tests/fixtures/manifests/candidate-invalid-incomplete-authority.json` | authority 缺失反例 |
| `prototype/tests/fixtures/manifests/candidate-invalid-source-sha.json` | source SHA 反例 |
| `prototype/tests/fixtures/manifests/candidate-missing-profile-rejected.json` | profile 缺失反例 |
| `prototype/tests/fixtures/manifests/candidate-unknown-profile-rejected.json` | profile 未知反例 |
| `prototype/tests/fixtures/manifests/candidate-v03-extra-authority-rejected.json` | v0.3 多余 authority 反例 |
| `prototype/tests/fixtures/manifests/candidate-v03-path-mismatch-rejected.json` | v0.3 path 反例 |
| `prototype/tests/fixtures/manifests/candidate-v03-protocol-mismatch-rejected.json` | v0.3 protocol 反例 |
| `prototype/tests/fixtures/manifests/candidate-v03-role-mismatch-rejected.json` | v0.3 role 反例 |
| `prototype/tests/fixtures/manifests/candidate-v03-scenario-mismatch-rejected.json` | v0.3 scenario 反例 |
| `prototype/tests/fixtures/manifests/candidate-valid.json` | v0.2 compatibility 正例 |
| `prototype/tests/fixtures/manifests/candidate-zero-id-rejected.json` | manifest ID 反例 |

- 除上表 49 个无重复 exact path 外，source commit 修改任何其他路径都失败；
- source scope audit/guard 必须把本计划、discovery pair、recapture pair 与
  grammar review receipt pair 这七个本轮 Phase 0 exact path 视为允许的只读
  authority 输入；既有 compatibility probe/receipt pair 继续作为父 plan_ref
  已冻结的只读 authority，同时拒绝
  `docs/exec-plans/evidence/**` 下任何其他新增、修改或替代路径；
- 明确禁止修改 `prototype/src/**`、`prototype/scripts/playtest-host.mjs`、
  `prototype/scripts/management-ledger-contract.mjs`、Vite 配置、lockfile、
  玩法/数值 fixtures、capture ledger、玩家包或访谈；
- 不修改玩法、数值、runtime UI、capture ledger、玩家包或访谈；
- 实现通过后把精确 source commit 集成到证据谱系
  `5b9438cc5123ba35d8a703f3507bbf463e90176d`；
- 集成必须证明 RC8、C01、C02、C03、P01–P06 与 D01–D15 全部旧证据 tree
  逐字节不变。

### 4.3 旧证据 guard

`5b9438cc5123ba35d8a703f3507bbf463e90176d` 的冻结基线为：

| path | tree ID | files | inventory SHA-256 |
|---|---|---:|---|
| `data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01` | `c5714f7ca7adb5e8fe052d4d00f27c545b988347` | 67 | `3f55528ad8993aae8646a152489227eee76c280e0ae2c2d092b57dc2ec5398e2` |
| `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C01` | `55f661518c7ed8a2cc99f0fc0f25fabecd24c286` | 41 | `fa7a926f64dfff08e2c86b1baa8f87217aecce5e99232154f534110538c2f5c6` |
| `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C02` | `9b7dbae2c0c5d1bba45399e77dac65766911d3b3` | 62 | `250a9d82e0e2056af1622bd063e806d236178e72ee93b1a6f178708d056f4664` |
| `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C03` | `6c3e5bf9bf4808724534c7c1fb472fc487a4d350` | 65 | `1c107b09ebdc4eacf0ac2bae388402aee2f12ad1dadbf081e547da66ac40462d` |

inventory 算法冻结为：按 Git path 字典序，对每个 blob 写一行
`<content-sha256><两个空格><bytes><两个空格><相对路径>\n`，再对完整 UTF-8
文件取 SHA-256。实现必须提供单一 `guard:frozen-evidence` 命令，分别在
evidence lineage 集成前、dependency integration 后、C04 seal 前运行。

source 分支模式：

```text
npm run guard:frozen-evidence -- \
  --mode source \
  --baseline cd2fc9716d98c160fe530c593347992f18bf96e4 \
  --head <source-sha> \
  --output <source-guard-json>
```

只验证 base→HEAD 没有修改、删除或新增任何 `data/playtests/**`。成功状态为
`PASS_SOURCE_SCOPE`；差异返回 `FROZEN_EVIDENCE_SOURCE_DIFF`。

evidence lineage 模式：

```text
npm run guard:frozen-evidence -- \
  --mode evidence-lineage \
  --baseline 5b9438cc5123ba35d8a703f3507bbf463e90176d \
  --head <integration-sha> \
  --output <c04-evidence-guard-json>
```

复算上表四个 tree、file count 与 inventory。成功状态为
`PASS_EVIDENCE_LINEAGE`；失败码分别为 `FROZEN_EVIDENCE_TREE`、
`FROZEN_EVIDENCE_FILE_COUNT`、`FROZEN_EVIDENCE_INVENTORY`。未知 mode 或缺失
参数返回 `FROZEN_EVIDENCE_SHAPE`。

两种输出统一保存 schema version、mode、base/head、逐路径观测值、命令 argv 与
结果。integration 输出与 sidecar 保存到 C04 新证据，CM01 必填
`frozenEvidenceGuard.path/sha256/baselineSha/status`。实际 manifest verifier、
IR 与 seal 都必须独立复算 evidence-lineage 四树，不能只信字段。

### 4.4 C04 不可变候选

C04 独立封存：

- 新 source SHA 与 dependency integration SHA；
- 新 build ID `g1-rc-20260729.rc9-c04`；
- scenario `0.5.1`、protocol v0.3、schema v2；
- 新 candidate core、candidate-build manifest、artifact manifest 与 UTC archive；
- `authorityProfile=rc9-v03`；
- P07/P08 与 D16–D20 独立编号和证据。

即使产品 bundle 与 C03 逐字节相同，C04 的 source/build/archive/authority 仍必须
使用新身份，不能复用 C03 seal。

提交拓扑冻结为：

```text
cd2fc97 -> amended plan_ref -> implementation commits -> sourceSha
5b9438c -> integrate sourceSha -> I(dependencyIntegrationSha)
I -> Phase 6 / P07 / P08 / D16...D20 / diagnostics manifest commits
  -> E(candidateEvidenceSnapshotSha; no CM, no freeze/IR/seal output)
E -> M(CM01 commit)
M -> F(freeze-preparation outputs/audit)
F -> IRxx independent-review record
IRxx -> Sxx seal record
```

- `I` 是只包含新计划授权代码及 authority 集成的
  `dependencyIntegrationSha`；它不是 candidate evidence snapshot；
- Phase 6 outputs、candidate core/build/artifact/archive、P07/P08、D16–D20 与
  diagnostics manifest 必须按既有串行规则提交，最后一个包含这些证据、但不包含
  CM01 的 commit 定义为 `E=candidateEvidenceSnapshotSha`；
- CM01 在 `E` 之后创建，必须同时绑定 `sourceSha`、
  `dependencyIntegrationSha=I` 与 `candidateEvidenceSnapshotSha=E`。full
  verifier 必须用必填 `--manifest-git-sha M` 从 M 的 canonical CM01 path 读取
  manifest，再用 Git object API 从 `E:<canonical-path>` 读取 candidate
  evidence；不得读取可变工作树同名文件；
- full verifier output 只能在 `M` 之后写入 F 的 freeze-audit namespace，不能
  回写 M 或 E。由此 CM 不引用自己的 verification output，verification output
  则明确绑定 M 与 E，消除 manifest/evidence 自引用；
- E 中的 integration runtime output 必须记录
  `verificationInputSha=I`、`headSha=I`、`artifactGitSha=sourceSha`。三者不得
  折叠为一个“当前 HEAD”字段。

## 5. Phase 6 验证

以下公共命令清单只标识必须完成的 command ID；每项实际调用必须保留其在本计划、
测试运营合同与当前 source/integration 身份下所需的完整 argv，不得把清单中的短名
解释为省略必填参数的无参调用。

source 与 dependency integration 的每一条 Phase 6 命令，以及
`rc:repro`、clean clone 或其他子进程，都必须使用 process-local 的同一 exact
环境，不得依赖调用 shell 的继承 PATH：

```text
PATH=/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin
commandVNodePath=/opt/homebrew/opt/node@24/bin/node
resolvedNodeRealPath=/opt/homebrew/Cellar/node@24/24.18.0/bin/node
nodeVersion=v24.18.0
nodeBinarySha256=72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f
```

每个 source Phase 6 output，以及 integration 的
`evidence/phase6-retry-02` 目录或其中任何文件，在创建前都必须先在内存中完成
Node identity preflight。preflight 必须逐字验证并随后随该项成功结果保存：

- exact PATH；
- `command -v node` 的 exact path 与 resolved realpath；
- Node version 与 binary SHA-256；
- 本项完整 argv；
- `plan_ref`；
- source 模式的 source SHA，或 integration 模式的 I 与 artifact source SHA。

任一 identity、PATH、argv 或 Git binding 漂移都必须在创建目录、JSON、TXT、
sidecar、archive 或其他 Phase 6 output 前失败，保持零输出。通过 preflight 后，
同一 process-local 环境必须传给该命令的全部 child process；TXT 结果保存 identity
header，JSON 结果保存等价的结构化 identity。不得只在场次开头声明一次而让后续
命令使用未验证环境。禁止通过 `brew install`、`brew link`、`brew unlink`、
`brew reinstall`、修改 symlink 或修复 Node 25 来取得 PASS，也不得回退到 Node 25、
系统 Node、alias、用户 PATH 或其他“等价”wrapper。

source 与 dependency integration 都必须完成公共命令：

```text
npm run lint
npm run test:run
npm run build
npm run rc:build
npm run rc:verify
npm run e2e:rc
npm run rc:archive
npm run rc:verify-archive
npm run schema:fixtures
npm run guard:rc8
npm run rc:repro
```

source 分支另外执行：

```text
npm run guard:frozen-evidence -- \
  --mode source \
  --baseline cd2fc9716d98c160fe530c593347992f18bf96e4 \
  --head <source-sha> \
  --output <external-temp-source-guard-json>
npm run manifest:verify -- \
  --fixtures \
  --output <external-temp-manifest-fixtures-json>
npm run manifest:verify -- \
  --probe tests/fixtures/manifests/candidate-c04-authority-probe.json \
  --repo-root .. \
  --output <external-temp-manifest-probe-json>
npm run runtime:equivalence -- \
  --head <source-sha> \
  --artifact-git-sha <source-sha> \
  --output <external-temp-runtime-equivalence-json>
```

dependency integration 另外执行，并把输出保存到 C04
`evidence/phase6-retry-02/**`：

```text
npm run guard:frozen-evidence -- \
  --mode evidence-lineage \
  --baseline 5b9438cc5123ba35d8a703f3507bbf463e90176d \
  --head <integration-sha> \
  --output data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6-retry-02/frozen-evidence-guard.json
npm run manifest:verify -- \
  --fixtures \
  --output data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6-retry-02/manifest-fixtures.json
npm run manifest:verify -- \
  --probe tests/fixtures/manifests/candidate-c04-authority-probe.json \
  --repo-root .. \
  --output data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6-retry-02/manifest-probe.json
npm run runtime:equivalence -- \
  --head <integration-sha> \
  --artifact-git-sha <source-sha> \
  --output data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6-retry-02/runtime-equivalence.json
```

上述四个 integration Phase 6 JSON 是本轮新增 verifier no-clobber 的精确范围：
均为 repo-root-relative canonical path，且必须尚不存在，失败后不得覆盖重跑。
其 sidecar exact path 为：

```text
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6-retry-02/frozen-evidence-guard.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6-retry-02/manifest-fixtures.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6-retry-02/manifest-probe.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6-retry-02/runtime-equivalence.json.sha256
```

每个 JSON 必须同时以 create-new 方式生成上述 sidecar；
sidecar 逐字保存 JSON SHA-256 与 repo-relative path，JSON 或 sidecar 任一已存在都
必须在写入前失败。

字面量目录 `phase6-retry-02` 是 C04 唯一有效的 Phase 6 command-results root。
十四项
`commandResults[]` 的 JSON/TXT 都必须位于该目录；C01–C03 的既有
`evidence/phase6/**` 路径不变。fixtures/probe 的非绝对 `--output` 必须以
`repoRoot` 解析，不能以 `prototype` npm cwd 解析；外部 source preflight 仍只用
绝对临时路径。回归测试必须从非 repo-root cwd 启动真实 production CLI，并证明
repo-relative output 落到临时 repo root 下的 canonical path，未落到 cwd 下。
`phase6-retry-02` 不得解释为 `phase6-retry-*` glob，也不授权
`phase6-retry-03` 或任何未来 retry root。

旧 `evidence/phase6/frozen-evidence-guard.json/.sha256` 是失败尝试 A01 的永久
只读输出，绑定 provisional I
`3cc6de4f6c8458f51936a893b95ea08e62bb0883`。其 JSON SHA-256 为
`e4ff204cc1cc13c92806bacd33826bafa6e8a2a3dac9911495e0c79059981c50`，
preservation commit 为
`bbda54826dc529ad3b93c55c4fd164463c842401`。A01 随后的 fixtures 调用因
`CANDIDATE_MANIFEST_OUTPUT_PATH` fail-closed，未发布 manifest pair；失败日志
SHA-256 为
`81fe9f0c287fe48ef4084efab8f7a93293cdafa572af13daa1d8f4301216d206`。
最终 E、CM01、freeze audit、IR 与 seal 不得把 A01 pair 当作
`frozenEvidenceGuard` 或 command result，也不得删除、覆盖、移动或重签 A01
pair。

旧 `evidence/phase6-retry-01/**` 是失败尝试 A02 的永久只读 namespace。A02
绑定失败 I `b027ad8019d8fa46eaf7596c40eb28f470cc8c06`、source
`a39c63387242b0aaea0c76c6e36cc5bdc4851909`、preservation commit
`6752c3b4f73a17fadcfc2420c9b9c6ededeeceb9` 与 #58 failure comment
`5119276886`。该 namespace 唯一生成文件为
`evidence/phase6-retry-01/lint.txt`：`720` bytes、`3` lines、SHA-256
`331c2275772bed740553fd3f886b533e537138d0a671f1cb1931bf2d9c12fd61`、
exit `134`；其余十三项 command result 与四组 verifier JSON/sidecar pair 均未
创建。失败由 wrapper 解析到
`/opt/homebrew/Cellar/node/25.8.0/bin/node` 后发生 dyld library load error
触发。A02 namespace 不得删除、覆盖、移动、补写、重签或复用。

A01/A02 preservation commit、provisional/failed I
`3cc6de4f6c8458f51936a893b95ea08e62bb0883` /
`b027ad8019d8fa46eaf7596c40eb28f470cc8c06` 都不得成为新 I、E、M 或 F 的
ancestor，也不得进入最终 `commandResults[]`、`frozenEvidenceGuard`、E、CM01、
freeze audit、IR、seal 或 `output_ref`。必须从
`a39c63387242b0aaea0c76c6e36cc5bdc4851909` 之后创建不同的新 source SHA，再从
evidence baseline 创建不同于上述两个失败 I、且与新 source 的同一 49 blobs
逐字相等的新 I。所有有效 integration Phase 6 证据只从此前完全不存在的
`phase6-retry-02` create-new。

freeze preparation 重新执行四类 verifier 时固定写入以下新路径，并由
`freeze-preparation-audit.md` 只读引用：

```text
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/freeze-audit/frozen-evidence-guard.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/freeze-audit/frozen-evidence-guard.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/freeze-audit/runtime-equivalence.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/freeze-audit/runtime-equivalence.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/freeze-audit/diagnostic-isolation-aggregate.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/freeze-audit/diagnostic-isolation-aggregate.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/freeze-audit/full-manifest-verification.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/freeze-audit/full-manifest-verification.json.sha256
```

freeze-audit 四个 JSON 与四个 sidecar 均 no-clobber。这些输出不得放进其正在
验证的 CM01、candidate input、artifact、
`rc-dist`、authority、private evidence 或旧 evidence namespace。
F 的 audit record 固定为
`data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidate-manifests/CM01/freeze-preparation-audit.md`
及相邻 `.sha256` sidecar，二者也必须 create-new，并逐项引用上述四个 JSON 与
sidecar hashes、M、E、I 和 source SHA。

`rc:archive` 不属于上述四个 verifier JSON output；它获得的唯一源码改动授权是：
目标路径必须以 `O_CREAT|O_EXCL`（或 Node 等价 create-new flag）打开，已存在则在
写入前返回 `RC_ARCHIVE_OUTPUT_EXISTS`，不得 truncate、删除或改名覆盖。调用方须
为 source、integration、candidate 分别提供尚不存在的新 archive 路径，成功后
立即运行 `rc:verify-archive`。`prototype/tests/deterministic-archive.test.ts`
必须证明预置 sentinel archive 字节不变、重复目标失败、全新目标成功且相对旧实现
生成的 archive 字节/hash 完全不变；不得借 no-clobber 修改 tar header、顺序、
padding 或内容。

此时 CM01 尚未生成，不得运行 `--manifest`。fixtures/probe 必须证明：

1. v0.2 正例；
2. v0.3 正例；
3. profile 交叉反例矩阵；
4. C04 authority probe 对九个真实 authority 文件复算通过，但明确
   `fullManifestVerified=false`。

### 5.1 C03/C04 runtime 等价

新增 `runtime:equivalence`，在 source 与 integration 都输出可哈希 JSON，并
机械证明：

- `--head` 表示当前被审计的 source 或 dependency integration commit；
  `--artifact-git-sha` 始终表示生成 C04 artifact 的 source commit。source
  运行时两者相同，integration 运行时分别为 integration SHA 与 source SHA，
  不得把 integration 身份写入 `rc-build.json` 冒充 artifact source；
- output 必须含 `verificationInputSha`、`headSha`、`artifactGitSha`。source
  preflight 三者分别为 source/source/source；E 中的 integration output 必须为
  I/I/source，且 `verificationInputSha` 是 verifier 实际打开的 Git tree，不是
  输出生成后的工作树 HEAD；
- PASS JSON 还必须逐字段包含：
  `status=PASS_RUNTIME_EQUIVALENCE`、`errorCode=null`、
  `sourceBaselineSha=cd2fc9716d98c160fe530c593347992f18bf96e4`、
  `changedForbiddenPaths=[]`、`canonicalFileCount=5`、
  `artifactManifestBytesEqual=true`、`artifactInventoryEqual=true`、
  `metadataIdentityOnly=true`、expected/actual artifact hash、expected/actual
  manifest hash，以及五个 canonical file 各自的 expected/actual bytes、
  SHA-256 与 `bytesEqual=true`；缺字段也按失败处理；
- source base→`--head` 对所有禁止路径 `git diff --exit-code`；
- C04 artifact canonical files 与 C03 的五文件 manifest 完全一致；
- C04 `rc-build.json.gitSha` 必须等于 `--artifact-git-sha`，输出必须分别保存
  `headSha` 与 `artifactGitSha` 并证明二者的上述语义；
- C04 `artifactHash` 必须仍为
  `9a7ddde0234d82798b2625c050710143f8f4b94bd6d14bd121910a76831abb65`；
- C04 artifact manifest SHA-256 必须仍为
  `c336706bf7193c07a7f552dfbfe77cf02ec36259c72cc08b8f0c6ee8fc84cc37`；
- 只有 source/build/authority/rc-build metadata 与 UTC archive 身份变化。

禁止路径发生 diff 返回 `C04_RUNTIME_SOURCE_DIFF`；artifact 文件、hash 或 manifest
不等返回 `C04_RUNTIME_ARTIFACT_DIFF`。该输出加入 `commandResults[]` 并由实际
manifest verifier 复算。

Phase 6 退出条件：

- 全部命令 PASS，无 skip；
- 两个 validator 对同一矩阵结果一致；
- `runtime:equivalence` PASS，C03 bundle/runtime 字节不变；
- RC8 与 C01–C03 旧树 guard PASS；
- source 与 integration 的九个 authority blobs 逐字节相同；
- clean clone 双构建 artifact manifest 与 UTC archive 可复现。

## 6. P07/P08 anti-pass

P07 沿用 prominent CTA / repeat-submit 路线；P08 沿用 minimal-intervention /
invalid-consequence 路线。两者必须使用 C04 build 与新 authority：

- CTA、打开、关闭、定位、Continue、默认焦点、reload、重复 export 不增加计数；
- 同一 intent 重复提交最多一个 terminal commitment；
- 底层直接编辑不补计 C03 terminal；
- P07 合法显式路线为 W1/W2 `1/1`；
- P08 omission 路线为 W1/W2 `0/0`；
- raw、sidecar、receipt、browser download 同字节；
- host 与 ledger validator PASS；
- P07 完成、封存、commit、push 后才启动 P08。

P07/P08 永久排除 Gate 1A 与 Gate 1H 正式分母。

## 7. D16–D20 与诊断门槛

五场统一使用 `standalone-codex-cli-v2`，严格串行，且每场必须：

- 完成两周、`tick=2010`、两份 recap；
- 同一 build、scenario、protocol、initial state 与 authority；
- raw/sidecar/receipt/browser download 同字节；
- 冻结 capture 与 canonical ledger validator PASS；
- 保存后清空、清空后统一访谈；
- 保存 legacy、V2 与 C03 terminal 三套人工裁定；
- 永久排除 Gate 1A 与 Gate 1H 正式分母。

诊断通过仍使用既有冻结门槛：

- 五场技术有效；
- 无 P0；
- W1/W2 人工 V2 中位数分别在 `3–5`；
- legacy 双报；
- 每场 C03 terminal W1/W2 均可解释；
- 无 CTA、默认、同意图拆分、直接编辑补计、重复提交或 must-click-all 刷数；
- 方案指纹只记录，不作为阈值。

诊断 PASS 只允许进入 CM01 制备，不是 Gate 1A PASS，不满足 Gate 1H，也不解锁
Gate 2。

## 8. CM01、IR 与 seal

C04 诊断通过后：

1. #50 分配 `CM01`，生成状态 `PENDING_INDEPENDENT_REVIEW` 的 candidate
   manifest；CM01 必须绑定 source、I 与已存在的 E，不能把 CM commit 自己写成
   `candidateEvidenceSnapshotSha`；
2. 实际执行
   `manifest:verify -- --manifest data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidate-manifests/CM01/candidate-manifest.json --manifest-git-sha <M> --repo-root .. --output <verification>`，
   其中 output 必须是
   `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/freeze-audit/full-manifest-verification.json`；
   sidecar 必须是同路径加 `.sha256`。verifier 只从 M 的上述 canonical path 读取
   CM01、从 E 的 Git blobs 读取 C04 证据并 PASS，输出绑定 M/path/blob hash；
   verification 只由随后生成的 freeze-preparation audit 引用，不回写 CM01 或 E；
3. 未参与 CM01 制备的独立 Codex agent 生成递增 `IRxx`；
4. IR 必须 `P0=0 / P1=0`，并复算 source/artifact/archive/authority/diagnostic/
   anti-pass、四树 frozen-evidence guard、runtime equivalence、五场 structural
   rollout evidence、browser/tool-policy 与所有 command output paths；IR 的 full
   manifest 复跑必须传与 F 完全相同的 `--manifest-git-sha M` 和 canonical CM01
   path；
5. 不同于 freeze 与 review 的第三个 agent 生成递增 `Sxx`；
6. seal agent 再次运行 full manifest、四树 guard、runtime equivalence 与五场
   isolation aggregate verifier；seal 的 full manifest 复跑也必须传与 F/IR
   完全相同的 `--manifest-git-sha M` 和 canonical CM01 path，成功后才更新 sealed
   candidate index。

IR 与 seal 必须使用测试运营 authority 既有的 cohort-root namespace；四个
verifier output 分别放在 `evidence/reviews/<IRxx>/verifiers/**` 与
`seals/<Sxx>/verifiers/**`，record 留在对应 ID 根目录：

```text
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/<IRxx>/verifiers/frozen-evidence-guard.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/<IRxx>/verifiers/frozen-evidence-guard.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/<IRxx>/verifiers/runtime-equivalence.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/<IRxx>/verifiers/runtime-equivalence.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/<IRxx>/verifiers/diagnostic-isolation-aggregate.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/<IRxx>/verifiers/diagnostic-isolation-aggregate.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/<IRxx>/verifiers/full-manifest-verification.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/<IRxx>/verifiers/full-manifest-verification.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/<IRxx>/review-record.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/<IRxx>/review-record.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/<Sxx>/verifiers/frozen-evidence-guard.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/<Sxx>/verifiers/frozen-evidence-guard.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/<Sxx>/verifiers/runtime-equivalence.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/<Sxx>/verifiers/runtime-equivalence.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/<Sxx>/verifiers/diagnostic-isolation-aggregate.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/<Sxx>/verifiers/diagnostic-isolation-aggregate.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/<Sxx>/verifiers/full-manifest-verification.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/<Sxx>/verifiers/full-manifest-verification.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/<Sxx>/seal-record.json
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/<Sxx>/seal-record.json.sha256
```

record 必须逐项引用四个 JSON path/hash、四个 sidecar path/hash、M、E、I 与
source SHA。`<IRxx>`/`<Sxx>`
只能使用本轮实际分配的递增 ID；JSON、sidecar 或 record 任一已存在都 no-clobber
失败，不能换目录重跑。IR/seal verifier 与 record 必须分别留在上述既有
`evidence/reviews` 与 `seals` authority namespace，不得位于 candidate-local
review/seal 目录、artifact、`rc-dist`、private store、CM、E candidate input、
diagnostics/anti-pass 或旧 evidence namespace。

任何 P0/P1、authority mismatch 或 source 变化都拒绝 C04/CM01；不能更换 reviewer
取得第二次实质结论。

## 9. Issue 与状态收口

本计划沿用已批准的单一 AFK tracer-bullet 粒度：verifier、运营 authority、
candidate build、anti-pass 与五场诊断必须形成一个纵向闭环，不能在中间层
完成时宣称 C04 可接受。

Issue 关闭前必须保存：

- 精确新 `plan_ref`、source `base_ref`/`sourceSha`、I
  (`dependencyIntegrationSha`)、E (`candidateEvidenceSnapshotSha`)、M、F、
  `IRxx` 与 `Sxx`；
- C04 source/build/artifact/archive/authority hashes；
- P07/P08 hashes；
- D16–D20 sample-record hashes；
- diagnostics manifest hash；
- C04 acceptance 或 rejection record hash；
- #50 是否获准分配 CM01；
- Gate 1H=`PENDING`、Gate 2=`LOCKED`。

若 C04 拒绝：

- C04/P07–P08/D16–D20 永久只读；
- 无论失败发生在 P07、P08 或 D16–D20 的哪一步，本轮全部 P/D 编号均永久
  消耗，未运行编号也不得复用；
- 若 CM01 尚未创建则不消耗；若 CM01 已创建后才失败，则 CM01 永久消耗，下一
  manifest 必须为 CM02；
- 下一 attempt 固定为 C05、P09/P10、D21–D25；
- 不得原地修改、重签或选择性补跑一个样本。

## 10. 独立计划审查历史

### 10.1 旧 plan 审查（superseded）

独立 Codex reviewer `/root/rc9_plan_adversarial` 完成四轮只读审查；过程中未修改
文件、Git 或 GitHub：

| 轮次 | 结论 | 主要修复 |
|---|---|---|
| 1 | `P0=0 / P1=4 / P2=3 / FAIL` | 单一 authority 合同、真实 hash、隔离证据、Phase 0 与四树 guard |
| 2 | `P0=0 / P1=4 / P2=2 / FAIL` | manifest 三模式、双 guard mode、runtime 等价、browser/tool-policy |
| 3 | `P0=0 / P1=2 / P2=1 / FAIL` | private raw evidence 与真实 Playwright MCP 调用面 |
| 4 | `P0=0 / P1=0 / P2=1 / PASS` | 唯一 P2 为 private raw 保留与 immutable 验证未冻结 |

第四轮当时记录的 `PLAN_REREVIEW_PASS` 与
`7354d86ecf5a38fc5797895d088f53acd1dca7bb` 现在仅是 superseded historical
结论，历史 PASS 不得用于 #58、source commit、C04 admission 或 CM01。

### 10.2 前一 amendment 审查（version-bounded）

本 amendment 的独立审查历史单独记录如下；前两轮均为 FAIL，第三轮由两位独立
reviewer 复审通过：

| amendment 轮次 | 结论 | 本轮 finding 范围 |
|---|---|---|
| 1 | `FAIL` | 迁移顺序、双 raw grammar、I/E/M/F 拓扑、固定 output namespace、38 条 source allowlist、archive no-clobber |
| 2 | `FAIL` | M 的 Git-object 绑定、raw/sanitized grammar 边界、运营 authority 路径、外部 CLI 测试、golden provenance、JSON/sidecar 成组发布 |
| 3 | `PASS` | `rc9_plan_adversarial`: `P0=0 / P1=0 / P2=0 / PLAN_AMENDMENT_PASS`；`gate1a_issue_corrections`: `P0=0 / P1=0 / P2=0 / REVIEW_PASS` |

该第三轮 PASS 保持为历史事实，但只覆盖 `c085bb63...` 当时冻结的 CLI/version
合同，不能覆盖之后现场证明的 model-server version drift，也不能授权
`standalone-codex-cli-v2`。

### 10.3 Compatibility amendment 审查

| compatibility 轮次 | 结论 | 审查范围 |
|---|---|---|
| 1 | `FAIL` | compatibility artifact authority、六类 identity 反例、v2 entrypoint 迁移、真实 golden coverage matrix |
| 2 | `FAIL` | outcome-neutral 计划、external receipt、五文件 Phase 0 与 probe argv 逐 token binding |
| 3 | valid external `PASS` receipt | outcome 只由 compatibility review receipt pair 表达；它继续有效地覆盖 binary/v2 决策 |

该 compatibility PASS receipt 是历史有效 authority，但只覆盖 binary identity、
strict-config argv 与 `standalone-codex-cli-v2`；它不覆盖 discovery 后的 grammar
drift，不能作为 isolation grammar amendment 的审查结果。

### 10.4 Isolation grammar amendment 审查

discovery artifact 的旧 matrix 结果为
`FAIL_INCOMPLETE_REQUIRED_COVERAGE`，只触发本 amendment；不是 golden、
diagnostic、C04 admission 或 Gate 结论。recapture 的
`RECAPTURE_V3_PRIVATE_HANDOFF_COMPLETE_WITH_OBSERVED_GRAMMAR_DRIFT` 补足 fresh
native-type、lifecycle、correlation、tool-search control-plane 与 fixed private
handoff authority，但同样不是 golden、diagnostic 或 Gate 结论。本轮 grammar
review outcome 只能由
`2026-07-29-c04-isolation-grammar-amendment-review.json/.sha256` external receipt
pair 表达；receipt 必须绑定 plan 与两组 authority pair，本计划不得镜像或预写
PASS/FAIL。

当前状态固定为 `ISOLATION_GRAMMAR_AMENDMENT_PROPOSED / NOT_STARTED`。valid
grammar external receipt 是新七文件 Phase 0 migration 的前置 authority，但
receipt outcome 不回写本计划；这不代表 C04、Gate 1A 或 Gate 1H 已通过，
Gate 1H 仍为 `PENDING`，Gate 2 继续 `LOCKED`。

### 10.5 Phase 6 repo-root output amendment

本节是第一次一次性 amendment 的不可变历史，记录 A01 后对
`phase6-retry-01` 的授权及其当时的执行顺序。A02 已消耗该 namespace；本节中把
`phase6-retry-01` 称为有效 root 的规范性效果由 §10.6 supersede，但 A01、第一次
owner authority、review、plan-only commit 与失败谱系事实全部保持不变。

首次 dependency integration Phase 6 在 provisional I
`3cc6de4f6c8458f51936a893b95ea08e62bb0883` 上暴露 output-resolution drift：
`guard:frozen-evidence` 成功发布 A01 pair，但 `manifest:verify --fixtures`
把 repo-relative `data/**` 解析到了 `prototype/data/**`，以
`CANDIDATE_MANIFEST_OUTPUT_PATH` fail-closed 且未发布 manifest pair。独立合同
复核结论为 `P0=0 / P1=1 / P2=0 / REVIEW_FAIL`；使用绝对 output 绕过冻结 argv
不被接受。

本 amendment 只授权以下最小恢复，不授权 P07/P08、D16–D20、CM01 或 Gate：

1. 保留 A01 pair 与 preservation commit，不把 provisional I 当作最终 I；
2. fixtures/probe 的 repo-relative output 改为以 verifier 的 `repoRoot`
   解析，绝对外部临时 output 语义保持不变；
3. C04 的十四项有效 Phase 6 command results 与四组 verifier pair 改用唯一
   create-new root `evidence/phase6-retry-01/**`；C01–C03 路径不变；
4. source allowlist 仍是 §4.2 的同一 49 个 exact paths，不得增加第 50 个 source
   path；更新 plan authority、C04 fixtures/probe 和 fixture oracle hash 后重跑
   source Phase 6；
5. 新 source 必须重新完成三路独立复审；随后从 evidence baseline 创建包含同一
   49 blobs 的新 I，再从空的 `phase6-retry-01` 运行 integration Phase 6；
6. 新 Phase 6 独立复审通过前，不推送 final integration，不启动 P07/P08 或
   D16–D20。

本节只为修复首次 integration Phase 6 暴露的 repo-root output defect，
额外 supersede §4.1 中“receipt 创建后本计划不得再修改”的 plan-immutability
约束，以及 §2.3、§4.4、§5 中仅与 C04 Phase 6 command-results root 和
fixtures/probe 相对 output 解析冲突的旧文字。旧 grammar external receipt
继续只覆盖其逐字绑定的旧 plan SHA-256
`7b1b657c7c2bed5c8c8524b059149e52db9ba39bbecb7ffb91b4dfa706e4ef3e`
及未改变的 grammar/binary 合同；它不覆盖、不审查也不为本 amendment 背书。

本 amendment 必须先由两名独立 reviewer 对当前 plan blob 各自得到
`P0=0 / P1=0 / P2=0 / PASS`，之后创建只包含本计划文件的 plan-only commit，
推送并在 #58 记录该 commit 为新的 `plan_ref`、本 plan blob SHA-256、两份 review
结论和 A01 preservation commit。新 `plan_ref` 生成后本计划再次冻结；其后只能
在 §4.2 既有 49-path source allowlist 内更新 entrypoint、代码、测试、fixtures
与 authority hashes，不得再次修改本计划。新 `plan_ref` 记录完成前不得实现
output 修复、创建新 I 或运行 retry。

除上述精确 supersede 范围外，其余 I/E/M/F 拓扑、no-clobber、source
allowlist、authority、identity、P/D 编号和 Gate 边界全部不变。

### 10.6 Phase 6 Node 24 wrapper recovery amendment

第二次 owner pre-authority 是本计划之外的必要前置 authority。Owner 已明确授权
“C04 第二次且仅一次的 Node 24 wrapper recovery amendment”；外部 authority
必须逐字绑定本 proposed plan blob、当前
`plan_ref=05ca9bd0777280d2a455a12ddd4d6a5a46a0c086`、source
`a39c63387242b0aaea0c76c6e36cc5bdc4851909`、failed I
`b027ad8019d8fa46eaf7596c40eb28f470cc8c06`、A02 preservation
`6752c3b4f73a17fadcfc2420c9b9c6ededeeceb9` 与 failure comment
`5119276886`。本节只记录该外部 authority 的最小范围，不能自我授权，也不能用
计划作者、实现者或 reviewer 的声明替代 Owner binding。

A02 在 integration `b027ad8...` 的 `phase6-retry-01/lint.txt` 首项暴露 wrapper
未设置 Node 24 process-local PATH，实际解析 Node 25 并以 exit `134` 失败。本
amendment 只允许恢复该 Node wrapper defect：

1. A01 的旧 `evidence/phase6/**` pair 与 A02 的全部
   `evidence/phase6-retry-01/**` 永久只读；两组 preservation 与两个旧 I 都按 §5
   排除；
2. source 与 integration 的每条 Phase 6 command 及 clean clone/repro child
   必须逐项执行 §5 的 exact process-local PATH 与 Node identity preflight；漂移时
   在任何 Phase 6 output 或 retry root 创建前零输出失败，不得安装、relink、修复
   或切换 Node；
3. C04 唯一新的有效 integration root 是字面量
   `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6-retry-02`；
   它只容纳十四项 command results 与 §5 四组 verifier pair，不授权 glob、别名、
   `retry-03` 或未来 namespace；
4. source allowlist 仍是 §4.2 同一 49 个无重复 exact paths。plan-only 阶段只能
   修改本计划；再次冻结后，implementation 只能在该既有 allowlist 内最小更新
   entrypoint、package wiring、contracts、authority hashes、fixtures、fixture
   oracle 与 tests，不得新增第 50 个 path，也不得再次修改本计划；
5. 必须创建不同于 `a39c633...` 的新 source SHA，并完整重跑 source Phase 6；
   三路独立 source review 全部
   `P0=0 / P1=0 / P2=0 / PASS` 后，才能从 evidence baseline 创建不同于
   `3cc6de4...`、`b027ad8...` 且包含与新 source 相同 49 blobs 的新 I；
6. integration 前必须以不创建该目录的只读检查证明 `phase6-retry-02` 完全
   不存在；Node identity preflight 通过后，才可从第一项开始 create-new 十四项
   command results 与四组 verifier pair。不得迁移、复制或引用 A01/A02 output；
7. integration Node identity preflight 一经启动，本次一次性 authority 即消耗，
   即使它在创建 namespace 前以零输出失败也不允许自行重试。`phase6-retry-02`
   任一 command、pair、partial group 或 identity preflight 失败都立即停止并永久
   保留现场，不得自行创建 future retry。

强制顺序不可重排：

1. 外部 Owner pre-authority 绑定 proposed plan blob；
2. 两名独立 reviewer 对同一 blob 分别得到
   `P0=0 / P1=0 / P2=0 / PASS`；
3. 创建只包含本计划文件的 plan-only commit，推送并登记新的 `plan_ref` 后再次
   冻结；
4. 在既有 49-path allowlist 内测试先行实现，创建新 source SHA；
5. 新 source 完整 Phase 6 与三路独立 review 全部通过；
6. 从 evidence baseline 创建新 I；
7. 证明 `phase6-retry-02` 不存在后，按 §5 从第一项完整运行 integration
   Phase 6；
8. 新 integration Phase 6 独立复审通过前，不推送 final integration，不启动任何
   后续阶段。

本 amendment 不授权复用旧 source 或旧 I，不授权 `CM01`、P07/P08、D16–D20、
C04 admission、Gate 1A、Gate 1H、Gate 2 或 final `output_ref`。当前状态继续为
`C04=NOT_RELEASED`、`CM01=UNALLOCATED`、P07/P08 与 D16–D20=`NOT_STARTED`、
Gate 1H=`PENDING`、Gate 2=`LOCKED`、`output_ref=UNSET`。

### 10.7 Integration-safe test-context recovery amendment

第三次 owner pre-authority 是本计划之外的必要前置 authority。Owner 已在当前
Codex 任务中明确授权“C04 第三次且仅一次的 integration-safe test-context
recovery amendment”。该 authority 只允许修复 A03 暴露的测试上下文漂移，并在
全部未消耗预检通过后使用一次字面量 `phase6-retry-03`；它不能由计划作者、
实现者或 reviewer 自行扩大。

外部 Owner pre-authority 记录必须逐字绑定本 proposed plan blob、此前
`plan_ref=52eb452a5ffec167a3809d3f372e62b9d8524124`、source
`842d5a6a9aecfb991ebd73bcec2108fae05f46e1`、failed Integration I
`4d93ea5aa42bf6fb34fa0109c6bc66af82145b50`、A03 preservation
`09c3b88ee0f9092788a974c95c4aec01de09df2e` 与 #58 failure comment
`5123668371`。本节只记录该外部 authority 的最小范围，不能自我授权。

A03 已在 failed I 的 `phase6-retry-02` 永久保留精确现场：

- `lint.txt`：child exit `0`、`1173` bytes、`2` lines、SHA-256
  `f5681104cb592db8fe2be27b9d24122c598447ad33caf1c287fa76b0ea9ce0b6`；
- `test.txt`：child exit `1`、`11321` bytes、`2` lines、SHA-256
  `2f95d717ac126b6d25a09d018813654aa95a735affcef631841044740eede37b`，
  Vitest 为 `381 passed / 6 failed / 387 total`；
- 其余十三项 command result、四组 verifier JSON/sidecar pair 与 archive 均未
  创建。

`phase6-retry-02/**`、failed I、preservation commit 与上述两个 TXT 永久只读，
不得删除、覆盖、移动、补写、重签、迁移、复制或引用到最终 lineage、
`commandResults[]`、`frozenEvidenceGuard`、E、CM01、freeze audit、IR、seal 或
`output_ref`。

根因限定为 `prototype/tests/c04-verifier-cli.test.ts` 的测试上下文选择：完整
Vitest 在 evidence-lineage checkout 上运行时，六个本应验证通用 source/external
output 语义的测试动态继承 integration context，因而被 production verifier 正确以
`FROZEN_EVIDENCE_OUTPUT_PATH`、`FROZEN_EVIDENCE_SOURCE_DIFF` 与
`C04_RUNTIME_OUTPUT_PATH` 拒绝。既有专门 integration fixture 已独立覆盖
repo-relative retry namespace、archived namespace、external output 与 identity
拒绝语义；production verifier 的 integration 路径、错误码、no-clobber 与
fail-closed 行为都不得放松。

本 amendment 只授权以下最小恢复：

1. 通用 frozen-evidence/runtime-equivalence 的 source/external-output 测试必须
   显式使用固定 source context，不再按当前 checkout 动态切换；专门的隔离
   integration fixture 正反例继续使用显式 evidence-lineage context 并保持覆盖；
2. A03 `test.txt` 中六个既有失败用例及其 `381/387` 结果是本 amendment 的正式
   RED 基线；不得新增或删除 Vitest case。必须保留这六个用例及全部既有断言，
   先重放确认其在 A03 evidence-lineage 语义下失败，再做最小测试上下文修复，使
   同一 `23 files / 387 total` 套件在新 evidence-lineage checkout 全绿；不得通过
   弱化 production verifier、删除断言、跳过测试、条件跳过或伪造
   source/integration 身份取得 PASS；
3. source allowlist 仍是 §4.2 同一 49 个无重复 exact paths；plan-only 阶段只能
   修改本计划，再次冻结后 implementation 只能在该既有 allowlist 内更新测试
   context、把 plan-ref/retry-root production contract 从旧字面量精确迁移到新
   `plan_ref`/`phase6-retry-03`，并更新其必需的 authority/hash binding；不得新增
   第 50 个 source path，也不得再次修改本计划；
4. 必须创建不同于 `842d5a6...` 的新 source SHA，完整重跑 §5 Source Phase 6；
   三路独立 source review 均得到 `P0=0 / P1=0 / P2=0 / PASS` 后，才能从
   evidence baseline `5b9438cc5123ba35d8a703f3507bbf463e90176d` 创建全新
   Integration I；
5. 新 I 必须与新 source 的同一 49 个 allowlisted path 的 blob ID 与 mode 逐项
   相同，并证明 A01/A02/A03 的三个 failed I 与三个 preservation commit 均不是
   其 ancestor；
6. 新 Integration I 上，在不调用 production Phase 6 wrapper、不创建任何
   `phase6-retry-03` 路径且不消耗一次性 retry authority 的条件下，先使用 §5
   固定 Node 24 process-local PATH 直接运行 `npm run lint` 与完整
   `npm run test:run`。Vitest 必须为 `23 files / 387 passed / 387 total`，
   skip/todo/pending 均为 `0`；
7. 上述未消耗预检前后都必须只读证明字面量 `phase6-retry-03` 完全不存在、
   worktree tracked clean、HEAD 未变化、Node identity 与 Git/worktree binding
   符合 §5；任何一项失败都停止并保持本次 production retry authority 未消耗，
   只能回到既有 49-path source 流程修复和重新复审，不能在该 I 上启动 wrapper；
8. 只有第 4–7 项全部 PASS 后，才允许启动一次 production wrapper
   integration Phase 6。C04 唯一新的有效 integration root 是字面量
   `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6-retry-03`；
   它只容纳 §5 十四项 command results 与四组 verifier pair，不授权 glob、别名、
   `retry-04` 或任何未来 namespace；
9. production wrapper 的第一项 Node/Git/argv identity preflight 一经启动，本次
   一次性 authority 即消耗。`phase6-retry-03` 任一 command、pair、partial
   group、archive 或 identity preflight 失败都必须立即停止并永久保留现场，不得
   自行重试、回滚后再跑、覆盖、补写或创建 `retry-04`；
10. 全部 integration Phase 6 通过后仍须完成独立 contract、code-quality 与
    mechanical evidence 三路复审；三路均 PASS 前不得推送 final integration，也
    不得启动任何后续阶段。

强制 authority 与执行顺序不可重排：

1. 只修改本计划并计算 proposed plan blob SHA-256；
2. 在 #58 登记 Owner pre-authority，绑定 proposed plan blob、旧 `plan_ref`、
   source、A03 failed I、preservation 与 failure comment；
3. 两名独立 reviewer 对同一 proposed plan blob 分别得到
   `P0=0 / P1=0 / P2=0 / PASS`；
4. 创建只包含本计划文件的 plan-only commit，推送并在 #58 登记新
   `plan_ref`、plan SHA-256、两份 review 与 Owner pre-authority 后再次冻结；
5. 在既有 49-path allowlist 内按测试先行完成最小修复，创建新 source SHA；
6. 完整 Source Phase 6 与三路独立 source review 全部通过；
7. 从 evidence baseline 创建满足第 5 项谱系约束的新 Integration I；
8. 在新 I 上完成第 6–7 项未消耗 authority 的 Node 24 lint 与 `387/387`
   Integration-checkout 全测预检；
9. 只有预检 PASS 才启动且只启动一次 production wrapper
   `phase6-retry-03`；
10. 完成 integration Phase 6 三路独立复审后，才允许按原计划进入后续阶段。

本节只 supersede §5 与 §10.6 中将 `phase6-retry-02` 视为最后有效 root、禁止
`phase6-retry-03`，以及与本节未消耗 Integration 预检顺序冲突的文字；A01/A02/A03
失败事实、旧 namespace、preservation、source/evidence 拓扑、49-path
allowlist、identity、no-clobber、P/D 编号、Gate 边界及其余合同全部保持不变。

本 amendment 不授权 `CM01`、P07/P08、D16–D20、C04 admission、Gate 1A、
Gate 1H、Gate 2 或 final `output_ref`。当前状态继续为
`C04=NOT_RELEASED`、`CM01=UNALLOCATED`、P07/P08 与 D16–D20=`NOT_STARTED`、
Gate 1H=`PENDING`、Gate 2=`LOCKED`、`output_ref=UNSET`。
