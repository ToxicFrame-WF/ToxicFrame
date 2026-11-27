import Dropdown from './Dropdown'
import NcCard from './NcCard'
import { countTop, monthTicks, niceDate, niceTop } from '../statsChart'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInventory } from '../hooks/useInventory'
import { useNow } from '../hooks/useWorldState'
import { usePlanetIcons } from '../hooks/usePlanetIcons'
import { useItemMeta } from '../hooks/useItemMeta'
import PlatIcon from './PlatIcon'
import type { Trade, TradeStack } from '../tradeStats'
import Pic from './Pic'
import Icon from './Icon'
import { localDay } from '../localDay'

// Overview > Stats. The layout follows Alecaframe's "Your stats". Balances and relics opened come
// from one saved row per day (main/statsHistory.ts), written on every inventory refresh. Trades
// are not recorded yet.

type Panel =
  'days' | 'relics' | 'trades' | 'platinum' | 'ducats' | 'endo' | 'credits' | 'aya' | 'vitus'
type TradeTab = 'all' | 'sale' | 'purchase' | 'trade'

const BALANCES: { id: Panel; label: string; icon: string }[] = [
  { id: 'platinum', label: 'Platinum', icon: '◈' },
  { id: 'ducats', label: 'Ducats', icon: '✪' },
  { id: 'endo', label: 'Endo', icon: '❂' },
  { id: 'credits', label: 'Credits', icon: '▤' },
  { id: 'aya', label: 'Aya', icon: '◊' },
  { id: 'vitus', label: 'Vitus Essence', icon: '◇' }
]
// The game's own picture for each currency (from the wiki); the old symbol shows until it loads.
function CurrencyIcon({ id, glyph }: { id: string; glyph: string }): React.JSX.Element {
  const src = usePlanetIcons()[id]
  return src ? (
    <Pic src={src} size={20} letter={glyph} />
  ) : (
    <span className="w-5 text-center">{glyph}</span>
  )
}

const RANGES = ['All time', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'This year']
const TRADE_TABS: { id: TradeTab; label: string; icon: 'infinity' | 'coins' | 'cart' | 'swap' }[] =
  [
    { id: 'all', label: 'All', icon: 'infinity' },
    { id: 'sale', label: 'Sale', icon: 'coins' },
    { id: 'purchase', label: 'Purchase', icon: 'cart' },
    { id: 'trade', label: 'Trade', icon: 'swap' }
  ]
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

const card = 'rounded-2xl border border-slate-700 bg-slate-800/50'
const field =
  'rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none'

const dayKey = (y: number, m: number, d: number): string =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function MonthGrid({
  year,
  month,
  days: rec,
  traded,
  onHover,
  onPick
}: {
  year: number
  month: number
  days: Record<string, DayStat>
  traded: Record<string, unknown[]> // days with trades
  onHover: (day: string | null, at?: DOMRect) => void
  onPick: (day: string) => void
}): React.JSX.Element {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7 // weeks start on Monday
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1)
  ]
  return (
    <NcCard title={`${MONTHS[month]} ${year}`}>
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <b className="nc-name text-xs">
            {MONTHS[month]} {year}
          </b>
          <span className="text-[11px] text-slate-300">
            {cells.filter((d) => d && rec[dayKey(year, month, d)]).length} recorded
          </span>
        </div>
        <div className="grid grid-cols-[repeat(7,1.5rem)] justify-between gap-y-1 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="text-[11px] font-semibold text-slate-200">
              {d}
            </span>
          ))}
          {cells.map((d, i) =>
            d === null ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                onMouseEnter={(e) =>
                  onHover(dayKey(year, month, d), e.currentTarget.getBoundingClientRect())
                }
                onMouseLeave={() => onHover(null)}
                onClick={() => onPick(dayKey(year, month, d))}
                className={`nc-day flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border text-[11px] ${
                  rec[dayKey(year, month, d)] || traded[dayKey(year, month, d)]
                    ? 'border-violet-300 bg-violet-500/80 text-white'
                    : dayKey(year, month, d) > localDay()
                      ? 'border-transparent text-slate-600'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300'
                }`}
              >
                {d}
              </button>
            )
          )}
        </div>
      </div>
    </NcCard>
  )
}

