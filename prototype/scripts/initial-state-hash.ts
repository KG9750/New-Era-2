import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import { stableStateHash } from '../src/telemetry/session'

process.stdout.write(stableStateHash(scenario.createInitialState()))
