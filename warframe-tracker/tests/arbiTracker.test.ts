import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { registerHooks } from 'module'

const dir = mkdtempSync(join(tmpdir(), 'arbi-'))
mock.module('electron', {
  namedExports: {
    app: { getPath: () => dir },
    BrowserWindow: { getAllWindows: () => [] }
  }
})
// src/main imports siblings without '.ts', which plain node cannot resolve
registerHooks({
  resolve: (spec, ctx, next) => {
    try {
      return next(spec, ctx)
    } catch (e) {
      if (spec.startsWith('.')) return next(spec + '.ts', ctx)
      throw e
    }
  }
})
const { arbiLine, getArbiRuns, getArbiState } = await import('../src/main/arbiTracker.ts')

const run = (lines: string[]): void => lines.forEach(arbiLine)
const RUN = [
  '35.476 Script [Info]: ThemedSquadOverlay.lua: Cached mission name=Draco (Ceres) - Arbitration (SolNode146)',
  '43.866 Sys [Info]: Client loaded {"name":"SolNode146_EliteAlert"} with MissionInfo:',
  '43.926 Sys [Info]: SyncAutoPopulatedConsumables for mission MT_SURVIVAL with location SolNode146',
  '50.000 Sys [Info]: CorpusEliteShieldDroneAvatar12 spawned',
  '51.000 Sys [Info]: CorpusEliteShieldDroneAvatar12 died',
  '52.000 Sys [Info]: CorpusEliteShieldDroneAvatar13 spawned',
  '400.000 Script [Info]: SurvivalMission.lua: Survival: Gave reward tier 1 at 300',
  '700.000 Sys [Info]: MISSION_SCORE SolNode146 1',
  '720.000 Sys [Info]: ExitState: Loading'
]

test('a full run is saved once with drones counted by id', () => {
  run(RUN)
  const [r, ...rest] = getArbiRuns()
  assert.equal(rest.length, 0) // the loading screen after the end does not save a second run
  assert.equal(r.name, 'Draco (Ceres)')
  assert.equal(r.mode, 'MT_SURVIVAL')
  assert.equal(r.drones, 2)
  assert.equal(r.rotations, 1)
  assert.equal(r.completed, true)
  assert.equal(r.durationSec, 656)
  assert.equal(r.vitus, 1.12)
  assert.equal(getArbiState().phase, 'done')
})

test('a new load mid-run saves the old run as unfinished', () => {
  run(RUN.slice(0, 3))
  run(RUN.slice(1, 2))
  assert.equal(getArbiRuns()[0].completed, false)
  assert.equal(getArbiState().phase, 'recording')
})

test('a broken runs file is never overwritten', () => {
  const f = join(dir, 'arbiRuns.json')
  writeFileSync(f, '{broken')
  run(RUN.slice(7))
  assert.equal(readFileSync(f, 'utf8'), '{broken')
})
