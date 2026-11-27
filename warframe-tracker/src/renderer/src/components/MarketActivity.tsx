import { useEffect, useMemo, useState } from 'react'
import NcCard from './NcCard'
import Pic from './Pic'
import PlatIcon from './PlatIcon'
import { Empty, Plat, SearchBox } from './TradingAnalytics'
import { useItemMeta } from '../hooks/useItemMeta'
import { usePersisted } from '../hooks/usePersisted'
import { flips, liquidity, movers, setDeals } from '../marketTools'
import { useNow } from '../hooks/useWorldState'
import { updateSettings, useSettings } from '../settings'

// Trading > Market activity: tools for finding trades, from a background scan of every
// warframe.market item's statistics (src/main/marketScan.ts).
const card = 'rounded-2xl border border-slate-700 bg-slate-800/50'
const SHOWN = 25
const TABS = [
  {
    id: 'sets',
    label: 'Set vs parts',
    icon: '⚙',
    about:
      'Buy every part at its lowest sell order, sell the set at this week’s median price. Profit before your time.'
  },
  {
    id: 'flips',
    label: 'Flip finder',
    icon: '⇄',
    about:
      'Gap between the best buy order and the lowest sell order, on items selling 3+ a day: place a buy order just above, resell just under.'
  },
  {
    id: 'movers',
    label: 'Movers',
    icon: '↕',
    about:
      'This week’s median sale price against the 90-day one. Rising: a good time to sell. Falling: wait, or buy cheap.'
  },
  {
    id: 'liquid',
    label: 'Liquidity',
    icon: '≋',
    about: 'Platinum changing hands per day (price × sales). Items here sell fast.'
  }
] as const
type Tab = (typeof TABS)[number]['id']

interface Row {
  slug: string
  cells: React.ReactNode[]
  nums: number[] // the same columns as numbers, for sorting
  parts?: { slug: string; qty: number }[] // set rows
}

// open an item in the right panel's Buy / Sell tab (App listens for this)
const openInBuySell = (slug: string): void => {
  window.dispatchEvent(new CustomEvent('toxicframe:compare', { detail: { slug } }))
}

// an item's picture and name; clicking opens it in Buy / Sell
function ItemButton({
  slug,
  name,
  icon,
  small
}: {
  slug: string
  name: string
  icon?: string
  small?: boolean
}): React.JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <button
        onClick={(e) => {
          e.stopPropagation() // inside a set row, which opens its parts on click
          openInBuySell(slug)
        }}
        title="Open in Buy / Sell"
        className="nc-quiet flex min-w-0 items-center gap-2.5 border-0 bg-transparent p-0 text-left !normal-case !tracking-normal text-slate-100 hover:text-[#6fd0d6]"
      >
        <Pic src={icon ?? ''} size={small ? 20 : 24} letter={name[0]} />
        <span className={`truncate ${small ? '' : 'font-semibold'}`}>{name}</span>
      </button>
      {/* opens in the browser (the window-open handler only lets https pages out) */}
      <a
        href={`https://warframe.market/items/${slug}/statistics`}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="Price history on warframe.market"
        aria-label={`${name} price history on warframe.market`}
        className="shrink-0 px-1 text-slate-400 hover:text-[#6fd0d6]"
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      </a>
    </span>
  )
}

// live check result next to a name: profit from online players' orders, or "gone"
function LiveTag({ deal, now }: { deal?: LiveDeal; now: number }): React.JSX.Element | null {
  if (!deal) return null
  const ago = Math.max(0, Math.round((now - deal.at) / 60_000))
  const when = ago < 1 ? 'just now' : `${ago} min ago`
  if (deal.profit == null)
    return (
      <span
        title={`Nobody online sells ${deal.kind === 'set' ? 'every part or the set' : 'this'} right now (checked ${when})`}
        className="shrink-0 border border-white/15 px-1 text-xs !normal-case !tracking-normal text-slate-400"
      >
        gone
      </span>
    )
  return (
    <span
      title={`${deal.kind === 'set' ? `Online now: parts ${deal.buy} p, list the set at ${deal.sell} p` : `Online now: buy order at ${deal.buy} p, resell at ${deal.sell} p`} (checked ${when})`}
      className={`inline-flex shrink-0 items-center gap-1 border px-1 text-xs !normal-case !tracking-normal ${deal.profit > 0 ? 'border-emerald-400/50 text-emerald-300' : 'border-rose-400/50 text-rose-300'}`}
    >
      live {deal.profit > 0 ? '+' : ''}
      {deal.profit}
      <PlatIcon size={12} /> · {when}
    </span>
  )
}

