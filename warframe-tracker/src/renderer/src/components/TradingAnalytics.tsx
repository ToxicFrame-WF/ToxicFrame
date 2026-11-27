import Dropdown from './Dropdown'
import NcCard from './NcCard'
import { useEffect, useMemo, useState } from 'react'
import Pic from './Pic'
import { useNow } from '../hooks/useWorldState'
import { useItemMeta } from '../hooks/useItemMeta'
import { usePersisted } from '../hooks/usePersisted'
import { requestPrices, usePriceStore } from '../hooks/priceStore'
import { clock } from '../clock'
import { tradeStats, type Flip, type Trade } from '../tradeStats'
import Icon from './Icon'
import WikiIcon from './WikiIcon'
import HoverCard from './HoverCard'
import PlatIcon from './PlatIcon'

// Trading > Analytics, from the app's trade log (Sold on My Orders and AlecaFrame imports).
// Market activity lives in MarketActivity.tsx and borrows the small parts exported here.

const card = 'rounded-2xl border border-slate-700 bg-slate-800/50'
// category -> wiki picture (names verified 2026-11-24); Other keeps a drawn "?"
const CAT_ICON: Record<string, string> = {
  Sets: 'MarketFancyPrimeVaultIcon(xWhite).png',
  Arcanes: 'IconArcane(xWhite).png',
  Rivens: 'RivenIcon64.png',
  Relics: 'LithRelicIntact.png',
  Mods: 'FindMod(xWhite).png',
  'Prime parts': 'PrimeAccessIcon(xWhite).png'
}
const CATEGORIES = ['Sets', 'Arcanes', 'Other', 'Rivens', 'Relics', 'Mods', 'Prime parts']

// the trades behind one resold item, for its hover card
function FlipHistory({ f }: { f: Flip }): React.JSX.Element {
  const day = (t: number): string =>
    new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' })
  const shown = f.trades.slice(-10)
  // a set row's part buys: name the part without the set's own prefix
  const part = (name: string): string => name.replace(f.name.slice(0, -3), '')
  return (
    <div className="flex flex-col text-sm !normal-case !tracking-normal">
      {shown.map((e, i) => (
        <div
          key={i}
          className="grid grid-cols-[4.5rem_3.25rem_minmax(0,1fr)_3.5rem] items-baseline gap-x-2 border-b border-white/5 py-1.5"
        >
          <span className="text-xs !normal-case !tracking-normal text-slate-400">{day(e.at)}</span>
          <b className={e.type === 'buy' ? 'text-rose-300' : 'text-emerald-300'}>
            {e.type === 'buy' ? 'Bought' : 'Sold'}
          </b>
          <span
            className="truncate text-xs !normal-case !tracking-normal text-slate-400"
            title={e.item}
          >
            ×{e.quantity}
            {e.item ? ` · ${part(e.item)}` : f.parts ? ' · set' : ''}
          </span>
          <span className="text-right font-semibold text-slate-100">
            {Math.round(e.platinum).toLocaleString()} p
          </span>
        </div>
      ))}
      {f.trades.length > shown.length && (
        <span className="pt-1.5 text-xs !normal-case !tracking-normal text-slate-400">
          +{f.trades.length - shown.length} older
        </span>
      )}
      <span className="mt-3 text-xs !normal-case !tracking-normal text-slate-400">
        {f.parts
          ? `Paid ${Math.round(f.buyAvg * f.units)} p for ${f.parts.reduce((a, x) => a + x.units, 0)} bought parts, sold ${f.units} set${f.units === 1 ? '' : 's'} for ${Math.round(f.sellAvg * f.units)} p. Parts you farmed count as free.`
          : `Profit: ${f.units} bought and sold, ${Math.round(f.buyAvg)} → ${Math.round(f.sellAvg)} p each.`}
      </span>
    </div>
  )
}

