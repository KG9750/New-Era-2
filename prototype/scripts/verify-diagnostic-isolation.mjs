import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  closeSync,
  constants as fsConstants,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { fileURLToPath } from 'node:url'

const INPUT_SCHEMA = 'new-era-diagnostic-isolation-input-v1'
const PREFLIGHT_SCHEMA = 'new-era-diagnostic-isolation-preflight-v1'
const FIXTURE_SCHEMA = 'new-era-diagnostic-isolation-fixture-matrix-v1'
const RESULT_SCHEMA = 'new-era-diagnostic-isolation-result-v2'
const PROFILE = 'standalone-codex-cli-v2'
const CLI_BINARY =
  '/Applications/ChatGPT.app/Contents/Resources/codex'
const CLI_VERSION = 'codex-cli 0.146.0-alpha.3.1'
const CLI_SHA256 =
  '6d8be49e49751554df16572369e636cbe02c84b208cad3dc35528c846eeca223'
const CLI_TEAM_IDENTIFIER = '2DC432GLL2'
const CLI_AUTHORITY =
  'Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)'
const NODE_ROOT = '/opt/homebrew/opt/node@24/bin'
const NODE_EXECUTABLE = `${NODE_ROOT}/node`
const NODE_VERSION = 'v24.18.0'
const NODE_SHA256 =
  '72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f'
const MODEL = 'gpt-5.6-sol'
const REASONING = 'xhigh'
const ORIGIN = 'http://127.0.0.1:4202'
const PLAYWRIGHT_PROVIDER = 'direct-tools-playwright-mcp'
const PLAYWRIGHT_VERSION = '0.0.76'
const FIXED_PATH =
  `${NODE_ROOT}:/opt/homebrew/bin:/usr/bin:/bin`
const PRIVATE_EVIDENCE_ROOT =
  '/Users/leo/.codex/private-evidence/new-era-2'
const GOLDEN_PRIVATE_OBJECT_ROOT =
  '/Users/leo/.codex/private-evidence/new-era-2/' +
  'c04-isolation-grammar-recapture-v3/objects'
const GOLDEN_PRIVATE_ROOT = dirname(GOLDEN_PRIVATE_OBJECT_ROOT)
const COHORT_ID = 'g1a-20260727-rc9-01'
const CANDIDATE_ATTEMPT = 'C04'
const PERSISTED_GRAMMAR =
  'codex-0.146.0-alpha.3.1-persisted-rollout-v2'
const EXEC_GRAMMAR =
  'codex-0.146.0-alpha.3.1-exec-events-v2'
const PERSISTED_GOLDEN =
  'prototype/tests/fixtures/isolation/' +
  'golden-codex-0.146.0-alpha.3.1-persisted-rollout.jsonl'
const EXEC_GOLDEN =
  'prototype/tests/fixtures/isolation/' +
  'golden-codex-0.146.0-alpha.3.1-exec-events.jsonl'
const RECAPTURE_PATH =
  'docs/exec-plans/evidence/' +
  '2026-07-29-c04-isolation-grammar-recapture.json'
const RECAPTURE_SHA256 =
  '70997d22e8a4d1c37bdd39aca49543527825d714e941c03f823822c19fdebbf7'
const RECAPTURE_SIDECAR_SHA256 =
  'dc04668fe7b1273e9321dfff9067caf8d925456de9210e87ed888758d8763e86'
const SOURCE_SET =
  'recapture-v3-private-handoff-A-B-C-B_EXTENSION-B_SUCCESS_PROBE'
const CAPTURE_IDS = [
  'A',
  'B',
  'C',
  'B_EXTENSION',
  'B_SUCCESS_PROBE',
]
const SAMPLE_IDS = [
  'TECH-RC9-D16',
  'TECH-RC9-D17',
  'TECH-RC9-D18',
  'TECH-RC9-D19',
  'TECH-RC9-D20',
]
const SAMPLE_ID = /^TECH-RC9-D(?:1[6-9]|20)$/
const HEX_64 = /^[a-f0-9]{64}$/
const OPAQUE_OBJECT_ID = /^sha256-[a-f0-9]{64}\.jsonl$/
const NPM_INTEGRITY = /^sha512-([A-Za-z0-9+/]+={0,2})$/
const SANITIZER_ID = /^[a-z0-9][a-z0-9._-]*-v\d+(?:\.\d+)*$/i

export const CONTEXT_PAGE_PROBE = `async (page) => {
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
}`

export const DOWNLOAD_PROBE = `async (page) => {
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
}`

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export const UNSAFE_CODE_HASHES = Object.freeze({
  contextPageProbe: sha256(CONTEXT_PAGE_PROBE),
  downloadProbe: sha256(DOWNLOAD_PROBE),
})

export const ALLOWED_TOOLS = Object.freeze([
  'browser_click',
  'browser_fill_form',
  'browser_navigate',
  'browser_run_code_unsafe',
  'browser_snapshot',
  'browser_wait_for',
])

const NEGATIVE_CASES = Object.freeze({
  G01: 'ISOLATION_GRAMMAR_EXACT_KEYS',
  G02: 'ISOLATION_GRAMMAR_EXACT_KEYS',
  G03: 'ISOLATION_GRAMMAR_NATIVE_TYPE',
  G04: 'ISOLATION_GRAMMAR_TOP_LEVEL',
  G05: 'ISOLATION_GRAMMAR_SUBTYPE',
  L01: 'ISOLATION_MCP_LIFECYCLE',
  L02: 'ISOLATION_MCP_LIFECYCLE',
  L03: 'ISOLATION_MCP_LIFECYCLE',
  L04: 'ISOLATION_MCP_STATUS',
  C01: 'ISOLATION_CORRELATION_THREAD',
  C02: 'ISOLATION_CORRELATION_TURN',
  C03: 'ISOLATION_CORRELATION_FUNCTION',
  C04: 'ISOLATION_CORRELATION_CUSTOM_EQUALITY',
  C05: 'ISOLATION_CORRELATION_CUSTOM_INEQUALITY',
  C06: 'ISOLATION_CORRELATION_MCP_EQUALITY',
  C07: 'ISOLATION_CORRELATION_MCP_INEQUALITY',
  O01: 'ISOLATION_ORDER_PERSISTED_TOOL',
  O02: 'ISOLATION_ORDER_EXEC_MCP',
  T01: 'ISOLATION_ORDER_TOOL_SEARCH',
  T02: 'ISOLATION_TOOL_SEARCH_PROVIDER',
  T03: 'ISOLATION_TOOL_SEARCH_STATUS',
  T04: 'ISOLATION_TOOL_SEARCH_ARGUMENTS',
  T05: 'ISOLATION_TOOL_SEARCH_ARGUMENTS',
  T06: 'ISOLATION_CORRELATION_TOOL_SEARCH_EQUALITY',
  T07: 'ISOLATION_CORRELATION_TOOL_SEARCH_INEQUALITY',
  T08: 'ISOLATION_CORRELATION_TOOL_SEARCH_INEQUALITY',
  T09: 'ISOLATION_CORRELATION_TOOL_SEARCH_INEQUALITY',
  R01: 'ISOLATION_RESPONSE_ID_UNIQUENESS',
  S01: 'ISOLATION_GOLDEN_SOURCE_COMMITMENT',
  S02: 'ISOLATION_GOLDEN_SOURCE_UNAVAILABLE',
  U01: 'ISOLATION_TOOL_POLICY_LEAF',
})

const IDENTITY_CASES = Object.freeze({
  C04_CLI_BINARY_PATH: 'cliBinaryPath',
  C04_CLI_VERSION: 'agentCliVersion',
  C04_CLI_BINARY_SHA256: 'cliBinarySha256',
  C04_CLI_TEAM_IDENTIFIER: 'cliTeamIdentifier',
  C04_CLI_AUTHORITY: 'cliAuthority',
  C04_NODE_IDENTITY: 'nodeIdentity',
})

const PERSISTED_TOP_LEVEL = new Set([
  'session_meta',
  'event_msg',
  'response_item',
  'world_state',
  'turn_context',
])
const EXEC_TOP_LEVEL = new Set([
  'thread.started',
  'turn.started',
  'item.started',
  'item.completed',
  'turn.completed',
  'error',
  'turn.failed',
])

function variant(subtype, keys, types) {
  return Object.freeze({ subtype, keys: Object.freeze(keys), types })
}

