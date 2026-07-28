# Gate 1A RC9 C04 恢复计划

| 字段 | 内容 |
|---|---|
| 状态 | `APPROVED_FOR_ISSUE / NOT_STARTED` |
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
npm run manifest:verify -- --manifest <candidate-manifest-json> --repo-root .. --output <repo-relative-json>
```

- source preflight 可以把 `--output` 写到场次专属外部绝对临时路径；只有进入
  dependency integration、`commandResults[]`、CM01 或 freeze audit 的输出才
  必须是 repo-relative；
- `--fixtures`：运行共享纯合同的 v0.2/v0.3 正反矩阵；
- `--probe`：在 CM01 尚不存在时，读取真实九个 authority 文件并复算 hashes；
  成功输出 `status=PASS_AUTHORITY_PREFLIGHT`、`fullManifestVerified=false`，不得
  接受 diagnostics/anti-pass/artifact 等尚未生成的证据；
- `--manifest`：CM01 生成后执行完整真实文件复算，成功输出
  `status=PASS_FULL_MANIFEST`、manifest 自身 SHA-256 和全部 binding 摘要。

candidate manifest 的 required command IDs 用 `manifest-fixtures` 与
`manifest-probe` 替换旧 `manifest-verify`。最终 `--manifest` 输出产生在
candidate manifest 封存之后，只由 `freeze-preparation-audit.md` 引用，不能
回写 candidate manifest，避免 manifest → verification output → manifest 的
hash 自引用。

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

同时生成可公开复验的逐行结构投影：

- `agent-rollout-structural-evidence.jsonl/.sha256`；
- `cli-events-structural-evidence.jsonl/.sha256`。

投影覆盖原文件每一行，保存 ordinal、timestamp、顶层 type、payload type/name、
call/turn ID 与原始行 SHA-256；对 `session_meta`、`turn_context` 和
`function_call` 保存 allowlisted 结构字段及完整工具参数，并额外保存两次 unsafe
探针的成功状态、context/page ID、origin、pageCount 与下载 metadata。删除其他
message、reasoning、system/developer/user 内容和无关 tool output。投影头保存
原文件整体 SHA-256 与 line count；未知 event shape 直接拒绝。

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
```

verifier 必须机械核验 session meta、首个 turn context、cwd、workspace roots、
rollout source、模型、reasoning、CLI 版本、临时目录初态、Playwright MCP
版本/integrity、origin、逐工具参数 allowlist、context/page 探针与恰好一个应用
Session。
D20 后聚合核验五个 session ID、rollout commitments、临时目录、
browserContextId、browserPageId 均唯一。任一字段缺失、无法复算或 policy scan
失败，该样本技术无效并停止 C04。运营负责人只保存身份与协议事实，不把内部推理
或下载内容暴露给玩家。

## 4. C04 source 与证据谱系

### 4.1 Phase 0：先冻结计划

独立复审通过后，先只提交本计划、`PLANS.md` 与 `CONTEXT.md`，推送并记录精确
`plan_ref`。Issue 只能引用该已推送 SHA。

产品分支从 `cd2fc9716d98c160fe530c593347992f18bf96e4` 创建后，先移植 Phase 0
提交；移植后的三个文件必须与 `plan_ref` 中对应 blob 逐字节相同。后续 source
与 dependency integration 必须包含完全相同的九个 `rc9-v03` authority blobs；
若任一 authority hash 不同，不得构建 C04。

### 4.2 分支拓扑

- 产品实现从精确 source `cd2fc9716d98c160fe530c593347992f18bf96e4`
  创建 `codex/rc9-08r3-c04-implementation`；
