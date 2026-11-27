import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import NcCard from './NcCard'
import WikiIcon from './WikiIcon'
import ModCard, { type CardData } from './ModCard'
import { RELATIONS, rankProgress, sacrifice, title } from '../syndicates'
import type { SyndicateRow } from './SyndicateScreen'
import PlatIcon from './PlatIcon'

const RED = '#ff4d5a'
const CYAN = '#50d8e0'
const YELLOW = '#f5d742'

interface Shop {
  name: string
  image?: string
  slug?: string
  kind: ShopKind
  card?: CardData
  cost?: number // standing
  rank?: number
  plat?: number | null
}
// where the drop data names a syndicate differently (The Hex has no shop data; Cavia and Entrati come from the wiki lists in syndicateWares.ts)
const SHOP_NAME: Record<string, string> = { Ostrons: 'Ostron', Necraloid: 'NecraLoid' }
let shopCache: Promise<Record<string, Shop[]>> | null = null

export function Bar({ pct, color }: { pct: number; color: string }): React.JSX.Element {
  return (
    <span className="block h-1 w-full bg-white/10">
      <span
        className="block h-full"
        style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, background: color }}
      />
    </span>
  )
}

export function Line({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-2">
      <span className="uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-right font-semibold text-slate-100">{value}</span>
    </div>
  )
}

