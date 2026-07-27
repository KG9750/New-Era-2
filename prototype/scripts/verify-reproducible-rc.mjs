import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const BUILD_ID_PATTERN = /^g1-(?:rc|e2e)-[a-z0-9.-]+$/i
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i
const MAX_SOURCE_DATE_EPOCH = 8_589_934_591

function argument(name) {
  const index = process.argv.lastIndexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function fail(message) {
  throw new Error(message)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: options.env ?? process.env,
    cwd: options.cwd,
  })
  if (result.error) {
    fail(`无法启动 ${command}：${result.error.message}`)
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim()
    fail(
      `${command} ${args.join(' ')} 失败（exit ${result.status}）${
        output ? `\n${output}` : ''
      }`,
    )
  }
  return result.stdout.trim()
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function sameBytes(left, right, label) {
  if (!left.equals(right)) fail(`双 clean clone 的 ${label} 字节不一致`)
}

const gitSha = argument('--git-sha')?.toLowerCase()
const buildId = argument('--build-id')
const epochArgument =
  argument('--source-date-epoch') ?? process.env.SOURCE_DATE_EPOCH
const defaultRepository = resolve(import.meta.dirname, '..', '..')
const sourceRepositoryArgument =
  argument('--source-repository') ?? defaultRepository

if (
  !gitSha ||
  !buildId ||
  epochArgument === undefined ||
  !GIT_SHA_PATTERN.test(gitSha) ||
  !BUILD_ID_PATTERN.test(buildId)
) {
  process.stderr.write(
    '用法：node scripts/verify-reproducible-rc.mjs --git-sha <40位SHA> --build-id <g1-rc-...> --source-date-epoch <epoch>\n',
  )
  process.exit(1)
}

const sourceDateEpoch = Number(epochArgument)
if (
  !Number.isSafeInteger(sourceDateEpoch) ||
  sourceDateEpoch < 0 ||
  sourceDateEpoch > MAX_SOURCE_DATE_EPOCH
) {
  process.stderr.write(`SOURCE_DATE_EPOCH 无效：${epochArgument}\n`)
  process.exit(1)
}

let temporaryRoot
try {
  const sourceRepository = run(
    'git',
    [
      '-C',
      resolve(sourceRepositoryArgument),
      'rev-parse',
      '--show-toplevel',
    ],
  )
  run('git', [
    '-C',
    sourceRepository,
    'cat-file',
    '-e',
    `${gitSha}^{commit}`,
  ])

  temporaryRoot = mkdtempSync(join(tmpdir(), 'new-era-rc-repro-'))
  const deterministicEnvironment = {
    ...process.env,
    LANG: 'C',
    LC_ALL: 'C',
    SOURCE_DATE_EPOCH: String(sourceDateEpoch),
    TZ: 'UTC',
  }

  const outputs = ['A', 'B'].map((cloneId) => {
    const cloneRoot = join(temporaryRoot, `clone-${cloneId}`)
    run(
      'git',
      ['clone', '--quiet', '--no-hardlinks', sourceRepository, cloneRoot],
      { env: deterministicEnvironment },
    )
    run('git', ['checkout', '--quiet', '--detach', gitSha], {
      cwd: cloneRoot,
      env: deterministicEnvironment,
    })
    const checkedOutSha = run('git', ['rev-parse', 'HEAD'], {
      cwd: cloneRoot,
      env: deterministicEnvironment,
    })
    if (checkedOutSha !== gitSha) {
      fail(`clean clone ${cloneId} 未检出指定 source SHA`)
    }
    const initialStatus = run('git', ['status', '--porcelain'], {
      cwd: cloneRoot,
      env: deterministicEnvironment,
    })
    if (initialStatus) fail(`clean clone ${cloneId} 初始工作树不干净`)

    const prototypeRoot = join(cloneRoot, 'prototype')
    run('npm', ['ci', '--no-audit', '--no-fund'], {
      cwd: prototypeRoot,
      env: deterministicEnvironment,
    })
    run(
      'npm',
      [
        'run',
        'rc:build',
        '--',
        '--build-id',
        buildId,
        '--git-sha',
        gitSha,
      ],
      {
        cwd: prototypeRoot,
        env: deterministicEnvironment,
      },
    )
    run('npm', ['run', 'rc:verify'], {
      cwd: prototypeRoot,
      env: deterministicEnvironment,
    })

    const archivePath = join(cloneRoot, 'rc-dist.tar')
    run(
      'npm',
      [
        'run',
        'rc:archive',
        '--',
        '--input',
        'dist',
        '--output',
        archivePath,
        '--source-date-epoch',
        String(sourceDateEpoch),
      ],
      {
        cwd: prototypeRoot,
        env: deterministicEnvironment,
      },
    )
    run(
      'npm',
      [
        'run',
        'rc:verify-archive',
        '--',
        '--input',
        'dist',
        '--archive',
        archivePath,
        '--source-date-epoch',
        String(sourceDateEpoch),
      ],
      {
        cwd: prototypeRoot,
        env: deterministicEnvironment,
      },
    )

    return {
      archive: readFileSync(archivePath),
      manifest: readFileSync(
        join(prototypeRoot, 'dist', 'artifact-manifest.json'),
      ),
      metadata: readFileSync(join(prototypeRoot, 'dist', 'rc-build.json')),
    }
  })

  sameBytes(outputs[0].manifest, outputs[1].manifest, 'artifact manifest')
  sameBytes(outputs[0].metadata, outputs[1].metadata, 'RC build metadata')
  sameBytes(outputs[0].archive, outputs[1].archive, 'UTC archive')

  process.stdout.write(
    `${JSON.stringify({
      reproducible: true,
      gitSha,
      buildId,
      sourceDateEpoch,
      cloneCount: outputs.length,
      artifactManifestHash: sha256(outputs[0].manifest),
      rcBuildMetadataHash: sha256(outputs[0].metadata),
      archiveHash: sha256(outputs[0].archive),
    })}\n`,
  )
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 1
} finally {
  if (temporaryRoot) {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
}
