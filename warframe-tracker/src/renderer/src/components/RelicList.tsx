import Dropdown from './Dropdown'
import VoidTraceIcon from './VoidTraceIcon'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import * as cache from '../apiCache'
import Icon from './Icon'
import { usePersisted } from '../hooks/usePersisted'
import { refreshPrice, requestPrices, seedFromCache, usePriceStore } from '../hooks/priceStore'
import { useItemMeta } from '../hooks/useItemMeta'
import { useMastery } from '../hooks/useMastery'
import { usePlanetIcons } from '../hooks/usePlanetIcons'
import { toggleRelicFavorite, useSettings } from '../settings'
import { partCounter, relicCounts, totalOf, useInventory } from '../hooks/useInventory'
import PlatIcon from './PlatIcon'
import DucatIcon from './DucatIcon'
import Pic from './Pic'
import NcCard from './NcCard'
import RelicDetail from './RelicDetail'
import {
  FORMA,
  REFINEMENTS,
  OVERLAY_FILTERS_KEY,
  allPartsHeld,
  expectedBest,
  platOf,
  tradable,
  type Get,
  type OverlayFilters
} from '../relicValue'

const TIERS = ['All', 'Lith', 'Meso', 'Neo', 'Axi']
const TRACE_COST: Record<string, number> = {
  Intact: 0,
  Exceptional: 25,
  Flawless: 50,
  Radiant: 100
}
const PAGE = 30
// "Nyx Prime Neuroptics Blueprint" -> "nyx prime", the item a reward builds
const rewardItem = (item: string): string => (/^(.* Prime) /.exec(item)?.[1] ?? item).toLowerCase()

type SortKey = 'plat' | 'ducat' | 'missing' | 'name' | 'owned' | 'bestPlat' | 'bestDucat'
const SORTS: { key: SortKey; label: string; disabled?: boolean }[] = [
  { key: 'plat', label: 'Platinum value' },
  { key: 'ducat', label: 'Ducat value' },
  { key: 'missing', label: 'Missing rewards' },
  { key: 'name', label: 'Name' },
  { key: 'owned', label: 'Amount owned' },
  { key: 'bestPlat', label: 'Best upgrade, platinum' },
  { key: 'bestDucat', label: 'Best upgrade, ducats' }
]

// rarity as a coloured stripe on the tile's left edge: an inline shadow, so the Night City
// button outline (which overrides border colours) can't hide it
const RARITY_STRIPE: Record<string, string> = {
  Common: '#b0703a',
  Uncommon: '#c8d0dc',
  Rare: '#f5c542'
}
// "Nyx Prime Neuroptics Blueprint" -> ["Nyx", "Neuroptics Blueprint"]; everything here is Prime
const splitReward = (item: string): [string, string] => {
  const m = /^(.*?) Prime (.+)$/.exec(item)
  return m ? [m[1], m[2]] : [item, '']
}

const RARITY_STYLE: Record<string, string> = {
  Common: 'border-amber-700/40 bg-amber-900/10',
  Uncommon: 'border-white/15 bg-white/5', // not slate-500: Night City turns that red
  Rare: 'border-yellow-400/60 bg-yellow-400/10'
}

function useOnScreen<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: '100px'
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

const hideBroken = (e: React.SyntheticEvent<HTMLImageElement>): void => {
  e.currentTarget.style.visibility = 'hidden'
}

