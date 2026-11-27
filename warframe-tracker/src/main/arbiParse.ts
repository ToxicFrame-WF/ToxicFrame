// EE.log lines that describe an Arbitration run (verified in a real client run, Nov 2026, unless
// marked "assumed"). Every event carries the log's own seconds-since-game-start so timing is exact.
export type ArbiEvent = { t: number } & (
  | { type: 'selected'; node: string; name: string } // "Draco (Ceres)"
  | { type: 'loaded'; node: string; role: 'client' | 'host' }
  | { type: 'mode'; mode: string } // MT_SURVIVAL
  | { type: 'rotation'; count: number } // rotations completed (Survival)
  | { type: 'drone'; id: string }
  | { type: 'ended' } // MISSION_SCORE: the mission result was posted
  | { type: 'loading' } // a loading screen finished: the run is over, however it ended
)

const LINE = /^(\d+\.\d+) \S+ \[\w+\]: (.*)/

export function arbiEventFromLine(line: string): ArbiEvent | null {
  const m = LINE.exec(line)
  if (!m) return null
  const t = Number(m[1])
  const s = m[2]
  let x: RegExpExecArray | null
  if (
    (x = /ThemedSquadOverlay\.lua: Cached mission name=(.+) - Arbitration \((SolNode\d+)\)/.exec(s))
  )
    return { t, type: 'selected', name: x[1], node: x[2] }
  // "Client loaded" is verified; "Host loaded" is assumed (no host log seen yet)
  if ((x = /^(Client|Host) loaded \{"name":"(SolNode\d+)_EliteAlert"\}/.exec(s)))
    return { t, type: 'loaded', node: x[2], role: x[1] === 'Host' ? 'host' : 'client' }
  if ((x = /^SyncAutoPopulatedConsumables for mission (MT_\w+)/.exec(s)))
    return { t, type: 'mode', mode: x[1] }
  if ((x = /SurvivalMission\.lua: Survival: Gave reward tier (\d+) at/.exec(s)))
    return { t, type: 'rotation', count: Number(x[1]) }
  // drones show up in any line that names one (client logs only see reused network ids)
  if ((x = /CorpusEliteShieldDroneAvatar(\d+)/.exec(s))) return { t, type: 'drone', id: x[1] }
  // not "EndOfMatch.lua: Mission Succeeded": that fires a dozen times mid-run
  if (/^MISSION_SCORE SolNode\d+/.test(s)) return { t, type: 'ended' }
  if (s.includes('ExitState: Loading')) return { t, type: 'loading' }
  return null
}
