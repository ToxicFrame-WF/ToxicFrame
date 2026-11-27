import NcCard from './NcCard'
import * as cache from '../apiCache'
import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import { useInventoryItems, type InvRow } from '../hooks/useInventoryItems'
import { usePersisted } from '../hooks/usePersisted'
import { refreshInventory, useInventory } from '../hooks/useInventory'
import { useItemMeta } from '../hooks/useItemMeta'
import { usePriceStore, requestPrices, seedFromCache, priceKey } from '../hooks/priceStore'
import PlatIcon from './PlatIcon'
import DucatIcon from './DucatIcon'
import ModDetail from './ModDetail'
import RelicDetail from './RelicDetail'
import PartDetail from './PartDetail'
import WikiIcon from './WikiIcon'
import NightCityInventory from './NightCityInventory'
import { missingCost } from '../sets'
import { useMastery } from '../hooks/useMastery'
import { updateSettings, useSettings } from '../settings'

type TabKey = 'all' | 'relics' | 'mods' | 'arcanes' | 'misc' | 'sets'
// tab icons: official wiki files (names verified 2026-11-16)
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'all', label: 'All parts', icon: 'IconInfinity(xWhite).png' },
  { key: 'relics', label: 'Relics', icon: 'IconProjectionT4(xWhite).png' },
  { key: 'mods', label: 'Mods', icon: 'Fusion_Core_horizontal.png' },
  { key: 'arcanes', label: 'Arcanes', icon: 'CosmeticEnhancer.png' },
  { key: 'misc', label: 'Misc', icon: 'IconModDuplicates(xWhite).png' },
  { key: 'sets', label: 'Sets', icon: 'IconCrafted(xWhite).png' }
]
type View = 'owned' | 'safe' | 'over'
interface TabState {
  sort: SortKey
  reverse: boolean
  filters: InvFilters
  view: View
}
const TAB_DEFAULTS: TabState = { sort: 'amount', reverse: false, filters: {}, view: 'owned' }
const KEEP: { key: 'unowned' | 'unmastered' | 'favorites'; label: string }[] = [
  { key: 'unowned', label: 'Unowned & unmastered' },
  { key: 'unmastered', label: 'Unmastered only' },
  { key: 'favorites', label: 'Favorites only' }
]

// Filter panel: each group holds one optional choice (click again to clear).
interface InvFilters {
  result?: 'have' | 'missing' // resulting item owned/mastered or not
  copies?: 'many' | 'one'
  vault?: 'vaulted' | 'unvaulted'
  order?: 'listed' | 'unlisted'
  type?: 'non' | 'prime'
  fav?: 'only' | 'exclude'
  minPrice?: 5 | 10 | 15
  set?: 'complete' | 'incomplete'
  maxMissing?: 10 | 25 | 50 // sets tab: unfinished sets whose missing parts cost at most this
  // mods tab
  allMods?: boolean // also list mods you don't own
  allArcanes?: boolean // arcanes "Collection progress": also list arcanes you don't own
  equipped?: 'yes' | 'no'
  rank?: 'ranked' | 'unranked'
}
type SortKey = 'name' | 'plat' | 'ducats' | 'amount' | 'ducanator' | 'missing' | 'completion'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'plat', label: 'Platinum' },
  { key: 'ducats', label: 'Ducats' },
  { key: 'amount', label: 'Amount' },
  { key: 'ducanator', label: 'Ducanator' },
  { key: 'missing', label: 'Cheapest to complete' },
  { key: 'completion', label: 'Set completion' }
]
const PAGE = 60