// Left column of the syndicate screen once a syndicate is picked: progress, today's standing,
// rank-up sacrifice, what standing here does to the others, medallions and the shop's best buys.
export default function SyndicateDetail({
  row,
  rows,
  today,
  cap,
  medals,
  universal,
  onBack
}: {
  row: SyndicateRow
  rows: SyndicateRow[]
  today: number
  cap: number
  medals?: { count: number; standing: number }
  universal: number
  onBack: () => void
}): React.JSX.Element {
  const [shop, setShop] = useState<Shop[] | null>(null)
  const [shopOpen, setShopOpen] = useState(false)
  const prog = row.rank < 5 ? rankProgress(row.rank, row.standing) : undefined
  const next = sacrifice(row.tag, row.rank + 1)
  const name = (tag: string): string =>
    rows.find((r) => r.tag === tag)?.name ?? tag.replace('Syndicate', '')

  useEffect(() => {
    let live = true
    shopCache ??= window.api.getSyndicateShop()
    shopCache.then(async (all) => {
      // drop data names Ostrons "Ostron"
      const list = all[SHOP_NAME[row.name] ?? row.name] ?? []
      // only prices already cached here; the pop-up fetches the rest while it is open, so
      // browsing syndicates doesn't queue hundreds of market lookups
      const cached = new Map((await window.api.getCachedPrices()).map((p) => [p.slug, p.price]))
      if (!live) return
      setShop(
        list
          .map((s) => (s.slug && cached.has(s.slug) ? { ...s, plat: cached.get(s.slug) } : s))
          .sort((a, b) => (b.plat ?? -1) - (a.plat ?? -1))
      )
    })
    return () => {
      live = false
    }
  }, [row.name])

  return (
    <div className="min-h-0 space-y-4 overflow-y-auto pr-1 pt-2 text-xs">
      <button
        onClick={onBack}
        className="cursor-pointer uppercase tracking-widest text-slate-400 hover:text-white"
      >
        ‹ Overview
      </button>
      <div>
        <div className="text-lg font-bold uppercase tracking-wider" style={{ color: CYAN }}>
          {row.name}
        </div>
        <div className="uppercase tracking-widest" style={{ color: row.rank >= 5 ? YELLOW : CYAN }}>
          Rank {row.rank}
          {title(row.tag, row.rank) ? ` · ${title(row.tag, row.rank)}` : ''}
        </div>
      </div>

      <div className="space-y-1.5">
        <Line label="Standing" value={row.standing.toLocaleString()} />
        {prog && (
          <>
            <Bar pct={prog.pct} color={CYAN} />
            <Line label="To next rank" value={prog.toNext.toLocaleString()} />
          </>
        )}
        <Line label="Gained today" value={`${today.toLocaleString()} / ${cap.toLocaleString()}`} />
      </div>

      {next && (
        <Section title={`Rank-up to ${row.rank + 1}`}>
          <Line label="Items" value={next.items} />
          <Line label="Credits" value={next.credits.toLocaleString()} />
        </Section>
      )}

      {RELATIONS[row.tag] && (
        <Section title="Per 1,000 standing here">
          {Object.entries(RELATIONS[row.tag]).map(([tag, share]) => (
            <div key={tag} className="flex justify-between">
              <span className="uppercase tracking-wider text-slate-400">{name(tag)}</span>
              <span className="font-semibold" style={{ color: share > 0 ? CYAN : RED }}>
                {share > 0 ? '+' : ''}
                {(share * 1000).toLocaleString()}
              </span>
            </div>
          ))}
        </Section>
      )}

      {(medals || RELATIONS[row.tag]) && (
        <Section title="Medallions">
          <Line
            label="Own"
            value={`${medals?.count ?? 0} = ${(medals?.standing ?? 0).toLocaleString()} standing`}
          />
          <Line label="Universal" value={`${universal} = ${(universal * 1000).toLocaleString()}`} />
        </Section>
      )}

      <Section title="Shop">
        {!shop && <span className="text-slate-500">Loading…</span>}
        {shop?.length === 0 && <span className="text-slate-500">No shop data.</span>}
        {shop && shop.length > 0 && (
          <button
            onClick={() => setShopOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-600 px-3 py-2 text-left hover:bg-slate-800"
          >
            <span>Open shop · {shop.length} items</span>
            {shop[0].plat != null && (
              <span className="flex items-center gap-1 font-semibold" style={{ color: YELLOW }}>
                up to {Math.round(shop[0].plat)}
                <PlatIcon size={11} />
              </span>
            )}
          </button>
        )}
      </Section>
      {shopOpen && shop && (
        <ShopDialog name={row.name} items={shop} onClose={() => setShopOpen(false)} />
      )}
    </div>
  )
}

function Section({
  title: heading,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-1.5 border-t pt-3" style={{ borderColor: `${RED}55` }}>
      <div className="font-bold uppercase tracking-widest" style={{ color: RED }}>
        {heading}
      </div>
      {children}
    </div>
  )
}

// "Rank 3 · 20,000 standing", where the wiki list gave it
const wareNote = (s: Shop): string =>
  [s.rank != null ? `Rank ${s.rank}` : '', s.cost ? `${s.cost.toLocaleString()} standing` : '']
    .filter(Boolean)
    .join(' · ')

// shop tabs with their wiki icons, in this order (only the ones the shop has are shown)
const TABS: (readonly [ShopKind, string, string])[] = [
  ['Mods', 'IconAugment(xWhite).png', 'Mods'],
  ['Arcanes', 'IconArcane(xWhite).png', 'Arcanes'],
  ['Weapons', 'IconCategoryRifle(xWhite).png', 'Weapons'],
  ['Blueprints', 'IconCrafted(xWhite).png', 'Blueprints'],
  ['Other', 'IconBundle(xWhite).png', 'Other']
]

// The syndicate's whole shop in a pop-up: a searchable grid, most valuable first (market price).
function ShopDialog({
  name,
  items: initial,
  onClose
}: {
  name: string
  items: Shop[]
  onClose: () => void
}): React.JSX.Element {
  const [q, setQ] = useState('')
  const [items, setItems] = useState(initial)
  // prices come one at a time (rate-limited market queue): re-sort as each one arrives;
  // a failed lookup ends as null ("—") so "fetching prices…" can finish
  useEffect(() => {
    let live = true
    initial.forEach((s) => {
      if (!s.slug || s.plat !== undefined) return
      window.api
        .getPrice(s.slug)
        .then((p) => p.price)
        .catch(() => null)
        .then((plat) => {
          if (!live) return
          setItems((cur) =>
            cur
              .map((x) => (x.name === s.name ? { ...x, plat } : x))
              .sort((a, b) => (b.plat ?? -1) - (a.plat ?? -1))
          )
        })
    })
    return () => {
      live = false
    }
  }, [initial])
  const [tab, setTab] = useState<ShopKind | 'All'>('All')
  const kinds = TABS.filter((t) => items.some((s) => s.kind === t[0]))
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const shown = items.filter(
    (s) => (tab === 'All' || s.kind === tab) && s.name.toLowerCase().includes(q.toLowerCase())
  )
  const pricing = items.some((s) => s.slug && s.plat === undefined)
  return createPortal(
    <section
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${name} shop`}
        onClick={(e) => e.stopPropagation()}
        className="nc-dialog-card flex max-h-[80vh] w-full max-w-6xl flex-col rounded-lg bg-[#1b1e2b] text-slate-100"
      >
        <NcCard title={`${name} shop`} className="min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the shop"
                className="w-full max-w-xs rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-sm outline-none placeholder:text-slate-400"
              />
              <span className="text-xs text-slate-400">
                {shown.length} items{pricing ? ' · fetching prices…' : ''}
              </span>
              <button
                onClick={onClose}
                className="ml-auto rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            {kinds.length > 1 && (
              <div className="flex flex-wrap gap-1" role="tablist">
                {[['All', 'IconInfinity(xWhite).png', 'All'] as const, ...kinds].map(
                  ([k, icon, label]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={tab === k}
                      onClick={() => setTab(k)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${tab === k ? 'border-violet-400/60 bg-violet-500/20 text-white' : 'border-transparent text-slate-300 hover:bg-slate-800'}`}
                    >
                      <WikiIcon file={icon} title={label} color="currentColor" size={16} />
                      {label}
                      <span className="text-xs text-slate-400">
                        {k === 'All' ? items.length : items.filter((s) => s.kind === k).length}
                      </span>
                    </button>
                  )
                )}
              </div>
            )}
            {/* mods and arcanes as cards, everything else as tiles below them */}
            <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
              {shown.some((s) => s.card) && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
                  {shown
                    .filter((s) => s.card)
                    .map((s) => (
                      <ModCard
                        key={s.name}
                        name={s.name}
                        image={s.image}
                        card={s.card!}
                        arcane={s.kind === 'Arcanes'}
                        plat={s.plat}
                        priced={Boolean(s.slug)}
                        note={wareNote(s)}
                      />
                    ))}
                </div>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] content-start gap-3">
                {shown
                  .filter((s) => !s.card)
                  .map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3"
                    >
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center">
                        {s.image && (
                          <img
                            loading="lazy"
                            src={s.image}
                            alt=""
                            className="max-h-16 max-w-16 object-contain"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 text-base leading-tight">
                        {s.name}
                        {wareNote(s) && (
                          <span className="block text-xs text-slate-400">{wareNote(s)}</span>
                        )}
                      </span>
                      <span
                        className="flex shrink-0 items-center gap-1 text-lg font-semibold"
                        style={{ color: s.plat != null ? YELLOW : undefined }}
                      >
                        {s.plat != null ? Math.round(s.plat) : s.slug ? '…' : '—'}
                        {s.plat != null && <PlatIcon size={15} />}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </NcCard>
      </div>
    </section>,
    document.querySelector('main') ?? document.body
  )
}
