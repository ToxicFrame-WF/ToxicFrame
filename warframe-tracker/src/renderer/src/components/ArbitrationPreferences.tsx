import Dropdown from './Dropdown'
import NcCard from './NcCard'
import { clock } from '../clock'
import { useEffect, useState } from 'react'
import { MISSION_TYPES, PLANETS, TIERS, matchesPrefs, niceNode, factionCls } from '../arbitrations'
import { useNow } from '../hooks/useWorldState'
import TierBadge from './TierBadge'
import { Toggle } from './SettingsDialog'
import { updateSettings, useSettings, type ArbPrefs } from '../settings'

// Overview > Arbitrations > Alerts & favorites: pick which rotations you care about, preview what
// matches in the next week, and manage reminders and favorite nodes.

const when = (sec: number): string =>
  `${new Date(sec * 1000).toLocaleDateString([], { weekday: 'short' })} ${clock(sec)}`

const chip = (on: boolean): string =>
  on
    ? 'border-cyan-500 bg-cyan-600/80 text-white'
    : 'nc-quiet border-slate-600 bg-transparent text-slate-400 hover:border-slate-500 hover:text-slate-200'

function SlotRow({ s, first }: { s: ArbitrationSlot; first: boolean }): React.JSX.Element {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2 text-sm ${first ? '' : 'border-t border-slate-700/70'}`}
    >
      <span className="w-20 shrink-0 whitespace-nowrap text-xs font-bold">{when(s.start)}</span>
      <span className="flex w-8 shrink-0 justify-center">
        {s.tier && <TierBadge tier={s.tier} />}
      </span>
      <span className="shrink-0 font-bold">{s.type || s.name}</span>
      <span className="min-w-0 truncate text-xs text-slate-400">{niceNode(s.name)}</span>
      {s.enemy && (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${factionCls(s.enemy)}`}
        >
          {s.enemy}
        </span>
      )}
    </div>
  )
}

