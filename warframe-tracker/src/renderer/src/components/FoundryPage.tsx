import { useEffect, useMemo, useState } from 'react'
import { useGrowingList } from '../hooks/useGrowingList'
import * as cache from '../apiCache'
import { partCounter, useInventory } from '../hooks/useInventory'
import { usePersisted } from '../hooks/usePersisted'
import { useMastery, type MasteryRow } from '../hooks/useMastery'
import { useWorldState } from '../hooks/useWorldState'
import { toggleMasteryFavorite, useSettings } from '../settings'
import Pic from './Pic'
import NcCard from './NcCard'
import WikiIcon from './WikiIcon'
import { ShardIcon } from './ArchonShards'
import { effectFor, inspectShards, parseInstalled } from '../archonShards'
import WarframeDetail from './WarframeDetail'
import type { Installed } from '../archonShards'

// Foundry: every masterable item as a card with its build parts and what you own of each, plus
// status icons (mastered, vaulted, owned, Helminth) and a filter panel.

type Cat = 'all' | 'warframe' | 'primary' | 'secondary' | 'melee' | 'modular' | 'arch' | 'companion'
// tab icons: official wiki files (names verified 2026-11-16)
const CATS: [Cat, string, string][] = [
  ['all', 'IconInfinity(xWhite).png', 'All'],
  ['warframe', 'IconWarframe(xWhite).png', 'Warframe'],
  ['primary', 'IconPrimaryWeaponRifle(xWhite).png', 'Primary'],
  ['secondary', 'IconPistol(xWhite).png', 'Secondary'],
  ['melee', 'IconMelee(xWhite).png', 'Melee'],
  ['modular', 'IconCraftingKitgunChamber(xWhite).png', 'Modular'],
  ['arch', 'IconArchwing(xWhite).png', 'Arch'],
  ['companion', 'IconSentinel(xWhite).png', 'Companion']
]

const MODULAR =
  /Modular|OperatorAmplifiers|Hoverboard|MoaPets|ZanukaPets|InfestedCatbrow|PredatorKubrow|Kitgun/i

function catOf(i: MasteryItem): Cat {
  if (MODULAR.test(i.uniqueName)) return 'modular'
  switch (i.productCategory) {
    case 'Suits':
      return 'warframe'
    case 'LongGuns':
      return 'primary'
    case 'Pistols':
      return 'secondary'
    case 'Melee':
      return 'melee'
    case 'SpaceSuits':
    case 'SpaceGuns':
    case 'SpaceMelee':
    case 'MechSuits':
      return 'arch'
    case 'OperatorAmps':
      return 'modular'
    default:
      return 'companion'
  }
}

// yes/no filters; undefined = off
type YN = 'yes' | 'no' | undefined
interface Filters {
  type?: 'prime' | 'normal'
  mastery?: 'mastered' | 'unmastered'
  owned: YN
  vaulted: YN
  ready: YN
  enoughMr: YN
  resurgence: YN
  usedFor: YN
  favorite: YN
  helminth: YN
  shards: YN
}
const EMPTY: Filters = {
  owned: undefined,
  vaulted: undefined,
  ready: undefined,
  enoughMr: undefined,
  resurgence: undefined,
  usedFor: undefined,
  favorite: undefined,
  helminth: undefined,
  shards: undefined
}
const YN_FILTERS: [keyof Filters, string, string][] = [
  ['owned', 'IconOwned(xWhite).png', 'Owned'],
  ['vaulted', 'IconVault(xWhite).png', 'Vaulted'],
  ['ready', 'IconCrafted(xWhite).png', 'Ready to build'],
  ['enoughMr', 'IconMasteryRankLocked(xWhite).png', 'Enough mastery'],
  ['resurgence', 'Aya.png', 'Prime resurgence'],
  ['usedFor', 'IconBundle(xWhite).png', 'Used for crafting'],
  ['favorite', '★', 'Favorite'],
  ['helminth', 'IconHelminth(xWhite).png', 'Helminth done'],
  ['shards', 'IconShardPurpleSimple(xWhite).png', 'Contains archon shards']
]

export interface Card {
  row: MasteryRow
  cat: Cat
  craft?: CraftItem
  parts: { c: CraftComponent; have: number }[]
  ready: boolean
  usedFor: boolean
  helminth: boolean
  shards: Installed[]
  resurgence: boolean
  enoughMr: boolean
}