const PERSISTED_VARIANTS = Object.freeze([
  variant(
    'agent_message',
    ['memory_citation', 'message', 'phase', 'type'],
    {
      memory_citation: 'null',
      message: 'string',
      phase: 'string',
      type: 'string',
    },
  ),
  variant(
    'function_call_output',
    [
      'call_id',
      'id',
      'internal_chat_message_metadata_passthrough',
      'output',
      'type',
    ],
    {
      call_id: 'string',
      id: 'string',
      internal_chat_message_metadata_passthrough: 'object',
      output: 'string',
      type: 'string',
    },
  ),
  variant(
    'function_call',
    [
      'arguments',
      'call_id',
      'id',
      'internal_chat_message_metadata_passthrough',
      'name',
      'namespace',
      'type',
    ],
    {
      arguments: 'string',
      call_id: 'string',
      id: 'string',
      internal_chat_message_metadata_passthrough: 'object',
      name: 'string',
      namespace: 'string',
      type: 'string',
    },
  ),
  variant(
    'mcp_tool_call_end',
    ['call_id', 'duration', 'invocation', 'result', 'type'],
    {
      call_id: 'string',
      duration: 'object',
      invocation: 'object',
      result: 'object',
      type: 'string',
    },
  ),
  variant(
    'message',
    [
      'content',
      'id',
      'internal_chat_message_metadata_passthrough',
      'phase',
      'role',
      'type',
    ],
    {
      content: 'array',
      id: 'string',
      internal_chat_message_metadata_passthrough: 'object',
      phase: 'string',
      role: 'string',
      type: 'string',
    },
  ),
  variant(
    'message',
    [
      'content',
      'id',
      'internal_chat_message_metadata_passthrough',
      'role',
      'type',
    ],
    {
      content: 'array',
      id: 'string',
      internal_chat_message_metadata_passthrough: 'object',
      role: 'string',
      type: 'string',
    },
  ),
  variant(
    'reasoning',
    [
      'encrypted_content',
      'id',
      'internal_chat_message_metadata_passthrough',
      'summary',
      'type',
    ],
    {
      encrypted_content: 'string',
      id: 'string',
      internal_chat_message_metadata_passthrough: 'object',
      summary: 'array',
      type: 'string',
    },
  ),
  variant(
    'session_meta',
    [
      'base_instructions',
      'cli_version',
      'context_window',
      'cwd',
      'history_mode',
      'id',
      'model_provider',
      'originator',
      'session_id',
      'source',
      'thread_source',
      'timestamp',
    ],
    {
      base_instructions: 'object',
      cli_version: 'string',
      context_window: 'object',
      cwd: 'string',
      history_mode: 'string',
      id: 'string',
      model_provider: 'string',
      originator: 'string',
      session_id: 'string',
      source: 'string',
      thread_source: 'string',
      timestamp: 'string',
    },
  ),
  variant(
    'task_complete',
    [
      'completed_at',
      'duration_ms',
      'error',
      'last_agent_message',
      'started_at',
      'turn_id',
      'type',
    ],
    {
      completed_at: 'number',
      duration_ms: 'number',
      error: 'object',
      last_agent_message: 'null',
      started_at: 'number',
      turn_id: 'string',
      type: 'string',
    },
  ),
  variant(
    'task_complete',
    [
      'completed_at',
      'duration_ms',
      'last_agent_message',
      'started_at',
      'time_to_first_token_ms',
      'turn_id',
      'type',
    ],
    {
      completed_at: 'number',
      duration_ms: 'number',
      last_agent_message: 'string',
      started_at: 'number',
      time_to_first_token_ms: 'number',
      turn_id: 'string',
      type: 'string',
    },
  ),
  variant(
    'task_started',
    [
      'collaboration_mode_kind',
      'model_context_window',
      'started_at',
      'turn_id',
      'type',
    ],
    {
      collaboration_mode_kind: 'string',
      model_context_window: 'number',
      started_at: 'number',
      turn_id: 'string',
      type: 'string',
    },
  ),
  variant(
    'token_count',
    ['info', 'rate_limits', 'type'],
    { info: 'object', rate_limits: 'object', type: 'string' },
  ),
  variant(
    'tool_search_call',
    [
      'arguments',
      'call_id',
      'execution',
      'id',
      'internal_chat_message_metadata_passthrough',
      'status',
      'type',
    ],
    {
      arguments: 'object',
      call_id: 'string',
      execution: 'string',
      id: 'string',
      internal_chat_message_metadata_passthrough: 'object',
      status: 'string',
      type: 'string',
    },
  ),
  variant(
    'tool_search_output',
    [
      'call_id',
      'execution',
      'id',
      'internal_chat_message_metadata_passthrough',
      'status',
      'tools',
      'type',
    ],
    {
      call_id: 'string',
      execution: 'string',
      id: 'string',
      internal_chat_message_metadata_passthrough: 'object',
      status: 'string',
      tools: 'array',
      type: 'string',
    },
  ),
  variant(
    'turn_context',
    [
      'approval_policy',
      'approvals_reviewer',
      'collaboration_mode',
      'comp_hash',
      'current_date',
      'cwd',
      'effort',
      'model',
      'multi_agent_mode',
      'multi_agent_version',
      'permission_profile',
      'personality',
      'realtime_active',
      'sandbox_policy',
      'summary',
      'timezone',
      'turn_id',
      'workspace_roots',
    ],
    {
      approval_policy: 'string',
      approvals_reviewer: 'string',
      collaboration_mode: 'object',
      comp_hash: 'string',
      current_date: 'string',
      cwd: 'string',
      effort: 'string',
      model: 'string',
      multi_agent_mode: 'string',
      multi_agent_version: 'string',
      permission_profile: 'object',
      personality: 'string',
      realtime_active: 'boolean',
      sandbox_policy: 'object',
      summary: 'string',
      timezone: 'string',
      turn_id: 'string',
      workspace_roots: 'array',
    },
  ),
  variant(
    'user_message',
    [
      'audio',
      'images',
      'local_audio',
      'local_images',
      'message',
      'text_elements',
      'type',
    ],
    {
      audio: 'array',
      images: 'array',
      local_audio: 'array',
      local_images: 'array',
      message: 'string',
      text_elements: 'array',
      type: 'string',
    },
  ),
  variant(
    'world_state',
    ['full', 'state'],
    { full: 'boolean', state: 'object' },
  ),
  variant(
    'custom_tool_call_output',
    [
      'call_id',
      'id',
      'internal_chat_message_metadata_passthrough',
      'output',
      'type',
    ],
    {
      call_id: 'string',
      id: 'string',
      internal_chat_message_metadata_passthrough: 'object',
      output: 'array',
      type: 'string',
    },
  ),
  variant(
    'custom_tool_call',
    [
      'call_id',
      'id',
      'input',
      'internal_chat_message_metadata_passthrough',
      'name',
      'status',
      'type',
    ],
    {
      call_id: 'string',
      id: 'string',
      input: 'string',
      internal_chat_message_metadata_passthrough: 'object',
      name: 'string',
      status: 'string',
      type: 'string',
    },
  ),
])

class IsolationFailure extends Error {
  constructor(code, message = code, summary = {}) {
    super(message)
    this.code = code
    this.summary = summary
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function nativeType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value === 'object' ? 'object' : typeof value
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function exactKeys(value, keys) {
  return (
    isRecord(value) &&
    sameJson(Object.keys(value).sort(), [...keys].sort())
  )
}

function isRepoRelativePath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !isAbsolute(value) &&
    !value.includes('\\') &&
    value.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  )
}

function reject(errorCode, summary = {}) {
  return {
    schemaVersion: RESULT_SCHEMA,
    accepted: false,
    status: 'REJECTED_DIAGNOSTIC_ISOLATION',
    errorCode,
    summary,
  }
}

function accept(status, kind, summary = {}) {
  return {
    schemaVersion: RESULT_SCHEMA,
    accepted: true,
    status,
    errorCode: null,
    kind,
    summary,
  }
}

function throwFailure(code, message, summary) {
  throw new IsolationFailure(code, message, summary)
}

function parseJsonLines(bytes) {
  const text = bytes.toString('utf8')
  if (!text.endsWith('\n')) {
    throwFailure('ISOLATION_GRAMMAR_EXACT_KEYS', 'JSONL 缺少末尾换行')
  }
  const lines = text.slice(0, -1).split('\n')
  if (lines.length === 0 || lines.some((line) => line.length === 0)) {
    throwFailure('ISOLATION_GRAMMAR_EXACT_KEYS', 'JSONL 包含空行')
  }
  return {
    lines,
    records: lines.map((line) => {
      const value = JSON.parse(line)
      if (!isRecord(value)) {
        throwFailure('ISOLATION_GRAMMAR_NATIVE_TYPE')
      }
      return value
    }),
  }
}

function persistedSubtype(record) {
  if (['session_meta', 'turn_context', 'world_state'].includes(record.type)) {
    return record.type
  }
  return typeof record.payload?.type === 'string'
    ? record.payload.type
    : null
}

function execSubtype(record) {
  return record.type === 'item.started' || record.type === 'item.completed'
    ? record.item?.type ?? null
    : record.type
}

function recordSubtype(record, stream) {
  return stream === 'persisted'
    ? persistedSubtype(record)
    : execSubtype(record)
}

function assertExactNativeTypes(value, types) {
  for (const [key, expectedType] of Object.entries(types)) {
    if (nativeType(value[key]) !== expectedType) {
      throwFailure('ISOLATION_GRAMMAR_NATIVE_TYPE')
    }
  }
}

function validatePersistedRecord(record) {
  if (!isRecord(record) || !PERSISTED_TOP_LEVEL.has(record.type)) {
    throwFailure('ISOLATION_GRAMMAR_TOP_LEVEL')
  }
  if (!exactKeys(record, ['payload', 'timestamp', 'type'])) {
    throwFailure('ISOLATION_GRAMMAR_EXACT_KEYS')
  }
  assertExactNativeTypes(record, {
    payload: 'object',
    timestamp: 'string',
    type: 'string',
  })
  const subtype = persistedSubtype(record)
  const subtypeVariants = PERSISTED_VARIANTS.filter(
    (entry) => entry.subtype === subtype,
  )
  if (subtypeVariants.length === 0) {
    throwFailure('ISOLATION_GRAMMAR_SUBTYPE')
  }
  const keyVariant = subtypeVariants.find((entry) =>
    exactKeys(record.payload, entry.keys),
  )
  if (!keyVariant) {
    throwFailure('ISOLATION_GRAMMAR_EXACT_KEYS')
  }
  assertExactNativeTypes(record.payload, keyVariant.types)
  return subtype
}

function validateMcpItem(record) {
  const item = record.item
  if (
    !exactKeys(item, [
      'arguments',
      'error',
      'id',
      'result',
      'server',
      'status',
      'tool',
      'type',
    ])
  ) {
    throwFailure('ISOLATION_GRAMMAR_EXACT_KEYS')
  }
  assertExactNativeTypes(item, {
    arguments: 'object',
    id: 'string',
    server: 'string',
    status: 'string',
    tool: 'string',
    type: 'string',
  })
  if (!['in_progress', 'failed', 'completed'].includes(item.status)) {
    throwFailure('ISOLATION_MCP_STATUS')
  }
  const tuple =
    record.type === 'item.started' &&
    item.status === 'in_progress' &&
    item.error === null &&
    item.result === null
      ? 'started'
      : record.type === 'item.completed' &&
          item.status === 'failed' &&
          nativeType(item.error) === 'object' &&
          item.result === null
        ? 'completed-failed'
        : record.type === 'item.completed' &&
            item.status === 'completed' &&
            item.error === null &&
            nativeType(item.result) === 'object'
          ? 'completed-success'
          : null
  if (!tuple) throwFailure('ISOLATION_MCP_LIFECYCLE')
  return tuple
}

