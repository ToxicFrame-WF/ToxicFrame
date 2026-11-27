import { useEffect, useMemo, useState } from 'react'
import Countdown from './Countdown'
import { useInventory } from '../hooks/useInventory'
import { usePersisted } from '../hooks/usePersisted'
import { useNow, useWorldState } from '../hooks/useWorldState'
import Pic from './Pic'
import HoverCard, { ModifierHover } from './HoverCard'
import NcCard from './NcCard'
import {
  WEEKLY_GROUPS,
  WEEKLY_TASKS,
  autoDone,
  weekTicks,
  nextReset,
  endgameStreak,
  icebindRuns,
  teshinOffer,
  bird3Shard,
  FIXED_WARES,
  type Ware,
  eliteTier,
  weekKey,
  weeklyCounts,
  type WeeklyCounts,
  type WeeklyTask
} from '../weekly'

const GREEN = '#3fd28a' // finished, as on the Sets tab
const CYAN = '#3fa9b0'
const GOLD = '#f3e600'
const SUB = 'block truncate text-[12px] leading-snug text-white/55' // the one muted line under a task

// Weekly Tracker: tick off the weekly activities; everything clears at the Monday 00:00 UTC reset.
// A few tasks tick themselves from the inventory (compared with the week's first inventory).
export default function WeeklyTracker({
  editing,
  setEditing,
  headerButton
}: {
  editing: boolean
  setEditing: (f: (e: boolean) => boolean) => void
  headerButton: boolean // Night City: the Customize button sits in the screen header instead
}): React.JSX.Element {
  const inv = useInventory()
  const now = useNow(60_000) // only the week key needs it; the countdown ticks itself
  const week = weekKey(now)
  const [hidden, setHidden] = usePersisted<string[]>('Weekly.hidden', [])
  const [custom, setCustom] = usePersisted<{ id: string; label: string }[]>('Weekly.custom', [])
  const [ticks, setTicks] = usePersisted<{
    week: string
    on: string[]
    off: string[]
    runs?: Record<string, number> // counter tasks: runs done this week
  }>('Weekly.ticks', { week, on: [], off: [] })
  const [start, setStart] = usePersisted<{ week: string; counts: WeeklyCounts } | null>(
    'Weekly.start',
    null
  )
  const [bothArchimedeas, setBothArchimedeas] = usePersisted('Weekly.bothArchimedeas', false)
  const [eliteRewards, setEliteRewards] = usePersisted('Weekly.eliteRewards', false)
  const [newTask, setNewTask] = useState('')

  // this week's counts; the first inventory of a new week becomes the comparison point
  const counts = useMemo(() => {
    const misc = inv.data?.raw?.MiscItems
    return Array.isArray(misc)
      ? weeklyCounts(misc as { ItemType?: string; ItemCount?: number }[])
      : null
  }, [inv.data])
  // only an inventory read this week can be the start: the copy saved on disk may be days old
  const fetchedAt = inv.data?.fetchedAt ?? 0
  useEffect(() => {
    if (!counts || fetchedAt < Date.parse(week + 'T00:00:00Z')) return
    if (start?.week !== week) setStart({ week, counts })
    // a start saved before a count was tracked lacks it: fill only the missing ones, from now
    else if (Object.keys(counts).some((k) => !(k in start.counts)))
      setStart({ week, counts: { ...counts, ...start.counts } })
  }, [counts, start, week, setStart, fetchedAt])

  // last week's ticks don't count
  const on = new Set(ticks.week === week ? ticks.on : [])
  const off = new Set(ticks.week === week ? ticks.off : [])
  const auto = new Set(counts && start?.week === week ? autoDone(start.counts, counts) : [])
  const tierOf = (id: string): number =>
    eliteRewards && (id === 'deep' || id === 'temporal') && counts && start?.week === week
      ? eliteTier(id, start.counts, counts)
      : 0
  const { ticked, autoTicks, netracellMax } = weekTicks({
    on,
    off,
    auto,
    tiers: { deep: tierOf('deep'), temporal: tierOf('temporal') },
    elite: eliteRewards,
    both: bothArchimedeas
  })
  const maxOf = (t: WeeklyTask): number => (t.id === 'netracells' ? netracellMax : (t.max ?? 0))
  const savedRuns = ticks.week === week && typeof ticks.runs === 'object' ? ticks.runs : {}
  const autoIcebind = counts && start?.week === week ? icebindRuns(start.counts, counts) : 0
  const runsOf = (t: WeeklyTask): number =>
    Math.min(Math.max(savedRuns[t.id] ?? 0, t.id === 'icebind' ? autoIcebind : 0), maxOf(t))
  const setRuns = (t: WeeklyTask, n: number): void =>
    setTicks({
      week,
      on: [...on],
      off: [...off],
      runs: { ...savedRuns, [t.id]: Math.max(0, Math.min(maxOf(t), n)) }
    })
  const isDone = (t: WeeklyTask): boolean => (t.max ? runsOf(t) >= maxOf(t) : ticked(t.id))
  const toggle = (id: string): void => {
    const nOn = new Set(on)
    const nOff = new Set(off)
    if (ticked(id)) {
      nOn.delete(id)
      if (autoTicks(id)) nOff.add(id) // un-tick an automatic tick
    } else {
      nOff.delete(id)
      nOn.add(id)
    }
    setTicks({ week, on: [...nOn], off: [...nOff], runs: savedRuns })
  }

  const tasks: WeeklyTask[] = [
    ...WEEKLY_TASKS,
    ...custom.map((c) => ({ id: c.id, label: c.label, group: 'Custom' }))
  ]
  const shown = tasks.filter((t) => editing || !hidden.includes(t.id))
  const counted = tasks.filter((t) => !hidden.includes(t.id))
  const doneCount = counted.filter((t) => isDone(t)).length
  const pct = counted.length ? Math.round((100 * doneCount) / counted.length) : 0
  const allDone = counted.length > 0 && doneCount === counted.length
  const groupDone = (g: string): boolean => {
    const l = counted.filter((t) => t.group === g)
    return l.length > 0 && l.every(isDone)
  }

  // remember whether Endgame was cleared each week, for the streak
  const [history, setHistory] = usePersisted<Record<string, boolean>>('Weekly.history', {})
  const endgameDone = groupDone('Endgame')
  useEffect(() => {
    if (!!history[week] !== endgameDone) setHistory((h) => ({ ...h, [week]: endgameDone }))
  }, [endgameDone, week, history, setHistory])
  const streak = endgameStreak(history, week)

  const addTask = (): void => {
    const label = newTask.trim()
    if (!label) return
    setCustom((c) => [...c, { id: `custom-${Date.now()}`, label }])
    setNewTask('')
  }

  return (
    <div className="p-4 text-slate-100">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">Weekly tracker</h1>
        {!headerButton && (
          <button
            onClick={() => setEditing((e) => !e)}
            aria-pressed={editing}
            className="ml-auto rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
          >
            {editing ? '✓ Done customizing' : '⚙ Customize'}
          </button>
        )}
      </div>
      {/* the week at a glance: one big bar that fills up, the reset, and the Endgame streak */}
      <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="min-w-[18rem] flex-1">
          <div className="mb-1.5 flex items-baseline gap-3">
            <span className="text-3xl font-bold tabular-nums">
              {doneCount}
              <span className="text-lg text-white/45"> / {counted.length}</span>
            </span>
            <span className="text-lg font-semibold" style={{ color: allDone ? GREEN : CYAN }}>
              {allDone ? 'Week cleared ✓' : `${pct}%`}
            </span>
            <span className="ml-auto text-sm text-white/60">
              resets in <Countdown to={new Date(nextReset(now)).toISOString()} />
            </span>
          </div>
          <div
            className="h-3 overflow-hidden bg-white/10"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Weekly tasks done"
          >
            <div
              className="h-full transition-[width] duration-500"
              style={{ width: `${pct}%`, background: allDone ? GREEN : CYAN }}
            />
          </div>
        </div>
        <div
          className="text-center"
          title="Weeks in a row with every Endgame task done (this week counts once it is done)"
        >
          <div className="text-3xl font-bold" style={{ color: streak ? '#ff9f43' : undefined }}>
            🔥 {streak}
          </div>
          <div className="text-xs text-white/60">week{streak === 1 ? '' : 's'} Endgame streak</div>
        </div>
      </div>
      {editing && (
        <p className="mb-3 text-sm text-slate-400">
          Switch off the tasks you don&apos;t do; they disappear from the list and the count. Add
          your own tasks under Custom.
        </p>
      )}
      {editing && (
        <div className="mb-3 flex items-center gap-3 text-sm">
          <Switch
            on={bothArchimedeas}
            onChange={setBothArchimedeas}
            label="I run both Archimedeas every week"
          />
          <span>
            I run both Archimedeas every week
            <span className="text-white/45">
              {' '}
              (Netracells then always show the 1 Search Pulse that is left)
            </span>
          </span>
        </div>
      )}
      {editing && (
        <div className="mb-3 flex items-center gap-3 text-sm">
          <Switch
            on={eliteRewards}
            onChange={setEliteRewards}
            label="Track Elite Archimedea rewards"
          />
          <span>
            Track Elite Archimedea rewards
            <span className="text-white/45">
              {' '}
              (done only at 37 points: Deep from Vosfor, Temporal from Pix Chips. Dissolving arcanes
              also gives Vosfor)
            </span>
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {WEEKLY_GROUPS.map((g) => {
            const list = shown.filter((t) => t.group === g)
            if (!list.length && !(editing && g === 'Custom')) return null
            const inGroup = counted.filter((t) => t.group === g)
            const nDone = inGroup.filter(isDone).length
            return (
              <NcCard
                key={g}
                title={groupDone(g) ? `${g} ✓` : `${g}  ${nDone}/${inGroup.length}`}
                accent={groupDone(g) ? GREEN : undefined}
              >
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                  <div className="nc-name mb-2 font-semibold">
                    {g} {nDone}/{inGroup.length}
                  </div>
                  {/* the group's own small goal */}
                  <div className="mb-2 h-1 bg-white/10" aria-hidden>
                    <div
                      className="h-full transition-[width] duration-500"
                      style={{
                        width: `${inGroup.length ? (100 * nDone) / inGroup.length : 0}%`,
                        background: groupDone(g) ? GREEN : CYAN
                      }}
                    />
                  </div>
                  <ul className="space-y-0.5">
                    {list.map((t) => {
                      const row = (
                        <>
                          {t.max ? (
                            <span className="w-5 shrink-0" aria-hidden />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isDone(t)}
                              onChange={() => toggle(t.id)}
                              aria-label={t.label}
                              className="h-5 w-5 shrink-0 cursor-pointer accent-[#3fa9b0]"
                            />
                          )}
                          <Pic
                            src={ICON[t.id] && `https://wiki.warframe.com/images/${ICON[t.id]}`}
                            size={28}
                            letter={t.label[0]}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span
                                className={`truncate font-semibold ${isDone(t) ? 'text-white/45 line-through' : ''}`}
                              >
                                {t.label}
                              </span>
                              {t.auto && (
                                <span
                                  title={t.auto}
                                  className="shrink-0 rounded px-1 text-[10px] font-bold tracking-wider text-[#3fa9b0] ring-1 ring-[#3fa9b0]/60"
                                >
                                  AUTO
                                </span>
                              )}
                            </span>
                            <span className={SUB} title={subline(t)}>
                              {subline(t)}
                            </span>
                            {eliteRewards && (t.id === 'deep' || t.id === 'temporal') && (
                              <EliteSteps tier={tierOf(t.id)} />
                            )}
                          </span>
                          {t.max ? (
                            <Pips
                              n={runsOf(t)}
                              max={maxOf(t)}
                              label={t.label}
                              onSet={(n) => setRuns(t, n)}
                            />
                          ) : null}
                          {editing && (
                            <span className="flex shrink-0 items-center gap-1">
                              <Switch
                                on={!hidden.includes(t.id)}
                                onChange={(show) =>
                                  setHidden((h) =>
                                    show ? h.filter((x) => x !== t.id) : [...h, t.id]
                                  )
                                }
                                label={`Show ${t.label}`}
                              />
                              {t.group === 'Custom' && (
                                <button
                                  onClick={() => setCustom((c) => c.filter((x) => x.id !== t.id))}
                                  aria-label={`Delete ${t.label}`}
                                  className="px-2 text-lg text-white/60 hover:text-white"
                                >
                                  ✕
                                </button>
                              )}
                            </span>
                          )}
                        </>
                      )
                      const cls = `flex items-center gap-3 rounded px-2 py-2 hover:bg-white/5 ${hidden.includes(t.id) ? 'opacity-40' : ''}`
                      // shops: hover for what they sell this week
                      return SHOPS.includes(t.id) ? (
                        <HoverCard
                          key={t.id}
                          side="right"
                          title={`${t.label}: this week`}
                          className={cls}
                          content={<ShopPreview id={t.id} />}
                        >
                          {row}
                        </HoverCard>
                      ) : (
                        <li key={t.id} className={cls}>
                          {row}
                        </li>
                      )
                    })}
                  </ul>
                  {editing && g === 'Custom' && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTask()}
                        placeholder="New weekly task"
                        className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900/60 px-2 py-1 text-sm outline-none"
                      />
                      <button
                        onClick={addTask}
                        className="rounded bg-[#3fa9b0] px-3 py-1 text-sm font-semibold text-black"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </NcCard>
            )
          })}
        </div>
        <ThisWeek pulsesLeft={netracellTask ? maxOf(netracellTask) : 0} />
      </div>
    </div>
  )

  // one muted line: the note (counters: how many runs are left) and what it is worth
  function subline(t: WeeklyTask): string {
    const note =
      t.id === 'netracells'
        ? `${maxOf(t)} Search Pulse${maxOf(t) === 1 ? '' : 's'} left`
        : t.max
          ? `${t.max} ${t.note ?? 'runs'} a week`
          : eliteRewards && (t.id === 'deep' || t.id === 'temporal')
            ? t.note?.replace(/^normal or Elite, /, '')
            : t.note
    return [note, t.reward].filter(Boolean).join(' · ')
  }
}

const netracellTask = WEEKLY_TASKS.find((t) => t.id === 'netracells')

const SHOPS = ['palladino', 'teshin', 'acrithis', 'nightcap', 'yonta', 'bird3']

// What a shop sells this week. Teshin and Bird 3 rotate on a fixed schedule; Acrithis is
// random, so it shows what players reported on the wiki this week.
function ShopPreview({ id }: { id: string }): React.JSX.Element {
  const [acrithis, setAcrithis] = useState<{ observed: string; items: string[] } | null>()
  useEffect(() => {
    if (id === 'acrithis') window.api.getAcrithisWares().then(setAcrithis)
  }, [id])
  const list = (wares: Ware[]): React.JSX.Element => (
    <ul>
      {wares.map((w) => (
        <li
          key={w.name}
          className="flex justify-between gap-3 border-t border-white/10 py-1.5 first:border-t-0"
        >
          <span className="text-sm font-semibold text-white">{w.name}</span>
          {w.detail && <span className="text-right text-[13px] text-white/60">{w.detail}</span>}
        </li>
      ))}
    </ul>
  )
  const next = (text: string): React.JSX.Element => (
    <div className="mt-2 text-[13px] text-white/55">Next week: {text}</div>
  )
  if (id === 'teshin') {
    const o = teshinOffer()
    return (
      <>
        {list([o.now])}
        {next(`${o.next.name} (${o.next.detail})`)}
      </>
    )
  }
  if (id === 'bird3') {
    const b = bird3Shard()
    return (
      <>
        {list([{ name: `${b.now} Archon Shard`, detail: '30,000 Cavia standing' }])}
        {next(`${b.next} Archon Shard`)}
      </>
    )
  }
  if (id === 'acrithis') {
    if (acrithis === undefined)
      return <div className="text-sm text-white/60">Loading from the wiki…</div>
    const thisWeek = acrithis && weekKey(Date.parse(acrithis.observed + ' UTC')) === weekKey()
    if (!acrithis || !thisWeek)
      return (
        <div className="text-sm text-white/60">
          Nobody has reported this week&apos;s wares on the wiki yet. They rotate randomly.
        </div>
      )
    return (
      <>
        {list(acrithis.items.map((name) => ({ name })))}
        <div className="mt-2 text-[13px] text-white/55">
          Reported on the wiki, {acrithis.observed}
        </div>
      </>
    )
  }
  return list(FIXED_WARES[id] ?? [])
}

// task -> wiki picture (its reward, or the vendor)
const ICON: Record<string, string> = {
  archon: 'CrimsonArchonShard.png',
  deep: 'Vosfor.png',
  temporal: 'PixChip.png',
  netracells: 'EntratiLanthorn.png',
  icebind: 'RivenSplicer.png',
  palladino: 'RivenSliver.png',
  teshin: 'SteelEssence.png',
  acrithis: 'PathosClamp.png',
  nightcap: 'Kuva.png',
  yonta: 'Kuva.png',
  bird3: 'AmberArchonShard.png',
  clem: 'Clem.png',
  maroo: 'AyatanAnasaSculpture.png',
  kahl: 'KahlStock.png'
}

// Run counter as clickable pips: click one to set the count to it, click the last filled one to
// take a run back.
function Pips({
  n,
  max,
  label,
  onSet
}: {
  n: number
  max: number
  label: string
  onSet: (n: number) => void
}): React.JSX.Element {
  return (
    <span className="flex shrink-0 items-center gap-2" role="group" aria-label={`${label} runs`}>
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSet(i + 1 === n ? i : i + 1)}
          aria-label={`${label}: ${i + 1} run${i ? 's' : ''} done`}
          aria-pressed={i < n}
          className="h-4 w-4 rotate-45 cursor-pointer transition-colors duration-150"
          style={{
            background: i < n ? CYAN : 'transparent',
            boxShadow: `inset 0 0 0 2px ${i < n ? CYAN : 'rgb(255 255 255 / 0.35)'}`
          }}
        />
      ))}
      {max === 0 && <span className="text-xs text-white/45">no pulses left</span>}
    </span>
  )
}