- source change allowlist 仅为：
  `CONTEXT.md`、`PLANS.md`、本计划、RC9 测试运营合同、
  `prototype/package.json`、candidate-manifest 的两个既有 verifier、三个新
  verifier（manifest shared contract、frozen-evidence guard、diagnostic
  isolation）、runtime-equivalence verifier、manifest fixtures、isolation
  fixtures 与 `fixture-expectations.json`；
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
npm run runtime:equivalence
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
```

dependency integration 另外执行，并把输出保存到 C04
`evidence/phase6/**`：

```text
npm run guard:frozen-evidence -- \
  --mode evidence-lineage \
  --baseline 5b9438cc5123ba35d8a703f3507bbf463e90176d \
  --head <integration-sha> \
  --output <c04-evidence-guard-json>
npm run manifest:verify -- \
  --fixtures \
  --output <c04-manifest-fixtures-json>
npm run manifest:verify -- \
  --probe tests/fixtures/manifests/candidate-c04-authority-probe.json \
  --repo-root .. \
  --output <c04-manifest-probe-json>
```

此时 CM01 尚未生成，不得运行 `--manifest`。fixtures/probe 必须证明：

1. v0.2 正例；
2. v0.3 正例；
3. profile 交叉反例矩阵；
4. C04 authority probe 对九个真实 authority 文件复算通过，但明确
   `fullManifestVerified=false`。

### 5.1 C03/C04 runtime 等价

新增 `runtime:equivalence`，在 source 与 integration 都输出可哈希 JSON，并
机械证明：

- source base→source SHA 对所有禁止路径 `git diff --exit-code`；
- C04 artifact canonical files 与 C03 的五文件 manifest 完全一致；
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
   manifest 与 freeze-preparation audit；
2. 实际执行
   `manifest:verify -- --manifest <CM01> --repo-root .. --output <verification>`，
   使用 C04 真实文件和 hashes PASS；verification 只写入 freeze audit，不回写
   CM01；
3. 未参与 CM01 制备的独立 Codex agent 生成递增 `IRxx`；
4. IR 必须 `P0=0 / P1=0`，并复算 source/artifact/archive/authority/diagnostic/
   anti-pass、四树 frozen-evidence guard、runtime equivalence、五场 structural
   rollout evidence、browser/tool-policy 与所有 command output paths；
5. 不同于 freeze 与 review 的第三个 agent 生成递增 `Sxx`；
6. seal agent 再次运行 full manifest、四树 guard、runtime equivalence 与五场
   isolation aggregate verifier；成功后才更新 sealed candidate index。

任何 P0/P1、authority mismatch 或 source 变化都拒绝 C04/CM01；不能更换 reviewer
取得第二次实质结论。

## 9. Issue 与状态收口

本计划沿用已批准的单一 AFK tracer-bullet 粒度：verifier、运营 authority、
candidate build、anti-pass 与五场诊断必须形成一个纵向闭环，不能在中间层
完成时宣称 C04 可接受。

Issue 关闭前必须保存：

- 精确 `plan_ref`、source `base_ref`、integration ref 与 `output_ref`；
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

## 10. 独立计划审查

独立 Codex reviewer `/root/rc9_plan_adversarial` 完成四轮只读审查；过程中未修改
文件、Git 或 GitHub：

| 轮次 | 结论 | 主要修复 |
|---|---|---|
| 1 | `P0=0 / P1=4 / P2=3 / FAIL` | 单一 authority 合同、真实 hash、隔离证据、Phase 0 与四树 guard |
| 2 | `P0=0 / P1=4 / P2=2 / FAIL` | manifest 三模式、双 guard mode、runtime 等价、browser/tool-policy |
| 3 | `P0=0 / P1=2 / P2=1 / FAIL` | private raw evidence 与真实 Playwright MCP 调用面 |
| 4 | `P0=0 / P1=0 / P2=1 / PASS` | 唯一 P2 为 private raw 保留与 immutable 验证未冻结 |

第四轮 P2 已用明确保留期、`chflags uchg`、`stat -f '%Sf'` 与 fail-closed 规则
收口。最终状态为 `PLAN_REREVIEW_PASS`，只允许进入 Phase 0 和 Issue 发布；不代表
C04、Gate 1A 或 Gate 1H 已通过，Gate 2 继续 `LOCKED`。
