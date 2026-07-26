export const RC_BUILD_METADATA_PATH = 'rc-build.json'
export const RC_ARTIFACT_MANIFEST_PATH = 'artifact-manifest.json'

export interface RcBuildMetadata {
  buildId: string
  gitSha: string
  artifactHash: string
  artifactHashAlgorithm: 'sha256-canonical-file-manifest-v1'
  artifactManifestPath: typeof RC_ARTIFACT_MANIFEST_PATH
  initialStateHash: string
  initialStateHashAlgorithm: 'fnv1a32-stable-json-v1'
}

const BUILD_ID_PATTERN = /^g1-(?:rc|e2e)-[a-z0-9.-]+$/i
const SHA_PATTERN = /^[a-f0-9]{40}$/i
const ARTIFACT_HASH_PATTERN = /^[a-f0-9]{64}$/i
const INITIAL_STATE_HASH_PATTERN = /^fnv1a32-[a-f0-9]{8}$/i

export function parseRcBuildMetadata(value: unknown): RcBuildMetadata {
  if (!value || typeof value !== 'object') {
    throw new Error('RC 构建元数据不是对象')
  }
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.buildId !== 'string' ||
    !BUILD_ID_PATTERN.test(candidate.buildId)
  ) {
    throw new Error('RC 构建编号无效')
  }
  if (
    typeof candidate.gitSha !== 'string' ||
    !SHA_PATTERN.test(candidate.gitSha)
  ) {
    throw new Error('RC Git SHA 必须是完整的 40 位十六进制值')
  }
  if (
    typeof candidate.artifactHash !== 'string' ||
    !ARTIFACT_HASH_PATTERN.test(candidate.artifactHash)
  ) {
    throw new Error('RC artifactHash 必须是 64 位 SHA-256')
  }
  if (candidate.artifactHashAlgorithm !== 'sha256-canonical-file-manifest-v1') {
    throw new Error('RC artifactHash 算法不受支持')
  }
  if (candidate.artifactManifestPath !== RC_ARTIFACT_MANIFEST_PATH) {
    throw new Error('RC artifact manifest 路径不受支持')
  }
  if (
    typeof candidate.initialStateHash !== 'string' ||
    !INITIAL_STATE_HASH_PATTERN.test(candidate.initialStateHash)
  ) {
    throw new Error('RC initialStateHash 无效')
  }
  if (candidate.initialStateHashAlgorithm !== 'fnv1a32-stable-json-v1') {
    throw new Error('RC initialStateHash 算法不受支持')
  }
  return {
    buildId: candidate.buildId,
    gitSha: candidate.gitSha.toLowerCase(),
    artifactHash: candidate.artifactHash.toLowerCase(),
    artifactHashAlgorithm: candidate.artifactHashAlgorithm,
    artifactManifestPath: candidate.artifactManifestPath,
    initialStateHash: candidate.initialStateHash.toLowerCase(),
    initialStateHashAlgorithm: candidate.initialStateHashAlgorithm,
  }
}

export async function loadRcBuildMetadata(
  fetcher: typeof fetch = fetch,
): Promise<RcBuildMetadata> {
  const response = await fetcher(
    new URL(RC_BUILD_METADATA_PATH, document.baseURI),
    { cache: 'no-store' },
  )
  if (!response.ok) {
    throw new Error(`无法读取 RC 构建元数据（HTTP ${response.status}）`)
  }
  return parseRcBuildMetadata(await response.json())
}
