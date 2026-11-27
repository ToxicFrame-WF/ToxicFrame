import { useEffect, useState } from 'react'
import NcCard from './NcCard'
import { useNow } from '../hooks/useWorldState'
import type { ArbiState } from '../../../preload/index.d'
import { modeLabel, mmss } from '../arbiFormat'

const ROTATION_SEC = 300 // Survival rotation length (same as main/arbiTracker)

function Tile({
  label,
  value,
  sub
}: {
  label: string
  value: string
  sub?: string
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</h3>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-300">{sub}</div>}
    </div>
  )
}

// Arbitrations > Live: live figures while a run is on, then that run's summary until the next.
export default function ArbiLive(): React.JSX.Element {
  const [st, setSt] = useState<ArbiState>({ phase: 'idle', run: null })
  const now = useNow(250)
  useEffect(() => {
    void window.api.getArbiState().then(setSt)
    return window.api.onArbiState(setSt)
  }, [])

  const run = st.run
  const done = st.phase === 'done'
  const sec = run ? (done ? run.durationSec : Math.max(0, (now - run.startedAt) / 1000)) : 0
  const per = run && sec > 30 ? ((run.drones / sec) * 60).toFixed(1) : '-'
  const next =
    run?.mode === 'MT_SURVIVAL' && !done
      ? // from the newest rotation, not the start: real rotations run ~20 s long each (307, 628, 950 s)
        ROTATION_SEC - (now - (run.lastRotationAt ?? run.startedAt)) / 1000
      : null

  return (
    <div className="p-5 text-slate-100">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Arbitrations</h1>
      </div>
      <NcCard title={done ? 'Last run' : 'Live Arbitration'} accent={done ? '#34d399' : undefined}>
        <div className="space-y-3 p-4">
          {!run ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center">
              <h3 className="text-lg font-bold">Waiting for an Arbitration</h3>
              <p className="mt-2 text-sm text-slate-300">
                This tab fills in when you load into one. It reads the game log, nothing else.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold">Arbitration · {modeLabel(run.mode)}</div>
                  <p className="text-sm text-slate-300">{run.name}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    done
                      ? run.completed
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {done ? (run.completed ? 'Completed' : 'Left early') : '● Recording'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Tile label="Mission time" value={mmss(sec)} />
                <Tile
                  label="Rotations"
                  value={run.rotations === null ? 'Unknown' : String(run.rotations)}
                  sub={next !== null ? `Next in ${mmss(Math.max(0, next))}` : undefined}
                />
                <Tile
                  label="Drones seen"
                  value={String(run.drones)}
                  sub={per === '-' ? undefined : `${per} per minute`}
                />
                <Tile
                  label={run.role === 'client' ? 'Vitus Essence (partial)' : 'Expected Vitus'}
                  value={`~${(done ? run.vitus : estimate(run)).toFixed(1)}`}
                  sub="1 per rotation + 6% per drone"
                />
              </div>

              {run.role === 'client' && (
                <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  You joined as a client: drone counts need you to host or play solo. Only a few
                  drones show up in a client log, so these figures are partial.
                </p>
              )}
            </>
          )}
        </div>
      </NcCard>
    </div>
  )
}

const estimate = (r: { rotations: number | null; drones: number }): number =>
  (r.rotations ?? 0) + r.drones * 0.06 // same formula as main/arbiTracker