function CatIcon({ cat }: { cat: string }): React.JSX.Element {
  const file = CAT_ICON[cat]
  return file ? (
    <WikiIcon file={file} title={cat} color="#cbd5e1" size={18} />
  ) : (
    <span className="w-[18px] text-center text-slate-400">?</span>
  )
}

// AlecaFrame names a trade of several items "First item +N": say so, and keep the
// first item's name for its picture
const bundle = (name: string): { base: string; label: string } => {
  const m = / \+(\d+)$/.exec(name)
  return m
    ? { base: name.slice(0, m.index), label: `${name.slice(0, m.index)} and ${m[1]} more` }
    : { base: name, label: name }
}

// A small "Sort by" select: quieter than a button so it doesn't compete with the numbers.
function SortBox({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: string[]
  value?: string
  onChange?: (v: string) => void
}): React.JSX.Element {
  const [own, setOwn] = useState(options[0])
  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      {label}
      <Dropdown
        size="sm"
        value={value ?? own}
        onChange={onChange ?? setOwn}
        options={options.map((o) => ({ value: o, label: o }))}
      />
    </label>
  )
}

export function SearchBox({
  value,
  onChange
}: {
  value?: string
  onChange?: (v: string) => void
}): React.JSX.Element {
  const [own, setOwn] = useState('')
  const query = value ?? own
  const set = onChange ?? setOwn
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
      <span className="text-slate-400">⌕</span>
      <input
        value={query}
        onChange={(e) => set(e.target.value)}
        placeholder="Search"
        aria-label="Search"
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
      />
      {query && (
        <button
          onClick={() => set('')}
          title="Clear search"
          className="text-slate-400 hover:text-slate-200"
        >
          <Icon name="trash" />
        </button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border-t border-slate-700 px-5 py-10 text-center text-sm text-slate-300">
      {children}
    </div>
  )
}

export function Plat({ value }: { value: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2">
      {value}
      <PlatIcon size={18} />
    </span>
  )
}

// SVG path through the points as a curve that never overshoots them (monotone cubic,
// Fritsch-Carlson): flat stretches stay flat, no invented dips or peaks.
function smooth(p: number[][]): string {
  const n = p.length
  const sec = p.slice(1).map((q, i) => (q[1] - p[i][1]) / (q[0] - p[i][0]))
  const tan = p.map((_, i) => {
    const a = sec[i - 1] ?? sec[i]
    const b = sec[i] ?? sec[i - 1]
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b)
  })
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = (p[i + 1][0] - p[i][0]) / 3
    d += ` C${p[i][0] + h},${p[i][1] + tan[i] * h} ${p[i + 1][0] - h},${p[i + 1][1] - tan[i + 1] * h} ${p[i + 1][0]},${p[i + 1][1]}`
  }
  return d
}

// Cumulative net (line) and platinum traded (bars) per time bucket between from and to.
function NetChart({
  trades,
  from,
  to
}: {
  trades: Trade[]
  from: number
  to: number
}): React.JSX.Element | null {
  const { net, vol } = useMemo(() => {
    const n = Math.max(1, Math.min(60, Math.ceil((to - from) / DAY)))
    const size = (to - from) / n || 1
    const net = new Array<number>(n).fill(0)
    const vol = new Array<number>(n).fill(0)
    for (const t of trades) {
      if (t.type === 'trade') continue
      const i = Math.min(n - 1, Math.max(0, Math.floor((t.at - from) / size)))
      const total = t.platinum * t.quantity
      vol[i] += total
      net[i] += t.type === 'sell' ? total : -total
    }
    for (let i = 1; i < n; i++) net[i] += net[i - 1]
    return { net, vol }
  }, [trades, from, to])
  if (!vol.some(Boolean)) return null
  const lo = Math.min(0, ...net)
  const span = Math.max(...net, 0) - lo || 1
  const maxVol = Math.max(...vol) || 1
  const w = 100 / net.length
  const y = (v: number): number => 4 + (1 - (v - lo) / span) * 52
  const day = (t: number): string =>
    new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' })
  const up = net[net.length - 1] >= 0
  return (
    <>
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="h-56 w-full"
        role="img"
        aria-label={`Net platinum went from 0 to ${Math.round(net[net.length - 1])} in this period`}
      >
        {vol.map((v, i) => (
          <rect
            key={i}
            x={i * w + w * 0.15}
            width={w * 0.7}
            y={60 - (v / maxVol) * 22}
            height={(v / maxVol) * 22}
            fill="rgba(148,163,184,0.18)"
          />
        ))}
        <line
          x1="0"
          x2="100"
          y1={y(0)}
          y2={y(0)}
          stroke="rgba(255,255,255,0.12)"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={smooth(net.map((v, i) => [i * w + w / 2, y(v)]))}
          fill="none"
          stroke={up ? '#3fa9b0' : '#fda4af'}
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-xs !normal-case !tracking-normal text-slate-400">
        <span>{day(from)}</span>
        <span>{day((from + to) / 2)}</span>
        <span>{day(to)}</span>
      </div>
    </>
  )
}

