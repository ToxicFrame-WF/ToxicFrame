import Dropdown from './Dropdown'
import { useEffect, useMemo, useState } from 'react'
import * as cache from '../apiCache'
import Icon from './Icon'
import { useInventory } from '../hooks/useInventory'
import { usePersisted } from '../hooks/usePersisted'
import { toggleCraftingFavorite, useSettings } from '../settings'
import Pic from './Pic'
import NcCard from './NcCard'
import { usePlanetIcons } from '../hooks/usePlanetIcons'

const CREDITS = '__credits__'
type Tab = 'everything' | 'needed'
type Sort = 'goals' | 'name' | 'shortage' | 'owned'
const SORTS: { key: Sort; label: string }[] = [
  { key: 'goals', label: 'Most goals helped' },
  { key: 'name', label: 'Name' },
  { key: 'shortage', label: 'Largest shortage' },
  { key: 'owned', label: 'Most owned' }
]
const KIND_LABEL: Record<CompKind, string> = {
  resource: 'Resource',
  blueprint: 'Blueprint',
  component: 'Component'
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0
}
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

interface ShopRow {
  key: string
  name: string
  image?: string
  kind: CompKind
  needed: number
  owned: number
  shortage: number
  goals: number
}

export default function CraftingHelper(): React.JSX.Element {
  const icons = usePlanetIcons() // holds the wiki's Credits icon
  const inv = useInventory()
  const { craftingFavorites } = useSettings()
  const [catalog, setCatalog] = useState<CraftItem[]>([])
  const [modal, setModal] = useState(false)
  const [tab, setTab] = usePersisted<Tab>('CraftingHelper.tab', 'everything')
  const [query, setQuery] = useState('')
  const [sort, setSort] = usePersisted<Sort>('CraftingHelper.sort', 'name')
  const [sortOpen, setSortOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [types, setTypes] = useState<Set<CompKind>>(new Set())

  useEffect(() => {
    cache.craftables().then(setCatalog)
  }, [])

  const byId = useMemo(() => new Map(catalog.map((c) => [c.uniqueName, c])), [catalog])

  // owned counts across resources, recipes and built gear
  const ownedMap = useMemo(() => {
    const m = new Map<string, number>()
    const raw = inv.data?.raw ?? {}
    const sections = [
      'MiscItems',
      'Recipes',
      'PendingRecipes',
      'Suits',
      'LongGuns',
      'Pistols',
      'Melee',
      'Sentinels',
      'SentinelWeapons',
      'SpaceGuns',
      'SpaceMelee',
      'SpaceSuits',
      'MechSuits',
      'KubrowPets',
      'MoaPets'
    ]
    for (const s of sections) {
      const list = raw[s]
      if (!Array.isArray(list)) continue
      for (const e of list as { ItemType?: string; ItemCount?: number }[]) {
        const id = (e.ItemType ?? '').replace('/Lotus/StoreItems/', '/Lotus/')
        if (id) m.set(id, (m.get(id) ?? 0) + (e.ItemCount ?? 1))
      }
    }
    return m
  }, [inv.data])
  const credits = num(inv.data?.raw?.RegularCredits)
  const rank = inv.data?.masteryRank ?? 0

  const favItems = craftingFavorites.map((id) => byId.get(id)).filter((c): c is CraftItem => !!c)

  // aggregate the bill of materials across every favourite
  const rows = useMemo(() => {
    const map = new Map<string, ShopRow>()
    const bump = (
      key: string,
      name: string,
      kind: CompKind,
      image: string | undefined,
      need: number,
      goal: string
    ): void => {
      const r = map.get(key) ?? {
        key,
        name,
        image,
        kind,
        needed: 0,
        owned: 0,
        shortage: 0,
        goals: 0
      }
      r.needed += need
      map.set(key, r)
      ;(r as ShopRow & { _g?: Set<string> })._g ??= new Set<string>()
      ;(r as ShopRow & { _g?: Set<string> })._g!.add(goal)
    }
    for (const fav of favItems) {
      for (const c of fav.components)
        bump(c.uniqueName, c.name, c.kind, c.image, c.itemCount, fav.uniqueName)
      if (fav.buildPrice > 0)
        bump(CREDITS, 'Credits', 'resource', undefined, fav.buildPrice, fav.uniqueName)
    }
    const out: ShopRow[] = []
    for (const r of map.values()) {
      r.owned = r.key === CREDITS ? credits : (ownedMap.get(r.key) ?? 0)
      r.shortage = Math.max(0, r.needed - r.owned)
      r.goals = (r as ShopRow & { _g?: Set<string> })._g?.size ?? 0
      out.push(r)
    }
    return out
  }, [favItems, ownedMap, credits])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter(
      (r) =>
        (tab === 'everything' || r.shortage > 0) &&
        (types.size === 0 || types.has(r.kind)) &&
        (!q || r.name.toLowerCase().includes(q))
    )
    return list.sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'goals'
          ? b.goals - a.goals
          : sort === 'owned'
            ? b.owned - a.owned
            : b.shortage - a.shortage
    )
  }, [rows, tab, types, query, sort])

  return (
    <div className="flex h-full text-slate-100">
      {/* favorites panel */}
      <div className="flex w-64 shrink-0 flex-col border-r border-slate-700/60 p-4">
        <div className="mb-3 font-semibold">Your favorites</div>
        <button
          onClick={() => setModal(true)}
          className="mb-4 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Add favorites
        </button>
        {favItems.length === 0 ? (
          <div className="mt-6 flex flex-col items-center text-center">
            <span className="mb-2 text-3xl text-violet-400">◇</span>
            <div className="font-semibold">No crafting favorites</div>
            <p className="mb-3 mt-1 text-xs text-slate-400">
              Add craftable items to your favorites to see their materials
            </p>
            <button
              onClick={() => setModal(true)}
              className="rounded-lg border border-violet-500/60 px-3 py-1.5 text-sm text-violet-200 hover:bg-violet-500/10"
            >
              Browse craftable items
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            {favItems.map((f) => (
              <NcCard key={f.uniqueName} title={f.name}>
                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-2">
                  <Pic src={f.image} size={28} letter={f.name[0]} />
                  <span className="nc-name min-w-0 flex-1 truncate text-sm">{f.name}</span>
                  <span className="hidden flex-1 [.nc-card_&]:block" />
                  <button
                    onClick={() => toggleCraftingFavorite(f.uniqueName)}
                    title="Remove"
                    className="text-slate-500 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </div>
              </NcCard>
            ))}
          </div>
        )}
      </div>

      {/* shopping list */}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <h1 className="mb-3 text-2xl font-bold">Crafting helper</h1>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
            <span className="text-slate-400">⌕</span>
            <input
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search materials"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-200">
              <Icon name="trash" />
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              {SORTS.find((s) => s.key === sort)?.label}
              <span className="text-xs">▾</span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-slate-600 bg-slate-900 p-1 shadow-xl">
                {SORTS.map((s) => (
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
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              showFilters || types.size
                ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                : 'border-slate-600 bg-slate-900/60 hover:bg-slate-800'
            }`}
          >
            ⧩ Filters
          </button>
        </div>

        <div className="mb-3 flex gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1 text-sm">
          {(
            [
              ['everything', 'Everything'],
              ['needed', 'Still needed']
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-md px-3 py-1.5 ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="mb-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-sm">
            <div className="mb-2 text-slate-400">Type</div>
            <div className="flex flex-wrap gap-2">
              {(['resource', 'blueprint', 'component'] as CompKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() =>
                    setTypes((s) => {
                      const n = new Set(s)
                      n.has(k) ? n.delete(k) : n.add(k)
                      return n
                    })
                  }
                  className={`rounded-lg border px-3 py-1.5 ${
                    types.has(k)
                      ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                      : 'border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  {k === 'resource'
                    ? 'Resources & credits'
                    : k === 'blueprint'
                      ? 'Blueprints'
                      : 'Components to craft'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {favItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-lg font-semibold">Your shopping list will appear here</div>
              <p className="mt-1 text-sm text-slate-400">
                Add goals to see required resources, blueprints, and components.
              </p>
            </div>
          ) : shown.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">Nothing to show here.</p>
          ) : (
            <div className="space-y-3">
              {shown.map((r) => (
                <NcCard key={r.key} title={r.name}>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-2.5">
                    <Pic
                      src={r.image ?? (r.name === 'Credits' ? icons.credits : undefined)}
                      size={36}
                      letter={r.name[0]}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="nc-name truncate font-semibold">{r.name}</div>
                      <div className="text-xs text-slate-400">
                        {KIND_LABEL[r.kind]} · needed by {r.goals} favorite{r.goals > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div>
                        <span className={r.shortage > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                          {compact(r.owned)}
                        </span>
                        <span className="text-slate-500"> / {compact(r.needed)}</span>
                      </div>
                      {r.shortage > 0 ? (
                        <div className="text-xs text-rose-300">need {compact(r.shortage)} more</div>
                      ) : (
                        <div className="text-xs text-emerald-400">✓ have enough</div>
                      )}
                    </div>
                  </div>
                </NcCard>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <FavoritesModal
          catalog={catalog}
          favorites={craftingFavorites}
          ownedMap={ownedMap}
          rank={rank}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}

// ---- Favorite items browser ----

const CAT_GROUPS: { label: string; cats: string[] }[] = [
  { label: 'Warframes', cats: ['Suits', 'SpaceSuits', 'MechSuits'] },
  { label: 'Primary', cats: ['LongGuns'] },
  { label: 'Secondary', cats: ['Pistols'] },
  { label: 'Melee', cats: ['Melee'] },
  { label: 'Archwing', cats: ['SpaceGuns', 'SpaceMelee'] },
  { label: 'Companions', cats: ['Sentinels', 'SentinelWeapons', 'KubrowPets', 'MoaPets'] }
]

function FavoritesModal({
  catalog,
  favorites,
  ownedMap,
  rank,
  onClose
}: {
  catalog: CraftItem[]
  favorites: string[]
  ownedMap: Map<string, number>
  rank: number
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')
  const favSet = new Set(favorites)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const cats = CAT_GROUPS.find((g) => g.label === group)?.cats
    return catalog.filter(
      (c) =>
        (!cats || (c.productCategory && cats.includes(c.productCategory))) &&
        (!q || c.name.toLowerCase().includes(q))
    )
  }, [catalog, query, group])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="nc-dialog-card flex max-h-full w-full max-w-4xl flex-col rounded-lg bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <NcCard title="Favorite items" className="min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="text-xl font-bold">Favorite items</div>
                <p className="text-xs text-slate-400">
                  Craftable favorites appear in your plan automatically.
                </p>
              </div>
              <button onClick={onClose} className="text-xl text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
                <span className="text-slate-400">⌕</span>
                <input
                  className="w-full bg-transparent outline-none placeholder:text-slate-400"
                  placeholder="Search Warframes, weapons, equipment…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Dropdown
                value={group}
                onChange={setGroup}
                options={[
                  { value: 'All', label: 'All' },
                  ...CAT_GROUPS.map((g) => ({ value: g.label, label: g.label }))
                ]}
              />
            </div>
            <div className="mb-2 text-xs text-slate-400">
              {catalog.length} recipes, {favorites.length} crafting favorites in your plan
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {list.slice(0, 400).map((c) => {
                const owned = ownedMap.get(c.uniqueName) ?? 0
                const locked = c.masteryReq > rank
                const fav = favSet.has(c.uniqueName)
                return (
                  <div
                    key={c.uniqueName}
                    className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-2.5"
                  >
                    <Pic src={c.image} size={40} letter={c.name[0]} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{c.name}</div>
                      <div className="text-xs text-slate-400">
                        {c.type}
                        {c.masteryReq > 0 && `, MR ${c.masteryReq}`}
                      </div>
                      <div className="text-xs text-slate-400">{owned} owned</div>
                      {locked && (
                        <div className="text-xs text-amber-300/80">Requires higher mastery</div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleCraftingFavorite(c.uniqueName)}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                        fav
                          ? 'border-violet-400 bg-violet-600 text-white'
                          : 'border-violet-500/60 text-violet-200 hover:bg-violet-500/10'
                      }`}
                    >
                      {fav ? 'Favorited' : 'Favorite'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </NcCard>
      </div>
    </div>
  )
}