function validateExecRecord(record) {
  if (!isRecord(record) || !EXEC_TOP_LEVEL.has(record.type)) {
    throwFailure('ISOLATION_GRAMMAR_TOP_LEVEL')
  }
  const envelope = {
    'thread.started': {
      keys: ['thread_id', 'type'],
      types: { thread_id: 'string', type: 'string' },
    },
    'turn.started': {
      keys: ['type'],
      types: { type: 'string' },
    },
    'item.started': {
      keys: ['item', 'type'],
      types: { item: 'object', type: 'string' },
    },
    'item.completed': {
      keys: ['item', 'type'],
      types: { item: 'object', type: 'string' },
    },
    'turn.completed': {
      keys: ['type', 'usage'],
      types: { type: 'string', usage: 'object' },
    },
    error: {
      keys: ['message', 'type'],
      types: { message: 'string', type: 'string' },
    },
    'turn.failed': {
      keys: ['error', 'type'],
      types: { error: 'object', type: 'string' },
    },
  }[record.type]
  if (!exactKeys(record, envelope.keys)) {
    throwFailure('ISOLATION_GRAMMAR_EXACT_KEYS')
  }
  assertExactNativeTypes(record, envelope.types)
  if (record.type !== 'item.started' && record.type !== 'item.completed') {
    return record.type
  }
  const subtype = record.item?.type
  if (!['agent_message', 'error', 'mcp_tool_call'].includes(subtype)) {
    throwFailure('ISOLATION_GRAMMAR_SUBTYPE')
  }
  if (subtype === 'agent_message') {
    if (
      record.type !== 'item.completed' ||
      !exactKeys(record.item, ['id', 'text', 'type'])
    ) {
      throwFailure('ISOLATION_GRAMMAR_EXACT_KEYS')
    }
    assertExactNativeTypes(record.item, {
      id: 'string',
      text: 'string',
      type: 'string',
    })
  } else if (subtype === 'error') {
    if (
      record.type !== 'item.completed' ||
      !exactKeys(record.item, ['id', 'message', 'type'])
    ) {
      throwFailure('ISOLATION_GRAMMAR_EXACT_KEYS')
    }
    assertExactNativeTypes(record.item, {
      id: 'string',
      message: 'string',
      type: 'string',
    })
  } else {
    validateMcpItem(record)
  }
  return subtype
}

function validateToolSearch(call, output) {
  if (
    call.execution !== 'client' ||
    call.status !== 'completed' ||
    output.execution !== 'client' ||
    output.status !== 'completed'
  ) {
    throwFailure('ISOLATION_TOOL_SEARCH_STATUS')
  }
  if (
    !exactKeys(call.arguments, ['limit', 'query']) ||
    nativeType(call.arguments.limit) !== 'number' ||
    nativeType(call.arguments.query) !== 'string' ||
    call.arguments.limit !== 1 ||
    call.arguments.query !==
      'Playwright MCP browser_navigate navigate to URL'
  ) {
    throwFailure('ISOLATION_TOOL_SEARCH_ARGUMENTS')
  }
  if (!Array.isArray(output.tools) || output.tools.length !== 1) {
    throwFailure('ISOLATION_TOOL_SEARCH_PROVIDER')
  }
  const provider = output.tools[0]
  if (
    !exactKeys(provider, ['description', 'name', 'tools', 'type']) ||
    nativeType(provider.description) !== 'string' ||
    provider.name !== 'mcp__playwright' ||
    provider.type !== 'namespace' ||
    !Array.isArray(provider.tools) ||
    provider.tools.length !== 1
  ) {
    throwFailure('ISOLATION_TOOL_SEARCH_PROVIDER')
  }
  const leaf = provider.tools[0]
  if (
    !exactKeys(leaf, [
      'defer_loading',
      'description',
      'name',
      'parameters',
      'strict',
      'type',
    ]) ||
    nativeType(leaf.description) !== 'string' ||
    leaf.name !== 'browser_navigate' ||
    leaf.type !== 'function' ||
    leaf.defer_loading !== true ||
    leaf.strict !== false ||
    !isRecord(leaf.parameters)
  ) {
    throwFailure('ISOLATION_TOOL_SEARCH_PROVIDER')
  }
  const parameters = leaf.parameters
  if (
    !exactKeys(parameters, [
      'additionalProperties',
      'properties',
      'required',
      'type',
    ]) ||
    parameters.type !== 'object' ||
    parameters.additionalProperties !== false ||
    !sameJson(parameters.required, ['url']) ||
    !exactKeys(parameters.properties, ['url'])
  ) {
    throwFailure('ISOLATION_TOOL_SEARCH_PROVIDER')
  }
  const url = parameters.properties.url
  if (
    !exactKeys(url, ['description', 'type']) ||
    nativeType(url.description) !== 'string' ||
    url.type !== 'string'
  ) {
    throwFailure('ISOLATION_TOOL_SEARCH_PROVIDER')
  }
}

function validateD16ToolPolicy(persisted) {
  for (const record of persisted) {
    if (record.type !== 'response_item') continue
    const payload = record.payload
    if (!['function_call', 'custom_tool_call'].includes(payload.type)) continue
    if (!ALLOWED_TOOLS.includes(payload.name)) {
      throwFailure('ISOLATION_TOOL_POLICY_LEAF', undefined, {
        toolInvocationCount: 0,
      })
    }
    const opaque =
      payload.type === 'function_call' ? payload.arguments : payload.input
    let argumentsObject
    try {
      argumentsObject = JSON.parse(opaque)
    } catch {
      throwFailure('ISOLATION_TOOL_POLICY_ARGUMENTS')
    }
    if (!isRecord(argumentsObject)) {
      throwFailure('ISOLATION_TOOL_POLICY_ARGUMENTS')
    }
    if (
      payload.name === 'browser_navigate' &&
      (!exactKeys(argumentsObject, ['url']) ||
        argumentsObject.url !== `${ORIGIN}/`)
    ) {
      throwFailure('ISOLATION_TOOL_POLICY_ARGUMENTS')
    }
    if (
      payload.name === 'browser_run_code_unsafe' &&
      (!exactKeys(argumentsObject, ['code']) ||
        !Object.values(UNSAFE_CODE_HASHES).includes(
          sha256(argumentsObject.code),
        ))
    ) {
      throwFailure('DIAGNOSTIC_ISOLATION_UNSAFE_CODE')
    }
  }
}

function one(records, predicate, errorCode) {
  const matches = records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => predicate(record))
  if (matches.length !== 1) throwFailure(errorCode)
  return matches[0]
}

function validateCapture(capture, options = {}) {
  for (const record of capture.persisted) validatePersistedRecord(record)
  for (const record of capture.exec) validateExecRecord(record)

  const session = one(
    capture.persisted,
    (record) => record.type === 'session_meta',
    'ISOLATION_CORRELATION_THREAD',
  )
  const thread = one(
    capture.exec,
    (record) => record.type === 'thread.started',
    'ISOLATION_CORRELATION_THREAD',
  )
  if (
    !session.record.payload.id ||
    session.record.payload.id !== session.record.payload.session_id ||
    session.record.payload.id !== thread.record.thread_id
  ) {
    throwFailure('ISOLATION_CORRELATION_THREAD')
  }

  const taskStarted = capture.persisted
    .map((record, index) => ({ record, index }))
    .find(({ record }) => record.payload?.type === 'task_started')
  const turnContext = capture.persisted
    .map((record, index) => ({ record, index }))
    .find(({ record }) => record.type === 'turn_context')
  const taskComplete = capture.persisted
    .map((record, index) => ({ record, index }))
    .find(({ record }) => record.payload?.type === 'task_complete')
  if (
    !taskStarted ||
    !turnContext ||
    !taskComplete ||
    taskStarted.record.payload.turn_id !==
      turnContext.record.payload.turn_id ||
    taskStarted.record.payload.turn_id !==
      taskComplete.record.payload.turn_id
  ) {
    throwFailure('ISOLATION_CORRELATION_TURN')
  }
  if (
    !(
      taskStarted.index < turnContext.index &&
      turnContext.index < taskComplete.index
    )
  ) {
    throwFailure('ISOLATION_ORDER_PERSISTED_TURN')
  }

  const responseItems = capture.persisted.filter(
    (record) => record.type === 'response_item',
  )
  const responseIds = responseItems.map((record) => record.payload.id)
  if (responseIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    throwFailure('ISOLATION_RESPONSE_ID_UNIQUENESS')
  }

  const functionCall = responseItems
    .map((record) => ({
      record,
      index: capture.persisted.indexOf(record),
    }))
    .find(({ record }) => record.payload.type === 'function_call')
  const functionOutput = responseItems
    .map((record) => ({
      record,
      index: capture.persisted.indexOf(record),
    }))
    .find(({ record }) => record.payload.type === 'function_call_output')
  const customCall = responseItems
    .map((record) => ({
      record,
      index: capture.persisted.indexOf(record),
    }))
    .find(({ record }) => record.payload.type === 'custom_tool_call')
  const customOutput = responseItems
    .map((record) => ({
      record,
      index: capture.persisted.indexOf(record),
    }))
    .find(({ record }) => record.payload.type === 'custom_tool_call_output')
  const mcpEnd = capture.persisted
    .map((record, index) => ({ record, index }))
    .find(({ record }) => record.payload?.type === 'mcp_tool_call_end')

  if (functionCall || functionOutput) {
    if (
      !functionCall ||
      !functionOutput ||
      !mcpEnd ||
      functionCall.record.payload.call_id !== mcpEnd.record.payload.call_id ||
      functionCall.record.payload.call_id !==
        functionOutput.record.payload.call_id
    ) {
      throwFailure('ISOLATION_CORRELATION_FUNCTION')
    }
    if (
      !(
        functionCall.index < mcpEnd.index &&
        mcpEnd.index < functionOutput.index
      )
    ) {
      throwFailure('ISOLATION_ORDER_PERSISTED_TOOL')
    }
  }
  if (customCall || customOutput) {
    if (
      !customCall ||
      !customOutput ||
      !mcpEnd ||
      customCall.record.payload.call_id !==
        customOutput.record.payload.call_id
    ) {
      throwFailure('ISOLATION_CORRELATION_CUSTOM_EQUALITY')
    }
    if (
      mcpEnd.record.payload.call_id === customCall.record.payload.call_id
    ) {
      throwFailure('ISOLATION_CORRELATION_CUSTOM_INEQUALITY')
    }
    if (
      !(
        customCall.index < mcpEnd.index &&
        mcpEnd.index < customOutput.index
      )
    ) {
      throwFailure('ISOLATION_ORDER_PERSISTED_TOOL')
    }
  }

  const mcpItems = capture.exec
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.item?.type === 'mcp_tool_call')
  if (mcpItems.length > 0) {
    if (mcpItems.length !== 2) {
      throwFailure('ISOLATION_CORRELATION_MCP_EQUALITY')
    }
    const started = mcpItems.find(
      ({ record }) => record.type === 'item.started',
    )
    const completed = mcpItems.find(
      ({ record }) => record.type === 'item.completed',
    )
    if (!started || !completed || started.record.item.id !== completed.record.item.id) {
      throwFailure('ISOLATION_CORRELATION_MCP_EQUALITY')
    }
    if (completed.index < started.index) {
      throwFailure('ISOLATION_ORDER_EXEC_MCP')
    }
    const persistedIds = new Set([
      ...responseIds,
      ...responseItems
        .map((record) => record.payload.call_id)
        .filter((value) => typeof value === 'string'),
      ...(mcpEnd ? [mcpEnd.record.payload.call_id] : []),
    ])
    if (persistedIds.has(started.record.item.id)) {
      throwFailure('ISOLATION_CORRELATION_MCP_INEQUALITY')
    }
  }

  const searchCall = responseItems
    .map((record) => ({
      record,
      index: capture.persisted.indexOf(record),
    }))
    .find(({ record }) => record.payload.type === 'tool_search_call')
  const searchOutput = responseItems
    .map((record) => ({
      record,
      index: capture.persisted.indexOf(record),
    }))
    .find(({ record }) => record.payload.type === 'tool_search_output')
  if (searchCall || searchOutput) {
    if (!searchCall || !searchOutput) {
      throwFailure('ISOLATION_CORRELATION_TOOL_SEARCH_EQUALITY')
    }
    validateToolSearch(searchCall.record.payload, searchOutput.record.payload)
    if (searchOutput.index < searchCall.index) {
      throwFailure('ISOLATION_ORDER_TOOL_SEARCH')
    }
    if (
      searchCall.record.payload.call_id !==
        searchOutput.record.payload.call_id
    ) {
      throwFailure('ISOLATION_CORRELATION_TOOL_SEARCH_EQUALITY')
    }
    const ids = [
      searchCall.record.payload.id,
      searchOutput.record.payload.id,
      searchCall.record.payload.call_id,
    ]
    if (new Set(ids).size !== ids.length) {
      throwFailure('ISOLATION_CORRELATION_TOOL_SEARCH_INEQUALITY')
    }
  }
  if (new Set(responseIds).size !== responseIds.length) {
    throwFailure('ISOLATION_RESPONSE_ID_UNIQUENESS')
  }
  if (options.d16ToolPolicy) {
    validateD16ToolPolicy(capture.persisted)
  }
}

