import Dropdown from './Dropdown'
import NcCard from './NcCard'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as cache from '../apiCache'
import { buildSets } from '../hooks/buildSets'
import { useMastery } from '../hooks/useMastery'
import Icon from './Icon'
import { confirmBox } from './confirmBox'
import { priceKey, requestPrices, usePriceStore } from '../hooks/priceStore'
import { usePersisted } from '../hooks/usePersisted'
import { useSettings } from '../settings'
import { useItemMeta } from '../hooks/useItemMeta'
import { useInventory } from '../hooks/useInventory'
import { useInventoryItems } from '../hooks/useInventoryItems'
import PlatIcon from './PlatIcon'
import Pic from './Pic'
import WikiIcon from './WikiIcon'

// tab icons: the Inventory page's wiki files; Blueprint.png verified on the wiki 2026-11-27
const CATS = [
  { id: 'All', icon: 'IconInfinity(xWhite).png' },
  { id: 'Parts', icon: 'Blueprint.png' },
  { id: 'Relics', icon: 'IconProjectionT4(xWhite).png' },
  { id: 'Mods', icon: 'Fusion_Core_horizontal.png' },
  { id: 'Arcanes', icon: 'CosmeticEnhancer.png' },
  { id: 'Misc', icon: 'IconModDuplicates(xWhite).png' },
  { id: 'Sets', icon: 'IconCrafted(xWhite).png' }
] as const
type Cat = (typeof CATS)[number]['id']
type Sort = 'attention' | 'name' | 'price' | 'quantity'
type TypeFilter = 'all' | 'sell' | 'buy'
type VisFilter = 'all' | 'visible' | 'hidden'

// warframe.market describes every item with tags; map them to the page's categories.
function categoryOf(tags: string[]): Cat {
  const t = tags.map((x) => x.toLowerCase())
  if (t.includes('set')) return 'Sets'
  if (t.includes('relic')) return 'Relics'
  if (t.includes('mod')) return 'Mods'
  if (t.some((x) => x.includes('arcane'))) return 'Arcanes'
  if (t.includes('component') || t.includes('blueprint')) return 'Parts'
  return 'Misc'
}

const COLS =
  'grid grid-cols-[minmax(0,1fr)_3.5rem_5rem_9rem_11rem_1.75rem_1.75rem] items-center gap-3 px-3'
// nc-quiet: inside a Night City card every outlined button would turn red
const btn =
  'nc-quiet rounded-lg border border-slate-600 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800'

type Row = { order: MyOrder; item?: { slug: string; name: string; tags: string[]; icon?: string } }

let lastOrders: MyOrdersResult | null = null // see the result state below