export default function FoundryPage(): React.JSX.Element {
  const inv = useInventory()
  const mastery = useMastery()
  const invData = inv.data
  const masteryRows = mastery.rows
  const ws = useWorldState()
  const { masteryFavorites, loadAllItems } = useSettings()
  const [crafts, setCrafts] = useState<CraftItem[]>([])
  const [cat, setCat] = usePersisted<Cat>('FoundryPage.cat', 'warframe')
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = usePersisted<Filters>('FoundryPage.filters', EMPTY)
  const [detail, setDetail] = useState<string | null>(null)
  const [shardDefs, setShardDefs] = useState<ArchonShard[]>([])

  useEffect(() => {
    cache.craftables().then(setCrafts)
    cache.archonShards().then(setShardDefs)
  }, [])

  const cards = useMemo<Card[]>(() => {
    const raw = invData?.raw ?? {}
    const have = partCounter(raw)

    const byId = new Map(crafts.map((c) => [c.uniqueName, c]))
    const usedAsPart = new Set<string>()
    for (const c of crafts) for (const p of c.components) usedAsPart.add(p.uniqueName)

    const inf = raw.InfestedFoundry as { ConsumedSuits?: { s?: string }[] } | undefined
    const consumed = new Set((inf?.ConsumedSuits ?? []).map((x) => x.s ?? ''))
    const shards = parseInstalled(raw.Suits)
    // Varzia sells bundles like "M P V Nidus Saryn Prime Dual Pack": one name per Warframe in it
    const resurgence = new Set(
      (ws?.prime?.items ?? []).flatMap((x) => {
        const n = x.name.toLowerCase()
        const m = /^m p v (.+?) prime (?:single |dual |triple )?pack$/.exec(n)
        return m ? m[1].split(' ').map((w) => `${w} prime`) : [n]
      })
    )
    const mr = invData?.masteryRank ?? 0

    return masteryRows.map((row) => {
      const craft = byId.get(row.item.uniqueName)
      const parts = (craft?.components ?? []).map((c) => ({ c, have: have(c.uniqueName) }))
      const lower = row.item.name.toLowerCase()
      return {
        row,
        cat: catOf(row.item),
        craft,
        parts,
        ready: parts.length > 0 && parts.every((p) => p.have >= p.c.itemCount),
        usedFor: usedAsPart.has(row.item.uniqueName),
        helminth: consumed.has(row.item.uniqueName),
        shards: shards.get(row.item.uniqueName) ?? [],
        resurgence:
          row.item.isPrime && [...resurgence].some((n) => n === lower || n.startsWith(lower + ' ')),
        enoughMr: (craft?.masteryReq ?? 0) <= mr
      }
    })
  }, [invData, masteryRows, crafts, ws])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const yn = (f: YN, v: boolean): boolean => !f || (f === 'yes') === v
    const favSet = new Set(masteryFavorites)
    return cards
      .filter(
        (c) =>
          (cat === 'all' || c.cat === cat) &&
          (!q || c.row.item.name.toLowerCase().includes(q)) &&
          (!filters.type || (filters.type === 'prime') === c.row.item.isPrime) &&
          (!filters.mastery || (filters.mastery === 'mastered') === c.row.mastered) &&
          yn(filters.owned, c.row.owned) &&
          yn(filters.vaulted, c.row.item.vaulted) &&
          yn(filters.ready, c.ready) &&
          yn(filters.enoughMr, c.enoughMr) &&
          yn(filters.resurgence, c.resurgence) &&
          yn(filters.usedFor, c.usedFor) &&
          yn(filters.favorite, favSet.has(c.row.item.uniqueName)) &&
          yn(filters.helminth, c.helminth) &&
          yn(filters.shards, c.shards.length > 0)
      )
      .sort((a, b) => a.row.item.name.localeCompare(b.row.item.name))
  }, [cards, cat, query, filters, masteryFavorites])
  // draw the cards in batches as you scroll (hundreds of cards at once made opening the page lag)
  const { limit: grownLimit, sentinel } = useGrowingList(
    list.length,
    `${cat}|${query}|${JSON.stringify(filters)}`
  )

  const limit = loadAllItems ? Infinity : grownLimit

  const nActive =
    (filters.type ? 1 : 0) +
    (filters.mastery ? 1 : 0) +
    YN_FILTERS.filter(([k]) => filters[k] !== undefined).length

  return (
    <div className="flex h-full flex-col p-4 text-slate-100">
      <h1 className="mb-3 text-2xl font-bold">Foundry</h1>

      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-700 pb-3">
        <div className="flex flex-wrap gap-1 text-sm">
          {CATS.map(([k, icon, label]) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${cat === k ? 'border-violet-400/60 bg-violet-500/20 text-white' : 'border-transparent text-slate-300 hover:bg-slate-800'}`}
            >
              <WikiIcon file={icon} title={label} color="currentColor" size={16} />
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-sm">
          <span className="text-slate-400">⌕</span>
          <input
            className="w-36 bg-transparent outline-none placeholder:text-slate-400"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-white">
              ×
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${showFilters ? 'border-violet-400/60 bg-violet-500/20' : 'border-slate-600 bg-slate-900/60 hover:bg-slate-800'}`}
        >
          ⧩ Filters
          {nActive > 0 && (
            <span className="rounded bg-violet-600 px-1.5 text-xs text-white">{nActive}</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="mb-3">
          <NcCard title={'Filter foundry'}>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="nc-name font-semibold">Filter foundry</div>
                <div className="flex gap-2">
                  {nActive > 0 && (
                    <button
                      onClick={() => setFilters(EMPTY)}
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
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 xl:grid-cols-4">
                <Group icon="IconLotus(xWhite).png" title="Type">
                  {(['prime', 'normal'] as const).map((v) => (
                    <Opt
                      key={v}
                      on={filters.type === v}
                      onClick={() =>
                        setFilters({ ...filters, type: filters.type === v ? undefined : v })
                      }
                    >
                      {v === 'prime' ? 'Prime' : 'Normal'}
                    </Opt>
                  ))}
                </Group>
                <Group icon="IconMastered(xWhite).png" title="Mastery">
                  {(['mastered', 'unmastered'] as const).map((v) => (
                    <Opt
                      key={v}
                      on={filters.mastery === v}
                      onClick={() =>
                        setFilters({ ...filters, mastery: filters.mastery === v ? undefined : v })
                      }
                    >
                      {v === 'mastered' ? 'Mastered' : 'Unmastered'}
                    </Opt>
                  ))}
                </Group>
                {YN_FILTERS.map(([k, icon, title]) => (
                  <Group key={k} icon={icon} title={title}>
                    {(['yes', 'no'] as const).map((v) => (
                      <Opt
                        key={v}
                        on={filters[k] === v}
                        onClick={() =>
                          setFilters({ ...filters, [k]: filters[k] === v ? undefined : v })
                        }
                      >
                        {v === 'yes' ? 'Yes' : 'No'}
                      </Opt>
                    ))}
                  </Group>
                ))}
              </div>
            </div>
          </NcCard>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {!mastery.ready ? (
          <div className="py-20 text-center text-slate-400">Loading…</div>
        ) : list.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-lg font-semibold">No matching items</div>
            <p className="mt-1 text-sm text-slate-400">Change your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {list.slice(0, limit).map((c) => (
              <NcCard key={c.row.item.uniqueName} title={c.row.item.name}>
                <FoundryCard
                  card={c}
                  favorite={masteryFavorites.includes(c.row.item.uniqueName)}
                  shardDefs={shardDefs}
                  onOpen={() => setDetail(c.row.item.uniqueName)}
                />
              </NcCard>
            ))}
            {limit < list.length && (
              <div ref={sentinel} className="col-span-full h-1" aria-hidden />
            )}
          </div>
        )}
      </div>

      {detail && <WarframeDetail uniqueName={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

export function FoundryCard({
  card,
  favorite,
  shardDefs,
  onOpen
}: {
  card: Card
  favorite: boolean
  shardDefs: ArchonShard[]
  onOpen?: () => void
}): React.JSX.Element {
  const { row, parts } = card
  const item = row.item
  // owned/mastered items get the warm tint, like in-game "owned" state
  const warm = row.owned || row.mastered
  return (
    <div
      onClick={onOpen}
      className={`flex flex-col rounded-xl border p-3 ${onOpen ? 'cursor-pointer' : ''} ${warm ? 'border-amber-200/40 bg-[#4a4235]/60 hover:border-amber-200/70' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleMasteryFavorite(item.uniqueName)
          }}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}
          className={favorite ? 'text-amber-300' : 'text-slate-300 hover:text-white'}
        >
          {favorite ? '★' : '☆'}
        </button>
        <div className="nc-name min-w-0 flex-1 truncate font-semibold">{item.name}</div>
        {card.ready && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            Ready to build
          </span>
        )}
      </div>

      <div className={`flex items-center gap-3 ${parts.length ? '' : 'justify-center'}`}>
        <div className="relative shrink-0">
          <Pic src={item.imageName} fallback={item.imageFallback} size={96} letter={item.name[0]} />
          {card.shards.length > 0 && (
            <ShardStrip frame={item.uniqueName} shards={card.shards} defs={shardDefs} />
          )}
        </div>
        {parts.length > 0 && (
          <div className="flex flex-1 flex-wrap justify-center gap-1.5">
            {parts.map(({ c, have }) => {
              const done = have >= c.itemCount
              // blueprints: the item picture on blueprint blue, like the game (browse.wf has no
              // blueprint icon, and dark pictures vanish on the plain tile)
              const bp = c.kind === 'blueprint'
              return (
                <span
                  key={c.uniqueName}
                  title={`${c.name}: ${have} / ${c.itemCount}`}
                  style={
                    bp
                      ? {
                          // owned: blue turning green, so it reads like the other owned parts
                          backgroundImage: done
                            ? 'radial-gradient(circle, rgb(40 170 150 / 0.6), rgb(20 80 60 / 0.4))'
                            : 'radial-gradient(circle, rgb(56 130 200 / 0.45), rgb(20 50 90 / 0.3))'
                        }
                      : undefined
                  }
                  className={`relative flex h-11 w-11 items-center justify-center rounded-lg border ${done ? 'border-emerald-400/40 bg-emerald-900/30' : 'border-slate-600 bg-slate-900/50'}`}
                >
                  <Pic
                    src={bp ? item.imageName : c.image}
                    fallback={bp ? item.imageFallback : c.imageFallback}
                    size={30}
                    letter={c.name[0]}
                  />
                  {bp && (
                    <span className="absolute left-0.5 top-0 text-[8px] font-bold text-sky-200">
                      BP
                    </span>
                  )}
                  {have > 0 && (
                    <span className="absolute -bottom-1 -right-1 rounded bg-slate-900 px-1 text-[10px] font-semibold">
                      {have >= 1e6
                        ? `${(have / 1e6).toFixed(1)}M`
                        : have >= 1e4
                          ? `${Math.round(have / 1e3)}K`
                          : have}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        )}
        {parts.length === 0 && (
          <span className="text-xs text-slate-400">No blueprint (bought or quest reward)</span>
        )}
      </div>

      {/* the strip keeps its space when empty so every card in a row lines up; only the line goes */}
      {
        <div
          className={`mt-3 flex min-h-7 items-center justify-around pt-2 text-xs ${row.mastered || item.vaulted || card.resurgence || row.owned || card.helminth ? 'border-t border-slate-600/60' : ''}`}
        >
          {row.mastered && (
            <span className="flex items-center gap-1 text-[#e8d77a]">
              <WikiIcon file="IconMastered(xWhite).png" title="Mastered" color="#e8d77a" /> Mastered
            </span>
          )}
          {item.vaulted && (
            <span className="flex items-center gap-1 text-[#f1d9b5]">
              <WikiIcon file="IconVault(xWhite).png" title="Vaulted" color="#f1d9b5" /> Vaulted
            </span>
          )}
          {card.resurgence && (
            <span title="In Prime resurgence" className="text-sky-300">
              ✦ Resurgence
            </span>
          )}
          {row.owned && <span className="font-semibold text-slate-200">✓ Owned</span>}
          {card.helminth && (
            <span
              title="Subsumed to the Helminth"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-700/90"
            >
              <WikiIcon file="IconHelminth(xWhite).png" title="Subsumed" color="#fff" size={16} />
            </span>
          )}
        </div>
      }
    </div>
  )
}

function ShardStrip({
  frame,
  shards,
  defs
}: {
  frame: string
  shards: Installed[]
  defs: ArchonShard[]
}): React.JSX.Element {
  const [hover, setHover] = useState(false)
  const byColor = new Map(defs.map((d) => [d.color, d]))
  return (
    <div
      className="absolute -bottom-1 left-0 z-10"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          inspectShards(frame)
        }}
        title="Open in Archon shards"
        className="flex gap-0.5 rounded-md border border-slate-600 bg-slate-900/90 px-1 py-0.5 hover:border-slate-400"
      >
        {shards.map((s, i) => {
          const d = byColor.get(s.color)
          return d ? (
            <ShardIcon key={i} shard={d} tau={s.tau} size={16} />
          ) : (
            <span key={i} className="h-4 w-4" />
          )
        })}
      </button>
      {hover && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-80 rounded-xl border border-slate-600 bg-slate-800 p-3 shadow-2xl">
          <div className="mb-2 text-center text-sm font-semibold">Installed Archon shards</div>
          <div className="space-y-2">
            {shards.map((s, i) => {
              const d = byColor.get(s.color)
              const eff = effectFor(s, d)
              return (
                <div key={i} className="flex items-center gap-3">
                  {d && <ShardIcon shard={d} tau={s.tau} size={30} />}
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-300">
                      {s.tau ? 'Tauforged ' : ''}
                      {s.color} Archon Shard
                    </div>
                    <div className="text-sm font-semibold">
                      {eff.value
                        ? /[a-z]/i.test(eff.value)
                          ? eff.value
                          : `${eff.value} ${eff.name.toLowerCase()}`
                        : eff.name}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Group({
  icon,
  title,
  children
}: {
  icon: string
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-slate-200">
        {/* a wiki file name, or a plain symbol (the favorite star, same as on the cards) */}
        <span className="flex w-4 justify-center text-slate-400">
          {icon.endsWith('.png') ? (
            <WikiIcon file={icon} title={title} color="currentColor" size={16} />
          ) : (
            icon
          )}
        </span>
        {title}
      </div>
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
