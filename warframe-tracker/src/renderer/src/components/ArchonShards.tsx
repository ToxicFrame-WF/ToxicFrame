import { useEffect, useMemo, useState } from 'react'
import * as cache from '../apiCache'
import { useInventory } from '../hooks/useInventory'
import { usePersisted } from '../hooks/usePersisted'
import { useSettings } from '../settings'
import Pic from './Pic'
import NcCard from './NcCard'
import WarframeDetail from './WarframeDetail'
import {
  effectFor,
  parseInstalled,
  peekPendingInspect,
  clearPendingInspect,
  type Installed
} from '../archonShards'

// Archwings are in the frame group of the catalog but cannot take shards.
const ARCHWINGS = /^(Amesha|Elytron|Itzal|Odonata)( Prime)?$/i

type Sort = 'most' | 'name' | 'tau' | 'regular'
const SORTS: [Sort, string][] = [
  ['most', 'Most shards'],
  ['name', 'Warframe name'],
  ['tau', 'Most Tauforged'],
  ['regular', 'Most regular shards']
]

type Quality = 'regular' | 'tau' | 'fullTau'
const QUALITIES: [Quality, string][] = [
  ['regular', 'Has regular shards'],
  ['tau', 'Has Tauforged shards'],
  ['fullTau', 'Fully Tauforged']
]
interface ShardFilters {
  colors: string[]
  quality: Quality[]
  favOnly: boolean
}
const NO_FILTERS: ShardFilters = { colors: [], quality: [], favOnly: false }
function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

type Tab = 'warframes' | 'fusion' | 'effects'
type Slot = 'all' | 'with' | 'empty' | 'full'

// Coalescent recipes: two colours combine into a fusion colour.
const COALESCENT: { result: string; a: string; b: string }[] = [
  { result: 'Emerald', a: 'Amber', b: 'Azure' },
  { result: 'Topaz', a: 'Crimson', b: 'Amber' },
  { result: 'Violet', a: 'Crimson', b: 'Azure' }
]

export function ShardIcon({
  shard,
  tau,
  size = 28
}: {
  shard: ArchonShard
  tau?: boolean
  size?: number
}): React.JSX.Element {
  const s = tau ? shard.tauforged : shard.regular
  if (s.image) return <Pic src={s.image} size={size} />
  return (
    <span
      style={{ width: size, height: size * 0.5, background: shard.hex }}
      className="inline-block rotate-45 rounded-sm"
    />
  )
}