const PERIODS = { week: '7 days', month: '30 days', quarter: '90 days', all: 'All time' } as const
const PERIOD_DAYS = { week: 7, month: 30, quarter: 90, all: 0 }
export type Period = keyof typeof PERIODS

// the Period switch, shown in the screen header next to the page title
export function PeriodSelect({
  value,
  onChange
}: {
  value: Period
  onChange: (p: Period) => void
}): React.JSX.Element {
  return (
    <div className="flex border border-white/15" role="group" aria-label="Period">
      {(Object.keys(PERIODS) as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className={`px-4 py-2 text-sm font-semibold ${
            value === p
              ? 'bg-[#3fa9b0]/20 text-[#6fd0d6] shadow-[inset_0_-2px_0_#3fa9b0]'
              : 'nc-quiet text-slate-300 hover:text-white'
          }`}
        >
          {PERIODS[p]}
        </button>
      ))}
    </div>
  )
}
const DAY = 86_400_000
const SHOWN = 10 // ranking rows before "Show all"
const HELD_DAYS = 90 // older purchases were most likely used, not kept to resell
const MIN_SALES = 10 // fewer sales make the busiest time a guess
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Insight({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <NcCard title={title}>
      <div
        className={`${card} flex h-full flex-col justify-center gap-1 p-4 text-sm !normal-case !tracking-normal`}
      >
        {children}
      </div>
    </NcCard>
  )
}

