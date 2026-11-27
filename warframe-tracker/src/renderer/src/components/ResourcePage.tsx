import { useEffect, useMemo, useState } from 'react'
import * as cache from '../apiCache'
import Icon from './Icon'
import { refreshInventory, useInventory } from '../hooks/useInventory'
import { usePersisted } from '../hooks/usePersisted'
import Pic from './Pic'
import NcCard from './NcCard'
import ResourceDetail from './ResourceDetail'
import { useSettings } from '../settings'
import { resourceNeeds, type Recipes } from '../resourceNeeds'

type Sort = 'name' | 'owned' | 'needed'
const SORT_LABEL: Record<Sort, string> = {
  name: 'Name',
  owned: 'Most owned',
  needed: 'Largest shortage'
}
type Show = 'all' | 'owned' | 'needed'
const SHOW_LABEL: Record<Show, string> = {
  all: '◈ All resources',
  owned: '◈ Owned',
  needed: '◈ Needed'
}
// gear you have built or mastered: its blueprint's resources are no longer needed
const HAVE_SECTIONS = [
  'XPInfo',
  'Suits',
  'LongGuns',
  'Pistols',
  'Melee',
  'Sentinels',
  'SentinelWeapons',
  'SpaceGuns',
  'SpaceMelee',
  'SpaceSuits',
  'MechSuits'
]

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`
  return String(n)
}

export default function ResourcePage(): React.JSX.Element {
  const inv = useInventory()
  const { craftingFavorites } = useSettings()
  const [catalog, setCatalog] = useState<ResourceMeta[]>([])
  const [crafts, setCrafts] = useState<CraftItem[]>([])
  const [recipes, setRecipes] = useState<Recipes>({})
  const [open, setOpen] = useState<ResourceMeta | null>(null)
  const [show, setShow] = useState<Show>('owned')
  const [query, setQuery] = useState('')
  const [sort, setSort] = usePersisted<Sort>('ResourcePage.sort', 'name')
  const [sortOpen, setSortOpen] = useState(false)

  useEffect(() => {
    cache.resourceCatalog().then(setCatalog)
    cache.craftables().then(setCrafts)
    cache.recipeMap().then(setRecipes, () => {}) // offline: direct resources only
  }, [])

  // owned counts from the inventory's MiscItems (normalise the store-item path)
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    const misc = (inv.data?.raw?.MiscItems ?? []) as { ItemType?: string; ItemCount?: number }[]
    if (Array.isArray(misc))
      for (const e of misc)
        if (e.ItemType) m.set(e.ItemType.replace('/Lotus/StoreItems/', '/Lotus/'), e.ItemCount ?? 0)
    return m
  }, [inv.data])

  const isRes = useMemo(() => {
    const ids = new Set(catalog.map((r) => r.uniqueName))
    return (id: string): boolean => ids.has(id)
  }, [catalog])

  // what your favourite blueprints need, and what everything not yet built or mastered needs
  const favNeed = useMemo(() => {
    const fav = new Set(craftingFavorites)
    return resourceNeeds(
      crafts,
      (id) => fav.has(id),
      recipes,
      (id) => counts.get(id) ?? 0,
      isRes
    )
  }, [crafts, craftingFavorites, recipes, counts, isRes])
  const allNeed = useMemo(() => {
    const raw = inv.data?.raw ?? {}
    const have = new Set<string>()
    for (const s of HAVE_SECTIONS) {
      const l = raw[s]
      if (Array.isArray(l))
        for (const e of l as { ItemType?: string }[])
          if (e.ItemType) have.add(e.ItemType.replace('/Lotus/StoreItems/', '/Lotus/'))
    }
    return resourceNeeds(
      crafts,
      (id) => !have.has(id),
      recipes,
      (id) => counts.get(id) ?? 0,
      isRes
    )
  }, [crafts, inv.data, recipes, counts, isRes])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = catalog
      .map((r) => {
        const count = counts.get(r.uniqueName) ?? 0
        return { ...r, count, short: Math.max(0, (allNeed.get(r.uniqueName) ?? 0) - count) }
      })
      .filter(
        (r) =>
          (show === 'all' || (show === 'owned' ? r.count > 0 : r.short > 0)) &&
          (!q || r.name.toLowerCase().includes(q))
      )
    return rows.sort((a, b) =>
      sort === 'owned'
        ? b.count - a.count
        : sort === 'needed'
          ? b.short - a.short || a.name.localeCompare(b.name)
          : a.name.localeCompare(b.name)
    )
  }, [catalog, counts, allNeed, show, query, sort])

  if (inv.state !== 'ok' && !inv.data) {
    return (
      <div className="p-6 text-slate-100">
        <h1 className="mb-2 text-2xl font-bold">Resource inventory</h1>
        <p className="mb-4 max-w-md text-sm text-slate-400">
          Your resources are read from the running game. Start Warframe, log in, then load it.
        </p>
        <button
          onClick={refreshInventory}
          disabled={inv.state === 'loading'}
          className="rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {inv.state === 'loading' ? 'Reading inventory…' : '↻ Load inventory'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-4 text-slate-100">
      <h1 className="mb-3 text-2xl font-bold">Resource inventory</h1>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1 text-sm">
          {(Object.keys(SHOW_LABEL) as Show[]).map((k) => (
            <button
              key={k}
              onClick={() => setShow(k)}
              title={
                k === 'needed' ? 'Resources you have too few of for all your unlocks' : undefined
              }
              className={`rounded-md px-3 py-1.5 ${
                show === k ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {SHOW_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
          <span className="text-slate-400">⌕</span>
          <input
            className="w-full bg-transparent outline-none placeholder:text-slate-400"
            placeholder="Search resources by name"
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
            {SORT_LABEL[sort]}
            <span className="text-xs">▾</span>
          </button>
          {sortOpen && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-slate-600 bg-slate-900 p-1 shadow-xl">
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSort(s)
                    setSortOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm ${
                    sort === s ? 'bg-violet-600 text-white' : 'hover:bg-slate-800'
                  }`}
                >
                  {SORT_LABEL[s]}
                  {sort === s && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">No resources match.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {list.map((r) => (
              <NcCard key={r.uniqueName} title={r.type ?? 'Resource'}>
                <button
                  onClick={() => setOpen(r)}
                  className="flex w-full flex-1 cursor-pointer flex-col items-center rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-center hover:bg-white/5"
                >
                  <span className="flex h-14 w-14 items-center justify-center">
                    <Pic src={r.image} fallback={r.imageFallback} size={52} letter={r.name[0]} />
                  </span>
                  {/* not nc-name: Night City hides that inside cards; the tab shows the type */}
                  <div className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-slate-100">
                    {r.name}
                  </div>
                  <div className="mb-2 mt-1 text-lg font-bold">
                    {compact(r.count)}{' '}
                    <span className="text-xs font-normal text-slate-400">owned</span>
                  </div>
                  <div className="mt-auto w-full space-y-0.5 border-t border-white/10 pt-2 text-xs">
                    {craftingFavorites.length > 0 && (
                      <NeedLine
                        label="Favorites"
                        need={favNeed.get(r.uniqueName) ?? 0}
                        have={r.count}
                      />
                    )}
                    <NeedLine
                      label="All unlocks"
                      need={allNeed.get(r.uniqueName) ?? 0}
                      have={r.count}
                    />
                  </div>
                </button>
              </NcCard>
            ))}
          </div>
        )}
      </div>
      {open && (
        <ResourceDetail
          res={open}
          count={counts.get(open.uniqueName) ?? 0}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

// values in normal case: Night City capitalises small card text, which reads slowly in numbers
const NORMAL_CASE = { textTransform: 'none' } as const

// "Not needed", "✓ N to keep" when you have enough, or "N short" in red
function NeedLine({
  label,
  need,
  have
}: {
  label: string
  need: number
  have: number
}): React.JSX.Element {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      {need === 0 ? (
        <span className="text-white/45" style={NORMAL_CASE}>
          Not needed
        </span>
      ) : have >= need ? (
        <span
          className="text-emerald-400"
          style={NORMAL_CASE}
          title={`Keep ${need.toLocaleString('en-US')}`}
        >
          ✓ {compact(need)} to keep
        </span>
      ) : (
        <span
          className="text-red-400"
          style={NORMAL_CASE}
          title={`Need ${need.toLocaleString('en-US')}, have ${have.toLocaleString('en-US')}`}
        >
          {compact(need - have)} short
        </span>
      )}
    </div>
  )
}
