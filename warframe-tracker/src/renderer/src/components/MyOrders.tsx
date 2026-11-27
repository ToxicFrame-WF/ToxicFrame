import Dropdown from './Dropdown'
import NcCard from './NcCard'
import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import { priceKey, requestPrices, usePriceStore } from '../hooks/priceStore'
import { usePersisted } from '../hooks/usePersisted'
import { useSettings } from '../settings'
import { useItemMeta } from '../hooks/useItemMeta'
import { useInventory } from '../hooks/useInventory'
import { useInventoryItems } from '../hooks/useInventoryItems'
import PlatIcon from './PlatIcon'
import Pic from './Pic'

const CATS = [
  { id: 'All', icon: '∞' },
  { id: 'Parts', icon: '⑂' },
  { id: 'Relics', icon: '◈' },
  { id: 'Mods', icon: '⬢' },
  { id: 'Arcanes', icon: '✦' },
  { id: 'Misc', icon: '❖' },
  { id: 'Sets', icon: '⚙' }
] as const
type Cat = (typeof CATS)[number]['id']
type Sort = 'name' | 'price' | 'quantity'
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

const COLS = 'grid grid-cols-[minmax(0,1fr)_10.5rem_5rem_6rem_7rem_17rem] items-center gap-3 px-4'
const btn =
  'rounded-lg border border-slate-600 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800'

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
  const [sort, setSort] = usePersisted<Sort>('MyOrders.sort', 'name')
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
    const r = await call()
    setBusyIds((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
    if (!r.ok) {
      setNotice(r.error ?? 'That did not work.')
      return false
    }
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
  const remove = (o: MyOrder, name: string): void => {
    if (
      !window.confirm(
        `Delete your ${o.type} order for ${name}? This removes it from warframe.market.`
      )
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
    window.api.getSavedOrders().then((saved) => {
      if (alive && !fresh && saved) setResult((cur) => cur ?? saved)
    })
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

  // Compare each sell order against what you actually own (from the game inventory).
  const inv = useInventory()
  const invItems = useInventoryItems()
  const haveInventory = Boolean(inv.data)
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
    return m
  }, [invItems, inv.data])
  const ownedOf = (slug?: string): number => (slug ? (ownedBySlug.get(slug) ?? 0) : 0)
  const invShort = (order: MyOrder, item?: { slug: string }): boolean =>
    haveInventory && order.type === 'sell' && !!item && ownedOf(item.slug) < order.quantity

  const missing = metaReady ? rows.filter((r) => !r.item).length : 0
  const missingInv = haveInventory ? rows.filter((r) => invShort(r.order, r.item)).length : 0
  const sellValue = rows
    .filter((r) => r.order.type === 'sell')
    .reduce((s, r) => s + r.order.platinum * r.order.quantity, 0)
  const buyValue = rows
    .filter((r) => r.order.type === 'buy')
    .reduce((s, r) => s + r.order.platinum * r.order.quantity, 0)
  const visibleCount = rows.filter((r) => r.order.visible).length

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => r.item && (cat === 'All' || categoryOf(r.item.tags) === cat))
      .filter((r) => !q || r.item!.name.toLowerCase().includes(q))
      .filter((r) => typeFilter === 'all' || r.order.type === typeFilter)
      .filter((r) => visFilter === 'all' || (visFilter === 'visible') === r.order.visible)
      .sort((a, b) =>
        sort === 'price'
          ? b.order.platinum - a.order.platinum
          : sort === 'quantity'
            ? b.order.quantity - a.order.quantity
            : a.item!.name.localeCompare(b.item!.name)
      )
  }, [rows, cat, query, sort, typeFilter, visFilter])

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

  return (
    <div className="p-5 text-slate-100">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-1 text-2xl font-bold">My orders</h1>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs text-rose-300 ring-1 ring-rose-400/40">
            Sell value
          </span>
          <span className="inline-flex items-center gap-1">
            {sellValue}
            <PlatIcon size={16} />
          </span>
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-400/40">
            Buy value
          </span>
          <span className="inline-flex items-center gap-1">
            {buyValue}
            <PlatIcon size={16} />
          </span>
        </span>
        <span className="mx-auto text-sm text-slate-300">
          <Icon name="eye" />{' '}
          <b className="text-slate-100">
            {visibleCount}/{rows.length}
          </b>{' '}
          visible
        </span>
        {haveInventory
          ? missingInv > 0 && (
              <span
                title="Sell orders where you own fewer than you have listed"
                className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs text-amber-200"
              >
                ⚠ {missingInv} order{missingInv > 1 ? 's' : ''} with missing items
              </span>
            )
          : missing > 0 && (
              <span className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                ⚠ {missing} order{missing > 1 ? 's' : ''} with missing items
              </span>
            )}
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
          disabled={!rows.some((r) => r.order.type === 'sell')}
          title="Match the lowest in-game price on many sell orders at once"
          className={`${btn} px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50`}
        >
          ⚟ Bulk actions
        </button>
      </div>

      {/* tabs, search, sort, filters */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                cat === c.id
                  ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/60'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="text-base leading-none">{c.icon}</span>
              {c.id}
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
            <button
              onClick={() => setQuery('')}
              title="Clear search"
              className="text-slate-400 hover:text-slate-200"
            >
              <Icon name="trash" />
            </button>
          </div>
          <Dropdown
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={[
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
      <div className={`${COLS} border-t border-slate-700/70 py-2 text-xs text-slate-400`}>
        <span>Item</span>
        <span className="text-center">Visibility</span>
        <span className="text-center">Quantity</span>
        <span className="text-center">Price / item</span>
        <span className="text-center">Lowest sell</span>
        <span className="text-center">Actions</span>
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

      <div className="flex flex-col gap-2">
        {shown.map(({ order, item }) => {
          const price = item ? get(priceKey(item.slug, order.rank)) : undefined
          const lowest = price && price !== 'error' ? (price.lowest ?? price.price) : undefined
          const undercut = order.type === 'sell' && lowest != null && order.platinum > lowest
          const busy = busyIds.has(order.id)
          const editing = editId === order.id
          return (
            <NcCard key={order.id} title={item?.name ?? ''}>
              <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 text-sm hover:border-slate-600">
                <div className={`${COLS} py-2.5`}>
                  {/* item */}
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-lg bg-slate-800/80 p-1">
                      <Pic src={item?.icon} size={40} letter={item?.name[0]} />
                    </span>
                    <span className="min-w-0">
                      <span className="nc-name block truncate font-semibold">{item?.name}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs">
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ring-1 ${
                            order.type === 'sell'
                              ? 'bg-rose-500/20 text-rose-300 ring-rose-400/40'
                              : 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/40'
                          }`}
                        >
                          {order.type === 'sell' ? 'Sell' : 'Buy'}
                        </span>
                        {order.rank != null && (
                          <span className="text-slate-400">Rank: {order.rank}</span>
                        )}
                      </span>
                    </span>
                  </span>

                  {/* visibility */}
                  <span className="flex overflow-hidden rounded-lg border border-slate-600 text-xs font-medium">
                    <button
                      disabled={busy}
                      onClick={() => setVisible(order, true)}
                      className={`flex flex-1 items-center justify-center gap-1 px-2 py-1.5 ${
                        order.visible
                          ? 'bg-emerald-600/30 text-emerald-200'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Icon name="eye" /> Visible
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setVisible(order, false)}
                      className={`flex flex-1 items-center justify-center px-2 py-1.5 ${
                        !order.visible
                          ? 'bg-slate-600/50 text-slate-100'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      Hide
                    </button>
                  </span>

                  {/* quantity */}
                  {editing ? (
                    <input
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      inputMode="numeric"
                      className="w-full rounded-lg bg-slate-800 px-2 py-1 text-center ring-1 ring-violet-500 outline-none"
                    />
                  ) : (
                    <span className="text-center text-base font-bold">{order.quantity}</span>
                  )}

                  {/* price */}
                  {editing ? (
                    <input
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      inputMode="numeric"
                      className="w-full rounded-lg bg-slate-800 px-2 py-1 text-center ring-1 ring-violet-500 outline-none"
                    />
                  ) : (
                    <span className="flex flex-col items-center">
                      <span className="inline-flex items-center justify-center gap-1 text-base font-bold">
                        {order.platinum}
                        <PlatIcon size={16} />
                      </span>
                      <PriceVsLowest order={order} lowest={lowest} />
                    </span>
                  )}

                  {/* lowest sell */}
                  <span className="flex items-center justify-center gap-2">
                    <button
                      disabled={
                        busy || order.type !== 'sell' || lowest == null || lowest >= order.platinum
                      }
                      onClick={() => lowest != null && matchLowest(order, lowest)}
                      title={
                        lowest != null
                          ? `Lower your price to ${lowest}`
                          : 'No lowest price to match'
                      }
                      className={`${btn} px-2 disabled:cursor-not-allowed disabled:opacity-30`}
                    >
                      ‹
                    </button>
                    <span className="text-center leading-tight">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${undercut ? 'text-amber-300' : ''}`}
                        title={undercut ? 'Someone is selling cheaper' : undefined}
                      >
                        {order.type !== 'sell' ? (
                          '—'
                        ) : lowest != null ? (
                          <>
                            {lowest}
                            <PlatIcon size={14} />
                          </>
                        ) : price === 'error' ? (
                          '!'
                        ) : (
                          '…'
                        )}
                      </span>
                      <button
                        disabled={!item}
                        onClick={() =>
                          item && onCompare(item.slug, rankAware ? order.rank : undefined)
                        }
                        title="Show all orders for this item in the Buy / Sell tab"
                        className="block w-full text-xs text-slate-300 hover:text-violet-300"
                      >
                        Compare ›
                      </button>
                    </span>
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
                        <button
                          disabled={busy || order.type !== 'sell'}
                          onClick={() => soldOne(order)}
                          title="Record one sale (closes 1 unit)"
                          className={`${btn} text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          ✓ Sold 1
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => startEdit(order)}
                          title="Edit price and quantity"
                          className={btn}
                        >
                          ✎ Edit
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => addOne(order)}
                          title="Add one to the quantity"
                          className={btn}
                        >
                          +1
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => remove(order, item?.name ?? 'this item')}
                          title="Delete this order"
                          className={`${btn} text-rose-300`}
                        >
                          <Icon name="trash" />
                        </button>
                      </>
                    )}
                  </span>
                </div>
                {invShort(order, item) && (
                  <div className="flex items-center justify-between border-t border-slate-700/60 px-4 py-1.5 text-xs">
                    <span className="flex items-center gap-1.5 text-amber-300/90">
                      <span aria-hidden>⚠</span> {order.quantity} listed, {ownedOf(item?.slug)}{' '}
                      found in your inventory
                    </span>
                    <button
                      onClick={() => startEdit(order)}
                      className="flex items-center gap-1 text-slate-300 hover:text-white"
                    >
                      Review quantity ›
                    </button>
                  </div>
                )}
              </div>
            </NcCard>
          )
        })}
      </div>
      {bulkOpen && (
        <BulkMatch
          rows={rows.filter((r) => r.order.type === 'sell' && r.item)}
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={running ? undefined : onClose}
    >
      <div
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

// Sell orders: how your price compares to the cheapest seller ("+11" above it, "lowest" when
// you match it, "−3" below it), so an order that won't sell stands out without comparing columns.
function PriceVsLowest({
  order,
  lowest
}: {
  order: MyOrder
  lowest?: number | null
}): React.JSX.Element | null {
  if (order.type !== 'sell' || lowest == null) return null
  const diff = order.platinum - lowest
  const [text, cls, title] =
    diff > 0
      ? [`+${diff}`, 'text-rose-300 border-rose-400/50', `${diff} above the cheapest seller`]
      : diff === 0
        ? ['lowest', 'text-emerald-300 border-emerald-400/50', 'Same as the cheapest seller']
        : [
            `−${-diff}`,
            'text-emerald-300 border-emerald-400/50',
            `${-diff} below the cheapest seller`
          ]
  return (
    <span
      title={title}
      className={`mt-0.5 rounded border px-1 text-[10px] font-semibold leading-tight ${cls}`}
    >
      {text}
    </span>
  )
}
