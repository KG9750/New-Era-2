# Gate 1A RC9 C04 恢复计划

| 字段 | 内容 |
|---|---|
| 状态 | `AMENDMENT_REREVIEW_PASS / APPROVED_FOR_ISSUE / NOT_STARTED` |
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
diagnosticIsolationProfile=standalone-codex-cli-v1
```

在启动 D16 前，必须先把该 profile 写入 RC9 测试运营合同，并冻结：

- 精确、无交互的 Codex CLI 启动命令模板（变量只能替换场次专属绝对路径）：

  ```bash
  PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin" \
  codex exec --json --strict-config --ignore-user-config \
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
    -c 'mcp_servers.chrome-devtools.enabled=false' \
    -c 'mcp_servers.node_repl.enabled=false' \
    -c 'model_reasoning_effort="xhigh"' \
    -c 'approval_policy="never"' \
    - < "$NEUTRAL_PLAYER_PROMPT" > "$CLI_EVENT_STREAM"
  ```

- `codex --version` 必须逐场等于场前冻结的 `codex-cli 0.142.4`；Node 必须来自
  `/opt/homebrew/opt/node@24/bin`。版本变化使 C04 停止，不允许临场换版本；
- `prototype/scripts/verify-diagnostic-isolation.mjs` 及其正反 fixtures；
- isolation fixture 必须冻结两套彼此独立、来自真实 `codex-cli 0.142.4` 的脱敏
  golden raw，不能以一套 grammar 兼容另一套：
  - persisted rollout JSONL 顶层 `type` 只接受 `session_meta`、
    `turn_context`、`response_item`、`event_msg`。工具调用只能是
    `response_item.payload.type=function_call`，其
    `response_item.payload.arguments` 必须是 JSON string；verifier 对原字符串
    恰好解析一次，要求结果为 object，再做工具参数 allowlist；
  - `codex exec --json` event stream 顶层 `type` 只接受
    `thread.started`、`turn.started`、`item.started`、`item.completed`、
    `turn.completed`、`turn.failed`。MCP 工具调用只能位于
    `item.type=mcp_tool_call`，`item.arguments` 必须直接是 object，不能套用
    persisted rollout 的 JSON-string 解析；
  - 两个来源的 `timestamp` 分别按各自真实 schema 可选；不得要求两边同时存在、
    类型相同或互相补造。任何 camelCase 事件别名、跨来源 envelope 或 arguments
    类型替换均拒绝；
- 两份 golden raw 固定为
  `prototype/tests/fixtures/isolation/golden-codex-0.142.4-persisted-rollout.jsonl`
  与
  `prototype/tests/fixtures/isolation/golden-codex-0.142.4-exec-events.jsonl`。
  它们必须分别从真实 persisted rollout 与真实 `codex exec --json` stream 单向
  脱敏取得，保留 envelope、字段类型与事件顺序；不得由 structural projection、
  预期 verification 或手写目标对象反向生成；
- 两份 golden 的 provenance 只写入
  `prototype/tests/fixtures/fixture-expectations.json.isolationGoldenProvenance`，
  schema 固定为恰好两个 key：`persistedRollout` 与 `execEvents`。每项必须恰好包含
  `sourceGrammar`、`codexCliVersion`、`benignSourceOpaqueCommitment`、
  `sanitizerVersion`、`sanitizerRuleset`、`goldenPath`、`goldenSha256`、
  `goldenLineCount`、`independentReadBackStatus=PASS` 与
  `privacyScanStatus=PASS`。`benignSourceOpaqueCommitment` 只承诺用于 fixture
  制备的 benign 来源字节，不得写真实敏感内容、private evidence object ID 或任何
  绝对 private path。两个 `sourceGrammar` 必须分别为冻结 grammar ID，
  `codexCliVersion` 必须逐字等于 `codex-cli 0.142.4`，commitment 与 SHA 必须为
  64 位小写十六进制，version/ruleset 必须为非空 versioned ID，golden path 必须为
  上述两个 exact path，line count 必须为正整数，两个 status 只接受 `PASS`；额外
  provenance key、缺字段或 hash/line count 不匹配均失败；
- sanitizer 为两个 grammar 各冻结一份 deterministic field allowlist：
  - sanitizer 在删除任何字段前，必须先按对应来源的完整 known grammar 校验 raw
    输入。raw 中来源 schema 已知的 system/developer/user message、reasoning、
    绝对路径及其他敏感字段允许存在，但只能删除或变成 commitment；未知顶层
    event/type、未知 payload/item type、未知 key 或 arguments 类型错配必须按该
    来源 grammar fail-closed，不能靠 sanitizer 丢弃未知结构后继续；
  - persisted envelope 只保留 `timestamp?`、`type` 与 `payload`；`session_meta`
    payload 只保留 session ID、source、model、reasoning effort、cwd commitment
    与 workspace-roots commitment；`turn_context` payload 只保留 turn ID、
    model、reasoning effort、cwd/workspace commitments、approval/sandbox
    policy；`response_item(function_call)` payload 只保留 `type`、`name`、
    `call_id` 与原始 `arguments` string；`event_msg` payload 只保留事件 subtype
    与结构关联 ID；
  - exec event envelope 只保留 `timestamp?`、`type`、thread/turn ID 与
    allowlisted `item`；`mcp_tool_call` item 只保留 item ID、server、tool、
    arguments object、status 与结构关联 ID；
  - 严格拒绝 allowlist 外字段只适用于 sanitized golden 与 structural projection
    输出，不适用于完整 raw 的已知敏感字段。sanitized 输出必须递归扫描
    secret/token/key、PII、system/developer/user message、reasoning 内容和本机
    绝对路径；允许保留的 cwd/workspace 只能输出 commitment/hash，不能输出原
    路径。输出必须在独立进程从磁盘 read-back，重新做 schema、hash/line count 与
    forbidden-content scan 后才能成为 golden；generator 内存中的对象或
    projection PASS 不能替代该 read-back；
- 唯一 provider 为 direct-tools Playwright MCP
  `@playwright/mcp@0.0.76`；preflight 必须保存已解析 package version、
  npm integrity、实际 server argv 与工具 inventory。禁止 in-app Browser
  plugin、Chrome、Computer Use、Chrome DevTools MCP 与 `node_repl`；
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
投影、prompt hash、Codex/Node 版本、Playwright MCP package version/integrity/
server argv、预期 tool inventory、两个 unsafe code hash、origin 和临时目录
空态。

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

投影覆盖原文件每一行，保存 ordinal、来源内可选 timestamp、顶层 type、结构关联
ID 与原始行 SHA-256。persisted projection 按 `session_meta`、`turn_context`、
`response_item(function_call)`、`event_msg` 的独立 allowlist 输出；exec
projection 按 thread/turn lifecycle 与 `item(mcp_tool_call)` 的独立 allowlist
输出。工具参数必须来自各自 raw grammar：前者从原始 arguments string 单次解析，
后者直接读取 arguments object；并额外保存两次 unsafe 探针的成功状态、
context/page ID、origin、pageCount 与下载 metadata。删除其他 message、
reasoning、system/developer/user 内容、绝对路径和无关 tool output。projection
只能由已验证 raw 单向生成 allowlisted 结构，不能作为 raw 输入、不能补造 raw
字段，也不能反向生成 golden raw。raw 必须先通过对应来源的完整 known grammar；
已知敏感字段随后删除或 commitment 化，未知 event/type/key 则在生成 projection
前直接拒绝。投影输出自身再严格拒绝 projection allowlist 外字段。投影头保存原
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
agentCliVersion
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
rollout source、模型、reasoning、CLI 版本、临时目录初态、Playwright MCP
版本/integrity、origin、逐工具参数 allowlist、context/page 探针与恰好一个应用
Session。

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

### 4.1 Amendment 迁移

旧 plan commit `7354d86ecf5a38fc5797895d088f53acd1dca7bb` 及其
`PLAN_REREVIEW_PASS` 现在只保留为 superseded historical record，不再授权 Issue、
source commit、C04 evidence 或 CM01。取得下列第 1 步独立审查 PASS 前，状态保持
`AMENDMENT_REVIEW_PENDING / NOT_STARTED`；第三轮 PASS 后仅解锁步骤 2–5，
implementation 仍为 `NOT_STARTED`，必须完成全部迁移后才可实施：

1. 先取得本 amendment 的独立 `AMENDMENT_REREVIEW_PASS`；
2. review PASS 后在 evidence-plan 分支创建只包含本计划文件的 plan-only commit，
   推送后以该 commit 作为新 `plan_ref`；本次 amendment 不再改写 `CONTEXT.md` 或
   `PLANS.md`；
3. 在 #58 明确记录“新 `plan_ref` supersedes
   `7354d86ecf5a38fc5797895d088f53acd1dca7bb`”，Issue 后续只引用新
   `plan_ref`；
4. 把该 plan-only commit cherry-pick 到现有
   `codex/rc9-08r3-c04-implementation` 的 `9fb0c8828ab301402f9eee8f9d4135b88dc58c14`
   之后；此 cherry-pick 必须发生在任何 implementation commit 之前。现有工作树
   改动在此之前不得提交，也不能被称为已获新计划授权；
5. cherry-pick 后重新计算九个 `rc9-v03` authority blob hashes，重写 C04
   authority probe 的期望 hash，并从真实 CLI 重新运行 manifest fixtures 与
   authority probe；旧 `7354d86...`/`9fb0c88...` 计划下产生的所有临时
   verification JSON、hash、stdout capture 一律作废，不得进入
   `commandResults[]`、E、CM、IR 或 seal。

新 source 与 dependency integration 必须包含与新 `plan_ref` 相同的 amendment
plan blob，以及重新绑定后的同一组九个 authority blobs；任一 hash 不同都不得
构建 C04。

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
| `prototype/tests/fixtures/isolation/golden-codex-0.142.4-persisted-rollout.jsonl` | 脱敏真实 persisted rollout grammar golden |
| `prototype/tests/fixtures/isolation/golden-codex-0.142.4-exec-events.jsonl` | 脱敏真实 `codex exec --json` grammar golden |
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

- 除上表 39 个 exact path 外，source commit 修改任何其他路径都失败；
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
`evidence/phase6/**`：

```text
npm run guard:frozen-evidence -- \
  --mode evidence-lineage \
  --baseline 5b9438cc5123ba35d8a703f3507bbf463e90176d \
  --head <integration-sha> \
  --output data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6/frozen-evidence-guard.json
npm run manifest:verify -- \
  --fixtures \
  --output data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6/manifest-fixtures.json
npm run manifest:verify -- \
  --probe tests/fixtures/manifests/candidate-c04-authority-probe.json \
  --repo-root .. \
  --output data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6/manifest-probe.json
npm run runtime:equivalence -- \
  --head <integration-sha> \
  --artifact-git-sha <source-sha> \
  --output data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6/runtime-equivalence.json
```

上述四个 integration Phase 6 JSON 是本轮新增 verifier no-clobber 的精确范围：
均为 repo-root-relative canonical path，且必须尚不存在，失败后不得覆盖重跑。
其 sidecar exact path 为：

```text
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6/frozen-evidence-guard.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6/manifest-fixtures.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6/manifest-probe.json.sha256
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04/evidence/phase6/runtime-equivalence.json.sha256
```

每个 JSON 必须同时以 create-new 方式生成上述 sidecar；
sidecar 逐字保存 JSON SHA-256 与 repo-relative path，JSON 或 sidecar 任一已存在都
必须在写入前失败。
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

五场统一使用 `standalone-codex-cli-v1`，严格串行，且每场必须：

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

### 10.2 当前 amendment 审查

本 amendment 的独立审查历史单独记录如下；前两轮均为 FAIL，第三轮由两位独立
reviewer 复审通过：

| amendment 轮次 | 结论 | 本轮 finding 范围 |
|---|---|---|
| 1 | `FAIL` | 迁移顺序、双 raw grammar、I/E/M/F 拓扑、固定 output namespace、38 条 source allowlist、archive no-clobber |
| 2 | `FAIL` | M 的 Git-object 绑定、raw/sanitized grammar 边界、运营 authority 路径、外部 CLI 测试、golden provenance、JSON/sidecar 成组发布 |
| 3 | `PASS` | `rc9_plan_adversarial`: `P0=0 / P1=0 / P2=0 / PLAN_AMENDMENT_PASS`；`gate1a_issue_corrections`: `P0=0 / P1=0 / P2=0 / REVIEW_PASS` |

当前状态为 `AMENDMENT_REREVIEW_PASS / APPROVED_FOR_ISSUE / NOT_STARTED`。只允许
按 §4.1 进入 plan-only commit、Issue migration 与后续 implementation 顺序；这不
代表 C04、Gate 1A 或 Gate 1H 已通过，Gate 1H 仍为 `PENDING`，Gate 2 继续
`LOCKED`。