export default function InventoryPage(): React.JSX.Element {
  const { ready, relics, mods, arcanes, parts, misc } = useInventoryItems()
  const inv = useInventory()
  const meta = useItemMeta()
  const { get, version } = usePriceStore()
  const [tab, setTab] = usePersisted<TabKey>('InventoryPage.tab', 'all')
  const [query, setQuery] = useState('')
  // sort, filters and view are remembered per tab: each tab keeps its own
  const [perTab, setPerTab] = usePersisted<Partial<Record<TabKey, Partial<TabState>>>>(
    'InventoryPage.perTab',
    {}
  )
  const cur: TabState = { ...TAB_DEFAULTS, ...perTab[tab] }
  const setter =
    <K extends keyof TabState>(k: K) =>
    (v: TabState[K] | ((p: TabState[K]) => TabState[K])): void =>
      setPerTab((all) => {
        const c = { ...TAB_DEFAULTS, ...all[tab] }
        const next = typeof v === 'function' ? (v as (p: TabState[K]) => TabState[K])(c[k]) : v
        return { ...all, [tab]: { ...c, [k]: next } }
      })
  const { reverse, filters, view } = cur
  // mods and arcanes have no ducat value, and sets are judged by plat and completion
  const noDucats = tab === 'mods' || tab === 'arcanes' || tab === 'sets'
  // and "cheapest to complete" only means something for sets
  const sortOptions = SORTS.filter(
    (s) =>
      !(noDucats && (s.key === 'ducats' || s.key === 'ducanator')) &&
      ((s.key !== 'missing' && s.key !== 'completion') || tab === 'sets')
  )
  const sort = sortOptions.some((s) => s.key === cur.sort) ? cur.sort : 'plat'
  const setSort = setter('sort')
  const setReverse = setter('reverse')
  const setFilters = setter('filters')
  const setView = setter('view')
  const [sortOpen, setSortOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [invMeta, setInvMeta] = useState<InventoryMeta>({})
  const [shownPaged, setShown] = useState(PAGE)
  const [selected, setSelected] = useState<InvRow | null>(null)
  const [keepOpen, setKeepOpen] = useState(false)
  const settings = useSettings()
  const shown = settings.loadAllItems ? Infinity : shownPaged
  const keepMode = settings.keepForCrafting ?? 'unowned'
  const mastery = useMastery()
  const [orders, setOrders] = useState<MyOrder[]>([])

  useEffect(() => {
    cache.inventoryMeta().then(setInvMeta)
    // fetched on every visit so order changes and a later account link show up
    window.api
      .getMyOrders()
      .then((r) => setOrders(r.ok ? r.orders : []))
      .catch(() => {})
  }, [])

  // How many of a part to keep for building its item, per the "Keep for crafting" rule.
  const keepOf = useMemo(() => {
    const byItem = new Map(mastery.rows.map((r) => [r.item.uniqueName, r]))
    const favs = new Set([...settings.masteryFavorites, ...settings.craftingFavorites])
    return (r: InvRow): number => {
      if (r.kind === 'mod' || r.kind === 'arcane') return r.equippedCopies ?? 0 // slotted copies aren't spare
      if (r.kind !== 'part' || !r.parent || r.setParts) return 0
      const item = byItem.get(r.parent)
      const keep =
        keepMode === 'favorites'
          ? favs.has(r.parent)
          : keepMode === 'unmastered'
            ? !item || !item.mastered // keep while the item isn't mastered, even if owned
            : !item || (!item.owned && !item.mastered)
      return keep ? (r.need ?? 1) : 0
    }
  }, [mastery.rows, keepMode, settings.masteryFavorites, settings.craftingFavorites])

  // quantity listed for sale on warframe.market, by market item id
  const listed = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of orders)
      if (o.type === 'sell') m.set(o.itemId, (m.get(o.itemId) ?? 0) + o.quantity)
    return m
  }, [orders])
  const listedOf = (r: InvRow): number =>
    r.slug && meta[r.slug] ? (listed.get(meta[r.slug].id) ?? 0) : 0
  const spareOf = (r: InvRow): number => Math.max(0, r.count - keepOf(r))

  const byItem = useMemo(
    () => new Map(mastery.rows.map((r) => [r.item.uniqueName, r])),
    [mastery.rows]
  )
  const favSet = useMemo(
    () => new Set([...settings.masteryFavorites, ...settings.craftingFavorites]),
    [settings.masteryFavorites, settings.craftingFavorites]
  )
  // items whose every tradable part you own enough of
  // One row per item you own at least one tradable part of: its parts, how many full sets you
  // could build, and the set's market name.
  const sets = useMemo(() => {
    const owned = new Map(parts.map((p) => [p.key, p.count]))
    const byParent = new Map<string, { id: string; m: InvMeta }[]>()
    for (const [id, m] of Object.entries(invMeta))
      if (m.kind === 'part' && m.parent && m.tradable)
        byParent.set(m.parent, [...(byParent.get(m.parent) ?? []), { id, m }])
    const out: InvRow[] = []
    for (const [parent, list] of byParent) {
      if (!list.some(({ id }) => owned.has(id))) continue
      const item = byItem.get(parent)?.item
      const name = item?.name ?? list[0].m.name.split(' ').slice(0, -1).join(' ')
      const setParts = list
        .map(({ id, m }) => ({
          name: m.name.startsWith(name) ? m.name.slice(name.length).trim() : m.name,
          image: m.image,
          have: owned.get(id) ?? 0,
          need: m.need ?? 1,
          slug: m.slug
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      out.push({
        key: `set:${parent}`,
        kind: 'part',
        name: `${name} Set`,
        image: item?.imageName,
        count: Math.min(...setParts.map((x) => Math.floor(x.have / x.need))),
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_set`,
        ducats: list.reduce((n, { m }) => n + (m.ducats ?? 0) * (m.need ?? 1), 0) || undefined,
        tradable: true,
        isPrime: list[0].m.isPrime,
        parent,
        setParts,
        mastered: byItem.get(parent)?.mastered
      })
    }
    return out
  }, [invMeta, parts, byItem])

  const completeSets = useMemo(() => {
    const owned = new Map(parts.map((p) => [p.key, p.count]))
    const ok = new Map<string, boolean>()
    for (const [id, m] of Object.entries(invMeta)) {
      if (m.kind !== 'part' || !m.parent) continue
      const enough = (owned.get(id) ?? 0) >= (m.need ?? 1)
      ok.set(m.parent, (ok.get(m.parent) ?? true) && enough)
    }
    return new Set([...ok].filter(([, v]) => v).map(([k]) => k))
  }, [invMeta, parts])

  const matches = (r: InvRow): boolean => {
    const f = filters
    const item = r.parent ? byItem.get(r.parent) : undefined
    if (f.result) {
      if (!item) return false
      if ((item.owned || item.mastered) !== (f.result === 'have')) return false
    }
    if (f.copies && r.count > 1 !== (f.copies === 'many')) return false
    if (f.vault) {
      const v = r.kind === 'relic' ? r.vaulted : item?.item.vaulted
      if (v === undefined || v !== (f.vault === 'vaulted')) return false
    }
    if (f.order && listedOf(r) > 0 !== (f.order === 'listed')) return false
    if (f.type && r.isPrime !== (f.type === 'prime')) return false
    if (f.fav) {
      const fav = favSet.has(r.key) || (!!r.parent && favSet.has(r.parent))
      if (fav !== (f.fav === 'only')) return false
    }
    if (f.minPrice && !(platOf(r) > f.minPrice)) return false
    if (f.maxMissing) {
      // only unfinished sets whose missing parts all have a price and add up to the limit
      const cost = missingCost(r.setParts ?? [], priceOf)
      if (!cost || cost > f.maxMissing) return false
    }
    if (f.set) {
      if (!r.parent) return false
      if (completeSets.has(r.parent) !== (f.set === 'complete')) return false
    }
    if (f.equipped && (r.equippedCopies ?? 0) > 0 !== (f.equipped === 'yes')) return false
    if (f.rank && (r.rank ?? 0) > 0 !== (f.rank === 'ranked')) return false
    return true
  }
  const nActive =
    Object.values(filters).filter((v) => v !== undefined).length + (view !== 'owned' ? 1 : 0)
  const pick = <K extends keyof InvFilters>(k: K, v: InvFilters[K]): void => {
    setFilters((f) => ({ ...f, [k]: f[k] === v ? undefined : v }))
    setShown(PAGE)
  }

  useEffect(() => {
    seedFromCache()
  }, [])

  // every mod/arcane you don't own, for "Only owned" off and arcane "Collection progress"
  const unownedOf = (kind: 'mod' | 'arcane', owned: InvRow[]): InvRow[] => {
    const have = new Set(owned.map((m) => m.key))
    return Object.entries(invMeta)
      .filter(([id, m]) => m.kind === kind && !have.has(id))
      .map(([id, m]): InvRow => ({
        key: id,
        kind,
        name: m.name,
        image: m.image,
        rarity: m.rarity,
        maxRank: m.maxRank,
        count: 0,
        slug: m.slug,
        tradable: m.tradable,
        isPrime: m.isPrime
      }))
  }
  const unownedMods = useMemo(() => unownedOf('mod', mods), [invMeta, mods]) // eslint-disable-line react-hooks/exhaustive-deps
  const unownedArcanes = useMemo(() => unownedOf('arcane', arcanes), [invMeta, arcanes]) // eslint-disable-line react-hooks/exhaustive-deps

  const rowsFor = (t: TabKey): InvRow[] =>
    t === 'relics'
      ? relics
      : t === 'mods'
        ? filters.allMods
          ? [...mods, ...unownedMods]
          : mods
        : t === 'arcanes'
          ? filters.allArcanes
            ? [...arcanes, ...unownedArcanes]
            : arcanes
          : t === 'misc'
            ? misc.filter((r) => !!r.slug && !!meta[r.slug]) // only what warframe.market lists
            : t === 'sets'
              ? sets
              : parts // 'all'

  const ducatsOf = (r: InvRow): number => r.ducats ?? (r.slug ? (meta[r.slug]?.ducats ?? 0) : 0)
  // mods/arcanes are priced at the rank of your best copy, so a rank 5 arcane isn't valued at rank 0
  const keyOf = (r: InvRow): string | undefined =>
    r.slug && (r.kind === 'mod' || r.kind === 'arcane') ? priceKey(r.slug, r.rank ?? 0) : r.slug
  const priceOf = (key?: string): number => {
    const p = key ? get(key) : undefined
    return p && p !== 'error' ? (p.price ?? 0) : 0
  }
  const platOf = (r: InvRow): number => priceOf(keyOf(r))

  // Each copy at its own rank's price. Copies kept back (equipped) come off the highest ranks
  // first, since slotted copies are usually the ranked ones.
  const valueOf = (r: InvRow): number => {
    let skip = keepOf(r)
    if (!r.byRank || !r.slug) return platOf(r) * Math.max(0, r.count - skip)
    let total = 0
    for (const [rank, n] of Object.entries(r.byRank).sort((a, b) => Number(b[0]) - Number(a[0]))) {
      const spare = Math.max(0, n - skip)
      skip = Math.max(0, skip - n)
      total += spare * priceOf(priceKey(r.slug, Number(rank)))
    }
    return total
  }

  const base = rowsFor(tab)

  // request prices for everything in the tab so totals and sort work
  useEffect(() => {
    const slugs = [
      ...new Set(
        base
          .flatMap(
            (r) =>
              r.slug && r.byRank
                ? Object.keys(r.byRank).map((k) => priceKey(r.slug!, Number(k)))
                : [keyOf(r), ...(r.setParts ?? []).map((p) => p.slug)] // sets: parts too, for the missing cost
          )
          .filter((s): s is string => !!s)
      )
    ]
    if (slugs.length) requestPrices(slugs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ready, filters.allMods, filters.allArcanes, inv.data])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = base.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q)) &&
        (tab === 'misc' || matches(r)) &&
        (view === 'owned' ||
          tab === 'misc' ||
          tab === 'sets' ||
          tab === 'mods' ||
          tab === 'arcanes' ||
          (view === 'safe'
            ? r.tradable && !!r.slug && spareOf(r) > listedOf(r)
            : listedOf(r) > spareOf(r)))
    )
    const score: Record<SortKey, (r: InvRow) => number> = {
      name: () => 0,
      plat: platOf,
      ducats: ducatsOf,
      amount: (r) => r.count,
      ducanator: (r) => {
        const p = platOf(r)
        return p > 0 ? ducatsOf(r) / p : ducatsOf(r)
      },
      // share of parts you have enough of, most complete first
      completion: (r) =>
        r.setParts?.length
          ? r.setParts.filter((p) => p.have >= p.need).length / r.setParts.length
          : 0,
      // negative so the cheapest unfinished sets come first
      // a missing part with no market price (untradable, or not loaded yet) can't be bought:
      // those sets go last instead of counting the part as free
      missing: (r) => {
        const cost = missingCost(r.setParts ?? [], priceOf)
        if (cost === 0) return -2e9 // already complete: nothing to buy, so after the rest
        return cost === null ? -1e9 : -cost
      }
    }
    const sorted = [...filtered].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : score[sort](b) - score[sort](a)
    )
    return reverse ? sorted.reverse() : sorted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reverse,
    base,
    query,
    sort,
    filters,
    version,
    meta,
    view,
    keepOf,
    listed,
    completeSets,
    byItem,
    favSet
  ])

  const totalPlat = useMemo(
    () => Math.round(list.reduce((s, r) => s + valueOf(r), 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, version]
  )
  const totalDucats = useMemo(
    () => list.reduce((s, r) => s + ducatsOf(r) * r.count, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, meta]
  )

  if (inv.state !== 'ok' && !inv.data) {
    return (
      <div className="p-6 text-slate-100">
        <h1 className="mb-2 text-2xl font-bold">Inventory</h1>
        <p className="mb-4 max-w-md text-sm text-slate-400">
          Your inventory is read from the running game. Start Warframe, log in, then load it.
        </p>
        <button
          onClick={refreshInventory}
          disabled={inv.state === 'loading'}
          className="rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {inv.state === 'loading' ? 'Reading inventory…' : '↻ Load inventory'}
        </button>
        {inv.state === 'error' && <p className="mt-3 text-sm text-slate-400">! {inv.error}</p>}
      </div>
    )
  }

  const showDucats = tab !== 'mods'

  return (
    <div className="flex h-full flex-col p-4 text-slate-100">
      {/* header */}
      <div className="mb-3 flex items-start justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <PlatIcon size={20} />
            <div>
              <div className="text-xs text-slate-400">
                Value of {TABS.find((t) => t.key === tab)?.label.toLowerCase()}
                {nActive > 0 || query ? ' (filtered)' : ''}
              </div>
              <div className="text-lg font-bold">{totalPlat}</div>
            </div>
          </div>
          {showDucats && (
            <div className="flex items-center gap-2">
              <DucatIcon size={20} />
              <div>
                <div className="text-xs text-slate-400">Ducats</div>
                <div className="text-lg font-bold text-amber-300">{totalDucats}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* tabs + controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-700/70 pb-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                setShown(PAGE)
              }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                tab === t.key
                  ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                  : 'border-transparent text-slate-300 hover:bg-slate-800'
              }`}
            >
              <WikiIcon file={t.icon} title={t.label} color="currentColor" size={18} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
            <span className="text-slate-400">⌕</span>
            <input
              className="w-36 bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-200">
              <Icon name="trash" />
            </button>
          </div>
          <button
            hidden={tab === 'misc'}
            onClick={() => setShowFilters((o) => !o)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
              showFilters || nActive
                ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                : 'border-slate-600 bg-slate-900/60 hover:bg-slate-800'
            }`}
          >
            ⧩ Filters
            {nActive > 0 && (
              <span className="rounded bg-violet-600 px-1.5 text-xs text-white">{nActive}</span>
            )}
          </button>
          <div className="relative flex items-center rounded-lg border border-slate-600 bg-slate-900/60 text-sm font-semibold">
            <button
              onClick={() => setReverse((r) => !r)}
              title={
                reverse
                  ? 'Lowest first (click for highest first)'
                  : 'Highest first (click for lowest first)'
              }
              className="rounded-l-lg px-2.5 py-2 text-slate-300 hover:bg-slate-800"
            >
              {/* three bars, longest at the top for highest first */}
              <svg
                viewBox="0 0 16 16"
                width={16}
                height={16}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                className={reverse ? '-scale-y-100' : ''}
              >
                <path d="M2 4h12M4 8h8M6 12h4" />
              </svg>
            </button>
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-2 rounded-r-lg border-l border-slate-600 px-3 py-2 hover:bg-slate-800"
            >
              {sortOptions.find((s) => s.key === sort)?.label}
              <span className="text-xs">▾</span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-slate-600 bg-slate-900 p-1 shadow-xl">
                {sortOptions.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => {
                      setSort(s.key)
                      setSortOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm ${
                      sort === s.key ? 'bg-violet-600 text-white' : 'hover:bg-slate-800'
                    }`}
                  >
                    {s.label}
                    {sort === s.key && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* owned / safe to list / overlisted (not for mods: they aren't kept for crafting) */}
      {tab === 'arcanes' && (
        <div className="mb-3 flex w-fit gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1 text-sm">
          {(
            [
              [false, 'Owned copies'],
              [true, 'Collection progress']
            ] as const
          ).map(([all, label]) => (
            <button
              key={label}
              onClick={() => {
                setFilters((f) => ({ ...f, allArcanes: all || undefined }))
                setShown(PAGE)
              }}
              className={`rounded-md border px-3 py-1.5 ${!!filters.allArcanes === all ? 'border-violet-400/60 bg-violet-500/20 font-semibold text-white' : 'border-transparent text-slate-300 hover:bg-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        className={`mb-3 flex flex-wrap items-center gap-2 ${tab === 'mods' || tab === 'arcanes' || tab === 'misc' || tab === 'sets' ? 'hidden' : ''}`}
      >
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1 text-sm">
          {(
            [
              ['owned', 'All owned parts', ''],
              ['safe', 'Safe to list', '⛉'],
              ['over', 'Overlisted', '']
            ] as const
          ).map(([k, label, icon]) => (
            <button
              key={k}
              onClick={() => {
                setView(k)
                setShown(PAGE)
              }}
              title={
                k === 'safe'
                  ? 'Spare copies you can sell without touching parts kept for crafting'
                  : k === 'over'
                    ? 'Listed on warframe.market for more than you can spare'
                    : undefined
              }
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 ${view === k ? 'border-violet-400/60 bg-violet-500/20 font-semibold text-white' : 'border-transparent text-slate-300 hover:bg-slate-800'}`}
            >
              {icon && <span className="text-slate-300">{icon}</span>}
              {label}
            </button>
          ))}
        </div>
        <span className="ml-2 text-sm text-slate-400">
          {list.length}{' '}
          {TABS.find((t) => t.key === tab)
            ?.label.replace(/^All /, '')
            .toLowerCase()}
        </span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-slate-300">Keep for crafting</span>
          <div className="relative">
            <button
              onClick={() => setKeepOpen((o) => !o)}
              className="flex min-w-52 items-center justify-between gap-3 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 font-semibold hover:bg-slate-800"
            >
              {KEEP.find((k) => k.key === keepMode)?.label}
              <span className={`text-xs text-slate-400 transition ${keepOpen ? 'rotate-180' : ''}`}>
                ⌄
              </span>
            </button>
            {keepOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setKeepOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-full min-w-52 rounded-lg border border-slate-600 bg-slate-900 p-1 shadow-xl">
                  {KEEP.map((k) => (
                    <button
                      key={k.key}
                      onClick={() => {
                        updateSettings({ keepForCrafting: k.key })
                        setKeepOpen(false)
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm ${keepMode === k.key ? 'bg-violet-600 text-white' : 'hover:bg-slate-800'}`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showFilters && tab !== 'misc' && (
        <div className="mb-3">
          <NcCard title={`Filter ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}`}>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="nc-name font-semibold">
                  Filter {TABS.find((t) => t.key === tab)?.label.toLowerCase()}
                </div>
                <div className="flex gap-2">
                  {nActive > 0 && (
                    <button
                      onClick={() => {
                        setFilters({})
                        setView('owned')
                      }}
                      className="px-2 text-slate-300 hover:text-white"
                    >
                      Clear filters
                    </button>
                  )}
                  <button
                    onClick={() => setShowFilters(false)}
                    className="rounded-lg border border-violet-400/60 bg-violet-500/15 px-3 py-1.5 font-semibold hover:bg-violet-500/25"
                  >
                    × Close filters
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                {tab === 'mods' || tab === 'arcanes' ? (
                  <>
                    {tab === 'mods' && (
                      <FGroup icon="IconCrafted(xWhite).png" title="Ownership">
                        <label className="flex cursor-pointer items-center gap-2 py-1 text-slate-200">
                          <input
                            type="checkbox"
                            checked={!filters.allMods}
                            onChange={() => {
                              setFilters((f) => ({ ...f, allMods: f.allMods ? undefined : true }))
                              setShown(PAGE)
                            }}
                          />
                          Only owned
                        </label>
                      </FGroup>
                    )}
                    <FGroup icon="IconModDuplicates(xWhite).png" title="Copies owned">
                      <FOpt on={filters.copies === 'many'} onClick={() => pick('copies', 'many')}>
                        More than one
                      </FOpt>
                      <FOpt on={filters.copies === 'one'} onClick={() => pick('copies', 'one')}>
                        At most one
                      </FOpt>
                    </FGroup>
                    <FGroup icon="IconTradeRequestSentIcon(xWhite).png" title="Market order">
                      <FOpt on={filters.order === 'listed'} onClick={() => pick('order', 'listed')}>
                        Listed
                      </FOpt>
                      <FOpt
                        on={filters.order === 'unlisted'}
                        onClick={() => pick('order', 'unlisted')}
                      >
                        Not listed
                      </FOpt>
                    </FGroup>
                    <FGroup glyph="★" title="Favorites">
                      <FOpt on={filters.fav === 'only'} onClick={() => pick('fav', 'only')}>
                        Favorites only
                      </FOpt>
                      <FOpt on={filters.fav === 'exclude'} onClick={() => pick('fav', 'exclude')}>
                        Exclude favorites
                      </FOpt>
                    </FGroup>
                    <FGroup plat title="Minimum sell price">
                      {([5, 10, 15] as const).map((v) => (
                        <FOpt
                          key={v}
                          on={filters.minPrice === v}
                          onClick={() => pick('minPrice', v)}
                        >
                          <span className="flex items-center gap-1">
                            &gt;{v} <PlatIcon size={12} />
                          </span>
                        </FOpt>
                      ))}
                    </FGroup>
                    {tab === 'mods' && (
                      <FGroup title="Equipped">
                        <FOpt
                          on={filters.equipped === 'yes'}
                          onClick={() => pick('equipped', 'yes')}
                        >
                          Equipped
                        </FOpt>
                        <FOpt on={filters.equipped === 'no'} onClick={() => pick('equipped', 'no')}>
                          Not equipped
                        </FOpt>
                      </FGroup>
                    )}
                    <FGroup title="Rank">
                      <FOpt on={filters.rank === 'ranked'} onClick={() => pick('rank', 'ranked')}>
                        Ranked up
                      </FOpt>
                      <FOpt
                        on={filters.rank === 'unranked'}
                        onClick={() => pick('rank', 'unranked')}
                      >
                        Unranked
                      </FOpt>
                    </FGroup>
                  </>
                ) : (
                  <>
                    {tab !== 'sets' && (
                      <FGroup icon="IconTradeRequestSentIcon(xWhite).png" title="Selling">
                        <FOpt
                          on={view === 'safe'}
                          onClick={() => setView(view === 'safe' ? 'owned' : 'safe')}
                        >
                          Safe to list
                        </FOpt>
                        <FOpt
                          on={view === 'over'}
                          onClick={() => setView(view === 'over' ? 'owned' : 'over')}
                        >
                          Overlisted
                        </FOpt>
                      </FGroup>
                    )}
                    <FGroup icon="IconCrafted(xWhite).png" title="Resulting item">
                      <FOpt on={filters.result === 'have'} onClick={() => pick('result', 'have')}>
                        Owned / mastered
                      </FOpt>
                      <FOpt
                        on={filters.result === 'missing'}
                        onClick={() => pick('result', 'missing')}
                      >
                        Not owned or mastered
                      </FOpt>
                    </FGroup>
                    <FGroup icon="IconModDuplicates(xWhite).png" title="Copies owned">
                      <FOpt on={filters.copies === 'many'} onClick={() => pick('copies', 'many')}>
                        More than one
                      </FOpt>
                      <FOpt on={filters.copies === 'one'} onClick={() => pick('copies', 'one')}>
                        At most one
                      </FOpt>
                    </FGroup>
                    <FGroup icon="IconVault(xWhite).png" title="Vault status">
                      <FOpt
                        on={filters.vault === 'vaulted'}
                        onClick={() => pick('vault', 'vaulted')}
                      >
                        Vaulted
                      </FOpt>
                      <FOpt
                        on={filters.vault === 'unvaulted'}
                        onClick={() => pick('vault', 'unvaulted')}
                      >
                        Unvaulted
                      </FOpt>
                    </FGroup>
                    <FGroup icon="IconTradeRequestSentIcon(xWhite).png" title="Market order">
                      <FOpt on={filters.order === 'listed'} onClick={() => pick('order', 'listed')}>
                        Listed
                      </FOpt>
                      <FOpt
                        on={filters.order === 'unlisted'}
                        onClick={() => pick('order', 'unlisted')}
                      >
                        Not listed
                      </FOpt>
                    </FGroup>
                    <FGroup icon="IconProjectionT4(xWhite).png" title="Part type">
                      <FOpt on={filters.type === 'non'} onClick={() => pick('type', 'non')}>
                        Non-prime
                      </FOpt>
                      <FOpt on={filters.type === 'prime'} onClick={() => pick('type', 'prime')}>
                        Prime
                      </FOpt>
                    </FGroup>
                    <FGroup glyph="★" title="Favorites">
                      <FOpt on={filters.fav === 'only'} onClick={() => pick('fav', 'only')}>
                        Favorites only
                      </FOpt>
                      <FOpt on={filters.fav === 'exclude'} onClick={() => pick('fav', 'exclude')}>
                        Exclude favorites
                      </FOpt>
                    </FGroup>
                    <FGroup plat title="Minimum sell price">
                      {([5, 10, 15] as const).map((v) => (
                        <FOpt
                          key={v}
                          on={filters.minPrice === v}
                          onClick={() => pick('minPrice', v)}
                        >
                          <span className="flex items-center gap-1">
                            &gt;{v} <PlatIcon size={12} />
                          </span>
                        </FOpt>
                      ))}
                    </FGroup>
                    <FGroup icon="IconCrafted(xWhite).png" title="Set completion">
                      <FOpt on={filters.set === 'complete'} onClick={() => pick('set', 'complete')}>
                        Complete sets
                      </FOpt>
                      <FOpt
                        on={filters.set === 'incomplete'}
                        onClick={() => pick('set', 'incomplete')}
                      >
                        Incomplete sets
                      </FOpt>
                    </FGroup>
                    <FGroup plat title="Missing parts cost">
                      {([10, 25, 50] as const).map((v) => (
                        <FOpt
                          key={v}
                          on={filters.maxMissing === v}
                          onClick={() => pick('maxMissing', v)}
                        >
                          <span className="flex items-center gap-1">
                            ≤{v} <PlatIcon size={12} />
                          </span>
                        </FOpt>
                      ))}
                    </FGroup>
                  </>
                )}
              </div>
            </div>
          </NcCard>
        </div>
      )}

      {/* content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!ready ? (
          <p className="p-6 text-center text-sm text-slate-400">Loading inventory…</p>
        ) : list.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <NightCityInventory
              rows={list.slice(0, shown)}
              total={list.length}
              tabs={TABS}
              tab={tab}
              priceOfSlug={priceOf}
              // the parts tabs show the count in the Owned / Safe / Overlisted row instead
              showCount={tab === 'mods' || tab === 'arcanes' || tab === 'misc' || tab === 'sets'}
              platOf={platOf}
              ducatsOf={ducatsOf}
              onOpen={(r) =>
                (r.kind === 'mod' ||
                  r.kind === 'arcane' ||
                  r.kind === 'relic' ||
                  r.kind === 'part') &&
                setSelected(r)
              }
            />
            {shown < list.length && (
              <button
                onClick={() => setShown((s) => s + PAGE)}
                className="mx-auto mt-3 block rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm hover:bg-slate-800"
              >
                Show more ({list.length - shown} left)
              </button>
            )}
          </>
        )}
      </div>
      {selected &&
        (selected.kind === 'relic' ? (
          <RelicDetail
            relicId={selected.relicId ?? ''}
            initial={selected.refinement}
            onClose={() => setSelected(null)}
          />
        ) : selected.kind === 'part' ? (
          <PartDetail
            row={selected}
            plat={platOf(selected)}
            ducats={ducatsOf(selected)}
            onClose={() => setSelected(null)}
          />
        ) : (
          <ModDetail row={selected} plat={platOf(selected)} onClose={() => setSelected(null)} />
        ))}
    </div>
  )
}

function FGroup({
  icon,
  glyph,
  plat,
  title,
  children
}: {
  icon?: string
  glyph?: string
  plat?: boolean
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-slate-200">
        {icon && <WikiIcon file={icon} title={title} color="#7dd3c0" size={16} />}
        {glyph && <span className="text-amber-300">{glyph}</span>}
        {plat && <PlatIcon size={14} />}
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function FOpt({
  on,
  onClick,
  children
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 ${on ? 'border-violet-400/70 bg-violet-500/20 font-semibold text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700/50'}`}
    >
      {children}
    </button>
  )
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="mb-3 text-3xl text-slate-600">⬡</span>
      <div className="mb-1 text-lg font-semibold text-slate-200">No items in this category yet</div>
      <p className="max-w-sm text-sm text-slate-400">
        Your inventory updates as you play Warframe. Complete a mission or enter and leave a relay,
        then refresh.
      </p>
    </div>
  )
}
