// @ts-nocheck -- integration coverage invokes the production Node CLI.
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const verifier = resolve('scripts', 'verify-playtest-manifest.mjs')
const canonicalManifest =
  'data/playtests/weekly-management-slice/gate1a/' +
  'g1a-20260727-rc9-01/candidate-manifests/CM01/' +
  'candidate-manifest.json'
const fullOutput =
  'data/playtests/weekly-management-slice/gate1a/' +
  'g1a-20260727-rc9-01/candidates/C04/evidence/' +
  'freeze-audit/full-manifest-verification.json'

function temporaryDirectory(prefix: string) {
  return mkdtempSync(join(tmpdir(), prefix))
}

function run(args: string[], cwd = process.cwd()) {
  return spawnSync(process.execPath, [verifier, ...args], {
    cwd,
    encoding: 'utf8',
  })
}

function parseLine(output: string) {
  return JSON.parse(output.trim().split('\n').at(-1))
}

function git(repo: string, ...args: string[]) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
  })
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}

function createManifestSubstitutionRepo() {
  const repo = temporaryDirectory('new-era-manifest-git-')
  git(repo, 'init', '-q')
  git(repo, 'config', 'user.name', 'Manifest Test')
  git(repo, 'config', 'user.email', 'manifest@example.invalid')
  writeFileSync(join(repo, 'README.md'), 'frozen M without CM01\n')
  git(repo, 'add', 'README.md')
  git(repo, 'commit', '-q', '-m', 'freeze M')
  const manifestPath = join(repo, canonicalManifest)
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(
    manifestPath,
    readFileSync(
      resolve(
        'tests',
        'fixtures',
        'manifests',
        'candidate-c04-synthetic-valid.json',
      ),
    ),
  )
  mkdirSync(dirname(join(repo, fullOutput)), { recursive: true })
  return { repo, manifestGitSha: git(repo, 'rev-parse', 'HEAD') }
}

describe('candidate playtest manifest production CLI', () => {
  it('runs fixtures mode and atomically publishes JSON plus sidecar', () => {
    const root = temporaryDirectory('new-era-manifest-fixtures-')
    const output = join(root, 'fixtures.json')
    const result = run(['--fixtures', '--output', output])

    expect(result.status, result.stderr).toBe(0)
    expect(parseLine(result.stdout)).toMatchObject({
      status: 'PASS_FIXTURES',
      accepted: true,
      fullManifestVerified: false,
    })
    const jsonBytes = readFileSync(output)
    const sidecar = readFileSync(`${output}.sha256`, 'utf8')
    expect(sidecar).toContain(`  ${output}\n`)
    expect(jsonBytes.length).toBeGreaterThan(0)

    const repeated = run(['--fixtures', '--output', output])
    expect(repeated.status).toBe(1)
    expect(parseLine(repeated.stderr).errorCode).toBe(
      'CANDIDATE_MANIFEST_OUTPUT_EXISTS',
    )
  })

  it('runs probe mode against the nine real authority files', () => {
    const root = temporaryDirectory('new-era-manifest-probe-')
    const output = join(root, 'probe.json')
    const result = run([
      '--probe',
      resolve(
        'tests',
        'fixtures',
        'manifests',
        'candidate-c04-authority-probe.json',
      ),
      '--repo-root',
      '..',
      '--output',
      output,
    ])

    expect(result.status, result.stderr).toBe(0)
    expect(parseLine(result.stdout)).toMatchObject({
      status: 'PASS_AUTHORITY_PREFLIGHT',
      accepted: true,
      fullManifestVerified: false,
      authorityProfile: 'rc9-v03',
      scenarioVersion: '0.5.1',
      protocolVersion: 'weekly-management-slice-playtest-v0.3',
    })
    expect(readFileSync(`${output}.sha256`, 'utf8')).toContain(
      `  ${output}\n`,
    )
  })

  it('has no hidden two-argument fixture bypass', () => {
    const result = run([
      '--manifest',
      resolve(
        'tests',
        'fixtures',
        'manifests',
        'candidate-valid.json',
      ),
    ])

    expect(result.status).toBe(1)
    expect(parseLine(result.stderr).errorCode).toBe(
      'CANDIDATE_MANIFEST_MODE',
    )
  })

  it('requires M and rejects a worktree CM01 absent from M', () => {
    const { repo, manifestGitSha } = createManifestSubstitutionRepo()
    const result = run([
      '--manifest',
      canonicalManifest,
      '--manifest-git-sha',
      manifestGitSha,
      '--repo-root',
      repo,
      '--output',
      fullOutput,
    ])

    expect(result.status).toBe(1)
    expect(parseLine(result.stderr)).toMatchObject({
      status: 'FAIL',
      fullManifestVerified: false,
      errorCode: 'CANDIDATE_MANIFEST_GIT_BINDING',
    })
  })

  it('fails closed on a partial output group', () => {
    const root = temporaryDirectory('new-era-manifest-partial-')
    const output = join(root, 'fixtures.json')
    writeFileSync(output, 'sentinel\n')

    const result = run(['--fixtures', '--output', output])
    expect(result.status).toBe(1)
    expect(parseLine(result.stderr).errorCode).toBe(
      'PARTIAL_EVIDENCE_GROUP',
    )
    expect(readFileSync(output, 'utf8')).toBe('sentinel\n')
  })

  it('rejects an output symlink without following or replacing it', () => {
    const root = temporaryDirectory('new-era-manifest-symlink-')
    const target = join(root, 'target.json')
    const output = join(root, 'fixtures.json')
    writeFileSync(target, 'sentinel\n')
    symlinkSync(target, output)

    const result = run(['--fixtures', '--output', output])
    expect(result.status).toBe(1)
    expect(parseLine(result.stderr).errorCode).toBe(
      'PARTIAL_EVIDENCE_GROUP',
    )
    expect(readFileSync(target, 'utf8')).toBe('sentinel\n')
  })
})
