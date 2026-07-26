import { describe, expect, it, vi } from 'vitest'
import {
  loadRcBuildMetadata,
  parseRcBuildMetadata,
} from '../src/build-metadata'

const VALID_METADATA = {
  buildId: 'g1-rc-20260726.2',
  gitSha: 'A'.repeat(40),
  artifactHash: 'B'.repeat(64),
  artifactHashAlgorithm: 'sha256-canonical-file-manifest-v1',
  artifactManifestPath: 'artifact-manifest.json',
  initialStateHash: 'fnv1a32-33a16fbf',
  initialStateHashAlgorithm: 'fnv1a32-stable-json-v1',
}

describe('independent RC build metadata', () => {
  it('accepts only complete frozen fingerprints and normalizes hashes', () => {
    expect(parseRcBuildMetadata(VALID_METADATA)).toEqual({
      buildId: VALID_METADATA.buildId,
      gitSha: VALID_METADATA.gitSha.toLowerCase(),
      artifactHash: VALID_METADATA.artifactHash.toLowerCase(),
      artifactHashAlgorithm: VALID_METADATA.artifactHashAlgorithm,
      artifactManifestPath: VALID_METADATA.artifactManifestPath,
      initialStateHash: VALID_METADATA.initialStateHash,
      initialStateHashAlgorithm: VALID_METADATA.initialStateHashAlgorithm,
    })
    expect(() =>
      parseRcBuildMetadata({ ...VALID_METADATA, artifactHash: 'UNFROZEN' }),
    ).toThrow('64 位 SHA-256')
  })

  it('loads metadata from the independent no-store resource', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify(VALID_METADATA), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await expect(loadRcBuildMetadata(fetcher)).resolves.toMatchObject({
      buildId: VALID_METADATA.buildId,
    })
    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/rc-build.json' }),
      { cache: 'no-store' },
    )
  })

  it('blocks startup when the independent metadata resource is absent', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 404 }))
    await expect(loadRcBuildMetadata(fetcher)).rejects.toThrow('HTTP 404')
  })
})