function statFlags(filePath) {
  if (process.platform !== 'darwin') return ''
  const result = spawnSync('/usr/bin/stat', ['-f', '%Sf', filePath], {
    encoding: 'utf8',
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

function assertNoSymlinkTraversal(base, target) {
  const basePath = resolve(base)
  const targetPath = resolve(target)
  if (
    targetPath !== basePath &&
    !targetPath.startsWith(`${basePath}${sep}`)
  ) {
    throwFailure('ISOLATION_GOLDEN_SOURCE_UNAVAILABLE')
  }
  const components = relative(basePath, targetPath)
    .split(sep)
    .filter(Boolean)
  let cursor = basePath
  for (const component of components) {
    cursor = join(cursor, component)
    const stats = lstatSync(cursor)
    if (stats.isSymbolicLink()) {
      throwFailure('ISOLATION_GOLDEN_SOURCE_UNAVAILABLE')
    }
  }
}

function readGoldenPrivateObject(objectId, expected) {
  if (!OPAQUE_OBJECT_ID.test(objectId)) {
    throwFailure('ISOLATION_GOLDEN_SOURCE_UNAVAILABLE')
  }
  const handoffRootStats = lstatSync(GOLDEN_PRIVATE_ROOT)
  const rootStats = lstatSync(GOLDEN_PRIVATE_OBJECT_ROOT)
  if (
    !handoffRootStats.isDirectory() ||
    handoffRootStats.isSymbolicLink() ||
    (handoffRootStats.mode & 0o777) !== 0o500 ||
    !/(?:^|,)uchg(?:,|$)/.test(statFlags(GOLDEN_PRIVATE_ROOT)) ||
    !rootStats.isDirectory() ||
    rootStats.isSymbolicLink() ||
    (rootStats.mode & 0o777) !== 0o500 ||
    !/(?:^|,)uchg(?:,|$)/.test(statFlags(GOLDEN_PRIVATE_OBJECT_ROOT))
  ) {
    throwFailure('ISOLATION_GOLDEN_SOURCE_UNAVAILABLE')
  }
  const objectPath = join(GOLDEN_PRIVATE_OBJECT_ROOT, objectId)
  try {
    assertNoSymlinkTraversal(
      '/Users/leo/.codex/private-evidence/new-era-2',
      objectPath,
    )
    const stats = lstatSync(objectPath)
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      (stats.mode & 0o777) !== 0o400 ||
      !/(?:^|,)uchg(?:,|$)/.test(statFlags(objectPath))
    ) {
      throwFailure('ISOLATION_GOLDEN_SOURCE_UNAVAILABLE')
    }
    const bytes = readFileSync(objectPath)
    const parsed = parseJsonLines(bytes)
    if (
      sha256(bytes) !== expected.sha256 ||
      bytes.byteLength !== expected.bytes ||
      parsed.records.length !== expected.lines
    ) {
      throwFailure('ISOLATION_GOLDEN_SOURCE_COMMITMENT')
    }
    return parsed
  } catch (error) {
    if (error instanceof IsolationFailure) throw error
    throwFailure('ISOLATION_GOLDEN_SOURCE_UNAVAILABLE')
  }
}

function sidecarMatches(jsonPath, expectedSidecarHash) {
  const sidecarPath = `${jsonPath}.sha256`
  const sidecar = readFileSync(sidecarPath)
  if (sha256(sidecar) !== expectedSidecarHash) return false
  const text = sidecar.toString('utf8')
  return text === `${sha256(readFileSync(jsonPath))}  ${basename(jsonPath)}\n`
}

function hasForbiddenGoldenContent(value) {
  if (Array.isArray(value)) return value.some(hasForbiddenGoldenContent)
  if (isRecord(value)) {
    return Object.entries(value).some(([key, entry]) => {
      if (
        /^(?:secret|token|api[_-]?key|system_instructions|developer_instructions)$/i.test(
          key,
        )
      ) {
        return true
      }
      return hasForbiddenGoldenContent(entry)
    })
  }
  return (
    typeof value === 'string' &&
    /\/(?:Users|home|private|tmp|var|etc)\//.test(value)
  )
}

function loadGoldenCorpus(repoRoot, options = {}) {
  const expectationsPath = resolve(
    repoRoot,
    'prototype/tests/fixtures/fixture-expectations.json',
  )
  const recapturePath = resolve(repoRoot, RECAPTURE_PATH)
  const recaptureBytes = readFileSync(recapturePath)
  if (
    sha256(recaptureBytes) !== RECAPTURE_SHA256 ||
    !sidecarMatches(recapturePath, RECAPTURE_SIDECAR_SHA256)
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_GOLDEN_PROVENANCE')
  }
  const recapture = JSON.parse(recaptureBytes)
  if (
    recapture.schemaVersion !== 3 ||
    recapture.status !==
      'RECAPTURE_V3_PRIVATE_HANDOFF_COMPLETE_WITH_OBSERVED_GRAMMAR_DRIFT' ||
    recapture.privateSourceHandoff?.status !== 'COMPLETE' ||
    recapture.privateSourceHandoff?.rootPolicyId !==
      'new-era-2-c04-private-evidence-v3' ||
    recapture.privateSourceHandoff?.sourceSet?.expectedSourceFileCount !== 10 ||
    recapture.privateSourceHandoff?.objectsDirectory?.objectCount !== 10
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_GOLDEN_PROVENANCE')
  }
  const expectations = JSON.parse(readFileSync(expectationsPath, 'utf8'))
  const provenance = expectations.isolationGoldenProvenance
  if (!exactKeys(provenance, ['execEvents', 'persistedRollout'])) {
    throwFailure('DIAGNOSTIC_ISOLATION_GOLDEN_PROVENANCE')
  }
  const streams = [
    {
      name: 'persistedRollout',
      stream: 'persisted',
      grammar: PERSISTED_GRAMMAR,
      goldenPath: PERSISTED_GOLDEN,
    },
    {
      name: 'execEvents',
      stream: 'exec',
      grammar: EXEC_GRAMMAR,
      goldenPath: EXEC_GOLDEN,
    },
  ]
  const captures = Object.fromEntries(
    CAPTURE_IDS.map((captureId) => [
      captureId,
      { persisted: [], exec: [] },
    ]),
  )
  for (const contract of streams) {
    const entry = provenance[contract.name]
    if (
      !exactKeys(entry, [
        'sourceGrammar',
        'codexCliVersion',
        'sourceSet',
        'fixtureSourceCaptures',
        'sanitizerVersion',
        'sanitizerRuleset',
        'goldenPath',
        'goldenSha256',
        'goldenLineCount',
        'independentReadBackStatus',
        'privacyScanStatus',
      ]) ||
      entry.sourceGrammar !== contract.grammar ||
      entry.codexCliVersion !== CLI_VERSION ||
      entry.sourceSet !== SOURCE_SET ||
      !SANITIZER_ID.test(entry.sanitizerVersion ?? '') ||
      typeof entry.sanitizerRuleset !== 'string' ||
      entry.sanitizerRuleset.length === 0 ||
      entry.goldenPath !== contract.goldenPath ||
      !HEX_64.test(entry.goldenSha256 ?? '') ||
      !Number.isSafeInteger(entry.goldenLineCount) ||
      entry.goldenLineCount < 1 ||
      entry.independentReadBackStatus !== 'PASS' ||
      entry.privacyScanStatus !== 'PASS' ||
      !Array.isArray(entry.fixtureSourceCaptures) ||
      !sameJson(
        entry.fixtureSourceCaptures.map((capture) => capture.captureId),
        CAPTURE_IDS,
      )
    ) {
      throwFailure('DIAGNOSTIC_ISOLATION_GOLDEN_PROVENANCE')
    }
    const goldenBytes = readFileSync(resolve(repoRoot, entry.goldenPath))
    const parsed = parseJsonLines(goldenBytes)
    if (
      sha256(goldenBytes) !== entry.goldenSha256 ||
      parsed.records.length !== entry.goldenLineCount ||
      hasForbiddenGoldenContent(parsed.records)
    ) {
      throwFailure('DIAGNOSTIC_ISOLATION_GOLDEN_PROVENANCE')
    }
    let offset = 0
    for (const [index, source] of entry.fixtureSourceCaptures.entries()) {
      if (
        !exactKeys(source, [
          'captureId',
          'ordinal',
          'sourceOpaqueObjectId',
          'sourceOpaqueCommitment',
          'sourceLineCount',
          'eventOrder',
        ]) ||
        source.captureId !== CAPTURE_IDS[index] ||
        source.ordinal !== index + 1 ||
        !OPAQUE_OBJECT_ID.test(source.sourceOpaqueObjectId ?? '') ||
        !HEX_64.test(source.sourceOpaqueCommitment ?? '') ||
        !Number.isSafeInteger(source.sourceLineCount) ||
        source.sourceLineCount < 1 ||
        !Array.isArray(source.eventOrder) ||
        source.eventOrder.length !== source.sourceLineCount
      ) {
        throwFailure('DIAGNOSTIC_ISOLATION_GOLDEN_PROVENANCE')
      }
      const handoff =
        recapture.privateSourceHandoff.objectsByCapture?.[
          source.captureId
        ]?.[contract.stream]
      if (
        !handoff ||
        source.sourceOpaqueObjectId !== handoff.opaqueObjectId ||
        source.sourceOpaqueCommitment !== handoff.sha256 ||
        source.sourceLineCount !== handoff.lines
      ) {
        throwFailure('DIAGNOSTIC_ISOLATION_GOLDEN_PROVENANCE')
      }
      if (!options.skipPrivateReadBack) {
        readGoldenPrivateObject(source.sourceOpaqueObjectId, handoff)
      }
      const segment = parsed.records.slice(
        offset,
        offset + source.sourceLineCount,
      )
      if (segment.length !== source.sourceLineCount) {
        throwFailure('DIAGNOSTIC_ISOLATION_GOLDEN_PROVENANCE')
      }
      for (const [eventIndex, event] of source.eventOrder.entries()) {
        if (
          !exactKeys(event, [
            'sourceLineOrdinal',
            'topLevelType',
            'subtype',
          ]) ||
          event.sourceLineOrdinal !== eventIndex + 1 ||
          event.topLevelType !== segment[eventIndex].type ||
          event.subtype !==
            recordSubtype(segment[eventIndex], contract.stream)
        ) {
          throwFailure('DIAGNOSTIC_ISOLATION_GOLDEN_PROVENANCE')
        }
      }
      captures[source.captureId][contract.stream] = segment
      offset += source.sourceLineCount
    }
    if (offset !== parsed.records.length) {
      throwFailure('DIAGNOSTIC_ISOLATION_GOLDEN_PROVENANCE')
    }
  }
  for (const captureId of CAPTURE_IDS) {
    validateCapture(captures[captureId])
  }
  return captures
}

function findPersisted(capture, subtype) {
  const entry = capture.persisted.find(
    (record) => persistedSubtype(record) === subtype,
  )
  if (!entry) throw new Error(`missing persisted ${subtype}`)
  return entry
}

function findExecMcp(capture, topLevel) {
  const entry = capture.exec.find(
    (record) =>
      record.type === topLevel &&
      record.item?.type === 'mcp_tool_call',
  )
  if (!entry) throw new Error(`missing exec ${topLevel} mcp`)
  return entry
}

function swap(records, left, right) {
  ;[records[left], records[right]] = [records[right], records[left]]
}

function applyNegativeMutation(corpus, fixtureId) {
  if (fixtureId === 'S01' || fixtureId === 'S02') return
  const a = corpus.A
  const b = corpus.B
  const bExtension = corpus.B_EXTENSION
  const success = corpus.B_SUCCESS_PROBE
  if (fixtureId === 'G01') delete a.persisted[0].timestamp
  else if (fixtureId === 'G02') a.persisted[0].unknown = true
  else if (fixtureId === 'G03') a.persisted[0].timestamp = 1
  else if (fixtureId === 'G04') a.persisted[0].type = 'unknown'
  else if (fixtureId === 'G05') {
    const message = findPersisted(a, 'message')
    message.payload.type = 'unknown'
  } else if (fixtureId === 'L01') {
    findExecMcp(b, 'item.started').item.error = {}
  } else if (fixtureId === 'L02') {
    findExecMcp(b, 'item.completed').item.result = {}
  } else if (fixtureId === 'L03') {
    findExecMcp(success, 'item.completed').item.error = {}
  } else if (fixtureId === 'L04') {
    findExecMcp(b, 'item.started').item.status = 'started'
  } else if (fixtureId === 'C01') {
    b.exec.find((record) => record.type === 'thread.started').thread_id += 'x'
  } else if (fixtureId === 'C02') {
    findPersisted(b, 'task_complete').payload.turn_id += 'x'
  } else if (fixtureId === 'C03') {
    findPersisted(b, 'function_call_output').payload.call_id += 'x'
  } else if (fixtureId === 'C04') {
    findPersisted(success, 'custom_tool_call_output').payload.call_id += 'x'
  } else if (fixtureId === 'C05') {
    findPersisted(success, 'mcp_tool_call_end').payload.call_id =
      findPersisted(success, 'custom_tool_call').payload.call_id
  } else if (fixtureId === 'C06') {
    findExecMcp(b, 'item.completed').item.id += 'x'
  } else if (fixtureId === 'C07') {
    const chainId = findPersisted(b, 'function_call').payload.call_id
    findExecMcp(b, 'item.started').item.id = chainId
    findExecMcp(b, 'item.completed').item.id = chainId
  } else if (fixtureId === 'O01') {
    const callIndex = b.persisted.indexOf(findPersisted(b, 'function_call'))
    const endIndex = b.persisted.indexOf(findPersisted(b, 'mcp_tool_call_end'))
    swap(b.persisted, callIndex, endIndex)
  } else if (fixtureId === 'O02') {
    const started = b.exec.indexOf(findExecMcp(b, 'item.started'))
    const completed = b.exec.indexOf(findExecMcp(b, 'item.completed'))
    swap(b.exec, started, completed)
  } else if (fixtureId === 'T01') {
    const callIndex = b.persisted.indexOf(findPersisted(b, 'tool_search_call'))
    const outputIndex = b.persisted.indexOf(
      findPersisted(b, 'tool_search_output'),
    )
    swap(b.persisted, callIndex, outputIndex)
  } else if (fixtureId === 'T02') {
    findPersisted(b, 'tool_search_output').payload.tools[0].name =
      'mcp__other'
  } else if (fixtureId === 'T03') {
    findPersisted(b, 'tool_search_call').payload.execution = 'server'
  } else if (fixtureId === 'T04') {
    findPersisted(b, 'tool_search_call').payload.arguments.limit = 2
  } else if (fixtureId === 'T05') {
    findPersisted(b, 'tool_search_call').payload.arguments.query += 'x'
  } else if (fixtureId === 'T06') {
    findPersisted(b, 'tool_search_output').payload.call_id += 'x'
  } else if (fixtureId === 'T07') {
    const call = findPersisted(b, 'tool_search_call').payload
    call.id = call.call_id
  } else if (fixtureId === 'T08') {
    const output = findPersisted(b, 'tool_search_output').payload
    output.id = output.call_id
  } else if (fixtureId === 'T09') {
    findPersisted(b, 'tool_search_output').payload.id =
      findPersisted(b, 'tool_search_call').payload.id
  } else if (fixtureId === 'R01') {
    const items = bExtension.persisted.filter(
      (record) => record.type === 'response_item',
    )
    items[1].payload.id = items[0].payload.id
  } else if (fixtureId !== 'U01') {
    throw new Error(`unknown negative fixture ${fixtureId}`)
  }
}

function runSourceNegativeCase(repoRoot, fixtureId) {
  const recapture = JSON.parse(
    readFileSync(resolve(repoRoot, RECAPTURE_PATH), 'utf8'),
  )
  const source =
    recapture.privateSourceHandoff.objectsByCapture.A.persisted
  if (fixtureId === 'S01') {
    readGoldenPrivateObject(source.opaqueObjectId, {
      ...source,
      sha256: 'f'.repeat(64),
    })
    throw new Error('S01 mutation unexpectedly accepted')
  }
  readGoldenPrivateObject(`sha256-${'0'.repeat(64)}.jsonl`, source)
  throw new Error('S02 mutation unexpectedly accepted')
}

function executeNegativeCase(repoRoot, fixtureId) {
  const expectedErrorCode = NEGATIVE_CASES[fixtureId]
  if (!expectedErrorCode) {
    return reject('DIAGNOSTIC_ISOLATION_FIXTURE_CASE')
  }
  try {
    if (fixtureId === 'S01' || fixtureId === 'S02') {
      runSourceNegativeCase(repoRoot, fixtureId)
    }
    const corpus = clone(
      loadGoldenCorpus(repoRoot, { skipPrivateReadBack: true }),
    )
    applyNegativeMutation(corpus, fixtureId)
    for (const captureId of CAPTURE_IDS) {
      validateCapture(corpus[captureId], {
        d16ToolPolicy:
          fixtureId === 'U01' && captureId === 'B_SUCCESS_PROBE',
      })
    }
    return reject('DIAGNOSTIC_ISOLATION_FIXTURE_MISMATCH', {
      fixtureId,
      expectedErrorCode,
      actualAccepted: true,
    })
  } catch (error) {
    const actualErrorCode =
      error instanceof IsolationFailure
        ? error.code
        : 'DIAGNOSTIC_ISOLATION_FIXTURE_INTERNAL'
    if (actualErrorCode !== expectedErrorCode) {
      return reject('DIAGNOSTIC_ISOLATION_FIXTURE_MISMATCH', {
        fixtureId,
        expectedErrorCode,
        actualErrorCode,
      })
    }
    return reject(actualErrorCode, {
      fixtureId,
      canonicalInputRehashed: true,
      toolInvocationCount:
        error instanceof IsolationFailure
          ? error.summary.toolInvocationCount ?? 0
          : 0,
    })
  }
}

function expectedCommandArgv(temporaryWorkspace) {
  return [
    CLI_BINARY,
    'exec',
    '--json',
    '--strict-config',
    '--ignore-user-config',
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--cd',
    temporaryWorkspace,
    '--model',
    MODEL,
    '--disable',
    'memories',
    '--disable',
    'hooks',
    '--ignore-rules',
    '-c',
    'plugins."browser@openai-bundled".enabled=false',
    '-c',
    'plugins."chrome@openai-bundled".enabled=false',
    '-c',
    'plugins."computer-use@openai-bundled".enabled=false',
    '-c',
    'mcp_servers.playwright.enabled=true',
    '-c',
    'mcp_servers.playwright.command="npx"',
    '-c',
    'mcp_servers.playwright.args=["-y","@playwright/mcp@0.0.76"]',
    '-c',
    'mcp_servers.playwright.default_tools_approval_mode="auto"',
    '-c',
    'model_reasoning_effort="xhigh"',
    '-c',
    'approval_policy="never"',
    '-',
  ]
}

function validatePreflight(preflight, sampleId, liveIdentity = false) {
  if (
    !isRecord(preflight) ||
    preflight.schemaVersion !== PREFLIGHT_SCHEMA ||
    preflight.sampleId !== sampleId ||
    preflight.diagnosticIsolationProfile !== PROFILE ||
    !isAbsolute(preflight.stdinPromptPath ?? '') ||
    !isAbsolute(preflight.cliEventStreamPath ?? '') ||
    !isAbsolute(preflight.rolloutPath ?? '') ||
    !isAbsolute(preflight.temporaryWorkspace ?? '') ||
    preflight.temporaryWorkspaceInitiallyEmpty !== true ||
    !HEX_64.test(preflight.promptHash ?? '')
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_PREFLIGHT')
  }
  if (preflight.cliBinaryPath !== CLI_BINARY) {
    throwFailure('C04_CLI_BINARY_PATH')
  }
  if (preflight.agentCliVersion !== CLI_VERSION) {
    throwFailure('C04_CLI_VERSION')
  }
  if (preflight.cliBinarySha256 !== CLI_SHA256) {
    throwFailure('C04_CLI_BINARY_SHA256')
  }
  if (preflight.cliTeamIdentifier !== CLI_TEAM_IDENTIFIER) {
    throwFailure('C04_CLI_TEAM_IDENTIFIER')
  }
  if (preflight.cliAuthority !== CLI_AUTHORITY) {
    throwFailure('C04_CLI_AUTHORITY')
  }
  if (
    preflight.nodeExecutable !== NODE_EXECUTABLE ||
    preflight.nodeVersion !== NODE_VERSION ||
    preflight.nodeBinarySha256 !== NODE_SHA256
  ) {
    throwFailure('C04_NODE_IDENTITY')
  }
  if (
    preflight.agentModel !== MODEL ||
    preflight.agentReasoningEffort !== REASONING
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_AGENT_CONFIG')
  }
  if (
    !exactKeys(preflight.environment, ['PATH']) ||
    preflight.environment.PATH !== FIXED_PATH ||
    !sameJson(
      preflight.commandArgv,
      expectedCommandArgv(preflight.temporaryWorkspace),
    ) ||
    preflight.commandArgv.some((token) =>
      [
        'mcp_servers.chrome-devtools.enabled=false',
        'mcp_servers.node_repl.enabled=false',
      ].includes(token),
    )
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_LAUNCH_COMMAND')
  }
  const playwright = preflight.playwrightMcp
  const integrityMatch =
    typeof playwright?.npmIntegrity === 'string'
      ? playwright.npmIntegrity.match(NPM_INTEGRITY)
      : null
  if (
    !isRecord(playwright) ||
    playwright.provider !== PLAYWRIGHT_PROVIDER ||
    playwright.packageVersion !== PLAYWRIGHT_VERSION ||
    !integrityMatch ||
    Buffer.from(integrityMatch[1], 'base64').byteLength !== 64 ||
    !sameJson(playwright.serverArgv, [
      'npx',
      '-y',
      '@playwright/mcp@0.0.76',
    ]) ||
    !sameJson(playwright.expectedToolInventory, ALLOWED_TOOLS)
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_PLAYWRIGHT')
  }
  if (preflight.origin !== ORIGIN) {
    throwFailure('DIAGNOSTIC_ISOLATION_ORIGIN')
  }
  if (!sameJson(preflight.unsafeCodeHashes, UNSAFE_CODE_HASHES)) {
    throwFailure('DIAGNOSTIC_ISOLATION_UNSAFE_CODE')
  }
  if (liveIdentity) validateLiveIdentity()
}

function validateLiveIdentity() {
  const binaryBytes = readFileSync(CLI_BINARY)
  if (sha256(binaryBytes) !== CLI_SHA256) {
    throwFailure('C04_CLI_BINARY_SHA256')
  }
  const version = spawnSync(CLI_BINARY, ['--version'], { encoding: 'utf8' })
  if (version.status !== 0 || version.stdout.trim() !== CLI_VERSION) {
    throwFailure('C04_CLI_VERSION')
  }
  const codesign = spawnSync(
    '/usr/bin/codesign',
    ['-dvv', CLI_BINARY],
    { encoding: 'utf8' },
  )
  const signature = `${codesign.stdout}${codesign.stderr}`
  if (!signature.includes(`TeamIdentifier=${CLI_TEAM_IDENTIFIER}`)) {
    throwFailure('C04_CLI_TEAM_IDENTIFIER')
  }
  if (!signature.includes(`Authority=${CLI_AUTHORITY}`)) {
    throwFailure('C04_CLI_AUTHORITY')
  }
  const nodeVersion = spawnSync(NODE_EXECUTABLE, ['--version'], {
    encoding: 'utf8',
  })
  if (
    nodeVersion.status !== 0 ||
    nodeVersion.stdout.trim() !== NODE_VERSION ||
    sha256(readFileSync(NODE_EXECUTABLE)) !== NODE_SHA256
  ) {
    throwFailure('C04_NODE_IDENTITY')
  }
}

function executeIdentityCase(repoRoot, errorCode) {
  if (!Object.hasOwn(IDENTITY_CASES, errorCode)) {
    return reject('DIAGNOSTIC_ISOLATION_FIXTURE_CASE')
  }
  const sample = JSON.parse(
    readFileSync(
      resolve(
        repoRoot,
        'prototype/tests/fixtures/isolation/sample-valid.json',
      ),
      'utf8',
    ),
  )
  const preflight = clone(sample.preflight)
  const field = IDENTITY_CASES[errorCode]
  if (field === 'nodeIdentity') preflight.nodeBinarySha256 = 'f'.repeat(64)
  else preflight[field] = `${preflight[field]}-drift`
  try {
    validatePreflight(preflight, sample.sampleId)
    return reject('DIAGNOSTIC_ISOLATION_FIXTURE_MISMATCH')
  } catch (error) {
    if (!(error instanceof IsolationFailure) || error.code !== errorCode) {
      return reject('DIAGNOSTIC_ISOLATION_FIXTURE_MISMATCH', {
        expectedErrorCode: errorCode,
        actualErrorCode: error?.code ?? null,
      })
    }
    return reject(errorCode, {
      canonicalInputRehashed: true,
      toolInvocationCount: 0,
    })
  }
}

function canonicalSamplePaths(sampleId) {
  const inputPath =
    `data/playtests/weekly-management-slice/gate1a/${COHORT_ID}/` +
    `candidates/${CANDIDATE_ATTEMPT}/diagnostics/${sampleId}/` +
    'diagnostic-isolation-input.json'
  const verificationPath =
    `data/playtests/weekly-management-slice/gate1a/${COHORT_ID}/` +
    `candidates/${CANDIDATE_ATTEMPT}/evidence/diagnostic-isolation/` +
    `${sampleId}-verification.json`
  return {
    inputPath,
    inputSidecarPath: `${inputPath}.sha256`,
    verificationPath,
    verificationSidecarPath: `${verificationPath}.sha256`,
  }
}

export function validateDiagnosticIsolation(input) {
  if (input?.kind === 'sample') {
    try {
      validatePreflight(input.preflight, input.sampleId)
    } catch (error) {
      return reject(
        error instanceof IsolationFailure
          ? error.code
          : 'DIAGNOSTIC_ISOLATION_SHAPE',
      )
    }
    if (
      input.schemaVersion !== INPUT_SCHEMA ||
      !SAMPLE_ID.test(input.sampleId ?? '') ||
      !isRecord(input.privateEvidence?.rollout) ||
      !isRecord(input.privateEvidence?.cliEvents) ||
      !isRepoRelativePath(input.structuralEvidence?.agentRollout?.path) ||
      !HEX_64.test(input.structuralEvidence?.agentRollout?.sha256 ?? '') ||
      !isRepoRelativePath(input.structuralEvidence?.cliEvents?.path) ||
      !HEX_64.test(input.structuralEvidence?.cliEvents?.sha256 ?? '') ||
      !isRecord(input.identityAndIsolation)
    ) {
      return reject('DIAGNOSTIC_ISOLATION_SHAPE')
    }
    return accept(
      'PASS_DIAGNOSTIC_ISOLATION_CONTRACT',
      'sample-contract',
      { sampleId: input.sampleId, operationallyVerified: false },
    )
  }
  if (input?.kind === 'aggregate') {
    if (
      input.schemaVersion !== INPUT_SCHEMA ||
      input.cohortId !== COHORT_ID ||
      input.candidateAttempt !== CANDIDATE_ATTEMPT ||
      !Array.isArray(input.samples) ||
      !sameJson(
        input.samples.map((sample) => sample.sampleId),
        SAMPLE_IDS,
      ) ||
      input.samples.some((sample) => {
        const expected = {
          sampleId: sample.sampleId,
          ...canonicalSamplePaths(sample.sampleId),
        }
        return !exactKeys(sample, Object.keys(expected)) ||
          !sameJson(sample, expected)
      })
    ) {
      return reject('DIAGNOSTIC_ISOLATION_AGGREGATE_SHAPE')
    }
    return accept(
      'PASS_DIAGNOSTIC_ISOLATION_AGGREGATE_CONTRACT',
      'aggregate-contract',
      {
        sampleIds: SAMPLE_IDS,
        serialExecution: true,
        operationallyVerified: false,
      },
    )
  }
  return reject('DIAGNOSTIC_ISOLATION_SHAPE')
}

export function validateDiagnosticIsolationFixtureMatrix(matrix) {
  const expectedEntries = Object.entries(NEGATIVE_CASES)
  if (
    !isRecord(matrix) ||
    matrix.schemaVersion !== FIXTURE_SCHEMA ||
    !Array.isArray(matrix.fixtures) ||
    matrix.fixtures.length !== expectedEntries.length ||
    !matrix.fixtures.every((fixture, index) => {
      const [fixtureId, errorCode] = expectedEntries[index]
      return (
        exactKeys(fixture, [
          'fixtureId',
          'mutation',
          'expectedAccepted',
          'expectedErrorCode',
        ]) &&
        fixture.fixtureId === fixtureId &&
        typeof fixture.mutation === 'string' &&
        fixture.mutation.length > 0 &&
        fixture.expectedAccepted === false &&
        fixture.expectedErrorCode === errorCode
      )
    }) ||
    new Set(matrix.fixtures.map((fixture) => fixture.fixtureId)).size !==
      expectedEntries.length
  ) {
    return reject('DIAGNOSTIC_ISOLATION_FIXTURE_SHAPE')
  }
  return accept(
    'PASS_DIAGNOSTIC_ISOLATION_FIXTURE_CONTRACT',
    'fixtures',
    {
      fixtureCount: expectedEntries.length,
      requiredNegativeCases: expectedEntries.length,
      executedNegativeCases: 0,
      operationallyVerified: false,
    },
  )
}

function validateMatrixAndGoldens(repoRoot) {
  const matrixPath = resolve(
    repoRoot,
    'prototype/tests/fixtures/isolation/fixture-matrix.json',
  )
  const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'))
  const contract = validateDiagnosticIsolationFixtureMatrix(matrix)
  if (!contract.accepted) return contract
  loadGoldenCorpus(repoRoot)
  const outcomes = []
  for (const fixture of matrix.fixtures) {
    const result = executeNegativeCase(repoRoot, fixture.fixtureId)
    if (
      result.accepted ||
      result.errorCode !== fixture.expectedErrorCode
    ) {
      return reject('DIAGNOSTIC_ISOLATION_FIXTURE_MISMATCH', {
        fixtureId: fixture.fixtureId,
        expectedErrorCode: fixture.expectedErrorCode,
        actualErrorCode: result.errorCode,
      })
    }
    outcomes.push({
      fixtureId: fixture.fixtureId,
      errorCode: result.errorCode,
      status: 'PASS',
    })
  }
  return accept('PASS_DIAGNOSTIC_ISOLATION_FIXTURES', 'fixtures', {
    fixtureCount: matrix.fixtures.length,
    requiredNegativeCases: 31,
    executedNegativeCases: outcomes.length,
    uniqueNegativeCases:
      new Set(outcomes.map((entry) => entry.fixtureId)).size,
    outcomes,
    goldenGrammar: {
      persisted: {
        sourceGrammar: PERSISTED_GRAMMAR,
        envelopeTypes: 5,
        payloadSubtypes: 17,
        payloadVariants: 19,
      },
      exec: {
        sourceGrammar: EXEC_GRAMMAR,
        envelopeTypes: 7,
        itemSubtypes: 3,
      },
    },
    toolInvocationCount: 0,
  })
}

function readSidecarPair(jsonPath, sidecarPath) {
  try {
    const jsonStats = lstatSync(jsonPath)
    const sidecarStats = lstatSync(sidecarPath)
    if (
      !jsonStats.isFile() ||
      jsonStats.isSymbolicLink() ||
      !sidecarStats.isFile() ||
      sidecarStats.isSymbolicLink()
    ) {
      return null
    }
    const bytes = readFileSync(jsonPath)
    const hash = sha256(bytes)
    if (
      readFileSync(sidecarPath, 'utf8') !==
      `${hash}  ${basename(jsonPath)}\n`
    ) {
      return null
    }
    return { bytes, hash }
  } catch {
    return null
  }
}

function readD16PrivateObject(sampleId, commitment) {
  try {
    if (
      !isRecord(commitment) ||
      !HEX_64.test(commitment.objectId ?? '') ||
      commitment.objectId !== commitment.sha256 ||
      !Number.isSafeInteger(commitment.bytes) ||
      !Number.isSafeInteger(commitment.lineCount)
    ) {
      throw new Error('invalid commitment')
    }
    const sampleDirectory = join(
      PRIVATE_EVIDENCE_ROOT,
      COHORT_ID,
      CANDIDATE_ATTEMPT,
      sampleId.replace('TECH-RC9-', ''),
    )
    const objectPath = join(sampleDirectory, commitment.objectId)
    assertNoSymlinkTraversal(PRIVATE_EVIDENCE_ROOT, objectPath)
    const directoryStats = lstatSync(sampleDirectory)
    const objectStats = lstatSync(objectPath)
    if (
      !directoryStats.isDirectory() ||
      directoryStats.isSymbolicLink() ||
      (directoryStats.mode & 0o777) !== 0o500 ||
      !objectStats.isFile() ||
      objectStats.isSymbolicLink() ||
      (objectStats.mode & 0o777) !== 0o400 ||
      !/(?:^|,)uchg(?:,|$)/.test(statFlags(objectPath))
    ) {
      throw new Error('private object mode')
    }
    const bytes = readFileSync(objectPath)
    const parsed = parseJsonLines(bytes)
    if (
      sha256(bytes) !== commitment.sha256 ||
      bytes.byteLength !== commitment.bytes ||
      parsed.records.length !== commitment.lineCount
    ) {
      throw new Error('private object commitment')
    }
    return { bytes, ...parsed }
  } catch {
    throwFailure('PRIVATE_EVIDENCE_UNAVAILABLE')
  }
}

function validateStructuralProjection(
  repoRoot,
  descriptor,
  privateObject,
  stream,
) {
  if (
    !isRecord(descriptor) ||
    !isRepoRelativePath(descriptor.path) ||
    !HEX_64.test(descriptor.sha256 ?? '')
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_PROJECTION')
  }
  const projectionPath = resolve(repoRoot, descriptor.path)
  if (!projectionPath.startsWith(`${resolve(repoRoot)}${sep}`)) {
    throwFailure('DIAGNOSTIC_ISOLATION_PROJECTION')
  }
  const pair = readSidecarPair(
    projectionPath,
    `${projectionPath}.sha256`,
  )
  if (!pair || pair.hash !== descriptor.sha256) {
    throwFailure('DIAGNOSTIC_ISOLATION_PROJECTION')
  }
  const parsed = parseJsonLines(pair.bytes)
  if (parsed.records.length !== privateObject.records.length + 1) {
    throwFailure('DIAGNOSTIC_ISOLATION_PROJECTION')
  }
  const header = parsed.records[0]
  if (
    !exactKeys(header, [
      'kind',
      'sourceLineCount',
      'sourceLineSha256',
      'sourceSha256',
      'stream',
    ]) ||
    header.kind !== 'projection-header' ||
    header.stream !== stream ||
    header.sourceSha256 !== sha256(privateObject.bytes) ||
    header.sourceLineCount !== privateObject.records.length ||
    !sameJson(
      header.sourceLineSha256,
      privateObject.lines.map((line) => sha256(`${line}\n`)),
    )
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_PROJECTION')
  }
  for (const [index, record] of privateObject.records.entries()) {
    const projection = parsed.records[index + 1]
    if (
      !exactKeys(projection, [
        'correlation',
        'ordinal',
        'originalLineSha256',
        'subtype',
        'timestamp',
        'topLevelType',
      ]) ||
      projection.ordinal !== index + 1 ||
      projection.topLevelType !== record.type ||
      projection.subtype !== recordSubtype(record, stream) ||
      projection.originalLineSha256 !== sha256(`${privateObject.lines[index]}\n`) ||
      (stream === 'persisted'
        ? projection.timestamp !== record.timestamp
        : projection.timestamp !== null) ||
      !isRecord(projection.correlation)
    ) {
      throwFailure('DIAGNOSTIC_ISOLATION_PROJECTION')
    }
  }
}

function validateOperationalSample(input, repoRoot, inputPath, inputHash) {
  if (
    input.schemaVersion !== INPUT_SCHEMA ||
    input.kind !== 'sample' ||
    input.synthetic === true ||
    !SAMPLE_ID.test(input.sampleId ?? '')
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_SHAPE')
  }
  validatePreflight(input.preflight, input.sampleId, true)
  const rollout = readD16PrivateObject(
    input.sampleId,
    input.privateEvidence?.rollout,
  )
  const exec = readD16PrivateObject(
    input.sampleId,
    input.privateEvidence?.cliEvents,
  )
  const capture = {
    persisted: rollout.records,
    exec: exec.records,
  }
  validateCapture(capture, { d16ToolPolicy: true })
  validateStructuralProjection(
    repoRoot,
    input.structuralEvidence?.agentRollout,
    rollout,
    'persisted',
  )
  validateStructuralProjection(
    repoRoot,
    input.structuralEvidence?.cliEvents,
    exec,
    'exec',
  )
  const identity = input.identityAndIsolation
  const session = capture.persisted.find(
    (record) => record.type === 'session_meta',
  ).payload
  if (
    !isRecord(identity) ||
    identity.diagnosticIsolationProfile !== PROFILE ||
    identity.agentSessionId !== session.id ||
    identity.agentCliBinaryPath !== CLI_BINARY ||
    identity.agentCliVersion !== CLI_VERSION ||
    identity.agentCliBinarySha256 !== CLI_SHA256 ||
    identity.agentCliTeamIdentifier !== CLI_TEAM_IDENTIFIER ||
    identity.agentCliAuthority !== CLI_AUTHORITY ||
    identity.temporaryWorkspace !== input.preflight.temporaryWorkspace ||
    !sameJson(identity.workspaceRoots, [input.preflight.temporaryWorkspace])
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_SESSION')
  }
  return accept(
    'PASS_DIAGNOSTIC_ISOLATION',
    'sample',
    {
      sampleId: input.sampleId,
      canonicalInputPath: inputPath,
      canonicalInputHash: inputHash,
      agentSessionId: identity.agentSessionId,
      privateRolloutObjectId: input.privateEvidence.rollout.objectId,
      privateCliEventObjectId: input.privateEvidence.cliEvents.objectId,
      agentRolloutSha256: input.privateEvidence.rollout.sha256,
      agentRolloutStructuralEvidencePath:
        input.structuralEvidence.agentRollout.path,
      agentRolloutStructuralEvidenceHash:
        input.structuralEvidence.agentRollout.sha256,
      cliEventStructuralEvidencePath:
        input.structuralEvidence.cliEvents.path,
      cliEventStructuralEvidenceHash:
        input.structuralEvidence.cliEvents.sha256,
      agentModel: identity.agentModel,
      agentReasoningEffort: identity.agentReasoningEffort,
      agentCliBinaryPath: identity.agentCliBinaryPath,
      agentCliVersion: identity.agentCliVersion,
      agentCliBinarySha256: identity.agentCliBinarySha256,
      agentCliTeamIdentifier: identity.agentCliTeamIdentifier,
      agentCliAuthority: identity.agentCliAuthority,
      rolloutCommitment: input.privateEvidence.rollout.sha256,
      temporaryWorkspace: identity.temporaryWorkspace,
      temporaryWorkspaceInitiallyEmpty:
        identity.temporaryWorkspaceInitiallyEmpty,
      workspaceRoots: identity.workspaceRoots,
      firstSessionMetaSummary: identity.firstSessionMetaSummary,
      firstTurnContextSummary: identity.firstTurnContextSummary,
      toolCallPolicyScan: identity.toolCallPolicyScan,
      browserProvider: identity.browserProvider,
      playwrightMcpVersion: identity.playwrightMcpVersion,
      playwrightMcpIntegrity: identity.playwrightMcpIntegrity,
      browserContextId: identity.browserContextId,
      browserPageId: identity.browserPageId,
      isolationPreflightHash: identity.isolationPreflightHash,
      applicationSessionId: identity.applicationSession?.ids?.[0],
      lifecycle: input.lifecycle,
      toolInvocationCount: 0,
    },
  )
}

function validateOperationalAggregate(input, repoRoot) {
  const contract = validateDiagnosticIsolation(input)
  if (!contract.accepted) {
    throwFailure(contract.errorCode)
  }
  const summaries = []
  for (const reference of input.samples) {
    const paths = canonicalSamplePaths(reference.sampleId)
    const inputPair = readSidecarPair(
      resolve(repoRoot, paths.inputPath),
      resolve(repoRoot, paths.inputSidecarPath),
    )
    const verificationPair = readSidecarPair(
      resolve(repoRoot, paths.verificationPath),
      resolve(repoRoot, paths.verificationSidecarPath),
    )
    if (!inputPair || !verificationPair) {
      throwFailure('DIAGNOSTIC_ISOLATION_AGGREGATE_VERIFICATION')
    }
    const sample = JSON.parse(inputPair.bytes)
    const rerun = validateOperationalSample(
      sample,
      repoRoot,
      paths.inputPath,
      inputPair.hash,
    )
    if (
      `${JSON.stringify(rerun, null, 2)}\n` !==
      verificationPair.bytes.toString('utf8')
    ) {
      throwFailure('DIAGNOSTIC_ISOLATION_AGGREGATE_VERIFICATION')
    }
    summaries.push(rerun.summary)
  }
  for (const field of [
    'agentSessionId',
    'rolloutCommitment',
    'temporaryWorkspace',
    'browserContextId',
    'browserPageId',
    'applicationSessionId',
  ]) {
    if (new Set(summaries.map((summary) => summary[field])).size !== 5) {
      throwFailure('DIAGNOSTIC_ISOLATION_AGGREGATE_UNIQUENESS')
    }
  }
  for (let index = 1; index < summaries.length; index += 1) {
    if (
      Date.parse(summaries[index - 1].lifecycle.evidencePushedAtUtc) >=
      Date.parse(summaries[index].lifecycle.startedAtUtc)
    ) {
      throwFailure('DIAGNOSTIC_ISOLATION_AGGREGATE_SERIALIZATION')
    }
  }
  return accept(
    'PASS_DIAGNOSTIC_ISOLATION_AGGREGATE',
    'aggregate',
    {
      sampleIds: SAMPLE_IDS,
      serialExecution: true,
      uniqueAgentSessions: 5,
    },
  )
}

function fsyncDirectory(directory) {
  const descriptor = openSync(directory, fsConstants.O_RDONLY)
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

function unlinkIfPresent(filePath) {
  try {
    unlinkSync(filePath)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

function sidecarBytes(hash, label) {
  return Buffer.from(`${hash}  ${label}\n`)
}

function atomicWritePair(filePath, document, label) {
  const outputPath = resolve(filePath)
  const sidecarPath = `${outputPath}.sha256`
  const outputStats = lstatSync(outputPath, { throwIfNoEntry: false })
  const sidecarStats = lstatSync(sidecarPath, { throwIfNoEntry: false })
  if (Boolean(outputStats) !== Boolean(sidecarStats)) {
    throwFailure('PARTIAL_EVIDENCE_GROUP')
  }
  if (outputStats && sidecarStats) {
    throwFailure('DIAGNOSTIC_ISOLATION_OUTPUT_EXISTS')
  }
  const parent = dirname(outputPath)
  mkdirSync(parent, { recursive: true })
  const nonce = `${process.pid}.${randomUUID()}`
  const temporaryPath = join(parent, `.${basename(outputPath)}.${nonce}.tmp`)
  const temporarySidecarPath = join(
    parent,
    `.${basename(sidecarPath)}.${nonce}.tmp`,
  )
  const bytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`)
  const sidecar = sidecarBytes(sha256(bytes), label)
  let outputDescriptor
  let sidecarDescriptor
  let outputPublished = false
  let sidecarPublished = false
  try {
    outputDescriptor = openSync(
      temporaryPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o600,
    )
    sidecarDescriptor = openSync(
      temporarySidecarPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o600,
    )
    writeFileSync(outputDescriptor, bytes)
    writeFileSync(sidecarDescriptor, sidecar)
    fsyncSync(outputDescriptor)
    fsyncSync(sidecarDescriptor)
    closeSync(outputDescriptor)
    outputDescriptor = undefined
    closeSync(sidecarDescriptor)
    sidecarDescriptor = undefined
    fsyncDirectory(parent)
    linkSync(temporaryPath, outputPath)
    outputPublished = true
    linkSync(temporarySidecarPath, sidecarPath)
    sidecarPublished = true
    fsyncDirectory(parent)
    unlinkSync(temporaryPath)
    unlinkSync(temporarySidecarPath)
    fsyncDirectory(parent)
  } catch (error) {
    if (outputDescriptor !== undefined) closeSync(outputDescriptor)
    if (sidecarDescriptor !== undefined) closeSync(sidecarDescriptor)
    try {
      if (outputPublished) unlinkIfPresent(outputPath)
      if (sidecarPublished) unlinkIfPresent(sidecarPath)
      unlinkIfPresent(temporaryPath)
      unlinkIfPresent(temporarySidecarPath)
      fsyncDirectory(parent)
    } catch {
      throwFailure('PARTIAL_EVIDENCE_GROUP')
    }
    if (error instanceof IsolationFailure) throw error
    throwFailure(
      outputPublished !== sidecarPublished
        ? 'PARTIAL_EVIDENCE_GROUP'
        : error?.code === 'EEXIST'
          ? 'DIAGNOSTIC_ISOLATION_OUTPUT_EXISTS'
          : 'DIAGNOSTIC_ISOLATION_OUTPUT_WRITE',
    )
  }
}

function parseArguments(argv) {
  const allowed = new Set([
    '--fixtures',
    '--fixture-case',
    '--identity-case',
    '--input',
    '--output',
  ])
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index]
    if (!allowed.has(name) || Object.hasOwn(options, name)) {
      throwFailure('DIAGNOSTIC_ISOLATION_CLI')
    }
    if (name === '--fixtures') {
      options[name] = true
      continue
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throwFailure('DIAGNOSTIC_ISOLATION_CLI')
    }
    options[name] = value
    index += 1
  }
  const modes = [
    options['--fixtures'] ? 'fixtures' : null,
    options['--fixture-case'] ? 'fixture-case' : null,
    options['--identity-case'] ? 'identity-case' : null,
    options['--input'] ? 'input' : null,
  ].filter(Boolean)
  if (modes.length !== 1) throwFailure('DIAGNOSTIC_ISOLATION_CLI')
  if (
    modes[0] === 'fixtures' &&
    Object.keys(options).length !== 1
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_CLI')
  }
  if (
    ['fixture-case', 'identity-case'].includes(modes[0]) &&
    Object.keys(options).some(
      (key) =>
        ![
          modes[0] === 'fixture-case'
            ? '--fixture-case'
            : '--identity-case',
          '--output',
        ].includes(key),
    )
  ) {
    throwFailure('DIAGNOSTIC_ISOLATION_CLI')
  }
  if (modes[0] === 'input' && !options['--output']) {
    throwFailure('DIAGNOSTIC_ISOLATION_CLI')
  }
  return { mode: modes[0], options }
}

function main() {
  const repoRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
  )
  try {
    const { mode, options } = parseArguments(process.argv.slice(2))
    if (mode === 'fixtures') {
      const result = validateMatrixAndGoldens(repoRoot)
      const serialized = `${JSON.stringify(result)}\n`
      ;(result.accepted ? process.stdout : process.stderr).write(serialized)
      process.exitCode = result.accepted ? 0 : 1
      return
    }
    if (mode === 'fixture-case' || mode === 'identity-case') {
      const result =
        mode === 'fixture-case'
          ? executeNegativeCase(repoRoot, options['--fixture-case'])
          : executeIdentityCase(repoRoot, options['--identity-case'])
      process.stderr.write(`${JSON.stringify(result)}\n`)
      process.exitCode = 1
      return
    }
    const inputPath = resolve(options['--input'])
    const outputPath = resolve(options['--output'])
    const outputStats = lstatSync(outputPath, { throwIfNoEntry: false })
    const sidecarStats = lstatSync(`${outputPath}.sha256`, {
      throwIfNoEntry: false,
    })
    if (Boolean(outputStats) !== Boolean(sidecarStats)) {
      throwFailure('PARTIAL_EVIDENCE_GROUP')
    }
    if (outputStats && sidecarStats) {
      throwFailure('DIAGNOSTIC_ISOLATION_OUTPUT_EXISTS')
    }
    const inputStats = lstatSync(inputPath)
    if (!inputStats.isFile() || inputStats.isSymbolicLink()) {
      throwFailure('DIAGNOSTIC_ISOLATION_INPUT_READ')
    }
    if (
      outputPath === inputPath ||
      dirname(outputPath) === dirname(inputPath)
    ) {
      throwFailure('DIAGNOSTIC_ISOLATION_OUTPUT_PATH')
    }
    const inputBytes = readFileSync(inputPath)
    const document = JSON.parse(inputBytes)
    let result
    let outputLabel = relative(repoRoot, outputPath)
    if (document.kind === 'sample') {
      const expected = canonicalSamplePaths(document.sampleId)
      if (
        relative(repoRoot, inputPath) !== expected.inputPath ||
        relative(repoRoot, outputPath) !== expected.verificationPath
      ) {
        throwFailure('DIAGNOSTIC_ISOLATION_INPUT_BINDING')
      }
      const pair = readSidecarPair(
        inputPath,
        resolve(repoRoot, expected.inputSidecarPath),
      )
      if (!pair || !pair.bytes.equals(inputBytes)) {
        throwFailure('DIAGNOSTIC_ISOLATION_INPUT_BINDING')
      }
      result = validateOperationalSample(
        document,
        repoRoot,
        expected.inputPath,
        pair.hash,
      )
      outputLabel = expected.verificationPath
    } else if (document.kind === 'aggregate') {
      result = validateOperationalAggregate(document, repoRoot)
    } else {
      throwFailure('DIAGNOSTIC_ISOLATION_SHAPE')
    }
    atomicWritePair(outputPath, result, outputLabel)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    const expectedFailure = error instanceof IsolationFailure
    const result = reject(
      expectedFailure
        ? error.code
        : 'DIAGNOSTIC_ISOLATION_INTERNAL',
      expectedFailure
        ? {}
        : {
            message: error instanceof Error ? error.message : String(error),
          },
    )
    process.stderr.write(`${JSON.stringify(result)}\n`)
    process.exitCode = 1
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main()
}