export function MarketActivity(): React.JSX.Element {
  const meta = useItemMeta()
  const [stats, setStats] = useState<MarketStats | null>(null)
  const [progress, setProgress] = useState<MarketProgress | null>(null)
  const [tab, setTab] = usePersisted<Tab>('Market.tab', 'sets')
  const [rising, setRising] = usePersisted('Market.rising', true)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState<string | null>(null) // set row showing its parts
  const [sort, setSort] = useState<{ tab: Tab; col: number; desc: boolean } | null>(null)
  const [live, setLive] = useState<Record<string, LiveDeal>>({})
  const settings = useSettings()
  // the threshold to restore when deal alerts are switched back on
  const [lastDeal, setLastDeal] = usePersisted('Market.lastDealAlert', 30)
  const dealsOn = settings.dealAlert > 0
  const now = useNow(60_000)
  useEffect(() => {
    void window.api.getLiveDeals().then(setLive)
    return window.api.onLiveDeals(setLive)
  }, [])
  const liveOf = (slug: string): LiveDeal | undefined =>
    tab === 'sets' ? live[`set:${slug}`] : tab === 'flips' ? live[`flip:${slug}`] : undefined

  useEffect(() => {
    const load = (): void => void window.api.getMarketStats().then(setStats)
    load()
    void window.api.startMarketScan() // does nothing when the data is fresh or a scan runs
    return window.api.onMarketProgress((p) => {
      setProgress(p)
      load()
    })
  }, [])

  const items = stats?.items ?? {}
  const name = (slug: string): string => meta[slug]?.name ?? slug.replace(/_/g, ' ')
  const fmt = (n: number): string => Math.round(n).toLocaleString()
  const perDay = (n: number): string => (n >= 10 ? fmt(n) : n.toFixed(1))

  const rows: Row[] = useMemo(() => {
    if (tab === 'sets')
      return setDeals(stats?.sets ?? {}, items).map((d) => ({
        slug: d.slug,
        cells: [fmt(d.partsCost), fmt(d.setPrice), d.profit, perDay(d.vol7)],
        nums: [d.partsCost, d.setPrice, d.profit, d.vol7],
        parts: stats?.sets[d.slug]
      }))
    if (tab === 'flips')
      return flips(items).map((f) => ({
        slug: f.slug,
        cells: [fmt(f.buy), fmt(f.sell), f.margin, perDay(f.vol7)],
        nums: [f.buy, f.sell, f.margin, f.vol7]
      }))
    if (tab === 'movers')
      return movers(items)
        .filter((m) => (rising ? m.change > 0 : m.change < 0))
        .map((m) => ({
          slug: m.slug,
          cells: [fmt(m.med90), fmt(m.med7), m.change, perDay(m.vol7)],
          nums: [m.med90, m.med7, m.change, m.vol7]
        }))
    return liquidity(items).map((l) => ({
      slug: l.slug,
      cells: [fmt(l.price), perDay(l.vol7), l.value, ''],
      nums: [l.price, l.vol7, l.value, 0]
    }))
  }, [tab, stats, items, rising]) // eslint-disable-line react-hooks/exhaustive-deps

  const heads =
    tab === 'sets'
      ? ['Parts cost', 'Set sells for', 'Profit', 'Sales / day']
      : tab === 'flips'
        ? ['Buy at', 'Sell at', 'Margin', 'Sales / day']
        : tab === 'movers'
          ? ['90-day price', 'This week', 'Change', 'Sales / day']
          : ['Price', 'Sales / day', 'Plat / day', '']
  const q = query.trim().toLowerCase()
  const matched = q ? rows.filter((r) => name(r.slug).toLowerCase().includes(q)) : rows
  // a clicked column header sorts by it (again: the other way); none = the tool's own order
  // live-checked rows first, best live profit first (gone ones after); then the scan's order
  const liveRank = (slug: string): number => {
    const l = liveOf(slug)
    return !l ? -Infinity : l.profit == null ? -1e9 : l.profit
  }
  const found =
    sort && sort.tab === tab
      ? [...matched].sort((a, b) => (a.nums[sort.col] - b.nums[sort.col]) * (sort.desc ? -1 : 1))
      : tab === 'sets' || tab === 'flips'
        ? [...matched].sort((a, b) => liveRank(b.slug) - liveRank(a.slug))
        : matched
  const visible = showAll || q ? found : found.slice(0, SHOWN)
  const scanned = Object.keys(items).length
  const scanning = progress?.scanning ?? stats?.scanning ?? false
  const done = progress?.done ?? stats?.done ?? 0
  const total = progress?.total ?? stats?.total ?? 0
  // ~0.45 s per item at the scan's pace (wfmFetch spacing plus the reply)
  const minutesLeft = Math.ceil(((total - done) * 0.45) / 60)
  const about = TABS.find((t) => t.id === tab)!.about

  const value = (i: number, v: React.ReactNode): React.ReactNode => {
    if (typeof v !== 'number') return v
    if (tab === 'movers')
      return (
        <span className={v < 0 ? 'text-rose-300' : 'text-emerald-300'}>
          {v > 0 ? '+' : ''}
          {Math.round(v * 100)}%
        </span>
      )
    return (
      <span className={i === 2 && v < 0 ? 'text-rose-300' : i === 2 ? 'text-emerald-300' : ''}>
        <Plat value={`${i === 2 && v > 0 && tab !== 'liquid' ? '+' : ''}${fmt(v)}`} />
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 text-slate-100">
      <NcCard title={'Market scan'}>
        <div
          className={`${card} flex flex-wrap items-center gap-4 p-4 text-sm !normal-case !tracking-normal`}
        >
          {scanning ? (
            <>
              <span className="text-slate-200">
                Scanning warframe.market: {fmt(done)} of {fmt(total)}
                {total > done ? ` · about ${minutesLeft} min left` : ''}
              </span>
              <span className="h-1.5 min-w-40 flex-1 bg-slate-900">
                <span
                  className="block h-full bg-[#3fa9b0]"
                  style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                />
              </span>
            </>
          ) : (
            <span className="text-slate-300">
              {scanned
                ? `${fmt(scanned)} items scanned. Refreshed once a day while the app runs.`
                : 'No market data yet.'}
            </span>
          )}
          <label className="flex items-center gap-2 text-slate-300">
            <button
              role="switch"
              aria-checked={dealsOn}
              aria-label="Live deal notifications"
              onClick={(e) => {
                e.preventDefault()
                if (dealsOn) setLastDeal(settings.dealAlert)
                updateSettings({ dealAlert: dealsOn ? 0 : lastDeal || 30 })
              }}
              className={`nc-quiet relative h-6 w-11 shrink-0 rounded-full border-0 transition-colors ${dealsOn ? 'bg-cyan-600' : 'bg-slate-700'}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${dealsOn ? 'translate-x-5' : ''}`}
              />
            </button>
            Notify me about live deals with a profit of at least
            <input
              type="number"
              min={0}
              disabled={!dealsOn}
              value={dealsOn ? settings.dealAlert : lastDeal}
              onChange={(e) =>
                updateSettings({ dealAlert: Math.max(0, Math.floor(Number(e.target.value)) || 0) })
              }
              aria-label="Minimum live deal profit in platinum (0 turns it off)"
              className="w-16 border border-white/15 bg-slate-900 px-2 py-1 text-right outline-none disabled:opacity-50"
            />
            <PlatIcon size={16} />
          </label>
          <span className="text-xs !normal-case !tracking-normal text-slate-400">
            The top 10 of Set vs parts and Flip finder are re-priced from online players every 10
            minutes (the “live” tags). Lists fill in while the scan runs. Order prices are the best
            listed in the last hour, online or not: check live orders before trading.
          </span>
        </div>
      </NcCard>

      <NcCard title={'Find trades'}>
        <div className={`${card} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTab(t.id)
                    setShowAll(false)
                  }}
                  aria-pressed={tab === t.id}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                    tab === t.id
                      ? 'border-[#3fa9b0] bg-[#3fa9b0]/20 text-[#6fd0d6]'
                      : 'nc-quiet border-white/15 bg-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'movers' && (
              <div className="flex border border-white/15" role="group" aria-label="Direction">
                {[true, false].map((up) => (
                  <button
                    key={String(up)}
                    onClick={() => setRising(up)}
                    aria-pressed={rising === up}
                    className={`px-3 py-1.5 text-sm font-semibold ${
                      rising === up
                        ? 'bg-[#3fa9b0]/20 text-[#6fd0d6]'
                        : 'nc-quiet text-slate-300 hover:text-white'
                    }`}
                  >
                    {up ? '▲ Rising' : '▼ Falling'}
                  </button>
                ))}
              </div>
            )}
            <SearchBox value={query} onChange={setQuery} />
          </div>
          <p className="px-5 pb-3 text-sm !normal-case !tracking-normal text-slate-300">{about}</p>
          <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_6rem] gap-3 border-t border-slate-700 bg-slate-900/40 px-5 py-2 text-xs text-slate-300">
            <span>Item</span>
            {heads.map((h, i) => {
              const on = sort?.tab === tab && sort.col === i
              return h ? (
                <button
                  key={i}
                  onClick={() => setSort({ tab, col: i, desc: on ? !sort.desc : true })}
                  aria-label={`Sort by ${h}${on ? (sort.desc ? ', now highest first' : ', now lowest first') : ''}`}
                  className={`nc-quiet justify-self-end border-0 bg-transparent p-0 text-right text-xs hover:text-white ${on ? 'text-[#6fd0d6]' : 'text-slate-300'}`}
                >
                  {h} {on ? (sort.desc ? '▼' : '▲') : ''}
                </button>
              ) : (
                <span key={i} />
              )
            })}
          </div>
          {visible.map((r) => (
            <div key={r.slug} className="border-t border-slate-700/70">
              {/* a set row opens its parts anywhere it is clicked; the ▸ button does it from the keyboard */}
              <div
                onClick={r.parts ? () => setOpen(open === r.slug ? null : r.slug) : undefined}
                className={`grid grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_6rem] items-center gap-3 px-5 py-2 text-sm ${r.parts ? 'cursor-pointer hover:bg-white/5' : ''}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {r.parts && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpen(open === r.slug ? null : r.slug)
                      }}
                      aria-expanded={open === r.slug}
                      aria-label={`${open === r.slug ? 'Hide' : 'Show'} the parts of ${name(r.slug)}`}
                      title="Show the parts"
                      className="nc-quiet flex size-7 shrink-0 items-center justify-center border border-white/15 text-slate-300 hover:text-white"
                    >
                      {open === r.slug ? '▾' : '▸'}
                    </button>
                  )}
                  <ItemButton slug={r.slug} name={name(r.slug)} icon={meta[r.slug]?.icon} />
                  <LiveTag deal={liveOf(r.slug)} now={now} />
                </span>
                {r.cells.map((c, i) => (
                  <span key={i} className="text-right text-slate-300">
                    {value(i, c)}
                  </span>
                ))}
              </div>
              {open === r.slug &&
                r.parts?.map((p) => {
                  const st = items[p.slug]
                  return (
                    <div
                      key={p.slug}
                      className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_6rem] items-center gap-3 bg-slate-900/40 py-1.5 pl-16 pr-5 text-sm"
                    >
                      <ItemButton
                        slug={p.slug}
                        name={`${name(p.slug)}${p.qty > 1 ? ` ×${p.qty}` : ''}`}
                        icon={meta[p.slug]?.icon}
                        small
                      />
                      <span className="text-right text-slate-300">
                        {st?.low != null ? fmt(st.low * p.qty) : '—'}
                      </span>
                      <span />
                      <span />
                      <span className="text-right text-slate-400">
                        {st ? perDay(st.vol7) : '—'}
                      </span>
                    </div>
                  )
                })}
            </div>
          ))}
          {found.length > visible.length && (
            <button
              onClick={() => setShowAll(true)}
              className="nc-quiet w-full border-t border-slate-700 py-2.5 text-sm text-[#6fd0d6] hover:text-white"
            >
              Show all {found.length}
            </button>
          )}
          {found.length === 0 && (
            <Empty>
              {q
                ? 'Nothing matches that search.'
                : scanning
                  ? 'Nothing here yet. The list fills in as the scan reaches these items.'
                  : 'Nothing matches right now.'}
            </Empty>
          )}
        </div>
      </NcCard>
    </div>
  )
}