export default function ArchonShards(): React.JSX.Element {
  const inv = useInventory()
  const [shards, setShards] = useState<ArchonShard[]>([])
  const [frames, setFrames] = useState<MasteryItem[]>([])
  const [tab, setTab] = usePersisted<Tab>('ArchonShards.tab', 'warframes')
  const [slot, setSlot] = usePersisted<Slot>('ArchonShards.slot', 'with')
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [effectColor, setEffectColor] = useState('Crimson')
  const [filters, setFilters] = usePersisted<ShardFilters>('ArchonShards.filters', NO_FILTERS)

  useEffect(() => {
    cache.archonShards().then(setShards)
    cache
      .masteryCatalog()
      .then((c) =>
        setFrames(
          c.items.filter(
            (i) => i.group === 'frame' && !/Archwing/i.test(i.uniqueName) && !ARCHWINGS.test(i.name)
          )
        )
      )
  }, [])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    const misc = (inv.data?.raw?.MiscItems ?? []) as { ItemType?: string; ItemCount?: number }[]
    if (Array.isArray(misc))
      for (const e of misc)
        if (e.ItemType) m.set(e.ItemType.replace('/Lotus/StoreItems/', '/Lotus/'), e.ItemCount ?? 0)
    return m
  }, [inv.data])
  const reg = (s: ArchonShard): number => counts.get(s.regular.uniqueName) ?? 0
  const tau = (s: ArchonShard): number => counts.get(s.tauforged.uniqueName) ?? 0

  const installed = useMemo(() => parseInstalled(inv.data?.raw?.Suits), [inv.data])
  const owned = useMemo(() => {
    const suits = inv.data?.raw?.Suits
    return new Set(
      Array.isArray(suits) ? (suits as { ItemType?: string }[]).map((x) => x.ItemType ?? '') : []
    )
  }, [inv.data])
  const instCount = useMemo(() => {
    const m = new Map<string, number>() // key `${color}|${tau}`
    for (const list of installed.values())
      for (const i of list) m.set(`${i.color}|${i.tau}`, (m.get(`${i.color}|${i.tau}`) ?? 0) + 1)
    return m
  }, [installed])
  const instReg = (s: ArchonShard): number => instCount.get(`${s.color}|false`) ?? 0
  const instTau = (s: ArchonShard): number => instCount.get(`${s.color}|true`) ?? 0

  const totalAvailable = shards.reduce((n, s) => n + reg(s) + tau(s), 0)
  const totalInstalled = shards.reduce((n, s) => n + instReg(s) + instTau(s), 0)
  const totalTau = shards.reduce((n, s) => n + tau(s) + instTau(s), 0)

  return (
    <div className="flex h-full flex-col p-4 text-slate-100">
      <div className="mb-3 flex items-start justify-between">
        <h1 className="text-2xl font-bold">Archon shards</h1>
        <div className="flex gap-5 text-sm">
          <span>
            <b className="text-lg">{totalAvailable}</b>{' '}
            <span className="text-slate-400">Available</span>
          </span>
          <span>
            <b className="text-lg">{totalInstalled}</b>{' '}
            <span className="text-slate-400">Installed</span>
          </span>
          <span>
            <b className="text-lg">{totalTau}✦</b> <span className="text-slate-400">Tauforged</span>
          </span>
        </div>
      </div>

      {/* shard inventory cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {shards.map((s) => (
          <NcCard key={s.color} title={s.color}>
            <button
              onClick={() => {
                setFilters((f) => ({ ...f, colors: toggle(f.colors, s.color) }))
                setTab('warframes')
              }}
              title={`Show Warframes with ${s.color} shards`}
              className={`rounded-xl border p-4 transition ${filters.colors.includes(s.color) ? '' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}
              style={
                filters.colors.includes(s.color)
                  ? { borderColor: s.hex, background: `${s.hex}22` }
                  : undefined
              }
            >
              <div className="mb-2 flex flex-col items-center">
                <ShardIcon shard={s} size={30} />
                <span className="nc-name mt-1 font-semibold" style={{ color: s.hex }}>
                  {s.color}
                </span>
              </div>
              <div className="mx-auto grid max-w-xs grid-cols-[auto_1fr_1fr] items-center gap-x-4 gap-y-1 text-center text-sm">
                <span />
                <span className="text-xs text-slate-300">Regular</span>
                <span className="text-xs text-slate-300">Tauforged</span>
                <span className="text-left text-xs text-slate-300">Available</span>
                <b className="text-lg">{reg(s)}</b>
                <b className="text-lg">{tau(s)}</b>
                <span className="text-left text-xs text-slate-300">Installed</span>
                <b className="text-lg">{instReg(s)}</b>
                <b className="text-lg">{instTau(s)}</b>
              </div>
            </button>
          </NcCard>
        ))}
      </div>

      {/* tabs */}
      <div className="mb-3 flex gap-1 self-start rounded-lg border border-slate-700 bg-slate-900/50 p-1 text-sm">
        {(
          [
            ['warframes', '▦ Warframes'],
            ['fusion', '⇄ Fusion lab'],
            ['effects', 'ⓘ Effect guide']
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 ${tab === k ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'warframes' && (
          <WarframeTab
            frames={frames}
            slot={slot}
            setSlot={setSlot}
            query={query}
            setQuery={setQuery}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            shards={shards}
            installed={installed}
            owned={owned}
            filters={filters}
            setFilters={setFilters}
          />
        )}
        {tab === 'fusion' && <FusionTab shards={shards} reg={reg} tau={tau} />}
        {tab === 'effects' && (
          <EffectTab shards={shards} color={effectColor} setColor={setEffectColor} />
        )}
      </div>
    </div>
  )
}

function WarframeTab({
  frames,
  slot,
  setSlot,
  query,
  setQuery,
  showFilters,
  setShowFilters,
  shards,
  installed,
  owned,
  filters,
  setFilters
}: {
  frames: MasteryItem[]
  slot: Slot
  setSlot: (s: Slot) => void
  query: string
  setQuery: (s: string) => void
  showFilters: boolean
  setShowFilters: (b: boolean) => void
  shards: ArchonShard[]
  installed: Map<string, Installed[]>
  owned: Set<string>
  filters: ShardFilters
  setFilters: (f: ShardFilters) => void
}): React.JSX.Element {
  const { masteryFavorites } = useSettings()
  const byColor = new Map(shards.map((s) => [s.color, s]))
  // another page (Foundry) may have asked to open one Warframe's shard window
  const [openId, setOpenId] = useState<string | null>(() => peekPendingInspect())
  useEffect(() => clearPendingInspect(), [])
  const open = frames.find((x) => x.uniqueName === openId) ?? null
  const setOpen = (f: MasteryItem | null): void => setOpenId(f?.uniqueName ?? null)
  const [sort, setSort] = usePersisted<Sort>('ArchonShards.sort', 'most')
  const [sortOpen, setSortOpen] = useState(false)
  const nActive =
    filters.colors.length +
    filters.quality.length +
    (filters.favOnly ? 1 : 0) +
    (slot !== 'all' ? 1 : 0)
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = frames.filter((f) => {
      const n = installed.get(f.uniqueName)?.length ?? 0
      if (slot === 'with' && n === 0) return false
      if (slot === 'empty' && (n >= 5 || !owned.has(f.uniqueName))) return false
      if (slot === 'full' && n < 5) return false
      const l = installed.get(f.uniqueName) ?? []
      if (filters.colors.length && !l.some((x) => filters.colors.includes(x.color))) return false
      if (filters.quality.includes('regular') && !l.some((x) => !x.tau)) return false
      if (filters.quality.includes('tau') && !l.some((x) => x.tau)) return false
      if (filters.quality.includes('fullTau') && (l.length < 5 || l.some((x) => !x.tau)))
        return false
      if (filters.favOnly && !masteryFavorites.includes(f.uniqueName)) return false
      if (!q) return true
      const terms = (installed.get(f.uniqueName) ?? []).flatMap((i) => [
        i.color.toLowerCase(),
        effectFor(i, byColor.get(i.color)).name.toLowerCase()
      ])
      return f.name.toLowerCase().includes(q) || terms.some((c) => c.includes(q))
    })
    const score = (f: MasteryItem): number => {
      const l = installed.get(f.uniqueName) ?? []
      if (sort === 'tau') return l.filter((x) => x.tau).length
      if (sort === 'regular') return l.filter((x) => !x.tau).length
      return l.length
    }
    return sort === 'name'
      ? filtered.sort((a, b) => a.name.localeCompare(b.name))
      : filtered.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
  }, [frames, slot, query, installed, shards, owned, sort, filters, masteryFavorites])

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1 text-sm">
          {(
            [
              ['all', 'All Warframes'],
              ['with', 'With shards'],
              ['empty', 'Empty slots'],
              ['full', 'Fully slotted']
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSlot(k)}
              className={`rounded-md px-3 py-1.5 ${slot === k ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm">
          <span className="text-slate-400">⌕</span>
          <input
            className="w-full bg-transparent outline-none placeholder:text-slate-400"
            placeholder="Search Warframes, colors, or effects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex min-w-48 items-center justify-between gap-3 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm font-semibold hover:bg-slate-800"
          >
            {SORTS.find(([k]) => k === sort)?.[1]}
            <span className={`text-xs text-slate-400 transition ${sortOpen ? 'rotate-180' : ''}`}>
              ⌄
            </span>
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-52 rounded-xl border border-slate-600 bg-slate-800 p-1.5 shadow-xl">
                {SORTS.map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setSort(k)
                      setSortOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${sort === k ? 'border border-violet-400/70 bg-slate-700/70 font-semibold text-white' : 'text-slate-200 hover:bg-slate-700/50'}`}
                  >
                    {label}
                    {sort === k && <span className="text-slate-300">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${showFilters ? 'border-violet-400/60 bg-violet-500/20 text-violet-100' : 'border-slate-600 bg-slate-900/60 hover:bg-slate-800'}`}
        >
          ⧩ Filters
          {nActive > 0 && (
            <span className="rounded bg-violet-600 px-1.5 text-xs text-white">{nActive}</span>
          )}
        </button>
      </div>

      {(filters.colors.length > 0 || filters.quality.length > 0 || filters.favOnly) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          {filters.colors.map((c) => (
            <Chip
              key={c}
              label={c}
              color={byColor.get(c)?.hex}
              onRemove={() => setFilters({ ...filters, colors: toggle(filters.colors, c) })}
            />
          ))}
          {filters.quality.map((q) => (
            <Chip
              key={q}
              label={QUALITIES.find(([k]) => k === q)?.[1] ?? q}
              onRemove={() => setFilters({ ...filters, quality: toggle(filters.quality, q) })}
            />
          ))}
          {filters.favOnly && (
            <Chip
              label="Favorite Warframes"
              onRemove={() => setFilters({ ...filters, favOnly: false })}
            />
          )}
          <button
            onClick={() => setFilters(NO_FILTERS)}
            className="px-2 py-1 text-slate-300 hover:text-white"
          >
            Clear filters
          </button>
        </div>
      )}

      {showFilters && (
        <div className="mb-3">
          <NcCard title={'Find equipped shards'}>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="nc-name font-semibold">Find equipped shards</div>
                <button
                  onClick={() => setShowFilters(false)}
                  className="rounded-lg border border-violet-400/60 bg-violet-500/15 px-3 py-1.5 font-semibold hover:bg-violet-500/25"
                >
                  × Close filters
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FilterGroup title="Installation">
                  {(
                    [
                      ['with', 'With shards'],
                      ['empty', 'Empty slots'],
                      ['full', 'Fully slotted']
                    ] as const
                  ).map(([k, label]) => (
                    <Opt key={k} on={slot === k} onClick={() => setSlot(slot === k ? 'all' : k)}>
                      {label}
                    </Opt>
                  ))}
                </FilterGroup>
                <FilterGroup title="Shard color">
                  {shards.map((sh) => (
                    <Opt
                      key={sh.color}
                      on={filters.colors.includes(sh.color)}
                      onClick={() =>
                        setFilters({ ...filters, colors: toggle(filters.colors, sh.color) })
                      }
                    >
                      {sh.color}
                    </Opt>
                  ))}
                </FilterGroup>
                <FilterGroup title="Shard quality">
                  {QUALITIES.map(([k, label]) => (
                    <Opt
                      key={k}
                      on={filters.quality.includes(k)}
                      onClick={() =>
                        setFilters({ ...filters, quality: toggle(filters.quality, k) })
                      }
                    >
                      {label}
                    </Opt>
                  ))}
                </FilterGroup>
                <FilterGroup title="★ Favorites">
                  <Opt
                    on={filters.favOnly}
                    onClick={() => setFilters({ ...filters, favOnly: !filters.favOnly })}
                  >
                    Favorite Warframes
                  </Opt>
                </FilterGroup>
              </div>
            </div>
          </NcCard>
        </div>
      )}

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="mb-2 text-3xl text-violet-400">✦</span>
          <div className="text-lg font-semibold">No matching Warframes</div>
          <p className="mt-1 text-sm text-slate-400">Change your search or filters.</p>
          <button
            onClick={() => setSlot('all')}
            className="mt-3 rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
          >
            Show all Warframes
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((f) => {
            const slots = installed.get(f.uniqueName) ?? []
            const nTau = slots.filter((s) => s.tau).length
            const counts = new Map<string, number>()
            for (const sh of slots) {
              const n = effectFor(sh, byColor.get(sh.color)).name
              counts.set(n, (counts.get(n) ?? 0) + 1)
            }
            const summary = [...counts].sort((a, b) => b[1] - a[1])
            return (
              <NcCard key={f.uniqueName} title={f.name}>
                <button
                  onClick={() => setOpen(f)}
                  className="flex flex-col rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-left hover:border-slate-500"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <Pic src={f.imageName} size={48} letter={f.name[0]} />
                    <div className="min-w-0">
                      <div className="nc-name truncate font-semibold">{f.name}</div>
                      <div className="text-xs text-slate-400">
                        {slots.length} / 5 installed{nTau ? `, ${nTau} Tauforged` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="mb-3 grid grid-cols-5 gap-1.5">
                    {[0, 1, 2, 3, 4].map((i) => {
                      const sh = slots[i]
                      const shard = sh && byColor.get(sh.color)
                      return (
                        <span
                          key={i}
                          title={sh ? `${sh.tau ? 'Tauforged ' : ''}${sh.color}` : 'Empty slot'}
                          className={`relative flex aspect-square items-center justify-center rounded-lg border ${sh ? 'border-slate-600 bg-slate-900/50' : 'border-dashed border-slate-600 text-slate-500'}`}
                          style={shard ? { background: `${shard.hex}1a` } : undefined}
                        >
                          {shard ? <ShardIcon shard={shard} tau={sh.tau} size={34} /> : '◇'}
                          {sh?.tau && (
                            <span className="absolute bottom-0.5 right-1 text-[10px] text-amber-100">
                              ✦
                            </span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                  <div className="min-h-[3.5rem] space-y-0.5 text-xs">
                    {summary.slice(0, 2).map(([n, c]) => (
                      <div key={n} className="truncate font-medium text-slate-200">
                        {c > 1 ? `${c}x ` : ''}
                        {n}
                      </div>
                    ))}
                    {summary.length > 2 && (
                      <div className="text-[11px] text-slate-400">
                        +{summary.length - 2} more effect{summary.length - 2 > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2 text-xs text-slate-300">
                    Inspect shards <span>›</span>
                  </div>
                </button>
              </NcCard>
            )
          })}
        </div>
      )}
      {open && (
        <ShardModal
          frame={open}
          slots={installed.get(open.uniqueName) ?? []}
          byColor={byColor}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}

function ShardModal({
  frame,
  slots,
  byColor,
  onClose
}: {
  frame: MasteryItem
  slots: Installed[]
  byColor: Map<string, ArchonShard>
  onClose: () => void
}): React.JSX.Element {
  const [details, setDetails] = useState(false)
  useEffect(() => {
    if (details) return
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, details])
  const nTau = slots.filter((s) => s.tau).length
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="nc-dialog-card flex max-h-full w-full max-w-xl flex-col rounded-lg bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <NcCard title={`${frame.name} shards`} className="min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex items-start gap-4">
              <Pic src={frame.imageName} size={64} letter={frame.name[0]} />
              <div className="flex-1">
                <div className="text-2xl font-semibold">{frame.name}</div>
                <div className="text-sm text-slate-400">
                  {slots.length} / 5 slots{nTau ? `, ${nTau} Tauforged` : ''}
                </div>
              </div>
              <button onClick={onClose} className="text-xl text-slate-400 hover:text-white">
                ×
              </button>
            </div>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => {
                const sh = slots[i]
                const shard = sh && byColor.get(sh.color)
                if (!sh)
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 rounded-lg border border-dashed border-slate-600 px-4 py-4 text-sm text-slate-300"
                    >
                      <span className="w-3 text-xs text-slate-400">{i + 1}</span>
                      <span className="flex w-10 justify-center text-xl text-slate-500">◇</span>
                      Empty slot
                    </div>
                  )
                const eff = effectFor(sh, shard)
                return (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3"
                  >
                    <span className="w-3 text-xs text-slate-400">{i + 1}</span>
                    <span className="flex w-10 justify-center">
                      {shard && <ShardIcon shard={shard} tau={sh.tau} size={40} />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" style={{ color: shard?.hex }}>
                        {sh.tau ? 'Tauforged ' : ''}
                        {sh.color} Archon Shard
                      </div>
                      <div className="text-sm text-slate-100">
                        {eff.value
                          ? `${eff.value} ${eff.value.match(/[a-z]/i) ? '' : eff.name.toLowerCase()}`
                          : eff.name}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="-mx-5 mt-5 border-t border-slate-700 px-5 pt-4">
              <button
                onClick={() => setDetails(true)}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold hover:bg-slate-700"
              >
                Warframe details ›
              </button>
            </div>
          </div>
        </NcCard>
      </div>
      {details && (
        <div onClick={(e) => e.stopPropagation()}>
          <WarframeDetail uniqueName={frame.uniqueName} onClose={() => setDetails(false)} />
        </div>
      )}
    </div>
  )
}

function FilterGroup({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="mb-1.5 text-slate-300">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Opt({
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

function Chip({
  label,
  color,
  onRemove
}: {
  label: string
  color?: string
  onRemove: () => void
}): React.JSX.Element {
  return (
    <span
      className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-700/60 px-2 py-1 font-semibold"
      style={color ? { borderColor: color } : undefined}
    >
      {label}
      <button onClick={onRemove} className="text-slate-300 hover:text-white" title="Remove filter">
        ×
      </button>
    </span>
  )
}

function FusionTab({
  shards,
  reg,
  tau
}: {
  shards: ArchonShard[]
  reg: (s: ArchonShard) => number
  tau: (s: ArchonShard) => number
}): React.JSX.Element {
  const byColor = new Map(shards.map((s) => [s.color, s]))
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 font-semibold">
          Ascent{' '}
          <span className="text-xs font-normal text-slate-400">
            3 regular → 1 Tauforged · requires the Helminth Coalescent Segment
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {shards.map((s) => (
            <div
              key={s.color}
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-center"
            >
              <div className="flex items-center justify-center gap-3">
                <span className="relative inline-flex">
                  <ShardIcon shard={s} size={34} />
                  <span className="absolute -bottom-1 -left-2 text-xs font-bold">3x</span>
                </span>
                <span className="text-lg text-slate-300">➜</span>
                <ShardIcon shard={s} tau size={34} />
              </div>
              <div className="mt-2 text-sm font-semibold" style={{ color: s.hex }}>
                Tauforged {s.color}
              </div>
              <div className="mt-1 text-xs text-slate-300">
                100 Stela, {Math.floor(reg(s) / 3)} possible now
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 font-semibold">
          Coalescent{' '}
          <span className="text-xs font-normal text-slate-400">
            combine two colours · requires the Helminth Coalescent Segment
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {COALESCENT.map((c) => {
            const a = byColor.get(c.a)
            const b = byColor.get(c.b)
            const result = byColor.get(c.result)
            if (!a || !b || !result) return null
            return (
              <div
                key={c.result}
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <ShardIcon shard={a} tau size={34} />
                  <span className="text-slate-300">+</span>
                  <ShardIcon shard={b} tau size={34} />
                  <span className="text-lg text-slate-300">➜</span>
                  <ShardIcon shard={result} tau size={34} />
                </div>
                <div className="mt-2 text-sm font-semibold" style={{ color: result.hex }}>
                  {c.result}
                </div>
                <div className="mt-1 text-xs text-slate-300">
                  50 Stela, {reg(result)} regular, {tau(result)} Tauforged
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EffectTab({
  shards,
  color,
  setColor
}: {
  shards: ArchonShard[]
  color: string
  setColor: (c: string) => void
}): React.JSX.Element {
  const shard = shards.find((s) => s.color === color) ?? shards[0]
  if (!shard) return <p className="text-sm text-slate-400">Loading…</p>
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {shards.map((s) => (
          <button
            key={s.color}
            onClick={() => setColor(s.color)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${s.color === color ? 'border-current' : 'border-slate-600 hover:bg-slate-800'}`}
            style={{ color: s.color === color ? s.hex : undefined }}
          >
            {s.color}
          </button>
        ))}
      </div>
      <div className="mb-3 flex items-center gap-2">
        <ShardIcon shard={shard} size={26} />
        <span className="text-lg font-bold" style={{ color: shard.hex }}>
          {shard.color} effects
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-700">
        <div className="grid grid-cols-[1fr_1fr_1fr] bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-400">
          <span>Effect</span>
          <span>Regular</span>
          <span>✦ Tauforged</span>
        </div>
        {shard.effects.map((e) => (
          <div
            key={e.name}
            className="grid grid-cols-[1fr_1fr_1fr] border-t border-slate-800 px-4 py-2.5 text-sm"
          >
            <span className="font-medium">{e.name}</span>
            <span className="text-slate-300">{e.regular}</span>
            <span className="text-amber-300">{e.tauforged}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Values from the Warframe wiki; Tauforged is 1.5× the regular bonus.
      </p>
    </div>
  )
}
