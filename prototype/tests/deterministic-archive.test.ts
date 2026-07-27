// @ts-nocheck -- integration coverage invokes Node CLI scripts.
import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryRoots: string[] = []
const archiveScript = resolve(
  'scripts',
  'create-deterministic-archive.mjs',
)
const verifyArchiveScript = resolve(
  'scripts',
  'verify-deterministic-archive.mjs',
)

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'new-era-archive-'))
  temporaryRoots.push(root)
  return root
}

function runArchive(input: string, output: string) {
  return spawnSync(
    process.execPath,
    [
      archiveScript,
      '--input',
      input,
      '--output',
      output,
      '--source-date-epoch',
      '946684800',
    ],
    { encoding: 'utf8' },
  )
}

function runVerify(input: string, archive: string) {
  return spawnSync(
    process.execPath,
    [
      verifyArchiveScript,
      '--input',
      input,
      '--archive',
      archive,
      '--source-date-epoch',
      '946684800',
    ],
    { encoding: 'utf8' },
  )
}

afterEach(() => {
  temporaryRoots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true })
  })
})

describe('deterministic RC archive CLI', () => {
  it('produces identical ustar bytes regardless of source creation order and mtime', () => {
    const root = temporaryRoot()
    const firstInput = join(root, 'first')
    const secondInput = join(root, 'second')
    const firstArchive = join(root, 'first.tar')
    const secondArchive = join(root, 'second.tar')

    mkdirSync(join(firstInput, 'assets'), { recursive: true })
    writeFileSync(join(firstInput, 'index.html'), '<main>RC9</main>\n')
    writeFileSync(join(firstInput, 'assets', 'app.js'), 'export default 9\n')

    mkdirSync(join(secondInput, 'assets'), { recursive: true })
    writeFileSync(join(secondInput, 'assets', 'app.js'), 'export default 9\n')
    writeFileSync(join(secondInput, 'index.html'), '<main>RC9</main>\n')

    utimesSync(join(firstInput, 'index.html'), 1_000, 1_000)
    utimesSync(join(secondInput, 'index.html'), 2_000, 2_000)

    const first = runArchive(firstInput, firstArchive)
    const second = runArchive(secondInput, secondArchive)

    expect(first.status, first.stderr).toBe(0)
    expect(second.status, second.stderr).toBe(0)
    const firstBytes = readFileSync(firstArchive)
    const secondBytes = readFileSync(secondArchive)
    expect(secondBytes.equals(firstBytes)).toBe(true)
    expect(
      createHash('sha256').update(firstBytes).digest('hex'),
    ).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.parse(first.stdout)).toMatchObject({
      archiveFormat: 'ustar',
      sourceDateEpoch: 946684800,
      entryCount: 3,
    })
  })

  it('verifies the archive entries and frozen ustar metadata against the input', () => {
    const root = temporaryRoot()
    const input = join(root, 'dist')
    const archive = join(root, 'rc-dist.tar')
    mkdirSync(join(input, 'assets'), { recursive: true })
    writeFileSync(join(input, 'index.html'), '<main>RC9</main>\n')
    writeFileSync(join(input, 'assets', 'app.js'), 'export default 9\n')
    expect(runArchive(input, archive).status).toBe(0)

    const verified = runVerify(input, archive)

    expect(verified.status, verified.stderr).toBe(0)
    expect(JSON.parse(verified.stdout)).toMatchObject({
      verified: true,
      archiveFormat: 'ustar',
      sourceDateEpoch: 946684800,
      entryCount: 3,
    })
  })

  it('rejects symbolic links instead of following machine-local targets', () => {
    const root = temporaryRoot()
    const input = join(root, 'dist')
    const archive = join(root, 'rc-dist.tar')
    mkdirSync(input)
    writeFileSync(join(input, 'index.html'), '<main>RC9</main>\n')
    symlinkSync('index.html', join(input, 'linked.html'))

    const result = runArchive(input, archive)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('archive 不允许符号链接')
  })
})