// Elite tier as two notches: 28 and 37 points, lit in gold once reached
function EliteSteps({ tier }: { tier: number }): React.JSX.Element {
  const step = (pts: number): React.JSX.Element => (
    <span
      className="rounded px-1.5 text-[11px] font-bold"
      style={
        tier >= pts
          ? { background: GOLD, color: '#000' }
          : { boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.3)', color: 'rgb(255 255 255 / 0.5)' }
      }
    >
      {pts}
    </span>
  )
  return (
    <span className="mt-1 flex items-center gap-1.5 text-[12px] text-white/55">
      Elite {step(28)} {step(37)}
      {tier === 37 && <span style={{ color: GREEN }}>all rewards</span>}
    </span>
  )
}

// What this week holds, so the plan sits next to the list.
function ThisWeek({ pulsesLeft }: { pulsesLeft: number }): React.JSX.Element | null {
  const ws = useWorldState()
  if (!ws?.archimedea?.length) return null
  return (
    <div className="w-full 2xl:w-80 2xl:shrink-0">
      <NcCard title="This week">
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-sm">
          <div className="nc-name mb-2 font-semibold">This week</div>
          {ws.archimedea.map((a) => (
            <div key={a.kind} className="mb-3">
              <div className="mb-1 font-semibold">{a.kind}</div>
              {/* hover a mission (or the personal line) for its modifiers */}
              <ul>
                {a.missions.map((m, i) => (
                  <ModifierHover
                    key={i}
                    title={`${m.mission}${m.faction ? ` · ${m.faction}` : ''}`}
                    deviation={m.deviation}
                    mods={m.risks}
                    label="Risks"
                  >
                    <span className="text-white/75">
                      <span className="mr-2 text-white/40">{i + 1}</span>
                      {m.mission}
                      {m.faction && <span className="text-white/45"> · {m.faction}</span>}
                    </span>
                  </ModifierHover>
                ))}
                {a.variables.length > 0 && (
                  <ModifierHover
                    title={`${a.kind}: personal modifiers`}
                    mods={a.variables}
                    label="Apply to every mission"
                  >
                    <span className="text-white/60">Personal modifiers ({a.variables.length})</span>
                  </ModifierHover>
                )}
              </ul>
            </div>
          ))}
          <div className="border-t border-white/10 pt-2 text-white/60">
            Search Pulses left for Netracells: <b className="text-white">{pulsesLeft}</b>
          </div>
        </div>
      </NcCard>
    </div>
  )
}

// An on/off switch: a 44x24 pill that slides, cyan when on. No `border` class, since Night City
// paints bordered buttons inside cards red.
function Switch({
  on,
  onChange,
  label
}: {
  on: boolean
  onChange: (on: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={() => onChange(!on)}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={{ background: on ? CYAN : 'rgb(255 255 255 / 0.18)' }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-150"
        style={{ left: on ? '1.375rem' : '0.125rem' }}
      />
    </button>
  )
}