function FilterChip({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1 text-sm ${
        active
          ? 'border-violet-400 bg-slate-700 text-white'
          : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function RelicCard({
  relic,
  meta,
  get,
  traces,
  refinement,
  players,
  onOpen
}: {
  relic: RelicSummary
  meta: ItemMeta
  get: Get
  traces: number
  refinement: string | null
  players: number
  onOpen: () => void
}): React.JSX.Element {
  const [ref, visible] = useOnScreen<HTMLDivElement>()
  const { relicOwned, relicFavorites } = useSettings()
  const counts = relicCounts(useInventory(), relic.id)
  const owned = counts ? totalOf(counts) : (relicOwned[relic.id] ?? 0)
  const favorite = relicFavorites.includes(relic.id)
  const icons = usePlanetIcons()
  const slugs = relic.rewards.map((r) => r.slug).filter((s): s is string => Boolean(s))
  const key = slugs.join('|')

  // request prices once the card has stayed on screen for a moment
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => requestPrices(slugs), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, key])

  const allLoaded = relic.rewards.every((rw) => !rw.slug || get(rw.slug))
  // The refinement picked in Filters wins; otherwise the refinements you own (from the game
  // inventory), or Radiant when you own none or there is no inventory data.
  const ownedStates = counts ? REFINEMENTS.filter((s) => (counts[s] ?? 0) > 0) : []
  const rows = refinement ? [refinement] : ownedStates.length ? ownedStates : ['Radiant']

  return (
    <div
      ref={ref}
      onClick={onOpen}
      className="cursor-pointer rounded-xl border border-slate-700 bg-slate-800 p-3 hover:border-slate-500"
    >
      {/* header: picture, the value of opening it (one line per refinement), owned, favourite */}
      <div className="mb-3 flex items-start gap-3">
        {relic.imageName && (
          <img
            loading="lazy"
            src={relic.imageName}
            className="h-12 w-12 shrink-0 rounded-lg bg-slate-900 object-contain p-1"
            onError={hideBroken}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="nc-name text-lg font-semibold leading-tight">
            {relic.tier} {relic.name}
          </div>
          {rows.map((s) => {
            const cost = TRACE_COST[s]
            return (
              <div key={s} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {s}
                  {(counts?.[s] ?? 0) > 0 && (
                    <span title="Copies you own" className="ml-1 text-xs text-emerald-300">
                      ×{counts?.[s]}
                    </span>
                  )}
                  {cost > 0 && (
                    <span
                      title={`Refining to ${s} costs ${cost} Void Traces${traces >= cost ? '' : ' (not enough)'}`}
                      className={`ml-1.5 inline-flex items-center gap-0.5 align-middle text-xs ${traces >= cost ? 'text-slate-300' : 'text-slate-400 opacity-60'}`}
                    >
                      · {cost}
                      <VoidTraceIcon small />
                    </span>
                  )}
                </span>
                <span
                  title="Average platinum from opening one"
                  className="inline-flex items-center gap-1 font-semibold tabular-nums text-sky-300"
                >
                  {allLoaded
                    ? expectedBest(relic, s, (rw) => platOf(get, rw.slug), players).toFixed(1)
                    : '…'}
                  <PlatIcon size={12} />
                </span>
                {/* Requiem rewards have no ducat value: no "0.0" for them */}
                {relic.rewards.some((rw) => rw.slug && meta[rw.slug]?.ducats) && (
                  <span
                    title="Average ducats from opening one"
                    className="inline-flex items-center gap-1 font-semibold tabular-nums text-amber-300"
                  >
                    {expectedBest(
                      relic,
                      s,
                      (rw) => (rw.slug ? (meta[rw.slug]?.ducats ?? 0) : 0),
                      players
                    ).toFixed(1)}
                    <DucatIcon size={12} />
                  </span>
                )}
              </div>
            )
          })}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {relic.vaulted && (
              <span className="inline-block rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300">
                <Icon name="lock" /> Vaulted
              </span>
            )}
            {owned > 0 && (
              <span className="inline-block rounded border border-emerald-500/50 bg-emerald-600/15 px-2 py-0.5 text-xs !normal-case !tracking-normal text-emerald-200">
                {counts
                  ? REFINEMENTS.filter((x) => (counts[x] ?? 0) > 0)
                      .map((x) => `×${counts[x]} ${x}`)
                      .join(' · ')
                  : `×${owned} owned`}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleRelicFavorite(relic.id)
          }}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}
          className={`self-start rounded-lg px-2 py-1 text-xl leading-none ${
            favorite ? 'text-amber-300' : 'text-slate-500 hover:text-slate-200'
          }`}
        >
          {favorite ? '★' : '☆'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {relic.rewards.map((rw, i) => {
          const state = get(rw.slug)
          const isForma = FORMA.test(rw.item)
          const label: React.ReactNode = !rw.slug ? (
            <span className="font-normal !normal-case !tracking-normal text-slate-400">
              {isForma ? 'Not tradable' : '—'}
            </span>
          ) : state === 'error' ? (
            '!'
          ) : state ? (
            state.price === null ? (
              '—'
            ) : (
              <>
                {state.price}
                <PlatIcon size={12} />
              </>
            )
          ) : (
            '…'
          )
          const marketIcon = rw.slug ? meta[rw.slug]?.icon : undefined
          const picSrc = isForma ? (icons.forma ?? rw.image) : (rw.image ?? marketIcon)
          const picFallback = isForma ? rw.image : marketIcon
          return (
            <button
              key={i}
              disabled={!rw.slug}
              onClick={(e) => {
                e.stopPropagation()
                if (rw.slug) refreshPrice(rw.slug)
              }}
              title={rw.slug ? 'Click to refresh this price' : 'Not tradable'}
              className={`nc-quiet flex items-center gap-2 rounded-lg border p-1.5 pl-2.5 text-left !normal-case !tracking-normal ${(rw.slug && RARITY_STYLE[rw.rarity]) || 'border-slate-600'} ${rw.slug ? '' : 'opacity-50'}`}
              // an untradable reward (Requiem's Exilus, Kuva) gets no rarity glow: it has no price
              style={{
                boxShadow: `inset 4px 0 0 ${(rw.slug && RARITY_STRIPE[rw.rarity]) || 'transparent'}`
              }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-900 text-xs text-slate-500">
                <Pic src={picSrc} fallback={picFallback} size={36} letter={rw.item[0]} />
              </span>
              <span className="min-w-0 flex-1">
                <span title={rw.item} className="block truncate text-sm leading-tight">
                  {splitReward(rw.item)[0]}
                </span>
                {/* always present (empty for "Lohk", "1200X Kuva") so every tile is equally tall */}
                <span className="block truncate text-[11px] leading-tight !normal-case !tracking-normal text-slate-300">
                  {splitReward(rw.item)[1] || '\u00a0'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300">
                  {label}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function RelicList(): React.JSX.Element {
  const [relics, setRelics] = useState<RelicSummary[]>([])
  const [query, setQuery] = useState('')
  const [tier, setTier] = usePersisted('RelicList.tier', 'All')
  const [sort, setSort] = usePersisted<SortKey>('RelicList.sort', 'plat')
  const [showFilters, setShowFilters] = useState(false)
  const [vaulted, setVaulted] = usePersisted<'any' | 'yes' | 'no'>('RelicList.vaulted', 'any')
  const [refinement, setRefinement] = usePersisted<string | null>('RelicList.refinement', null)
  const [ownership, setOwnership] = usePersisted<'all' | 'owned' | 'missing'>(
    'RelicList.ownership',
    'all'
  )
  const [copies10, setCopies10] = usePersisted<'any' | 'yes' | 'no'>('RelicList.copies10', 'any')
  const [favFilter, setFavFilter] = usePersisted<'any' | 'yes' | 'no' | 'first'>(
    'RelicList.favFilter',
    'any'
  )
  const [players, setPlayers] = usePersisted('RelicList.players', 1)
  const [allParts, setAllParts] = usePersisted<'any' | 'yes' | 'no'>('RelicList.allParts', 'any')
  const [allItems, setAllItems] = usePersisted<'any' | 'yes' | 'no'>('RelicList.allItems', 'any')
  const [, setOverlayFilters] = usePersisted<OverlayFilters | null>(OVERLAY_FILTERS_KEY, null)
  const [applied, setApplied] = useState(false)
  const [invMeta, setInvMeta] = useState<Awaited<ReturnType<typeof window.api.getInventoryMeta>>>(
    {}
  )
  const filterKey = [
    query,
    tier,
    sort,
    vaulted,
    refinement,
    ownership,
    copies10,
    favFilter,
    players,
    allParts,
    allItems
  ].join('|')
  const [page, setPage] = useState({ key: filterKey, shown: PAGE })
  const shown = useSettings().loadAllItems ? Infinity : page.key === filterKey ? page.shown : PAGE // back to one page when a filter changes
  const [selected, setSelected] = useState<RelicSummary | null>(null)
  const [typedTraces, setTraces] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('voidTraces')) || 0
    } catch {
      return 0
    }
  })
  const meta = useItemMeta()
  const settings = useSettings()
  const inventory = useInventory()
  const mastery = useMastery()
  const { get, version } = usePriceStore()

  useEffect(() => {
    cache.relics().then(setRelics)
    cache.inventoryMeta().then(setInvMeta)
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('voidTraces', String(typedTraces))
    } catch {
      // storage unavailable, not critical
    }
  }, [typedTraces])
  // Void Traces from the game inventory (a MiscItems resource), refreshed after loading screens;
  // the typed number is only used while no inventory is loaded
  const invTraces = useMemo(() => {
    const misc = inventory.data?.raw?.MiscItems
    if (!Array.isArray(misc)) return undefined
    const row = (misc as { ItemType?: string; ItemCount?: number }[]).find((m) =>
      m.ItemType?.endsWith('/VoidTearDrop')
    )
    return row?.ItemCount ?? 0
  }, [inventory.data])
  const traces = invTraces ?? typedTraces

  const allSlugs = useMemo(
    () => [
      ...new Set(
        relics.flatMap((r) => r.rewards.map((rw) => rw.slug).filter((s): s is string => !!s))
      )
    ],
    [relics]
  )

  // Preload every price: saved ones show instantly, stale or missing ones are fetched.
  const [seeded, setSeeded] = useState(false)
  const [skipped, setSkipped] = useState(false)
  useEffect(() => {
    seedFromCache().finally(() => setSeeded(true))
  }, [])
  useEffect(() => {
    if (seeded && allSlugs.length && settings.preloadPrices) requestPrices(allSlugs)
  }, [seeded, allSlugs, settings.preloadPrices])
  const total = allSlugs.length
  const have = allSlugs.filter((s) => get(s)).length
  const pct = total ? Math.round((have / total) * 100) : 0
  // only real downloads count: reading saved prices and the relic list is quick, and covering
  // the app for it flashed it dark on every visit
  const loadingPrices =
    !skipped && settings.preloadPrices && seeded && relics.length > 0 && have < total
  // and the overlay waits 0.4 s, so short loads finish without it
  const [overlayDue, setOverlayDue] = useState(false)
  useEffect(() => {
    if (!loadingPrices) return
    const t = setTimeout(() => setOverlayDue(true), 400)
    return () => {
      clearTimeout(t)
      setOverlayDue(false)
    }
  }, [loadingPrices])
  const preloading = loadingPrices && overlayDue

  // prices arrive one by one (hundreds while preloading); deferring lets React skip in-between
  // re-sorts instead of redoing the sort for every single price
  const sortVersion = useDeferredValue(version)
  const visibleRelics = useMemo(() => {
    const q = query.trim().toLowerCase()
    // game inventory when there is one, otherwise the manual counter
    const ownedOf = (r: RelicSummary): number => {
      const counts = relicCounts(inventory, r.id)
      return counts ? totalOf(counts) : (settings.relicOwned[r.id] ?? 0)
    }
    // a reward is still needed when you hold none of that part and its item ("Nyx Prime") is
    // neither owned nor mastered; forma and other non-Prime rewards never count
    const needed = new Set(
      mastery.rows.filter((m) => !m.owned && !m.mastered).map((m) => m.item.name.toLowerCase())
    )
    const held = partCounter(inventory.data?.raw ?? {})
    const heldBySlug = new Map<string, number>()
    for (const [u, m] of Object.entries(invMeta))
      if (m.kind === 'part' && m.slug)
        heldBySlug.set(m.slug, (heldBySlug.get(m.slug) ?? 0) + held(u))
    const missingOf = (r: RelicSummary): number =>
      tradable(r).filter(
        (rw) => needed.has(rewardItem(rw.item)) && !(heldBySlug.get(rw.slug!) ?? 0)
      ).length
    const allItemsDone = (r: RelicSummary): boolean =>
      tradable(r).every((rw) => !needed.has(rewardItem(rw.item)))
    const list = relics.filter(
      (r) =>
        (tier === 'All' || r.tier === tier) &&
        (vaulted === 'any' || r.vaulted === (vaulted === 'yes')) &&
        (ownership === 'all' || ownedOf(r) > 0 === (ownership === 'owned')) &&
        (copies10 === 'any' || ownedOf(r) >= 10 === (copies10 === 'yes')) &&
        (allParts === 'any' || allPartsHeld(r, heldBySlug) === (allParts === 'yes')) &&
        (allItems === 'any' || allItemsDone(r) === (allItems === 'yes')) &&
        (favFilter === 'any' ||
          favFilter === 'first' ||
          settings.relicFavorites.includes(r.id) === (favFilter === 'yes')) &&
        (!q ||
          `${r.tier} ${r.name}`.toLowerCase().includes(q) ||
          r.rewards.some((rw) => rw.item.toLowerCase().includes(q)))
    )
    const state = refinement ?? settings.cardRefinement
    const plat = (r: RelicSummary, s: string): number =>
      expectedBest(r, s, (rw) => platOf(get, rw.slug), players)
    const ducat = (r: RelicSummary, s: string): number =>
      expectedBest(r, s, (rw) => (rw.slug ? (meta[rw.slug]?.ducats ?? 0) : 0), players)
    const score: Record<SortKey, (r: RelicSummary) => number> = {
      plat: (r) => plat(r, state),
      ducat: (r) => ducat(r, state),
      name: () => 0,
      // rewards whose item ("Nyx Prime") you neither own nor have mastered; forma etc. don't count
      missing: missingOf,
      owned: ownedOf,
      // gain from refining Intact -> Radiant; the cost is the same for every relic
      bestPlat: (r) => plat(r, 'Radiant') - plat(r, 'Intact'),
      bestDucat: (r) => ducat(r, 'Radiant') - ducat(r, 'Intact')
    }
    // each relic's value is worked out once, not inside every comparison: with ~3,200 relics the
    // sort compares tens of thousands of times and re-ran on every arriving price, freezing the app
    const key = sort === 'name' ? null : new Map(list.map((r) => [r, score[sort](r)]))
    const sorted = [...list].sort((a, b) =>
      key ? key.get(b)! - key.get(a)! : `${a.tier} ${a.name}`.localeCompare(`${b.tier} ${b.name}`)
    )
    if (favFilter !== 'first') return sorted
    const fav = (r: RelicSummary): number => (settings.relicFavorites.includes(r.id) ? 0 : 1)
    return sorted.sort((a, b) => fav(a) - fav(b)) // stable: favorites first, same order inside each group
    // version makes the list re-sort as prices arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    relics,
    query,
    tier,
    vaulted,
    refinement,
    sort,
    meta,
    sortVersion,
    settings.cardRefinement,
    ownership,
    copies10,
    favFilter,
    players,
    settings.relicOwned,
    settings.relicFavorites,
    inventory,
    mastery.rows,
    invMeta,
    allParts,
    allItems
  ])

  const activeFilters = [
    ownership !== 'all',
    vaulted !== 'any',
    refinement !== null,
    copies10 !== 'any',
    favFilter !== 'any',
    allParts !== 'any',
    allItems !== 'any'
  ].filter(Boolean).length

  return (
    <div className="p-4 text-slate-100">
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-700/70 pb-3">
        <div className="flex flex-wrap gap-1">
          {TIERS.map((t) => {
            const icon = relics.find((r) => r.tier === t && r.imageName)?.imageName
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  tier === t
                    ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                    : 'border-transparent text-slate-300 hover:bg-slate-800'
                }`}
              >
                {t === 'All' ? (
                  <span className="text-base leading-none">∞</span>
                ) : icon ? (
                  <img
                    loading="lazy"
                    src={icon}
                    className="h-5 w-5 object-contain"
                    onError={hideBroken}
                  />
                ) : null}
                {t}
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
            <span className="text-slate-400">⌕</span>
            <input
              className="w-40 bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search"
              title="Search a relic (Lith A1) or a part (Rhino Prime Systems)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              onClick={() => setQuery('')}
              title="Clear search"
              className="text-slate-400 hover:text-slate-200"
            >
              <Icon name="trash" />
            </button>
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
              showFilters || activeFilters > 0
                ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                : 'border-slate-600 bg-slate-900/60 hover:bg-slate-800'
            }`}
          >
            ▼ Filters
            {activeFilters > 0 && (
              <span className="rounded bg-violet-600 px-1.5 text-xs text-white">
                {activeFilters}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setOverlayFilters({ tier, vaulted, refinement, copies10, players, allParts, sort })
              setApplied(true)
              setTimeout(() => setApplied(false), 1500)
            }}
            title="Use the current filters and sort for the in-game Recommended relics overlay"
            className="rounded-lg border border-violet-400/60 px-3 py-2 text-sm font-semibold hover:bg-slate-800"
          >
            {applied ? 'Applied' : 'Apply filters to overlay'}
          </button>
          <Dropdown
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={SORTS.map((o) => ({ value: o.key, label: o.label, disabled: o.disabled }))}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1">
          {(
            [
              ['all', 'All relics'],
              ['owned', 'Owned'],
              ['missing', 'Missing']
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setOwnership(k)}
              className={`rounded-md border px-3 py-1.5 ${
                ownership === k
                  ? 'border-violet-400/60 bg-violet-500/20 text-white'
                  : 'border-transparent text-slate-300 hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 font-semibold">
          Players opening this relic
          <Dropdown
            size="sm"
            value={String(players)}
            onChange={(v) => setPlayers(Number(v))}
            title="Values become the expected best of what the squad rolls (an estimate)"
            options={[1, 2, 3, 4].map((n) => ({
              value: String(n),
              label: `${n} player${n > 1 ? 's' : ''}`
            }))}
          />
        </label>
        <span className="text-slate-300">
          {players === 1 ? 'Values for opening one relic' : `Best of ${players} rolls, per relic`}
        </span>
        <label
          title={
            invTraces != null
              ? 'Void traces from your inventory, updated after each loading screen'
              : 'Void traces: type your amount, or load your inventory to track them automatically'
          }
          className="ml-auto flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1 text-sm !normal-case !tracking-normal ring-1 ring-slate-600"
        >
          <VoidTraceIcon />
          <span className="text-slate-300">Void Traces</span>
          {invTraces != null ? (
            // tracked from the inventory: plain text, nothing to type
            <span className="min-w-12 text-right text-lg font-bold">{traces}</span>
          ) : (
            <input
              type="number"
              min={0}
              value={traces}
              aria-label="Void traces"
              onChange={(e) => setTraces(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
              className="w-24 bg-transparent text-right text-lg font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          )}
        </label>
      </div>

      {showFilters && (
        <div className="mb-3">
          <NcCard title={'Filter relics'}>
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="nc-name font-semibold">Filter relics</span>
                <button
                  onClick={() => setShowFilters(false)}
                  className="rounded-lg border border-violet-400/70 px-3 py-1.5 text-sm font-semibold hover:bg-slate-800"
                >
                  ✕ Close filters
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-3 xl:grid-cols-6">
                <div>
                  <div className="mb-1.5 text-sm text-slate-200">Relic ownership</div>
                  <div className="flex gap-1.5">
                    <FilterChip
                      active={ownership === 'owned'}
                      onClick={() => setOwnership(ownership === 'owned' ? 'all' : 'owned')}
                    >
                      Owned
                    </FilterChip>
                    <FilterChip
                      active={ownership === 'missing'}
                      onClick={() => setOwnership(ownership === 'missing' ? 'all' : 'missing')}
                    >
                      Missing
                    </FilterChip>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-sm text-slate-200">Vaulted</div>
                  <div className="flex gap-1.5">
                    <FilterChip
                      active={vaulted === 'yes'}
                      onClick={() => setVaulted(vaulted === 'yes' ? 'any' : 'yes')}
                    >
                      Yes
                    </FilterChip>
                    <FilterChip
                      active={vaulted === 'no'}
                      onClick={() => setVaulted(vaulted === 'no' ? 'any' : 'no')}
                    >
                      No
                    </FilterChip>
                  </div>
                </div>
                {(
                  [
                    ['All rewards owned', 'You hold every tradable part', allParts, setAllParts],
                    [
                      'All items mastered/owned',
                      'Every item these parts build is owned or mastered',
                      allItems,
                      setAllItems
                    ]
                  ] as const
                ).map(([label, hint, value, set]) => (
                  <div key={label} title={inventory.data ? hint : 'Needs your game inventory'}>
                    <div className="mb-1.5 text-sm text-slate-200">{label}</div>
                    <div className="flex gap-1.5">
                      <FilterChip
                        active={value === 'yes'}
                        onClick={() => set(value === 'yes' ? 'any' : 'yes')}
                      >
                        Yes
                      </FilterChip>
                      <FilterChip
                        active={value === 'no'}
                        onClick={() => set(value === 'no' ? 'any' : 'no')}
                      >
                        No
                      </FilterChip>
                    </div>
                  </div>
                ))}
                <div>
                  <div className="mb-1.5 text-sm text-slate-200">At least 10 copies</div>
                  <div className="flex gap-1.5">
                    <FilterChip
                      active={copies10 === 'yes'}
                      onClick={() => setCopies10(copies10 === 'yes' ? 'any' : 'yes')}
                    >
                      Yes
                    </FilterChip>
                    <FilterChip
                      active={copies10 === 'no'}
                      onClick={() => setCopies10(copies10 === 'no' ? 'any' : 'no')}
                    >
                      No
                    </FilterChip>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-sm text-slate-200">Refinement</div>
                  <div className="flex flex-wrap gap-1.5">
                    {REFINEMENTS.map((r) => (
                      <FilterChip
                        key={r}
                        active={refinement === r}
                        onClick={() => setRefinement(refinement === r ? null : r)}
                      >
                        {r}
                      </FilterChip>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-sm text-slate-200">★ Favorite</div>
                  <div className="flex gap-1.5">
                    {(
                      [
                        ['yes', 'Yes'],
                        ['no', 'No'],
                        ['first', 'Order first']
                      ] as const
                    ).map(([k, label]) => (
                      <FilterChip
                        key={k}
                        active={favFilter === k}
                        onClick={() => setFavFilter(favFilter === k ? 'any' : k)}
                      >
                        {label}
                      </FilterChip>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </NcCard>
        </div>
      )}

      <p className="mb-3 text-sm text-slate-400">
        {visibleRelics.length} relics · prices: median of the 5 cheapest online sell orders
        (warframe.market)
        {settings.preloadPrices && !preloading && have < total && (
          <span className="ml-2 text-sky-300">
            Loading prices {have}/{total}…
          </span>
        )}
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-3">
        {visibleRelics.slice(0, shown).map((r) => (
          <NcCard key={r.id} title={`${r.tier} ${r.name} relic`}>
            <RelicCard
              relic={r}
              meta={meta}
              get={get}
              traces={traces}
              refinement={refinement ?? settings.cardRefinement}
              players={players}
              onOpen={() => setSelected(r)}
            />
          </NcCard>
        ))}
      </div>
      {shown < visibleRelics.length && (
        <button
          onClick={() => setPage({ key: filterKey, shown: shown + PAGE })}
          className="mx-auto mt-4 block rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
        >
          Show more
        </button>
      )}
      {preloading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-96 rounded-2xl border border-slate-600 bg-slate-900 p-6 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-violet-400" />
            <div className="text-xl font-semibold">Loading prices</div>
            <p className="mt-2 text-sm text-slate-300">
              Please wait while the prices for your relics are loaded
            </p>
            <div className="mt-5 flex justify-between text-xs text-slate-300">
              <span>
                Loading price {have}/{total}...
              </span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-slate-800">
              <div className="h-full bg-violet-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <button
              onClick={() => setSkipped(true)}
              className="mt-4 text-xs text-slate-400 underline"
            >
              Continue without waiting
            </button>
          </div>
        </div>
      )}
      {selected && (
        <RelicDetail
          relicId={selected.id}
          traces={traces}
          initial={refinement ?? settings.cardRefinement}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