// hideTrades lives in App: the screen header holds the "Show trades" button
export default function StatsPage({ hideTrades }: { hideTrades: boolean }): React.JSX.Element {
  const [panel, setPanel] = useState<Panel>('days')
  const [range, setRange] = useState(RANGES[0])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [group, setGroup] = useState<'Daily' | 'Monthly'>('Daily')
  const [year, setYear] = useState(new Date().getFullYear())
  const [tradeTab, setTradeTab] = useState<TradeTab>('all')
  const [query, setQuery] = useState('')
  const [oldestFirst, setOldestFirst] = useState(false) // trade history order

  // saved daily rows; re-read whenever the inventory refreshes (that is when a row is written)
  const inv = useInventory()
  const [history, setHistory] = useState<Record<string, DayStat>>({})
  useEffect(() => {
    window.api.getStatsHistory().then((h) => setHistory(h.days))
  }, [inv.data?.fetchedAt])

  // days inside the chosen range (local dates as "YYYY-MM-DD", which sort as text)
  // only the date matters here, so ranges recompute once a day, not on every clock tick
  const today = localDay(new Date(useNow(60_000)))
  const [rangeStart, rangeEnd] = useMemo(() => {
    const ago = (n: number): string =>
      new Date(Date.parse(today) - n * 864e5).toISOString().slice(0, 10)
    const start =
      from ||
      (range === 'Last 7 days'
        ? ago(6)
        : range === 'Last 30 days'
          ? ago(29)
          : range === 'Last 90 days'
            ? ago(89)
            : range === 'This year'
              ? `${today.slice(0, 4)}-01-01`
              : '')
    return [start, to || '9999']
  }, [range, from, to, today])
  const inRange = useMemo(
    () =>
      Object.keys(history)
        .filter((d) => d >= rangeStart && d <= rangeEnd)
        .sort(),
    [history, rangeStart, rangeEnd]
  )
  // latest value of a balance in the range, shortened (14.9M), or "—" with no recorded day
  const latestOf = (id: Panel): string => {
    const day = inRange[inRange.length - 1]
    const v = day ? (history[day][id as keyof DayStat] as number | undefined) : undefined
    if (v == null) return '—'
    return v >= 1e6
      ? `${(v / 1e6).toFixed(1)}M`
      : v >= 1e4
        ? `${(v / 1e3).toFixed(1)}K`
        : v.toLocaleString()
  }

  // trade log (Sold on My Orders + AlecaFrame import), limited to the same date range
  const meta = useItemMeta()
  const [trades, setTrades] = useState<Trade[]>([])
  const [tradeSort, setTradeSort] = useState<'date' | 'platinum'>('date')
  useEffect(() => {
    window.api.getTrades().then(setTrades)
  }, [])
  const iconOf = useMemo(() => {
    const byId = new Map(Object.values(meta).map((e) => [e.id, e.icon]))
    const byName = new Map(Object.values(meta).map((e) => [e.name.toLowerCase(), e.icon]))
    return (t: Trade): string | undefined =>
      byId.get(t.itemId) ?? (t.name ? byName.get(t.name.toLowerCase()) : undefined)
  }, [meta])
  const iconByName = useMemo(() => {
    const byName = new Map(Object.values(meta).map((e) => [e.name.toLowerCase(), e.icon]))
    return (name: string): string | undefined => byName.get(name.toLowerCase())
  }, [meta])
  const nameOf = useMemo(() => {
    const byId = new Map(Object.values(meta).map((e) => [e.id, e.name]))
    return (t: Trade): string => t.name ?? byId.get(t.itemId) ?? 'Unknown item'
  }, [meta])
  const tradesInRange = useMemo(
    () =>
      trades.filter((t) => {
        const d = localDay(new Date(t.at))
        return d >= rangeStart && d <= rangeEnd
      }),
    [trades, rangeStart, rangeEnd]
  )
  const tradesPerDay = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of tradesInRange) {
      const d = localDay(new Date(t.at))
      m[d] = (m[d] ?? 0) + 1
    }
    return m
  }, [tradesInRange])
  const tradesByDay = useMemo(() => {
    const m: Record<string, Trade[]> = {}
    for (const t of trades) (m[localDay(new Date(t.at))] ??= []).push(t)
    return m
  }, [trades])
  const [hover, setHover] = useState<{ day: string; at: DOMRect } | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  // the recorded day before `day`, for "change" figures
  const prevDay = (day: string): string | undefined =>
    Object.keys(history)
      .filter((d) => d < day)
      .sort()
      .pop()

  const shownTrades = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = tradesInRange.filter(
      (t) =>
        (tradeTab === 'all' ||
          (tradeTab === 'sale' && t.type === 'sell') ||
          (tradeTab === 'purchase' && t.type === 'buy') ||
          (tradeTab === 'trade' && t.type === 'trade')) &&
        (!q || `${nameOf(t)} ${t.user ?? ''}`.toLowerCase().includes(q))
    )
    const dir = oldestFirst ? 1 : -1
    return list.sort((a, b) =>
      tradeSort === 'platinum'
        ? dir * (a.platinum * a.quantity - b.platinum * b.quantity)
        : dir * (a.at - b.at)
    )
  }, [tradesInRange, tradeTab, query, oldestFirst, tradeSort, nameOf])
  const relicsTotal = inRange.reduce((n, d) => n + history[d].relicsOpened, 0)
  const lastRecord = Object.keys(history).sort().pop()

  const thisYear = new Date().getFullYear()
  const thisMonth = today.slice(0, 7) // 'YYYY-MM' in UTC
  const years = [thisYear, thisYear - 1, thisYear - 2]
  const balance = BALANCES.find((b) => b.id === panel)

  const activity: { id: Panel; label: string; icon: string }[] = [
    { id: 'days', label: 'Days recorded', icon: '⧖' },
    { id: 'relics', label: 'Relics opened', icon: '◈' },
    { id: 'trades', label: 'Total trades', icon: '⇄' }
  ]
  const panelTitle =
    activity.find((x) => x.id === panel)?.label ?? BALANCES.find((x) => x.id === panel)?.label ?? ''
  const tile = (active: boolean): string =>
    `rounded-xl border px-4 py-2 text-left ${
      active
        ? 'border-violet-400/70 bg-[#2a3a66]'
        : 'border-slate-700 bg-slate-900/40 hover:bg-slate-800'
    }`

  return (
    <div className="flex h-full flex-col p-4 text-slate-100">
      <div
        className={`grid min-h-0 flex-1 grid-cols-1 gap-4 ${hideTrades ? '' : 'min-[1100px]:grid-cols-[minmax(0,1fr)_21rem] min-[1100px]:grid-rows-[minmax(0,1fr)]'}`}
      >
        {/* left column */}
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className="shrink-0">
            <NcCard title="Date range">
              <div className={`${card} shrink-0 p-3`}>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="nc-name text-lg font-bold">Date range</h2>
                  <span className="text-xs text-slate-300">{inRange.length} recorded days</span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Dropdown
                      value={range}
                      onChange={setRange}
                      options={RANGES.map((r) => ({ value: r, label: r }))}
                    />
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className={field}
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className={field}
                    />
                  </div>
                </div>

                <div className="mb-1.5 mt-2.5 flex items-center justify-between text-sm">
                  <b>Recorded activity</b>
                  <span className="text-xs text-slate-300">Totals in selected range</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {activity.map((a) => (
                    <NcCard key={a.id} title={a.label} active={panel === a.id}>
                      <button onClick={() => setPanel(a.id)} className={tile(panel === a.id)}>
                        <div className="nc-name flex items-center gap-2 text-sm font-semibold">
                          <span>{a.icon}</span>
                          {a.label}
                        </div>
                        <div className="text-xl font-bold leading-tight">
                          {a.id === 'days'
                            ? inRange.length
                            : a.id === 'relics'
                              ? relicsTotal.toLocaleString()
                              : tradesInRange.length.toLocaleString()}
                        </div>
                      </button>
                    </NcCard>
                  ))}
                </div>

                <div className="mb-1.5 mt-2.5 flex items-center justify-between text-sm">
                  <b>Balance history</b>
                  <span className="text-xs text-slate-300">Choose a graph</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {BALANCES.map((b) => (
                    <NcCard key={b.id} title={b.label} active={panel === b.id}>
                      <button
                        onClick={() => setPanel(b.id)}
                        className={`${tile(panel === b.id)} py-1.5`}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <CurrencyIcon id={b.id} glyph={b.icon} />
                          <span className="nc-name">{b.label}</span>
                          <span
                            className="ml-auto text-sm font-bold"
                            title="Latest in range · click for the graph"
                          >
                            {latestOf(b.id)}
                          </span>
                        </span>
                      </button>
                    </NcCard>
                  ))}
                </div>
              </div>
            </NcCard>
          </div>

          {/* detail panel */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <NcCard title={panelTitle}>
              <div className={`${card} @container flex min-h-0 flex-1 flex-col p-5`}>
                {panel === 'days' ? (
                  <>
                    <div className="mb-1 flex items-center justify-between">
                      <h2 className="nc-name flex items-center gap-2 text-lg font-bold">
                        <span className="text-lg">⧖</span> Days recorded
                      </h2>
                    </div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-baseline gap-3">
                        <span className="text-2xl font-bold">{inRange.length}</span>
                        <span className="text-sm text-slate-300">
                          Recorded days in selected range
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-2 text-slate-200">
                          Group by
                          <Dropdown
                            size="sm"
                            value={group}
                            onChange={(v) => setGroup(v as typeof group)}
                            options={[
                              { value: 'Daily', label: 'Daily' },
                              { value: 'Monthly', label: 'Monthly' }
                            ]}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-slate-200">
                          Year
                          <Dropdown
                            size="sm"
                            value={String(year)}
                            onChange={(v) => setYear(Number(v))}
                            options={years.map((y) => ({ value: String(y), label: String(y) }))}
                          />
                        </label>
                      </div>
                    </div>
                    <p className="mb-2 text-xs text-slate-400">
                      Hover for a summary, click for activity details. Dates use UTC.
                    </p>

                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                      {group === 'Daily' && (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] items-start gap-3">
                          {/* from the month of the first record up to the month we are in now */}
                          {MONTHS.map((_, m) => m)
                            .filter((m) => {
                              const ym = `${year}-${String(m + 1).padStart(2, '0')}`
                              const first = Object.keys(history).sort()[0]?.slice(0, 7) ?? thisMonth
                              return ym >= first && ym <= thisMonth
                            })
                            .map((m) => (
                              <MonthGrid
                                key={m}
                                year={year}
                                month={m}
                                days={history}
                                traded={tradesByDay}
                                onHover={(d, at) => setHover(d && at ? { day: d, at } : null)}
                                onPick={setPicked}
                              />
                            ))}
                        </div>
                      )}
                      {group === 'Monthly' && (
                        <div className="grid grid-cols-3 gap-3 @2xl:grid-cols-4">
                          {MONTHS.map((m, i) => (
                            <span
                              key={m}
                              className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-4 text-center text-xs text-slate-300"
                            >
                              {m.slice(0, 3)}
                              <b className="mt-1 block text-lg text-slate-100">
                                {
                                  Object.keys(history).filter((d) =>
                                    d.startsWith(`${year}-${String(i + 1).padStart(2, '0')}`)
                                  ).length
                                }
                              </b>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
                      <span>
                        {inRange.length} recorded days in range{' '}
                        <span className="ml-3">
                          Last record:{' '}
                          {lastRecord
                            ? new Date(`${lastRecord}T00:00:00Z`).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                timeZone: 'UTC'
                              })
                            : 'none'}
                        </span>
                      </span>
                      <span className="flex items-center gap-4">
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 rounded border border-violet-300 bg-violet-500/80" />{' '}
                          Recorded
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 rounded border border-slate-600 bg-slate-900" />{' '}
                          No record
                        </span>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="nc-name mb-4 text-lg font-bold">
                      {panel === 'relics'
                        ? 'Relics opened'
                        : panel === 'trades'
                          ? 'Total trades'
                          : `${balance?.label} balance history`}
                    </h2>
                    {panel === 'trades' && tradesInRange.length > 0 ? (
                      <BalanceChart
                        days={Object.keys(tradesPerDay).sort()}
                        value={(d) => tradesPerDay[d]}
                        label="Trades"
                        total={tradesInRange.length}
                      />
                    ) : panel === 'trades' || inRange.length === 0 ? (
                      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-600 text-center text-sm text-slate-300">
                        <div>
                          <div className="mb-1 font-semibold text-slate-100">No data yet</div>
                          {panel === 'trades'
                            ? 'No trades in this range. Press Sold on My Orders, or import an AlecaFrame export.'
                            : 'Nothing is recorded in this range yet. Rows are added each time your inventory refreshes.'}
                        </div>
                      </div>
                    ) : panel === 'relics' ? (
                      <BalanceChart
                        days={inRange}
                        value={(d) => history[d].relicsOpened}
                        label="Relics opened"
                        total={relicsTotal}
                      />
                    ) : (
                      // balances are levels over time: a line chart, counts stay bars
                      <BalanceChart
                        days={inRange}
                        value={(d) => Number(history[d][panel as keyof DayStat] ?? 0)}
                        label={balance?.label ?? ''}
                      />
                    )}
                  </>
                )}
              </div>
            </NcCard>
          </div>
        </div>

        {/* trade history (folds away with Hide trades) */}
        {!hideTrades && (
          <div className="flex min-h-0 flex-col">
            <NcCard title="Trade history" className="min-h-0 flex-1">
              <div className={`${card} flex min-h-0 flex-1 flex-col p-4`}>
                <div className="mb-3 flex gap-0.5">
                  {TRADE_TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTradeTab(t.id)}
                      style={{ letterSpacing: '0.02em' }}
                      className={`flex flex-auto items-center justify-center gap-0.5 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-[11px] ${
                        tradeTab === t.id
                          ? 'bg-slate-700/70 font-semibold text-white ring-1 ring-slate-500'
                          : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Icon
                        name={t.icon}
                        size={13}
                        className={t.id === 'all' ? 'text-violet-300' : ''}
                      />
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="mb-3 flex gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
                    <Icon name="search" className="text-slate-300" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search"
                      className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
                    />
                    <button
                      onClick={() => setQuery('')}
                      title="Clear search"
                      className="text-slate-400 hover:text-white"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 text-sm">
                    <button
                      onClick={() => setOldestFirst((o) => !o)}
                      title={
                        oldestFirst
                          ? 'Oldest first (click for newest first)'
                          : 'Newest first (click for oldest first)'
                      }
                      className="text-slate-300 hover:text-white"
                    >
                      <Icon name="sort" className={oldestFirst ? '-scale-y-100' : ''} />
                    </button>
                    <Dropdown
                      size="sm"
                      value={tradeSort}
                      onChange={(v) => setTradeSort(v as 'date' | 'platinum')}
                      options={[
                        { value: 'date', label: 'Date' },
                        { value: 'platinum', label: 'Platinum' }
                      ]}
                    />
                  </div>
                </div>
                {shownTrades.length ? (
                  <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                    {shownTrades.map((t) => (
                      <TradeRow
                        key={`${t.at}-${t.itemId}-${t.name ?? ''}`}
                        t={t}
                        name={nameOf(t)}
                        icon={iconOf(t)}
                        iconByName={iconByName}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="flex min-h-40 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-600 p-4 text-center text-sm text-slate-300">
                    {trades.length
                      ? tradeTab === 'trade'
                        ? 'No item-for-item trades in this range.'
                        : 'No trades match.'
                      : 'No trades recorded yet.'}
                  </div>
                )}
              </div>
            </NcCard>
          </div>
        )}
      </div>
      {hover && (
        <DayHover
          day={hover.day}
          at={hover.at}
          stat={history[hover.day]}
          prev={history[prevDay(hover.day) ?? '']}
          trades={tradesByDay[hover.day]?.length ?? 0}
        />
      )}
      {picked && (
        <DayDetail
          day={picked}
          stat={history[picked]}
          prev={prevDay(picked)}
          history={history}
          trades={tradesByDay[picked] ?? []}
          nameOf={nameOf}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  )
}

const longDate = (day: string): string =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
const signed = (n: number): string => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString())
const tone = (n: number): string => (n > 0 ? 'text-emerald-300' : n < 0 ? 'text-rose-300' : '')

// Hover card on a calendar day: what was recorded that day.
function DayHover({
  day,
  at,
  stat,
  prev,
  trades
}: {
  day: string
  at: DOMRect
  stat?: DayStat
  prev?: DayStat
  trades: number
}): React.JSX.Element {
  const change = stat && prev ? stat.platinum - prev.platinum : null
  const row = 'flex justify-between gap-6'
  // drawn in <main>, outside the page panel: its cut-corner clip would cut this off
  return createPortal(
    <section
      className="pointer-events-none fixed z-50 w-60 rounded-lg text-sm shadow-xl bg-[#170710]"
      style={{ left: Math.min(at.left, window.innerWidth - 250), top: at.bottom + 6 }}
    >
      <NcCard title={longDate(day)}>
        <div className="px-3 py-2">
          <div className="nc-name mb-2 font-bold">{longDate(day)}</div>
          <div className={row}>
            <span>Days recorded</span>
            <b>{stat ? 1 : 0}</b>
          </div>
          <div className={row}>
            <span>Relics opened</span>
            <b>{stat?.relicsOpened ?? 0}</b>
          </div>
          <div className={row}>
            <span>Total trades</span>
            <b>{trades}</b>
          </div>
          <div className={row}>
            <span>Platinum change</span>
            <b className={tone(change ?? 0)}>
              {change == null || change === 0 ? '–' : signed(change)}
            </b>
          </div>
          <div className="mt-2 text-xs text-slate-400">Click for balances and trade details</div>
        </div>
      </NcCard>
    </section>,
    document.querySelector('main') ?? document.body
  )
}

// Click on a calendar day: balances against the previous recorded day, and the trades of that day.
function DayDetail({
  day,
  stat,
  prev,
  history,
  trades,
  nameOf,
  onClose
}: {
  day: string
  stat?: DayStat
  prev?: string
  history: Record<string, DayStat>
  trades: Trade[]
  nameOf: (t: Trade) => string
  onClose: () => void
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const from = prev ? history[prev] : undefined
  const box = 'rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3'
  // drawn in <main>, outside the page panel: its cut-corner clip would cut this off
  return createPortal(
    <section
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Activity on ${longDate(day)}`}
        onClick={(e) => e.stopPropagation()}
        className="nc-dialog-card w-full max-w-3xl rounded-lg bg-[#1b1e2b] text-slate-100"
      >
        <NcCard title={longDate(day)}>
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex items-start justify-between border-b border-slate-700 px-6 py-4">
              <div>
                <div className="nc-name text-xl font-bold">{longDate(day)}</div>
                <div className="text-xs text-slate-400">Recorded activity</div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg border border-slate-600 px-2.5 py-1 hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ['Days recorded', stat ? 1 : 0],
                    ['Relics opened', stat?.relicsOpened ?? 0],
                    ['Total trades', trades.length]
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className={box}>
                    <div className="text-xs text-slate-300">{label}</div>
                    <div className="text-2xl font-bold">{value}</div>
                  </div>
                ))}
              </div>

              <div className={box}>
                <div className="mb-2 font-bold">Balance changes</div>
                {(stat?.mr != null || stat?.completion != null) && (
                  <div className="mb-2 flex gap-6 text-sm text-slate-300">
                    {stat?.mr != null && (
                      <span>
                        Mastery rank <b className="text-slate-100">{stat.mr}</b>
                      </span>
                    )}
                    {stat?.completion != null && (
                      <span>
                        Prime completion <b className="text-slate-100">{stat.completion}%</b>
                      </span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-x-3 border-b border-slate-700 pb-1 text-xs text-slate-400">
                  <span>Currency</span>
                  <span className="text-right">From</span>
                  <span className="text-right">To</span>
                  <span className="text-right">Change</span>
                </div>
                {BALANCES.map((b) => {
                  const key = b.id as keyof DayStat
                  const a = from?.[key]
                  const z = stat?.[key]
                  const diff = a != null && z != null ? z - a : null
                  return (
                    <div
                      key={b.id}
                      className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-x-3 border-b border-slate-800 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <CurrencyIcon id={b.id} glyph={b.icon} />
                        {b.label}
                      </span>
                      <span className="text-right">
                        {a != null ? a.toLocaleString() : '–'}
                        {prev && (
                          <span className="block text-[11px] text-slate-400">{longDate(prev)}</span>
                        )}
                      </span>
                      <span className="text-right">
                        {z != null ? z.toLocaleString() : '–'}
                        {stat && (
                          <span className="block text-[11px] text-slate-400">{longDate(day)}</span>
                        )}
                      </span>
                      <span className={`text-right font-bold ${tone(diff ?? 0)}`}>
                        {diff == null || diff === 0 ? '–' : signed(diff)}
                      </span>
                    </div>
                  )
                })}
                <p className="mt-2 text-xs text-slate-400">
                  Changes are against the previous recorded day and include gains and spending. A
                  dash means there is nothing to compare.
                </p>
              </div>

              <div>
                <div className="mb-2 font-bold">
                  Trade details <span className="text-slate-400">{trades.length}</span>
                </div>
                {trades.length === 0 && (
                  <p className="text-sm text-slate-400">No trades recorded this day.</p>
                )}
                <div className="space-y-2">
                  {[...trades]
                    .sort((a, b) => b.at - a.at)
                    .map((t) => {
                      const { gave, got } = tradeSides(t, nameOf(t))
                      const kind =
                        t.type === 'sell' ? 'Sale' : t.type === 'buy' ? 'Purchase' : 'Trade'
                      const text = (side: TradeStack[]): string =>
                        side
                          .map(
                            (i) =>
                              `${i.count}× ${i.name}${i.rank != null ? ` (rank ${i.rank})` : ''}`
                          )
                          .join(', ')
                      return (
                        <div key={`${t.at}-${t.itemId}-${t.name ?? ''}`} className={box}>
                          <div className="mb-2 flex justify-between border-b border-slate-700 pb-2 text-sm">
                            <b>
                              {kind}
                              {t.user ? ` with ${cleanName(t.user)}` : ''}
                            </b>
                            <span className="text-slate-300">
                              {new Date(t.at).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-slate-400">Gave</div>
                              <div className="font-semibold">{text(gave)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400">Received</div>
                              <div className="font-semibold">{text(got)}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>
        </NcCard>
      </div>
    </section>,
    document.querySelector('main') ?? document.body
  )
}

// Simple bar chart: one bar per recorded day, hover for the date and value.
// game platform glyphs sit in the private-use range and show as boxes
const cleanName = (n: string): string => n.replace(/[\uE000-\uF8FF]/g, '').trim()

// One traded "slot": an item picture (or platinum) with its count in the corner. A set shows as a
// small fanned stack of cards with a SET tag, so it reads as several parts at a glance.
function TradeSlot({
  icon,
  count,
  plat,
  set,
  title
}: {
  icon?: string
  count: number
  plat?: boolean
  set?: boolean
  title: string
}): React.JSX.Element {
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0" title={title}>
      {set && (
        <>
          <span className="absolute inset-0 -rotate-12 rounded-md border border-slate-600 bg-slate-800" />
          <span className="absolute inset-0 rotate-6 rounded-md border border-slate-600 bg-slate-800" />
        </>
      )}
      <span className="relative flex h-full w-full items-center justify-center rounded-md border border-slate-600 bg-slate-900">
        {plat ? (
          <PlatIcon size={22} />
        ) : icon ? (
          <img loading="lazy" src={icon} alt="" className="h-8 w-8 object-contain" />
        ) : (
          <span className="text-xs font-bold text-slate-400">{title.slice(0, 2)}</span>
        )}
      </span>
      {set && (
        <span className="absolute -left-1 -top-1.5 rounded bg-amber-400 px-1 text-[8px] font-black leading-3 text-black">
          SET
        </span>
      )}
      <span className="absolute -bottom-1 -right-1 rounded bg-black/80 px-1 text-[10px] font-bold leading-4 text-white">
        {count}
      </span>
    </span>
  )
}

// A trade in the history list: partner and type, what you gave ⇄ what you got, platinum and time.
// Both sides of a trade as stacks. Imported trades and swaps carry their full lists; trades made
// in the app are one item for platinum.
function tradeSides(t: Trade, name: string): { gave: TradeStack[]; got: TradeStack[] } {
  const total = Math.round(t.platinum * t.quantity)
  const plat = (n?: number): TradeStack[] => (n ? [{ name: 'Platinum', count: n }] : [])
  if (t.gave || t.got)
    return {
      gave: [...(t.gave ?? []), ...plat(t.platGave)],
      got: [...(t.got ?? []), ...plat(t.platGot)]
    }
  const item = [{ name, count: t.quantity }]
  return t.type === 'sell' ? { gave: item, got: plat(total) } : { gave: plat(total), got: item }
}

// A trade in the history list: partner and kind, what you gave ⇄ what you got, platinum and time.
function TradeRow({
  t,
  name,
  icon,
  iconByName
}: {
  t: Trade
  name: string
  icon?: string
  iconByName: (name: string) => string | undefined
}): React.JSX.Element {
  const total = Math.round(t.platinum * t.quantity)
  const { gave, got } = tradeSides(t, name)
  const kind = t.type === 'sell' ? 'Sale' : t.type === 'buy' ? 'Purchase' : 'Trade'
  const badge =
    t.type === 'sell'
      ? 'bg-emerald-500/20 text-emerald-300'
      : t.type === 'buy'
        ? 'bg-rose-500/20 text-rose-300'
        : 'bg-violet-500/25 text-violet-200'
  const slot = (i: TradeStack, k: number): React.JSX.Element =>
    i.name === 'Platinum' ? (
      <TradeSlot key={k} plat count={i.count} title={`${i.count} platinum`} />
    ) : (
      <TradeSlot
        key={k}
        icon={i.picture ?? iconByName(i.name) ?? (t.gave ? undefined : icon)}
        count={i.count}
        set={/ set$/i.test(i.name)}
        title={`${i.name}${i.rank != null ? ` (rank ${i.rank})` : ''}`}
      />
    )
  return (
    <li className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-semibold normal-case">
          {t.user ? cleanName(t.user) : 'Unknown player'}
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${badge}`}>
          {kind}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex flex-wrap gap-2">{gave.map(slot)}</span>
        <span className="text-slate-400">⇄</span>
        <span className="flex flex-wrap gap-2">{got.map(slot)}</span>
        {t.type !== 'trade' && (
          <span
            className={`ml-auto flex shrink-0 items-center gap-1 font-bold ${t.type === 'sell' ? 'text-emerald-300' : 'text-rose-300'}`}
          >
            {t.type === 'sell' ? '+' : '−'}
            {total}
            <PlatIcon size={12} />
          </span>
        )}
      </div>
      {t.type !== 'trade' && <div className="mt-1 truncate text-xs text-slate-300">{name}</div>}
      <div className="text-[11px] text-slate-400">
        {new Date(t.at).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </li>
  )
}

// A balance over time: a line with a filled area, a value scale with three gridlines, month
// labels, a crosshair that shows the date and value under the mouse, and above it the latest
// value, the change over the range and the highest value. Drawn as one SVG shape, so it stays
// sharp for any number of days (bars of a few pixels merged into a block on long histories).
function BalanceChart({
  days: rawDays,
  value,
  label,
  total
}: {
  days: string[]
  value: (day: string) => number
  label: string
  total?: number // counts per day (relics, trades): summary shows the total instead
}): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  const days = rawDays
  const vals = rawDays.map(value)
  const n = vals.length
  const top = total != null ? countTop(Math.max(0, ...vals)) : niceTop(Math.max(0, ...vals))
  const W = 1000
  const H = 200
  const x = (i: number): number => (n > 1 ? (i / (n - 1)) * W : W / 2)
  const y = (v: number): number => H - (v / top) * H
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = n ? `${line} L${x(n - 1)} ${H} L${x(0)} ${H} Z` : ''
  const last = vals[n - 1] ?? 0
  const change = last - (vals[0] ?? 0)
  const peak = vals.reduce((b, v, i) => (v > vals[b] ? i : b), 0)
  const fmt = (v: number): string => v.toLocaleString()
  // weeks from the first to the last day (at least one), for the per-week average
  const weeks = n
    ? Math.max(1, (Date.parse(days[n - 1]) - Date.parse(days[0])) / 6048e5 + 1 / 7)
    : 1
  // the scale has a fixed width (so the month labels line up): 20M, 2.5K
  const short = (v: number): string =>
    v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${+(v / 1e3).toFixed(1)}K` : fmt(v)
  const pct = (i: number): string => `${(x(i) / W) * 100}%`
  const onMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setHover(n > 1 ? Math.round(f * (n - 1)) : 0)
  }
  return (
    <div>
      {total != null ? (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{fmt(total)}</span>
            <span className="text-sm text-slate-300">Total in selected range</span>
          </span>
          {n > 0 && (
            <>
              <span className="text-sm font-semibold text-[#5ef6ff]">
                ≈ {fmt(Math.round(total / weeks))} / week
              </span>
              <span className="text-sm text-slate-300">
                Most in a day {fmt(vals[peak])} on {niceDate(days[peak])}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{fmt(last)}</span>
            <span className="text-sm text-slate-300">Latest balance</span>
          </span>
          {n > 1 && (
            <span
              className={`text-sm font-semibold ${change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
            >
              {change >= 0 ? '+' : '−'}
              {fmt(Math.abs(change))} since {niceDate(days[0])}
            </span>
          )}
          {n > 0 && (
            <span className="text-sm text-slate-300">
              Highest {fmt(vals[peak])} on {niceDate(days[peak])}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        {/* value scale */}
        <div className="flex h-80 w-14 shrink-0 flex-col justify-between py-2 text-right text-[11px] text-slate-400">
          <span>{short(top)}</span>
          <span>{short(top / 2)}</span>
          <span>0</span>
        </div>
        <div
          className="relative h-80 min-w-0 flex-1 overflow-hidden bg-black/20"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-x-0 inset-y-2 h-[calc(100%-1rem)] w-full"
            aria-label={`${label} over time`}
          >
            {[0, H / 2, H].map((g) => (
              <line
                key={g}
                x1={0}
                x2={W}
                y1={g}
                y2={g}
                stroke="#ffffff"
                strokeOpacity={0.08}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={area} fill="#50d8e0" fillOpacity={0.18} />
            <path
              d={line}
              fill="none"
              stroke="#5ef6ff"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {hover != null && n > 0 && (
            <>
              <span
                className="pointer-events-none absolute inset-y-0 w-px bg-[#5ef6ff]/70"
                style={{ left: pct(hover) }}
              />
              <span
                className="pointer-events-none absolute top-2 whitespace-nowrap rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
                style={
                  x(hover) > W / 2
                    ? { right: `calc(100% - ${pct(hover)} + 8px)` }
                    : { left: `calc(${pct(hover)} + 8px)` }
                }
              >
                <span className="text-slate-400">{niceDate(days[hover])}</span>{' '}
                <b>
                  {fmt(vals[hover])} {label}
                </b>
              </span>
            </>
          )}
        </div>
      </div>
      {/* month labels, placed under the first recorded day of each month */}
      <div className="relative ml-16 mt-1 h-4 text-[11px] text-slate-400">
        {monthTicks(days).map((t) => (
          <span
            key={t.i}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: pct(t.i) }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}
