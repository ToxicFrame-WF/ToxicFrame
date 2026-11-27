import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arbiEventFromLine as ev } from '../src/main/arbiParse.ts'

test('arbitration events from real EE.log lines', () => {
  assert.deepEqual(
    ev(
      '35.476 Script [Info]: ThemedSquadOverlay.lua: Cached mission name=Draco (Ceres) - Arbitration (SolNode146)'
    ),
    { t: 35.476, type: 'selected', name: 'Draco (Ceres)', node: 'SolNode146' }
  )
  assert.deepEqual(
    ev('43.866 Sys [Info]: Client loaded {"name":"SolNode146_EliteAlert"} with MissionInfo:'),
    { t: 43.866, type: 'loaded', node: 'SolNode146', role: 'client' }
  )
  assert.equal(ev('43.866 Sys [Info]: Client loaded {"name":"SolNode146"} with MissionInfo:'), null)
  assert.deepEqual(
    ev(
      '43.926 Sys [Info]: SyncAutoPopulatedConsumables for mission MT_SURVIVAL with location SolNode146'
    ),
    { t: 43.926, type: 'mode', mode: 'MT_SURVIVAL' }
  )
  assert.deepEqual(
    ev('307.799 Script [Info]: SurvivalMission.lua: Survival: Gave reward tier 1 at 0'),
    {
      t: 307.799,
      type: 'rotation',
      count: 1
    }
  )
  assert.deepEqual(
    ev(
      '996.972 Net [Info]: Reusing id=4833, previously had AIGrnBurstRifle, new object: CorpusEliteShieldDroneAvatar5987. x'
    ),
    { t: 996.972, type: 'drone', id: '5987' }
  )
  assert.equal(ev('152.507 Script [Info]: EndOfMatch.lua: Mission Succeeded'), null)
  assert.equal(ev('1013.938 Sys [Info]: MISSION_SCORE SolNode146 0x000003BF')?.type, 'ended')
  assert.equal(ev('1029.951 Sys [Info]: ExitState: Loading')?.type, 'loading')
})
