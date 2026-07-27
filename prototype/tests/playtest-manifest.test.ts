// @ts-nocheck -- integration coverage invokes Node CLI scripts.
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const verifier = resolve('scripts', 'verify-playtest-manifest.mjs')

function verifyFixture(fileName: string) {
  return spawnSync(
    process.execPath,
    [
      verifier,
      '--manifest',
      resolve('tests', 'fixtures', 'manifests', fileName),
    ],
    { encoding: 'utf8' },
  )
}

describe('candidate playtest manifest CLI', () => {
  it('accepts the frozen first candidate manifest contract', () => {
    const result = verifyFixture('candidate-valid.json')

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      accepted: true,
      candidateManifestId: 'CM01',
      candidateAttempt: 'C01',
      errorCode: null,
    })
  })

  it('rejects a candidate that omits the frozen authority set', () => {
    const result = verifyFixture(
      'candidate-invalid-incomplete-authority.json',
    )

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      accepted: false,
      errorCode: 'CANDIDATE_MANIFEST_AUTHORITY',
    })
  })

  it('rejects rewrapping the current candidate attempt under a later manifest id', () => {
    const result = verifyFixture(
      'candidate-c01-rewrapped-by-cm02-rejected.json',
    )

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      accepted: false,
      errorCode: 'CANDIDATE_MANIFEST_HISTORY',
    })
  })

  it('rejects diagnostic evidence carried over from another candidate attempt', () => {
    const result = verifyFixture(
      'candidate-c02-reuses-c01-evidence-rejected.json',
    )

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      accepted: false,
      errorCode: 'CANDIDATE_MANIFEST_EVIDENCE',
    })
  })

  it.each([
    [
      'candidate-invalid-source-sha.json',
      1,
      false,
      'CANDIDATE_MANIFEST_SHAPE',
    ],
    [
      'candidate-zero-id-rejected.json',
      1,
      false,
      'CANDIDATE_MANIFEST_SHAPE',
    ],
    ['candidate-c02-first-manifest-valid.json', 0, true, null],
    ['candidate-c02-second-manifest-valid.json', 0, true, null],
  ] as const)(
    'matches the frozen oracle for %s',
    (fileName, status, accepted, errorCode) => {
      const result = verifyFixture(fileName)

      expect(result.status).toBe(status)
      expect(JSON.parse(result.stdout)).toMatchObject({
        accepted,
        errorCode,
      })
    },
  )
})
