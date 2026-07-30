import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateCharacterLibrary } from '../src/characters/generator'
import {
  createCharacterSampleLibrary,
  validateCharacterSampleLibrary,
} from '../src/characters/sample-library'
import {
  renderInternalCharacterSampleLibrary,
  renderPlayerCharacterSampleCards,
} from '../src/characters/sample-renderer'

const WORLD_SEED =
  '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1'
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(
  scriptDirectory,
  '../../data/characters/sample-12-v0.1-draft.json',
)
const rosterPath = resolve(
  scriptDirectory,
  '../../data/characters/character-samples-12-v0.1-draft.md',
)
const playerCardsPath = resolve(
  scriptDirectory,
  '../../data/characters/character-samples-12-v0.1-player-cards.md',
)

const sourceLibrary = generateCharacterLibrary({
  worldSeedHex: WORLD_SEED,
  count: 50,
})
const sampleLibrary = createCharacterSampleLibrary(sourceLibrary)
const findings = validateCharacterSampleLibrary(sampleLibrary, sourceLibrary)
if (findings.some((finding) => finding.result === 'blocked')) {
  throw new Error(
    `Sample library validation failed: ${JSON.stringify(findings)}`,
  )
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(
  outputPath,
  `${JSON.stringify(sampleLibrary, null, 2)}\n`,
  'utf8',
)
await writeFile(
  rosterPath,
  renderInternalCharacterSampleLibrary(sampleLibrary),
  'utf8',
)
await writeFile(
  playerCardsPath,
  renderPlayerCharacterSampleCards(sampleLibrary),
  'utf8',
)

process.stdout.write(
  `${JSON.stringify({
    outputPath,
    rosterPath,
    playerCardsPath,
    sampleLibraryId: sampleLibrary.sample_library_id,
    sourceLibraryId: sampleLibrary.source_library_id,
    samples: sampleLibrary.samples.length,
    machineStructurePassed:
      sampleLibrary.validation.machine_structure_passed,
    findings,
    manualReviews: sampleLibrary.validation.manual_reviews,
  })}\n`,
)