function ChipGroup({
  title,
  options,
  selected,
  onChange
}: {
  title: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}): React.JSX.Element {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
        {title}
        <span className="text-xs font-normal text-slate-300">
          {selected.length ? `${selected.length} selected` : 'Any'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o)
          return (
            <button
              key={o}
              onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
              aria-pressed={on}
              className={`rounded-lg border px-3 py-1.5 text-xs ${chip(on)}`}
            >
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ArbitrationPreferences(): React.JSX.Element {
  const settings = useSettings()
  const prefs = settings.arbPrefs
  const favs = settings.arbFavorites
  const [slots, setSlots] = useState<ArbitrationSlot[] | null>(null)
  const [nodesOpen, setNodesOpen] = useState(false)
  const set = (patch: Partial<ArbPrefs>): void =>
    updateSettings({ arbPrefs: { ...prefs, ...patch } })

  useEffect(() => {
    let alive = true
    window.api
      .getArbitrationForecast()
      .then((d) => alive && setSlots(d))
      .catch(() => alive && setSlots([]))
    return () => {
      alive = false
    }
  }, [])

  const nowSec = Math.floor(useNow() / 1000)
  const upcoming = (slots ?? []).filter((s) => s.start > nowSec)
  const matches = upcoming.filter((s) => matchesPrefs(s, prefs, favs))
  const nodeNames = [...new Set((slots ?? []).map((s) => s.name))].sort()
  // factions that actually appear in the schedule (plus any already picked)
  const factions = [
    ...new Set([...(slots ?? []).map((s) => s.enemy).filter(Boolean), ...prefs.factions])
  ].sort()
  const noFilters =
    !prefs.missionTypes.length &&
    !prefs.planets.length &&
    !prefs.factions.length &&
    !prefs.tiers.length &&
    !prefs.nodes.length &&
    !prefs.favOnly
  const reminders = upcoming.filter((s) => settings.arbReminders.includes(s.start))

  const panel = 'rounded-xl border border-slate-700 bg-slate-800/60 p-5'

  return (
    <div className="p-5 text-slate-100">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Arbitrations</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1100px]:grid-cols-[1fr_20rem]">
        {/* preferences */}
        <NcCard title="Your alert preferences">
          <div className={panel}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="nc-name text-lg font-bold">Your alert preferences</h2>
                <p className="mt-1 text-xs !normal-case text-slate-400">
                  Select any number of choices in each group. Empty groups include everything.
                  Changes save automatically.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <Toggle
                label="Notify me about matching missions"
                hint="Recurring alerts for your saved conditions"
                on={prefs.notify}
                onChange={() => set({ notify: !prefs.notify })}
              />
            </div>

            <ChipGroup
              title="Community farming tiers"
              options={TIERS}
              selected={prefs.tiers}
              onChange={(tiers) => set({ tiers })}
            />
            <ChipGroup
              title="Factions"
              options={factions}
              selected={prefs.factions}
              onChange={(factions) => set({ factions })}
            />
            <ChipGroup
              title="Mission types"
              options={MISSION_TYPES}
              selected={prefs.missionTypes}
              onChange={(missionTypes) => set({ missionTypes })}
            />
            <ChipGroup
              title="Planets"
              options={PLANETS}
              selected={prefs.planets}
              onChange={(planets) => set({ planets })}
            />

            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/50">
              <button
                onClick={() => setNodesOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
              >
                <span>{nodesOpen ? '▾' : '▸'} Specific nodes</span>
                <span className="text-xs font-normal text-slate-300">
                  {prefs.nodes.length ? `${prefs.nodes.length} selected` : 'Any node'}
                </span>
              </button>
              {nodesOpen && (
                <div className="flex flex-wrap gap-2 border-t border-slate-700 p-4">
                  {nodeNames.length === 0 && (
                    <span className="text-xs text-slate-400">Loading nodes…</span>
                  )}
                  {nodeNames.map((n) => {
                    const on = prefs.nodes.includes(n)
                    return (
                      <button
                        key={n}
                        onClick={() =>
                          set({
                            nodes: on ? prefs.nodes.filter((x) => x !== n) : [...prefs.nodes, n]
                          })
                        }
                        aria-pressed={on}
                        className={`rounded-lg border px-2.5 py-1 text-xs ${chip(on)}`}
                      >
                        {niceNode(n)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-5">
              <Toggle
                label="Only favorite nodes"
                hint="Star nodes on the schedule to add favorites"
                on={prefs.favOnly}
                onChange={() => set({ favOnly: !prefs.favOnly })}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <label className="text-sm">
                <div className="mb-1 text-xs text-slate-400">Advance notice</div>
                <Dropdown
                  value={String(prefs.advanceMin)}
                  onChange={(v) => set({ advanceMin: Number(v) })}
                  options={[0, 5, 10, 15, 30, 45].map((m) => ({
                    value: String(m),
                    label: m === 0 ? 'No advance notice' : `${m} minutes before`
                  }))}
                />
              </label>
              <label className="mt-5 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.alsoAtStart}
                  onChange={(e) => set({ alsoAtStart: e.target.checked })}
                />
                Also notify at rotation start
              </label>
            </div>

            <div className="mt-5 border-t border-slate-700 pt-5">
              <Toggle
                label="Show in Timers &amp; Events"
                hint="A compact summary beside your other timers"
                on={prefs.showInTimers}
                onChange={() => set({ showInTimers: !prefs.showInTimers })}
              />
            </div>
            <p className="mt-4 text-xs !normal-case text-slate-400">
              Notifications appear while ToxicFrame is running.
            </p>
          </div>
        </NcCard>

        {/* side column */}
        <div className="space-y-4">
          <NcCard title="Preview your matches">
            <div className={panel}>
              <h2 className="nc-name text-lg font-bold">Preview your matches</h2>
              {noFilters ? (
                <p className="mt-2 text-xs !normal-case text-slate-400">
                  No filters set — every rotation matches.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs !normal-case text-slate-400">
                    {slots
                      ? `${matches.length} upcoming rotation${matches.length === 1 ? '' : 's'} in seven days`
                      : 'Loading…'}
                  </p>
                  <div className="mt-3">
                    {matches.slice(0, 5).map((s, i) => (
                      <SlotRow key={s.start} s={s} first={i === 0} />
                    ))}
                    {slots && matches.length === 0 && (
                      <p className="text-sm text-slate-400">
                        Nothing matches these preferences this week.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </NcCard>

          <NcCard title="One-time reminders">
            <div className={panel}>
              <h2 className="nc-name text-lg font-bold">One-time reminders</h2>
              <p className="mt-1 text-xs !normal-case text-slate-400">
                Chosen individually on the schedule
              </p>
              {reminders.length === 0 ? (
                <p className="mt-3 text-xs !normal-case text-slate-400">
                  Use the bell beside a future rotation to save a reminder. Recurring alerts can
                  stay off.
                </p>
              ) : (
                <div className="mt-3">
                  {reminders.map((s, i) => (
                    <div
                      key={s.start}
                      className={`flex items-center gap-2 py-2 text-sm ${i > 0 ? 'border-t border-slate-700/70' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <SlotRow s={s} first />
                      </div>
                      <button
                        onClick={() =>
                          updateSettings({
                            arbReminders: settings.arbReminders.filter((t) => t !== s.start)
                          })
                        }
                        title="Remove this reminder"
                        className="text-slate-400 hover:text-slate-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs !normal-case text-slate-400">
                Reminders use your saved advance notice.
              </p>
            </div>
          </NcCard>

          <NcCard title="Favorite nodes">
            <div className={panel}>
              <h2 className="nc-name text-lg font-bold">Favorite nodes</h2>
              <p className="mt-1 text-xs !normal-case text-slate-400">
                {favs.length} saved for quick filtering
              </p>
              {favs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-300">
                  Star a node on the schedule. The favorite applies to every occurrence of that
                  node.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {favs.map((f) => (
                    <span
                      key={f}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/50 px-2.5 py-1 text-xs"
                    >
                      <span className="text-amber-300">★</span>
                      {niceNode(f)}
                      <button
                        onClick={() =>
                          updateSettings({ arbFavorites: favs.filter((x) => x !== f) })
                        }
                        title="Remove favorite"
                        className="text-slate-400 hover:text-slate-100"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </NcCard>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 px-1 text-sm text-slate-300">
        Schedule data sourced from
        <a
          href="https://browse.wf"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-slate-100 hover:text-violet-300"
        >
          browse.wf <span aria-hidden>↗</span>
        </a>
      </div>
    </div>
  )
}