export function YourTrading({ period }: { period: Period }): React.JSX.Element {
  const [picked, setRanking] = usePersisted<'sales' | 'purchases' | 'partners' | 'flips' | null>(
    'Trading.ranking',
    null
  )
  const tabs = [
    { id: 'flips', label: 'Resold', icon: '⇄' },
    { id: 'sales', label: 'Sales', icon: '↘' },
    { id: 'purchases', label: 'Purchases', icon: '↗' },
    { id: 'partners', label: 'Partners', icon: '♙' }
  ] as const
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('Total platinum')
  const [showAll, setShowAll] = useState(false)
  const meta = useItemMeta()
  const prices = usePriceStore()
  const now = useNow(60_000)
  const [trades, setTrades] = useState<Trade[]>([])
  useEffect(() => {
    window.api.getTrades().then(setTrades)
  }, [])
  const len = PERIOD_DAYS[period] * DAY
  const from = useMemo(
    () => (period === 'all' ? Math.min(now, ...trades.map((t) => t.at)) : now - len),
    [period, now, len, trades]
  )
  // set contents from the market scan: how many of each part a set needs (Dual Kamas Prime Blade x2)
  const [setParts, setSetParts] = useState<MarketStats['sets']>({})
  useEffect(() => {
    window.api.getMarketStats().then((m) => setSetParts(m.sets))
  }, [])
  const look = useMemo(() => {
    const byId = new Map(Object.values(meta).map((e) => [e.id, e]))
    const need = new Map<string, number>()
    for (const parts of Object.values(setParts))
      for (const p of parts) if (meta[p.slug]) need.set(meta[p.slug].name, p.qty)
    return {
      itemOf: (id: string) => byId.get(id),
      perSet: (part: string) => need.get(part) ?? 1
    }
  }, [meta, setParts])
  const inRange = useMemo(() => trades.filter((t) => t.at >= from), [trades, from])
  const stats = useMemo(() => tradeStats(inRange, look.itemOf, look.perSet), [inRange, look])
  // the period before this one, for the "vs before" line
  const before = useMemo(
    () =>
      period === 'all'
        ? undefined
        : tradeStats(
            trades.filter((t) => t.at >= from - len && t.at < from),
            look.itemOf,
            look.perSet
          ),
    [trades, from, len, period, look]
  )
  // what you hold is about every trade, not the period
  const held = useMemo(
    () =>
      tradeStats(
        trades.filter((t) => t.at >= now - HELD_DAYS * DAY),
        look.itemOf,
        look.perSet
      ).held,
    [trades, look, now]
  )
  // imported trades carry no warframe.market id: find their picture and slug by name
  const byName = useMemo(
    () => new Map(Object.entries(meta).map(([slug, e]) => [e.name.toLowerCase(), { ...e, slug }])),
    [meta]
  )
  const heldSlugs = useMemo(
    () => held.map((h) => byName.get(h.name.toLowerCase())?.slug),
    [held, byName]
  )
  useEffect(() => {
    requestPrices(heldSlugs.filter((s): s is string => !!s))
  }, [heldSlugs])
  // shortcut: unranked price for mods / arcanes bought at a rank, fine for an estimate
  let worth = 0
  let priced = 0
  held.forEach((h, i) => {
    const p = prices.get(heldSlugs[i])
    if (p && p !== 'error' && p.price != null) {
      worth += p.price * h.units
      priced += h.paid
    }
  })

  const ranking = picked ?? (stats.flips.length ? 'flips' : 'sales')
  const fmt = (n: number): string => Math.round(n).toLocaleString()
  const net = stats.received - stats.spent
  const priceTrades = inRange.filter((t) => t.type !== 'trade').length
  // margin from single-item resells only: set rows count farmed parts as free, so their
  // percentage says "you farmed" rather than "you sold well"; they show up as profit instead
  const single = stats.flips.filter((f) => !f.parts)
  const setRows = stats.flips.filter((f) => f.parts)
  const flipBuy = single.reduce((a, f) => a + f.units * f.buyAvg, 0)
  const flipMargin = flipBuy ? single.reduce((a, f) => a + f.profit, 0) / flipBuy : undefined
  const setProfit = setRows.reduce((a, f) => a + f.profit, 0)
  const setsSold = setRows.reduce((a, f) => a + f.units, 0)
  const delta = before ? net - (before.received - before.spent) : undefined
  const lastDays = stats.lastAt != null ? Math.floor((now - stats.lastAt) / DAY) : undefined
  const bestFlip = stats.flips[0]

  // categories with any platinum, best net first
  const cats = CATEGORIES.map((label) => ({ label, v: stats.byCategory[label] }))
    .filter((c) => c.v && (c.v.received || c.v.spent))
    .map((c) => ({ ...c, net: c.v!.received - c.v!.spent }))
    .sort((a, b) => b.net - a.net)
  const maxNet = Math.max(1, ...cats.map((c) => Math.abs(c.net)))

  const q = query.trim().toLowerCase()
  const rows = (
    ranking === 'flips'
      ? stats.flips.map((f) => ({
          name: f.name,
          icon: f.icon,
          quantity: f.units,
          platinum: f.profit,
          f
        }))
      : (ranking === 'sales'
          ? stats.topSales
          : ranking === 'purchases'
            ? stats.topPurchases
            : stats.topPartners
        ).map((r) => ({ ...r, f: undefined }))
  )
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .sort((a, b) =>
      sortBy === 'Quantity' || sortBy === 'Trades'
        ? b.quantity - a.quantity
        : b.platinum - a.platinum
    )
  const visible = showAll || q ? rows : rows.slice(0, SHOWN)
  const cols =
    ranking === 'flips'
      ? 'grid-cols-[minmax(0,1fr)_6rem_6rem_5rem_7rem]'
      : 'grid-cols-[minmax(0,1fr)_7rem_7rem]'
  const small = (label: string, value: React.ReactNode, cls = ''): React.JSX.Element => (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs !normal-case !tracking-normal text-slate-400">{label}</span>
      <span className={`text-xl font-bold ${cls}`}>{value}</span>
    </div>
  )
  const sign = (n: number): string => (n > 0 ? '+' : '')

  return (
    <div className="flex flex-col gap-4 p-4 text-slate-100">
      <div className="grid grid-cols-1 gap-4 min-[1000px]:grid-cols-[22rem_minmax(0,1fr)]">
        <NcCard title={'Net platinum'}>
          <div className={`${card} flex h-full flex-col gap-2 p-5`}>
            <span
              className={`text-5xl font-bold ${net < 0 ? 'text-rose-300' : net > 0 ? 'text-emerald-300' : ''}`}
            >
              <Plat value={`${sign(net)}${fmt(net)}`} />
            </span>
            <span className="text-sm !normal-case !tracking-normal text-slate-300">
              {delta != null
                ? delta === 0
                  ? `Same as the ${PERIODS[period]} before`
                  : `${fmt(Math.abs(delta))} p ${delta > 0 ? 'more' : 'less'} than the ${PERIODS[period]} before`
                : lastDays == null
                  ? 'No trades yet'
                  : lastDays === 0
                    ? 'Last trade today'
                    : `Last trade ${lastDays} day${lastDays === 1 ? '' : 's'} ago`}
            </span>
            <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
              {small('Received', <Plat value={fmt(stats.received)} />)}
              {small('Spent', <Plat value={fmt(stats.spent)} />)}
              {small('Trades', priceTrades)}
              {small(
                'Avg resell margin',
                flipMargin == null ? '—' : `${sign(flipMargin)}${Math.round(flipMargin * 100)}%`,
                (flipMargin ?? 0) < 0 ? 'text-rose-300' : 'text-[#6fd0d6]'
              )}
              {setsSold > 0 && (
                <span className="col-span-2 text-xs !normal-case !tracking-normal text-slate-400">
                  Sets from parts:{' '}
                  <b className={setProfit < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                    {sign(setProfit)}
                    {fmt(setProfit)} p
                  </b>{' '}
                  profit on {setsSold} set{setsSold === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
        </NcCard>
        <NcCard title={'Net over time'}>
          <div className={`${card} flex h-full flex-col justify-center gap-2 p-5`}>
            <div className="flex gap-4 text-xs !normal-case !tracking-normal text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 bg-[#3fa9b0]" /> Net, added up
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2 bg-slate-400/30" /> Platinum traded
              </span>
            </div>
            {priceTrades ? (
              <NetChart trades={inRange} from={from} to={now} />
            ) : (
              <div className="py-10 text-center text-sm text-slate-300">
                No trades in this period.
              </div>
            )}
          </div>
        </NcCard>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-3">
        <Insight title="Best resell">
          {bestFlip ? (
            <>
              <b className="truncate text-base text-slate-100">{bundle(bestFlip.name).label}</b>
              <span className="text-slate-300">
                {bestFlip.parts ? 'Parts' : 'Bought'} {fmt(bestFlip.buyAvg)} p →{' '}
                {bestFlip.parts ? 'set' : 'sold'} {fmt(bestFlip.sellAvg)} p ·{' '}
                <span className={bestFlip.profit < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                  {sign(bestFlip.profit)}
                  {fmt(bestFlip.profit)} p
                </span>
              </span>
            </>
          ) : (
            <span className="text-slate-300">No item you both bought and sold in this period.</span>
          )}
        </Insight>
        <Insight title="Bought, not resold yet">
          {held.length ? (
            <>
              <b className="text-base text-slate-100">
                {held.reduce((a, h) => a + h.units, 0)} items ·{' '}
                {fmt(held.reduce((a, h) => a + h.paid, 0))} p paid in the last {HELD_DAYS} days
              </b>
              <span className="text-slate-300">
                {priced ? (
                  <>
                    Priced ones worth ~{fmt(worth)} p today ·{' '}
                    <span className={worth < priced ? 'text-rose-300' : 'text-emerald-300'}>
                      {sign(worth - priced)}
                      {fmt(worth - priced)} p if sold
                    </span>
                  </>
                ) : (
                  'Loading today’s prices…'
                )}
              </span>
            </>
          ) : (
            <span className="text-slate-300">
              Everything you bought in the last {HELD_DAYS} days has been sold again.
            </span>
          )}
        </Insight>
        <Insight title="Busiest time">
          {stats.busiest && stats.busiest.sales >= MIN_SALES ? (
            <>
              <b className="text-base text-slate-100">
                {WEEKDAYS[stats.busiest.day]} · {clock(stats.busiest.hour * 3600)}–
                {clock(((stats.busiest.hour + 3) % 24) * 3600)}
              </b>
              <span className="text-slate-300">
                {Math.round((stats.busiest.count / stats.busiest.sales) * 100)}% of your sales (
                {stats.busiest.count} of {stats.busiest.sales}) in this period
              </span>
            </>
          ) : (
            <span className="text-slate-300">Needs at least {MIN_SALES} sales in this period.</span>
          )}
        </Insight>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-[24rem_minmax(0,1fr)]">
        <NcCard title={'Net by category'}>
          <div className={`${card} flex h-full flex-col gap-3 p-5`}>
            {cats.map((c) => (
              <div
                key={c.label}
                className="grid grid-cols-[7rem_minmax(0,1fr)_6rem] items-center gap-3 text-sm"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <CatIcon cat={c.label} />
                  {c.label}
                </span>
                <span
                  className="h-2 bg-slate-900"
                  title={`Received ${fmt(c.v!.received)} p, spent ${fmt(c.v!.spent)} p`}
                >
                  <span
                    className={`block h-full ${c.net < 0 ? 'bg-rose-300' : 'bg-[#3fa9b0]'}`}
                    style={{ width: `${(Math.abs(c.net) / maxNet) * 100}%` }}
                  />
                </span>
                <span
                  className={`text-right font-semibold ${c.net < 0 ? 'text-rose-300' : 'text-emerald-300'}`}
                >
                  {sign(c.net)}
                  {fmt(c.net)}
                </span>
              </div>
            ))}
            {cats.length ? (
              <span className="mt-auto pt-2 text-xs !normal-case !tracking-normal text-slate-400">
                Red = spent more than earned. Hover for both sides.
              </span>
            ) : (
              <div className="py-10 text-center text-sm text-slate-300">
                No trades in this period.
              </div>
            )}
          </div>
        </NcCard>

        <NcCard title={'Trade rankings'}>
          <div className={`${card} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex gap-1.5">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setRanking(t.id)
                      setShowAll(false)
                      setSortBy(t.id === 'partners' ? 'Trades' : 'Total platinum')
                    }}
                    aria-pressed={ranking === t.id}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                      ranking === t.id
                        ? 'border-[#3fa9b0] bg-[#3fa9b0]/20 text-[#6fd0d6]'
                        : 'nc-quiet border-white/15 bg-transparent text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              <SearchBox value={query} onChange={setQuery} />
              <SortBox
                label="Sort by"
                value={sortBy}
                onChange={setSortBy}
                options={
                  ranking === 'partners'
                    ? ['Trades', 'Total platinum']
                    : ['Total platinum', 'Quantity']
                }
              />
            </div>
            <div
              className={`grid ${cols} gap-3 border-t border-slate-700 bg-slate-900/40 px-5 py-2 text-xs text-slate-300`}
            >
              <span>{ranking === 'partners' ? 'Player' : 'Item'}</span>
              {ranking === 'flips' ? (
                <>
                  <span className="text-right">Avg buy</span>
                  <span className="text-right">Avg sell</span>
                  <span className="text-right">Margin</span>
                  <span className="text-right">Profit</span>
                </>
              ) : (
                <>
                  <span className="text-right">{ranking === 'partners' ? '' : 'Average'}</span>
                  <span className="text-right">Total</span>
                </>
              )}
            </div>
            <ul>
              {visible.map((t) => {
                const rowCls = `grid ${cols} items-center gap-3 border-t border-slate-700/70 px-5 py-2 text-sm`
                const cells = (
                  <>
                    <span className="flex min-w-0 items-center gap-2.5">
                      {ranking !== 'partners' && (
                        <Pic
                          src={t.icon ?? byName.get(bundle(t.name).base.toLowerCase())?.icon ?? ''}
                          size={24}
                          letter={t.name[0]}
                        />
                      )}
                      <span className="truncate font-semibold" title={t.name}>
                        {ranking === 'partners' ? t.name : bundle(t.name).label}
                      </span>
                      {t.f?.parts && (
                        <span className="shrink-0 border border-[#3fa9b0]/50 px-1 text-xs text-[#6fd0d6]">
                          from parts
                        </span>
                      )}
                      <span className="shrink-0 text-slate-400">
                        {ranking === 'partners'
                          ? `${t.quantity} trade${t.quantity === 1 ? '' : 's'}`
                          : `×${t.quantity}`}
                      </span>
                    </span>
                    {t.f ? (
                      <>
                        <span className="text-right text-slate-300">{fmt(t.f.buyAvg)}</span>
                        <span className="text-right text-slate-300">{fmt(t.f.sellAvg)}</span>
                        <span
                          className={`text-right ${t.f.profit < 0 ? 'text-rose-300' : 'text-[#6fd0d6]'}`}
                        >
                          {t.f.buyAvg && !t.f.parts
                            ? `${sign(t.f.sellAvg - t.f.buyAvg)}${Math.round((t.f.sellAvg / t.f.buyAvg - 1) * 100)}%`
                            : '—'}
                        </span>
                      </>
                    ) : (
                      <span className="text-right text-slate-300">
                        {ranking === 'partners' ? '' : `${fmt(t.platinum / t.quantity)} each`}
                      </span>
                    )}
                    <span
                      className={`text-right font-semibold ${t.f ? (t.platinum < 0 ? 'text-rose-300' : 'text-emerald-300') : ''}`}
                    >
                      <Plat value={fmt(t.platinum)} />
                    </span>
                  </>
                )
                return t.f ? (
                  <HoverCard
                    key={t.name}
                    title={bundle(t.name).label}
                    side="cursor"
                    content={<FlipHistory f={t.f} />}
                    className={rowCls}
                  >
                    {cells}
                  </HoverCard>
                ) : (
                  <li key={t.name} className={rowCls}>
                    {cells}
                  </li>
                )
              })}
            </ul>
            {rows.length > visible.length && (
              <button
                onClick={() => setShowAll(true)}
                className="nc-quiet w-full border-t border-slate-700 py-2.5 text-sm text-[#6fd0d6] hover:text-white"
              >
                Show all {rows.length}
              </button>
            )}
            {rows.length === 0 && (
              <Empty>
                {q
                  ? 'Nothing matches that search.'
                  : ranking === 'partners'
                    ? 'No partners yet. Import an AlecaFrame export in Settings to fill this.'
                    : ranking === 'flips'
                      ? 'No item you both bought and sold in this period.'
                      : trades.length
                        ? 'No trades in this period.'
                        : 'No trades recorded yet. Press Sold on My Orders to record one.'}
              </Empty>
            )}
          </div>
        </NcCard>
      </div>
    </div>
  )
}
