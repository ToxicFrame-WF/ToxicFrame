// EE.log lines that drive the in-game overlays (seen in a real fissure run, Nov 2026).
export type GameEvent =
  | { type: 'relicPicker' } // the Void Relics screen finished loading
  | { type: 'rewards' } // the fissure reward cards are on screen
  | { type: 'rewardsClosed' }
  | { type: 'loading' } // a loading screen finished: any open overlay is stale
  | { type: 'ownReward'; item: string } // "/Lotus/StoreItems/Types/...CitrinePrimeSystemsBlueprint"

export function gameEventFromLine(line: string): GameEvent | null {
  if (/ThemedProjectionManager\.lua: LoadingComplete\s*$/.test(line)) return { type: 'relicPicker' }
  if (line.includes('ProjectionRewardChoice.lua: Got rewards')) return { type: 'rewards' }
  if (line.includes('ProjectionRewardChoice.lua: Relic reward screen shut down'))
    return { type: 'rewardsClosed' }
  if (line.includes('ExitState: Loading')) return { type: 'loading' }
  // only the local player's reward is logged with its item
  const m = /VoidProjections: \S+ gets reward (\S+)/.exec(line)
  return m ? { type: 'ownReward', item: m[1] } : null
}
