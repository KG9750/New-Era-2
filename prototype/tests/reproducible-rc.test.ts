// @ts-nocheck -- integration coverage invokes Node CLI scripts.
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryRoots: string[] = []
const reproducibilityScript = resolve(
  'scripts',
  'verify-reproducible-rc.mjs',
)

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'new-era-repro-'))
  temporaryRoots.push(root)
  return root
}

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')}\n${result.stderr}`)
  }
  return result.stdout.trim()
}

function createSourceRepository(nondeterministic = false) {
  const root = temporaryRoot()
  const prototype = join(root, 'prototype')
  const scripts = join(prototype, 'scripts')
  mkdirSync(scripts, { recursive: true })
  writeFileSync(
    join(prototype, 'package.json'),
    `${JSON.stringify(
      {
        name: 'rc-repro-fixture',
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {
          'rc:build': 'node scripts/build.mjs',
          'rc:verify': 'node scripts/verify.mjs',
          'rc:archive': 'node scripts/archive.mjs',
          'rc:verify-archive': 'node scripts/verify-archive.mjs',
        },
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(
    join(prototype, 'package-lock.json'),
    `${JSON.stringify(
      {
        name: 'rc-repro-fixture',
        version: '1.0.0',
        lockfileVersion: 3,
        requires: true,
        packages: {
          '': {
            name: 'rc-repro-fixture',
            version: '1.0.0',
          },
        },
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(
    join(scripts, 'build.mjs'),
    [
      "import { mkdirSync, writeFileSync } from 'node:fs'",
      "import { join } from 'node:path'",
      "mkdirSync('dist', { recursive: true })",
      "const gitSha = process.argv[process.argv.indexOf('--git-sha') + 1]",
      "const buildId = process.argv[process.argv.indexOf('--build-id') + 1]",
      `writeFileSync(join('dist', 'artifact-manifest.json'), JSON.stringify({ files: [{ path: 'index.html', sha256: 'a'.repeat(64) }]${nondeterministic ? ', buildPath: process.cwd()' : ''} }) + '\\n')`,
      "writeFileSync(join('dist', 'rc-build.json'), JSON.stringify({ buildId, gitSha }) + '\\n')",
      "writeFileSync(join('dist', 'index.html'), '<main>fixture</main>\\n')",
    ].join('\n'),
  )
  writeFileSync(join(scripts, 'verify.mjs'), "process.stdout.write('ok\\n')\n")
  writeFileSync(
    join(scripts, 'archive.mjs'),
    [
      "import { readFileSync, writeFileSync } from 'node:fs'",
      "import { join } from 'node:path'",
      "const output = process.argv[process.argv.indexOf('--output') + 1]",
      "writeFileSync(output, readFileSync(join('dist', 'artifact-manifest.json')))",
    ].join('\n'),
  )
  writeFileSync(
    join(scripts, 'verify-archive.mjs'),
    "process.stdout.write('ok\\n')\n",
  )
  run('git', ['init', '-q'], root)
  run('git', ['add', '.'], root)
  run(
    'git',
    [
      '-c',
      'user.name=RC Repro Test',
      '-c',
      'user.email=rc-repro@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ],
    root,
  )
  return {
    root,
    sha: run('git', ['rev-parse', 'HEAD'], root),
  }
}

afterEach(() => {
  temporaryRoots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true })
  })
})

describe('RC clean-clone reproducibility CLI', () => {
  it('builds two detached clean clones and compares manifests and archives byte-for-byte', () => {
    const source = createSourceRepository()
    const result = spawnSync(
      process.execPath,
      [
        reproducibilityScript,
        '--source-repository',
        source.root,
        '--git-sha',
        source.sha,
        '--build-id',
        'g1-rc-repro.1',
        '--source-date-epoch',
        '946684800',
      ],
      { encoding: 'utf8' },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      reproducible: true,
      gitSha: source.sha,
      buildId: 'g1-rc-repro.1',
      sourceDateEpoch: 946684800,
      cloneCount: 2,
    })
  })

  it('fails when either clean clone leaks its build path into the artifact', () => {
    const source = createSourceRepository(true)
    const result = spawnSync(
      process.execPath,
      [
        reproducibilityScript,
        '--source-repository',
        source.root,
        '--git-sha',
        source.sha,
        '--build-id',
        'g1-rc-repro.2',
        '--source-date-epoch',
        '946684800',
      ],
      { encoding: 'utf8' },
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      '双 clean clone 的 artifact manifest 字节不一致',
    )
  })
})
