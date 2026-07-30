// @ts-nocheck -- integration coverage invokes Node CLI scripts.
import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
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

function runArchiveAsync(input: string, output: string) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolveResult) => {
      const child = spawn(process.execPath, [
        archiveScript,
        '--input',
        input,
        '--output',
        output,
        '--source-date-epoch',
        '946684800',
      ])
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk) => {
        stdout += chunk
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk
      })
      child.on('close', (status) => {
        resolveResult({ status, stdout, stderr })
      })
    },
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
  it('rejects an existing output before changing its sentinel bytes', () => {
    const root = temporaryRoot()
    const input = join(root, 'dist')
    const archive = join(root, 'rc-dist.tar')
    const sentinel = Buffer.from('do-not-overwrite\n')
    mkdirSync(input)
    writeFileSync(join(input, 'index.html'), '<main>RC9</main>\n')
    writeFileSync(archive, sentinel)
    const sentinelHash = createHash('sha256').update(sentinel).digest('hex')

    const result = runArchive(input, archive)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('RC_ARCHIVE_OUTPUT_EXISTS')
    const after = readFileSync(archive)
    expect(after.equals(sentinel)).toBe(true)
    expect(createHash('sha256').update(after).digest('hex')).toBe(sentinelHash)
    expect(readdirSync(root).sort()).toEqual(['dist', 'rc-dist.tar'])
  })

  it('allows one concurrent publisher and rejects repeats without leaving temporary files', async () => {
    const root = temporaryRoot()
    const input = join(root, 'dist')
    const archive = join(root, 'rc-dist.tar')
    mkdirSync(input)
    writeFileSync(join(input, 'payload.bin'), Buffer.alloc(8 * 1024 * 1024, 0x5a))

    const results = await Promise.all([
      runArchiveAsync(input, archive),
      runArchiveAsync(input, archive),
    ])

    expect(results.map(({ status }) => status).sort()).toEqual([0, 1])
    const rejected = results.find(({ status }) => status === 1)
    expect(rejected?.stderr).toContain('RC_ARCHIVE_OUTPUT_EXISTS')
    const published = readFileSync(archive)
    const publishedHash = createHash('sha256').update(published).digest('hex')

    const repeated = runArchive(input, archive)

    expect(repeated.status).toBe(1)
    expect(repeated.stderr).toContain('RC_ARCHIVE_OUTPUT_EXISTS')
    const afterRepeat = readFileSync(archive)
    expect(afterRepeat.equals(published)).toBe(true)
    expect(createHash('sha256').update(afterRepeat).digest('hex')).toBe(
      publishedHash,
    )
    expect(runVerify(input, archive).status).toBe(0)
    expect(readdirSync(root).sort()).toEqual(['dist', 'rc-dist.tar'])
  })

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
    expect(createHash('sha256').update(firstBytes).digest('hex')).toBe(
      '0fa5657ee33f093a444ac32c170291e31f7a95660aabe30a00b70077aa8ad1e2',
    )
    expect(JSON.parse(first.stdout)).toMatchObject({
      archiveFormat: 'ustar',
      archiveHash:
        '0fa5657ee33f093a444ac32c170291e31f7a95660aabe30a00b70077aa8ad1e2',
      bytes: 3584,
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