export default function MyOrders({
  onOpenSettings,
  onCompare
}: {
  onOpenSettings: () => void
  onCompare: (slug: string, rank?: number) => void
}): React.JSX.Element {
  const meta = useItemMeta()
  const { get } = usePriceStore()
  const rankAware = useSettings().rankAware
  const [loading, setLoading] = useState(true)
  // the last result of this session shows at once when you come back; the live one replaces it
  const [result, setResult] = useState<MyOrdersResult | null>(lastOrders)
  useEffect(() => {
    if (result) lastOrders = result
  }, [result])
  const [cat, setCat] = usePersisted<Cat>('MyOrders.cat', 'All')
  const [query, setQuery] = useState('')
  const [sort, setSort] = usePersisted<Sort>('MyOrders.sort2', 'attention') // new key: the old one kept 'name' from before Attention existed
  const [showFilters, setShowFilters] = useState(false)
  const [typeFilter, setTypeFilter] = usePersisted<TypeFilter>('MyOrders.typeFilter', 'all')
  const [visFilter, setVisFilter] = usePersisted<VisFilter>('MyOrders.visFilter', 'all')

  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set()) // orders with a request running
  const [notice, setNotice] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editQty, setEditQty] = useState('')

  // Runs one order action, then applies the change locally so the page updates without a reload.
  const act = async (
    id: string,
    call: () => Promise<OrderActionResult>,
    apply: (orders: MyOrder[]) => MyOrder[]
  ): Promise<boolean> => {
    if (busyIds.has(id)) return false // already running for this order
    setBusyIds((s) => new Set(s).add(id))
    setNotice(null)
    const r = await call().catch(() => ({ ok: false, error: 'Something went wrong.' }))
    setBusyIds((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
    if (!r.ok) {
      setNotice(r.error ?? 'That did not work.')
      return false
    }
    if (r.error) setNotice(r.error) // done, but with a warning (e.g. closed but not logged)
    setResult((prev) => (prev ? { ...prev, orders: apply(prev.orders) } : prev))
    return true
  }
  const patch = (id: string, change: Partial<MyOrder>) => (orders: MyOrder[]) =>
    orders.map((o) => (o.id === id ? { ...o, ...change } : o))

  const setVisible = (o: MyOrder, visible: boolean): void => {
    if (o.visible === visible) return
    void act(o.id, () => window.api.updateOrder(o.id, { visible }), patch(o.id, { visible }))
  }
  const soldOne = (o: MyOrder): void => {
    void act(
      o.id,
      () => window.api.closeOrder(o.id, 1),
      (orders) =>
        o.quantity <= 1
          ? orders.filter((x) => x.id !== o.id)
          : orders.map((x) => (x.id === o.id ? { ...x, quantity: x.quantity - 1 } : x))
    )
  }
  const addOne = (o: MyOrder): void => {
    void act(
      o.id,
      () => window.api.updateOrder(o.id, { quantity: o.quantity + 1 }),
      patch(o.id, { quantity: o.quantity + 1 })
    )
  }
  const remove = async (o: MyOrder, name: string): Promise<void> => {
    if (
      !(await confirmBox({
        title: 'Delete order',
        message: `Delete your ${o.type} order for ${name}? This removes it from warframe.market.`,
        confirm: 'Delete',
        danger: true
      }))
    )
      return
    void act(
      o.id,
      () => window.api.deleteOrder(o.id),
      (orders) => orders.filter((x) => x.id !== o.id)
    )
  }
  const [bulkOpen, setBulkOpen] = useState(false)
  const matchLowest = (o: MyOrder, lowest: number): void => {
    void act(
      o.id,
      () => window.api.updateOrder(o.id, { platinum: lowest }),
      patch(o.id, { platinum: lowest })
    )
  }
  const startEdit = (o: MyOrder): void => {
    setEditId(o.id)
    setEditPrice(String(o.platinum))
    setEditQty(String(o.quantity))
  }
  const saveEdit = async (o: MyOrder): Promise<void> => {
    const platinum = Math.floor(Number(editPrice))
    const quantity = Math.floor(Number(editQty))
    if (!(platinum > 0) || !(quantity > 0)) {
      setNotice('Price and quantity must be whole numbers above 0.')
      return
    }
    const ok = await act(
      o.id,
      () => window.api.updateOrder(o.id, { platinum, quantity }),
      patch(o.id, { platinum, quantity })
    )
    if (ok) setEditId(null)
  }

  const [reloadKey, setReloadKey] = useState(0)
  const load = (): void => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }
  useEffect(() => {
    let alive = true
    let fresh = false
    // the saved copy shows at once; the download replaces it when it arrives
    window.api
      .getSavedOrders()
      .then((saved) => {
        if (alive && !fresh && saved) setResult((cur) => cur ?? saved)
      })
      .catch(() => {})
    window.api
      .getMyOrders()
      .then((r) => {
        fresh = true
        // a failed download keeps showing the saved list, with the error
        if (alive)
          setResult((cur) => (r.ok || !cur?.orders.length ? r : { ...cur, error: r.error }))
      })
      .catch(
        () =>
          alive &&
          setResult({ ok: false, orders: [], error: 'Something went wrong loading your orders.' })
      )
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const byId = useMemo(() => {
    const m = new Map<string, { slug: string; name: string; tags: string[]; icon?: string }>()
    for (const [slug, e] of Object.entries(meta))
      m.set(e.id, { slug, name: e.name, tags: e.tags, icon: e.icon })
    return m
  }, [meta])

  const rows = useMemo(
    () => (result?.orders ?? []).map((o: MyOrder) => ({ order: o, item: byId.get(o.itemId) })),
    [result, byId]
  )

  // lowest prices for the items you sell
  useEffect(() => {
    const slugs: string[] = rows
      .filter((r) => r.order.type === 'sell' && r.item)
      .map((r) => priceKey(r.item!.slug, r.order.rank))
    if (slugs.length) requestPrices([...new Set(slugs)])
  }, [rows])

  const metaReady = byId.size > 0

  // 7-day median sale price per item (only items the market scan has covered, not per rank)
  const [stats, setStats] = useState<MarketStats['items']>({})
  useEffect(() => {
    void window.api
      .getMarketStats()
      .then((s) => setStats(s.items))
      .catch(() => {})
  }, [])
  // ranked orders get none: the stat mixes all ranks, so a maxed mod would be priced like rank 0
  const medianOf = (item?: { slug: string }, rank?: number): number | undefined => {
    const m = item && rank == null ? stats[item.slug]?.med7 : undefined
    return m && m > 0 ? Math.round(m) : undefined
  }

  // your warframe.market status: the app's own pick, else the public profile's
  const [live, setLive] = useState<WfmPresence | null>(null)
  const [pub, setPub] = useState<WfmPresence | 'offline' | null>(null)
  useEffect(() => {
    void window.api.getWfmPresence().then(setLive)
    void window.api.getWfmPublicStatus().then(setPub)
    return window.api.onWfmPresence(setLive)
  }, [])
  const presence = live ?? pub

  // Compare each sell order against what you actually own (from the game inventory).
  const inv = useInventory()
  const invItems = useInventoryItems()
  const haveInventory = Boolean(inv.data)
  // set counts come from the same calculation as the Inventory page's Sets tab
  const [invMeta, setInvMeta] = useState<InventoryMeta>({})
  useEffect(() => {
    cache.inventoryMeta().then(setInvMeta)
  }, [])
  const mastery = useMastery()
  const ownedBySlug = useMemo(() => {
    const m = new Map<string, number>()
    if (!inv.data) return m
    for (const r of [
      ...invItems.mods,
      ...invItems.arcanes,
      ...invItems.parts,
      ...invItems.relics,
      ...invItems.misc
    ])
      if (r.slug) m.set(r.slug, (m.get(r.slug) ?? 0) + r.count)
    const byItem = new Map(mastery.rows.map((r) => [r.item.uniqueName, r]))
    for (const s of buildSets(invMeta, invItems.parts, byItem)) m.set(s.slug!, s.count)
    return m
  }, [invItems, inv.data, invMeta, mastery.rows])
  // game images like the Inventory page; warframe.market's icons are generic for arcanes
  const imageBySlug = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of Object.values(invMeta)) if (e.slug && e.image) m.set(e.slug, e.image)
    for (const r of mastery.rows)
      if (r.item.imageName)
        m.set(`${r.item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_set`, r.item.imageName)
    return m
  }, [invMeta, mastery.rows])
  const iconOf = (item?: { slug: string; icon?: string }): string | undefined =>
    (item && imageBySlug.get(item.slug)) ?? item?.icon
  const ownedOf = (slug?: string): number => (slug ? (ownedBySlug.get(slug) ?? 0) : 0)
  const invShort = (order: MyOrder, item?: { slug: string }): boolean =>
    haveInventory && order.type === 'sell' && !!item && ownedOf(item.slug) < order.quantity
  const lowestOf = (o: MyOrder, item?: { slug: string }): number | null | undefined => {
    const p = item ? get(priceKey(item.slug, o.rank)) : undefined
    return p && p !== 'error' ? (p.lowest ?? p.price) : undefined
  }
  const gapOf = (o: MyOrder, lowest?: number | null): number =>
    o.type === 'sell' && lowest != null && o.platinum > lowest ? o.platinum - lowest : 0
  const gapRow = (r: Row): number => gapOf(r.order, lowestOf(r.order, r.item))
  const needsAttn = (r: Row): boolean => gapRow(r) > 0 || invShort(r.order, r.item)

  const missing = metaReady ? rows.filter((r) => !r.item).length : 0
  const warnCount = haveInventory ? rows.filter((r) => invShort(r.order, r.item)).length : missing
  const undercutCount = rows.filter((r) => r.item && gapRow(r) > 0).length
  const sellCount = rows.filter((r) => r.order.type === 'sell').length
  const buyCount = rows.length - sellCount
  const sellValue = rows
    .filter((r) => r.order.type === 'sell')
    .reduce((s, r) => s + r.order.platinum * r.order.quantity, 0)
  const visibleCount = rows.filter((r) => r.order.visible).length
  const catCount = (c: Cat): number =>
    rows.filter((r) => r.item && (c === 'All' || categoryOf(r.item.tags) === c)).length

  const q = query.trim().toLowerCase()
  const shown = rows
    .filter((r) => r.item && (cat === 'All' || categoryOf(r.item.tags) === cat))
    .filter((r) => !q || r.item!.name.toLowerCase().includes(q))
    .filter((r) => typeFilter === 'all' || r.order.type === typeFilter)
    .filter((r) => visFilter === 'all' || (visFilter === 'visible') === r.order.visible)
    .sort((a, b) =>
      sort === 'price'
        ? b.order.platinum - a.order.platinum
        : sort === 'quantity'
          ? b.order.quantity - a.order.quantity
          : sort === 'attention'
            ? // undercut first (biggest gap), then inventory-short, then the rest
              Number(needsAttn(b)) - Number(needsAttn(a)) ||
              gapRow(b) - gapRow(a) ||
              a.item!.name.localeCompare(b.item!.name)
            : a.item!.name.localeCompare(b.item!.name)
    )

  if (result && !result.ok) {
    const needsLink = result.error?.startsWith('Link your') || result.error?.includes('expired')
    return (
      <div className="p-6 text-slate-100">
        <h1 className="mb-3 text-2xl font-bold">My orders</h1>
        <div className="rounded-xl border border-dashed border-slate-600 p-6 text-sm text-slate-300">
          <p className="mb-3">{result.error}</p>
          {needsLink ? (
            <button
              onClick={onOpenSettings}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-white hover:bg-violet-500"
            >
              Open settings
            </button>
          ) : (
            <button
              onClick={load}
              className="rounded-lg border border-slate-600 px-3 py-1.5 hover:bg-slate-700"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  const pill = (active: boolean): string =>
    `rounded-lg px-3 py-1 text-xs ${active ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`
  const iconBtn =
    'flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 disabled:opacity-40'
  const numBtn = 'rounded px-1 font-bold hover:bg-slate-700/70 disabled:cursor-default'

  const renderRow = ({ order, item }: Row): React.JSX.Element => {
    const lowest = lowestOf(order, item)
    const gap = gapOf(order, lowest)
    const undercut = gap > 0
    const busy = busyIds.has(order.id)
    const editing = editId === order.id
    const sell = order.type === 'sell'
    const median = sell ? medianOf(item, order.rank) : undefined
    const key = (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter') void saveEdit(order)
      if (e.key === 'Escape') setEditId(null)
    }
    const input = (value: string, set: (v: string) => void, auto?: boolean): React.JSX.Element => (
      <input
        autoFocus={auto}
        value={value}
        onChange={(e) => set(e.target.value)}
        onKeyDown={key}
        inputMode="numeric"
        className="w-full rounded-md bg-slate-800 px-1 py-0.5 text-center ring-1 ring-violet-500 outline-none"
      />
    )
    return (
      // no NcCard frame: its name tab pulls the name out of the row and it reddens every button
      <div key={order.id}>
        <div
          className={`rounded-lg border border-slate-700/70 bg-slate-900/40 text-sm hover:border-slate-600 ${
            undercut ? 'border-l-2 border-l-amber-400 bg-amber-500/5' : ''
          }`}
        >
          <div className={`${COLS} py-1.5`}>
            {/* item */}
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded-md bg-slate-800/80 p-0.5">
                <Pic src={iconOf(item)} fallback={item?.icon} size={32} letter={item?.name[0]} />
              </span>
              <span className="truncate font-semibold">{item?.name}</span>
              {order.rank != null && (
                <span className="shrink-0 text-xs text-slate-400">R{order.rank}</span>
              )}
              <span
                className={`shrink-0 rounded border px-1 text-[10px] leading-4 font-semibold ${
                  sell
                    ? 'border-rose-400/40 text-rose-300'
                    : 'border-emerald-400/40 text-emerald-300'
                }`}
              >
                {sell ? 'SELL' : 'BUY'}
              </span>
            </span>

            {/* qty, price: click to edit */}
            <span className="text-center">
              {editing ? (
                input(editQty, setEditQty, true)
              ) : (
                <button
                  disabled={busy}
                  onClick={() => startEdit(order)}
                  title="Click to edit"
                  className={numBtn}
                >
                  {order.quantity}
                </button>
              )}
            </span>
            <span className="text-center">
              {editing ? (
                input(editPrice, setEditPrice)
              ) : (
                <button
                  disabled={busy}
                  onClick={() => startEdit(order)}
                  title="Click to edit"
                  className={`${numBtn} inline-flex items-center gap-1`}
                >
                  {order.platinum}
                  <PlatIcon size={14} />
                </button>
              )}
            </span>

            {/* market */}
            <span className="text-center text-xs font-semibold">
              {sell ? (
                lowest != null ? (
                  undercut ? (
                    <span className="text-amber-300" title="Someone is selling cheaper">
                      lowest {lowest}p (+{gap})
                    </span>
                  ) : (
                    <span className="text-emerald-300">
                      {order.platinum === lowest
                        ? '= lowest'
                        : `you're cheapest (−${lowest - order.platinum})`}
                    </span>
                  )
                ) : (
                  <span className="text-slate-400">
                    {item && get(priceKey(item.slug, order.rank)) === 'error' ? '!' : '…'}
                  </span>
                )
              ) : (
                // shortcut: no highest-buy price yet, add when priceStore has it
                <span className="text-slate-500">—</span>
              )}
              {median != null && (
                <span className="block text-[10px] font-normal text-slate-400">
                  week median {median}p
                </span>
              )}
            </span>

            {/* actions */}
            <span className="flex items-center justify-end gap-1.5">
              {editing ? (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void saveEdit(order)}
                    className={`${btn} text-emerald-300`}
                  >
                    Save
                  </button>
                  <button onClick={() => setEditId(null)} className={btn}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {undercut && (
                    <button
                      disabled={busy}
                      onClick={() => matchLowest(order, lowest!)}
                      title={`Lower your price to ${lowest}${
                        median != null && lowest! < median * 0.85
                          ? `. The lowest is well under the 7-day median (${median}p): ⋯ > Set to median`
                          : ''
                      }`}
                      className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                    >
                      Match {lowest}
                    </button>
                  )}
                  {sell && (
                    <button
                      disabled={busy}
                      onClick={() => soldOne(order)}
                      title="Record one sale (closes 1 unit)"
                      className={`${btn} text-emerald-300 disabled:opacity-40`}
                    >
                      Sold 1
                    </button>
                  )}
                </>
              )}
            </span>

            {/* menu */}
            <RowMenu
              disabled={busy}
              className={iconBtn}
              items={[
                ['Edit', () => startEdit(order)],
                ['+1 quantity', () => addOne(order)],
                ...(median != null && median !== order.platinum
                  ? ([[`Set to median (${median}p)`, () => matchLowest(order, median)]] as [
                      string,
                      () => void
                    ][])
                  : []),
                ['Compare', () => item && onCompare(item.slug, rankAware ? order.rank : undefined)],
                ['Delete', () => remove(order, item?.name ?? 'this item'), true]
              ]}
            />

            {/* visibility */}
            <button
              disabled={busy}
              aria-pressed={order.visible}
              onClick={() => setVisible(order, !order.visible)}
              title={order.visible ? 'Visible on warframe.market' : 'Hidden'}
              className={`${iconBtn} ${order.visible ? 'text-emerald-300' : 'text-slate-500 line-through'}`}
            >
              <Icon name="eye" />
            </button>
          </div>
          {invShort(order, item) && (
            <div className="flex items-center justify-between border-t border-slate-700/60 px-3 py-1 text-[11px]">
              <span className="flex items-center gap-1.5 text-amber-300/90">
                <span aria-hidden>⚠</span> {order.quantity} listed, {ownedOf(item?.slug)} found in
                your inventory
              </span>
              <button onClick={() => startEdit(order)} className="text-slate-300 hover:text-white">
                Review quantity ›
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // one card per group; amber for the group that needs you
  const group = (title: string, list: Row[], accent?: string): React.JSX.Element => (
    <NcCard title={`${title} · ${list.length}`} accent={accent}>
      <div className="flex flex-col gap-1.5 p-2">{list.map((r) => renderRow(r))}</div>
    </NcCard>
  )
  const attn = sort === 'attention' ? shown.filter(needsAttn) : []

  return (
    <div className="p-5 text-slate-100">
      {/* header */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="mr-1 text-2xl font-bold">My orders</h1>
        <span className="inline-flex items-center gap-1 text-sm text-slate-300">
          Listed <b className="text-slate-100">{sellValue}</b>
          <PlatIcon size={14} /> · {sellCount} sell · {buyCount} buy ·{' '}
          <b className="text-slate-100">
            {visibleCount}/{rows.length}
          </b>{' '}
          visible
        </span>
        {warnCount > 0 && (
          <span
            title="Sell orders where you own fewer than you have listed"
            className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs text-amber-200"
          >
            ⚠ {warnCount} order{warnCount > 1 ? 's' : ''} with missing items
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            title="Reload your orders"
            className="rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            ⟳
          </button>
          <button
            onClick={() => setBulkOpen(true)}
            disabled={undercutCount === 0}
            title="Match the lowest in-game price on many sell orders at once"
            className={`${btn} px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Match undercut ({undercutCount})
          </button>
        </span>
      </div>

      {presence && (
        <div
          className={`mb-2 flex items-center gap-3 rounded-lg border px-3 py-1.5 text-xs ${
            presence === 'online' || presence === 'ingame'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-amber-500/60 bg-amber-500/10 text-amber-200'
          }`}
        >
          {presence === 'ingame' ? (
            'In game on warframe.market'
          ) : presence === 'online' ? (
            'Online on warframe.market'
          ) : (
            <>
              <span>
                You&apos;re offline/invisible on warframe.market — buyers can&apos;t see your orders
              </span>
              <button
                onClick={() =>
                  void window.api.setWfmPresence('online').then(() => setPub('online'))
                }
                className={`${btn} ml-auto`}
              >
                Go online
              </button>
            </>
          )}
        </div>
      )}

      {/* tabs, search, sort, filters */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {CATS.filter((c) => c.id === 'All' || catCount(c.id) > 0).map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                cat === c.id
                  ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/60'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <WikiIcon file={c.icon} title={c.id} color="currentColor" size={18} />
              {c.id}
              <span className="text-xs text-slate-400">{catCount(c.id)}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
            <span className="text-slate-400">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-28 bg-transparent outline-none placeholder:text-slate-400"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                title="Clear search"
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
          <Dropdown
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={[
              { value: 'attention', label: 'Attention' },
              { value: 'name', label: 'Name' },
              { value: 'price', label: 'Price' },
              { value: 'quantity', label: 'Quantity' }
            ]}
          />
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
              showFilters || typeFilter !== 'all' || visFilter !== 'all'
                ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
                : 'border-slate-600 bg-slate-900/60 hover:bg-slate-800'
            }`}
          >
            ▼ Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            Type
            {(['all', 'sell', 'buy'] as TypeFilter[]).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={pill(typeFilter === t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </span>
          <span className="flex items-center gap-1">
            Visibility
            {(['all', 'visible', 'hidden'] as VisFilter[]).map((v) => (
              <button key={v} onClick={() => setVisFilter(v)} className={pill(visFilter === v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </span>
        </div>
      )}

      {/* column headers */}
      {/* mx: lines up with rows inside the group cards (their frame + padding) */}
      <div className={`${COLS} mx-2.5 border-t border-slate-700/70 py-1.5 text-xs text-slate-400`}>
        <span>Item</span>
        <span className="text-center">Qty</span>
        <span className="text-center">Your price</span>
        <span className="text-center">Market</span>
        <span className="text-right">Action</span>
        <span />
        <span />
      </div>

      {notice && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-rose-300 hover:text-rose-100">
            ✕
          </button>
        </div>
      )}
      {loading && !result && <p className="p-4 text-sm text-slate-400">Loading your orders…</p>}
      {result?.savedAt && (
        <p className="mb-2 text-xs text-amber-300">
          {result.error ? `${result.error} ` : 'Updating… '}Showing your orders as saved{' '}
          {new Date(result.savedAt).toLocaleString()}.
        </p>
      )}
      {!loading && result && shown.length === 0 && (
        <p className="p-4 text-sm text-slate-400">
          {rows.length === 0 ? 'You have no orders on warframe.market.' : 'No orders match.'}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {sort === 'attention' ? (
          <>
            {attn.length > 0 && group('Needs attention', attn, '#f59e0b')}
            {shown.length > attn.length &&
              group(
                'OK',
                shown.filter((r) => !attn.includes(r))
              )}
          </>
        ) : (
          shown.length > 0 && group('Orders', shown)
        )}
      </div>
      {bulkOpen && (
        <BulkMatch
          rows={rows
            .filter((r) => r.order.type === 'sell' && r.item)
            .map((r) => ({ ...r, item: { ...r.item!, icon: iconOf(r.item) } }))}
          onApplied={(id, platinum) =>
            setResult((prev) =>
              prev ? { ...prev, orders: patch(id, { platinum })(prev.orders) } : prev
            )
          }
          onClose={() => setBulkOpen(false)}
        />
      )}
    </div>
  )
}

// Bulk "match lowest price": a preview from saved prices, then for each ticked order a live
// re-check (in-game/online sellers, never your own order) before it is changed.
function BulkMatch({
  rows,
  onApplied,
  onClose
}: {
  rows: { order: MyOrder; item?: { slug: string; name: string; icon?: string } }[]
  onApplied: (id: string, platinum: number) => void
  onClose: () => void
}): React.JSX.Element {
  const { get } = usePriceStore()
  const [floor, setFloor] = useState('1')
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<Record<string, string>>({})
  const min = Math.max(1, Math.floor(Number(floor)) || 1)
  // always price a ranked order at its own rank: a rank-0 listing must never set a maxed mod's price
  const rankOf = (o: MyOrder): number | undefined => o.rank

  const preview = rows
    .map((r) => {
      const p = get(priceKey(r.item!.slug, rankOf(r.order)))
      const lowest = p && p !== 'error' ? p.lowest : null
      return { ...r, lowest: lowest ?? null }
    })
    .filter((r) => r.lowest != null && r.lowest < r.order.platinum && r.lowest >= min)
  const chosen = picked ?? new Set(preview.map((r) => r.order.id))

  const run = async (): Promise<void> => {
    setRunning(true)
    for (const r of preview) {
      if (!chosen.has(r.order.id)) continue
      const id = r.order.id
      setLog((l) => ({ ...l, [id]: 'Checking live price…' }))
      try {
        const live = await window.api.getPrice(r.item!.slug, true, rankOf(r.order))
        const target = live.lowest
        if (target == null) {
          setLog((l) => ({ ...l, [id]: 'No in-game seller now, unchanged' }))
          continue
        }
        if (target >= r.order.platinum || target < min) {
          setLog((l) => ({ ...l, [id]: `Live lowest is ${target}, unchanged` }))
          continue
        }
        const res = await window.api.updateOrder(id, { platinum: target })
        if (res.ok) onApplied(id, target)
        setLog((l) => ({ ...l, [id]: res.ok ? `Set to ${target}` : (res.error ?? 'Failed') }))
      } catch {
        setLog((l) => ({ ...l, [id]: 'Could not reach warframe.market' }))
      }
    }
    setRunning(false)
  }

  useEffect(() => {
    if (running) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={running ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Match lowest price"
        className="nc-dialog-card flex max-h-full w-full max-w-2xl flex-col rounded-lg bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <NcCard title="Match lowest price" className="min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-lg font-semibold">Match lowest price</div>
              <button
                onClick={onClose}
                disabled={running}
                aria-label="Close"
                className="text-xl text-slate-400 hover:text-white disabled:opacity-40"
              >
                ×
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              Lowers your sell orders to the cheapest in-game or online seller (offline sellers and
              your own orders are ignored). Each ticked order is re-checked live before it changes.
            </p>
            <label className="mb-3 flex items-center gap-2 text-sm">
              Never go below
              <input
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                disabled={running}
                inputMode="numeric"
                className="w-16 rounded-md bg-slate-900 px-2 py-1 ring-1 ring-slate-600"
              />
              <PlatIcon size={14} />
            </label>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {preview.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">
                  None of your sell orders are above the saved lowest price. Saved prices load as
                  you browse; open orders again later if some are still loading.
                </p>
              )}
              {preview.map((r) => {
                const id = r.order.id
                return (
                  <label
                    key={id}
                    className="flex items-center gap-3 rounded-lg bg-slate-900/50 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={chosen.has(id)}
                      disabled={running}
                      onChange={() => {
                        const next = new Set(chosen)
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        setPicked(next)
                      }}
                    />
                    <Pic src={r.item!.icon} size={28} letter={r.item!.name[0]} />
                    <span className="min-w-0 flex-1 truncate">
                      {r.item!.name}
                      {r.order.rank != null && (
                        <span className="text-slate-400"> · rank {r.order.rank}</span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {r.order.platinum} → <b className="text-sky-300">{r.lowest}</b>
                    </span>
                    {log[id] && (
                      <span
                        className="w-44 shrink-0 truncate text-xs text-slate-400"
                        title={log[id]}
                      >
                        {log[id]}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {chosen.size} of {preview.length} selected
              </span>
              <button
                onClick={() => void run()}
                disabled={running || chosen.size === 0}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {running
                  ? 'Updating…'
                  : `Update ${chosen.size} order${chosen.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </NcCard>
      </div>
    </div>
  )
}

// Minimal "⋯" popover; closes on an outside click or Escape.
function RowMenu({
  items,
  disabled,
  className
}: {
  items: [string, () => void, boolean?][]
  disabled?: boolean
  className: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <span ref={ref} className="relative">
      <button
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="More"
        className={className}
      >
        ⋯
      </button>
      {open && (
        <span
          role="menu"
          className="absolute right-0 z-20 mt-1 flex w-36 flex-col rounded-lg border border-slate-600 bg-slate-900 py-1 text-xs shadow-xl"
        >
          {items.map(([label, run, danger]) => (
            <button
              key={label}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                run()
              }}
              className={`px-3 py-1.5 text-left hover:bg-slate-800 ${danger ? 'text-rose-300' : ''}`}
            >
              {label}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
