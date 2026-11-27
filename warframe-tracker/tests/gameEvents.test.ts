import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameEventFromLine } from '../src/main/gameEvents.ts'

test('overlay events from real EE.log lines', () => {
  const ev = (l: string): string | undefined => gameEventFromLine(l)?.type
  assert.equal(
    ev('49.007 Script [Info]: ThemedProjectionManager.lua: LoadingComplete'),
    'relicPicker'
  )
  assert.equal(
    ev('49.325 Script [Info]: ThemedProjectionManager.lua: LoadingCompleteEnd'),
    undefined
  )
  assert.equal(ev('534.254 Script [Info]: ProjectionRewardChoice.lua: Got rewards'), 'rewards')
  assert.equal(
    ev('549.253 Script [Info]: ProjectionRewardChoice.lua: Relic reward screen shut down'),
    'rewardsClosed'
  )
  assert.equal(
    ev('533.771 Script [Info]: ProjectionRewardChoice.lua: Relic rewards initialized'),
    undefined
  )
  assert.deepEqual(
    gameEventFromLine(
      '534.126 Sys [Info]: VoidProjections: 5ee5f48658c74d319b19f8d1 gets reward /Lotus/StoreItems/Types/Recipes/WarframeRecipes/CitrinePrimeSystemsBlueprint'
    ),
    {
      type: 'ownReward',
      item: '/Lotus/StoreItems/Types/Recipes/WarframeRecipes/CitrinePrimeSystemsBlueprint'
    }
  )
})
