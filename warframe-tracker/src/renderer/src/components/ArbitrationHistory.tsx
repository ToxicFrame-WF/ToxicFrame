import Dropdown from './Dropdown'
import NcCard from './NcCard'
import { useEffect, useState } from 'react'
import type { ArbiRun } from '../../../preload/index.d'
import { mmss, modeLabel } from '../arbiFormat'

// Overview > Arbitrations > Run history: runs saved by the live tracker (main/arbiTracker.ts).
export default function ArbitrationHistory(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [runs, setRuns] = useState<ArbiRun[]>([])
  useEffect(() => {
    const load = (): void => void window.api.getArbiRuns().then(setRuns)
    load()
    return window.api.onArbiRuns(load)
  }, [])
  const q = query.trim().toLowerCase()
  const shown = runs.filter((r) =>
    `${r.name} ${modeLabel(r.mode)} ${r.role}`.toLowerCase().includes(q)
  )
  return (
    <div className="p-5 text-slate-100">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Arbitrations</h1>
      </div>

      <NcCard title={`Saved runs · ${runs.length}`}>
        <div className="p-4">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
              <span className="text-slate-400">⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search node, mode or role"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
              />
            </div>
            <button
              disabled
              className="cursor-not-allowed rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold opacity-50"
            >
              ▼ Filters
            </button>
            <Dropdown
              disabled
              value="n"
              onChange={() => {}}
              options={[{ value: 'n', label: 'Newest first' }]}
              ariaLabel="Sort"
            />
          </div>

          {shown.length === 0 ? (
            <div className="mx-auto max-w-md text-center">
              <h3 className="text-lg font-bold">Your first run starts here</h3>
              <p className="mt-3 text-sm text-slate-300">
                Runs are saved when you finish an Arbitration with the game open and ToxicFrame
                running.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {shown.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-sm"
                >
                  <div>
                    <div className="font-bold">
                      {r.name}{' '}
                      <span className="font-normal text-slate-300">· {modeLabel(r.mode)}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(r.startedAt).toLocaleString()} · {mmss(r.durationSec)} ·{' '}
                      {r.completed ? 'Completed' : 'Left early'} ·{' '}
                      {r.role === 'client' ? 'Client (partial drone count)' : 'Host'}
                    </div>
                  </div>
                  <div className="text-right text-xs tabular-nums text-slate-200">
                    <div>
                      {r.rotations === null ? 'Rotations unknown' : `${r.rotations} rotations`}
                    </div>
                    <div>
                      {r.drones} drones · ~{r.vitus.toFixed(1)} Vitus
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </NcCard>
    </div>
  )
}
