import Dropdown from './Dropdown'
import NcCard from './NcCard'
import { clock } from '../clock'
import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import { timeLeft, useNow } from '../hooks/useWorldState'
import { updateSettings, useSettings } from '../settings'
import TierBadge from './TierBadge'
import { factionCls } from '../arbitrations'

// Overview > Arbitrations > Schedule: the running arbitration, the next one, and a week-long forecast.
// The schedule itself comes from browse.wf (credit shown at the bottom).

// "Elara (Jupiter)" -> "Elara, Jupiter"
const niceNode = (name: string): string => name.replace(/\s*\((.+)\)\s*$/, ', $1')
const iso = (sec: number): string => new Date(sec * 1000).toISOString()
const dayStart = (sec: number): number => {
  const d = new Date(sec * 1000)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const dayLabel = (ms: number, todayMs: number, style: 'tab' | 'heading'): string => {
  const d = new Date(ms)
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const diff = Math.round((ms - todayMs) / 86400000)
  if (style === 'tab') {
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    return d.toLocaleDateString([], { weekday: 'short' })
  }
  const name =
    diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'long' })
  return `${name}, ${date}`
}

function Star({ on, onClick }: { on: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      title={on ? 'Remove from favorites' : 'Add this node to favorites'}
      className={`rounded-lg px-2 py-1 text-lg leading-none ${
        on ? 'text-amber-300' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {on ? '★' : '☆'}
    </button>
  )
}

function TopCard(p: {
  label: string
  labelCls: string
  box: string
  tip?: string
  slot: ArbitrationSlot | undefined
  empty: string
  caption: string
  big: string
  fav: string[]
  onFav: (name: string) => void
  progress?: number
}): React.JSX.Element {
  const s = p.slot
  return (
    <div title={p.tip} className={`${p.box} flex flex-col`}>
      <div className={`text-sm font-semibold ${p.labelCls}`}>
        <span className="nc-name">{p.label}</span>
      </div>
      {s ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-bold leading-tight">{s.type || s.name}</span>
            <TierBadge tier={s.tier} long />
          </div>
          <div className="mt-0.5 text-sm text-slate-300">
            {niceNode(s.name)}
            {s.enemy ? ` · ${s.enemy}` : ''}
          </div>
          <div className="mt-auto flex items-end justify-between pt-2">
            <div>
              <div className="text-xs text-slate-400">{p.caption}</div>
              <div className="text-xl font-bold">{p.big}</div>
            </div>
            <Star on={p.fav.includes(s.name)} onClick={() => p.onFav(s.name)} />
          </div>
          {p.progress !== undefined && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-slate-200"
                style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
              />
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 text-sm text-slate-400">{p.empty}</div>
      )}
    </div>
  )
}

export default function ArbitrationSchedule(): React.JSX.Element {
  const settings = useSettings()
  const now = useNow()
  const nowSec = Math.floor(now / 1000)
  const [slots, setSlots] = useState<ArbitrationSlot[] | null>(null)
  const [query, setQuery] = useState('')
  const [day, setDay] = useState<number | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [enemy, setEnemy] = useState('')
  const [missionType, setMissionType] = useState('')
  const [tier, setTier] = useState('')
  const [favOnly, setFavOnly] = useState(false)

  useEffect(() => {
    let alive = true
    const load = (): void => {
      window.api
        .getArbitrationForecast()
        .then((d) => alive && setSlots(d))
        .catch(() => alive && setSlots((prev) => prev ?? []))
    }
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const favs = settings.arbFavorites
  const toggleFav = (name: string): void =>
    updateSettings({
      arbFavorites: favs.includes(name) ? favs.filter((f) => f !== name) : [...favs, name]
    })

  const toggleReminder = (start: number): void => {
    const list = settings.arbReminders
    updateSettings({
      arbReminders: list.includes(start) ? list.filter((t) => t !== start) : [...list, start]
    })
  }

  // slots that have not ended yet (the list refreshes every few minutes, the clock every second)
  const live = useMemo(() => (slots ?? []).filter((s) => s.end > nowSec), [slots, nowSec])
  const current = live.find((s) => s.start <= nowSec)
  const next = live.find((s) => s.start > nowSec)
  const nextMatch = favs.length
    ? live.find((s) => s.start > nowSec && favs.includes(s.name))
    : live.reduce<(typeof live)[number] | undefined>((best, s) => {
        const r = s.tier ? 'SABCD'.indexOf(s.tier) : -1 // indexOf('') would be 0 (= S)
        if (r < 0 || s.start <= nowSec || s.start >= nowSec + 86400) return best
        return !best || r < 'SABCD'.indexOf(best.tier ?? '') ? s : best
      }, undefined)
  const bestMode = !favs.length

  const todayMs = dayStart(nowSec)
  const days = useMemo(() => [...new Set(live.map((s) => dayStart(s.start)))].slice(0, 8), [live])
  const enemies = useMemo(
    () => [...new Set(live.map((s) => s.enemy).filter(Boolean))].sort(),
    [live]
  )
  const types = useMemo(() => [...new Set(live.map((s) => s.type).filter(Boolean))].sort(), [live])

  const q = query.trim().toLowerCase()
  const shown = live
    .filter((s) => day === 'all' || dayStart(s.start) === day)
    .filter((s) => !q || `${s.name} ${s.type} ${s.enemy}`.toLowerCase().includes(q))
    .filter((s) => !enemy || s.enemy === enemy)
    .filter((s) => !missionType || s.type === missionType)
    .filter((s) => !tier || (tier === 'none' ? !s.tier : s.tier === tier))
    .filter((s) => !favOnly || favs.includes(s.name))

  const groups: { key: number; items: ArbitrationSlot[] }[] = []
  for (const s of shown) {
    const key = dayStart(s.start)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(s)
    else groups.push({ key, items: [s] })
  }

  const filtersActive = Boolean(enemy || missionType || tier || favOnly)
  const panel = 'rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3'

  return (
    <div className="p-5 text-slate-100">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Arbitrations</h1>
      </div>

      {slots && slots.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-600 p-6 text-sm text-slate-300">
          Could not load the arbitration schedule. Check your connection and reopen this page.
        </div>
      )}
      {!slots && <p className="text-sm text-slate-400">Loading the schedule…</p>}

      {slots && slots.length > 0 && (
        <>
          {/* top cards: one shared structure so heights and titles line up */}
          <div className="grid grid-cols-1 gap-3 min-[1100px]:grid-cols-3">
            <NcCard title="Current forecast">
              <TopCard
                label="⬡ Current forecast"
                labelCls="text-violet-300"
                box={panel}
                slot={current}
                empty="Nothing is running right now."
                caption="left to enter"
                big={current ? timeLeft(iso(current.end), now) : ''}
                fav={favs}
                onFav={toggleFav}
                progress={current ? ((nowSec - current.start) / 3600) * 100 : undefined}
              />
            </NcCard>

            <NcCard title="Up next">
              <TopCard
                label="◷ Up next"
                labelCls="text-slate-200"
                box={panel}
                slot={next}
                empty="—"
                caption={next ? `starts ${clock(next.start)}` : ''}
                big={next ? `in ${timeLeft(iso(next.start), now)}` : ''}
                fav={favs}
                onFav={toggleFav}
              />
            </NcCard>

            <NcCard title={bestMode ? 'Best in the next 24h' : 'Next match'}>
              <TopCard
                label={bestMode ? '★ Best in the next 24h' : '☆ Next match'}
                labelCls="text-amber-200"
                box="rounded-xl border border-amber-200/30 bg-slate-700/40 px-4 py-3"
                tip={bestMode ? 'Star nodes to follow them here' : undefined}
                slot={nextMatch}
                empty={
                  favs.length
                    ? `None of your ${favs.length} favorite${favs.length > 1 ? 's' : ''} comes up in the next week.`
                    : 'No preferences set. Star a node in the schedule to follow it here.'
                }
                caption={
                  nextMatch
                    ? `${new Date(nextMatch.start * 1000).toLocaleDateString([], {
                        weekday: 'short'
                      })} ${clock(nextMatch.start)}`
                    : ''
                }
                big={nextMatch ? `in ${timeLeft(iso(nextMatch.start), now)}` : ''}
                fav={favs}
                onFav={toggleFav}
              />
            </NcCard>
          </div>

          {/* forecast */}
          <h2 className="mb-3 mt-6 text-lg font-bold">Next seven days</h2>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
              <span className="text-slate-400">⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search nodes, planets, or mission types"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  title="Clear search"
                  className="text-slate-400 hover:text-slate-200"
                >
                  <Icon name="trash" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${
                showFilters || filtersActive
                  ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
                  : 'border-slate-600 bg-slate-900/60 hover:bg-slate-800'
              }`}
            >
              ▼ Filters
            </button>
          </div>

          {showFilters && (
            <div className="mb-3">
              <NcCard title="Filters">
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
                  <label className="flex items-center gap-2">
                    Faction
                    <Dropdown
                      size="sm"
                      value={enemy}
                      onChange={setEnemy}
                      options={[
                        { value: '', label: 'Any' },
                        ...enemies.map((e) => ({ value: e, label: e }))
                      ]}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    Mission
                    <Dropdown
                      size="sm"
                      value={missionType}
                      onChange={setMissionType}
                      options={[
                        { value: '', label: 'Any' },
                        ...types.map((t) => ({ value: t, label: t }))
                      ]}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    Grade
                    <Dropdown
                      size="sm"
                      value={tier}
                      onChange={setTier}
                      options={[
                        { value: '', label: 'Any' },
                        ...['S', 'A', 'B', 'C', 'D', 'F'].map((t) => ({
                          value: t,
                          label: `${t} Tier`
                        })),
                        { value: 'none', label: 'Unrated' }
                      ]}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={favOnly}
                      onChange={(e) => setFavOnly(e.target.checked)}
                    />
                    Favorites only
                  </label>
                  {filtersActive && (
                    <button
                      onClick={() => {
                        setEnemy('')
                        setMissionType('')
                        setTier('')
                        setFavOnly(false)
                      }}
                      className="text-violet-300 hover:text-violet-200"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </NcCard>
            </div>
          )}

          {/* day tabs */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setDay('all')}
              className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${
                day === 'all'
                  ? 'border-[#4a5f9a] bg-[#2a3a66] text-white'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="font-semibold">All days</div>
              <div className="text-slate-300">7-day forecast</div>
            </button>
            {days.map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${
                  day === d
                    ? 'border-[#4a5f9a] bg-[#2a3a66] text-white'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold">{dayLabel(d, todayMs, 'tab')}</div>
                <div className="text-slate-300">
                  {new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
              </button>
            ))}
          </div>

          {groups.length === 0 && (
            <p className="p-4 text-sm text-slate-400">No arbitrations match.</p>
          )}

          {groups.map((g) => (
            <div key={g.key} className="mb-4">
              <NcCard title={dayLabel(g.key, todayMs, 'heading')}>
                <div className="nc-name mb-2 px-1 text-sm font-bold">
                  {dayLabel(g.key, todayMs, 'heading')}
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-700/70">
                  {g.items.map((s, i) => {
                    const isCurrent = s.start <= nowSec
                    const hot = s.tier === 'S' || s.tier === 'A'
                    const hasReminder = settings.arbReminders.includes(s.start)
                    return (
                      <div
                        key={s.start}
                        className={`group flex items-center gap-3 border-l-[3px] px-3 py-2.5 text-sm ${
                          i > 0 ? 'border-t border-t-slate-700/70' : ''
                        } ${hot ? 'border-l-violet-400 bg-violet-500/20' : 'border-l-transparent'} ${
                          isCurrent && !hot ? 'bg-slate-700/40' : ''
                        }`}
                      >
                        <div className="w-40 shrink-0 whitespace-nowrap">
                          <span className="font-bold">
                            {isCurrent
                              ? `Now · until ${clock(s.end)}`
                              : `${clock(s.start)}–${clock(s.end)}`}
                          </span>
                          {!isCurrent && (
                            <span className="ml-2 text-[11px] text-slate-400">
                              in {timeLeft(iso(s.start), now).replace(/ \d+s$/, '')}
                            </span>
                          )}
                        </div>
                        <div className="flex w-10 shrink-0 justify-center">
                          {s.tier && <TierBadge tier={s.tier} />}
                        </div>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="shrink-0 font-bold">{s.type || s.name}</span>
                          <span className="truncate text-xs text-slate-300">
                            {niceNode(s.name)}
                          </span>
                          {s.enemy && (
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${factionCls(s.enemy)}`}
                            >
                              {s.enemy}
                            </span>
                          )}
                        </div>
                        <Star on={favs.includes(s.name)} onClick={() => toggleFav(s.name)} />
                        <button
                          disabled={isCurrent}
                          onClick={() => toggleReminder(s.start)}
                          title={
                            isCurrent
                              ? 'Already running'
                              : settings.arbReminders.includes(s.start)
                                ? 'Remove the reminder for this rotation'
                                : 'Remind me about this rotation'
                          }
                          className={`rounded-lg px-1.5 py-1 text-base leading-none focus-visible:opacity-100 disabled:opacity-25 ${
                            hasReminder
                              ? 'text-violet-300'
                              : 'text-slate-400 opacity-0 hover:text-slate-200 group-hover:opacity-100'
                          }`}
                        >
                          <Icon name={hasReminder ? 'bell' : 'bellOff'} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </NcCard>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Schedule and community grades: browse.wf (grades by the Arbitration Goons)
          </p>
        </>
      )}
    </div>
  )
}
