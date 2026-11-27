import { useEffect, useMemo, useState } from 'react'
import * as cache from '../apiCache'
import { useInventory } from './useInventory'

// Turns the raw inventory sections (from the helper) into display rows for the Inventory page,
// joined with item metadata (names, images, rarity, market slug) from the main process.

export interface InvRow {
  key: string
  kind: InvKind | 'relic'
  name: string
  image?: string
  rarity?: string
  modType?: string // mods: what they fit ("Shotgun")
  rank?: number // highest rank among owned copies (mods/arcanes)
  maxRank?: number
  count: number
  slug?: string
  ducats?: number
  tradable: boolean
  isPrime: boolean
  vaulted?: boolean
  equipped?: string[] // gear this mod/arcane is slotted in
  equippedCopies?: number // how many owned copies are slotted somewhere
  byRank?: Record<number, number> // mods/arcanes: copies at each rank
  refinement?: string // relics only
  setParts?: { name: string; image?: string; have: number; need: number; slug?: string }[] // sets only
  mastered?: boolean // sets: the item they build is already mastered
  relicId?: string // relics only
  parent?: string // parts only: the item this part builds
  need?: number // parts only: how many that recipe uses
}

export interface InventoryItems {
  ready: boolean
  relics: InvRow[]
  mods: InvRow[]
  arcanes: InvRow[]
  parts: InvRow[] // tradable build parts (All parts)
  misc: InvRow[] // fish, Ayatan treasures, scenes, Prisma weapons, ... (Misc tab)
}

const OID = /^[0-9a-f]{24}$/
const GEAR_SECTIONS = [
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
  'OperatorAmps',
  'Hoverboards'
]

interface GearEntry {
  ItemType?: string
  Configs?: { Upgrades?: string[] }[]
}
interface UpgradeInstance {
  ItemType?: string
  ItemId?: { $oid?: string }
  UpgradeFingerprint?: string
}
interface Stack {
  ItemType?: string
  ItemCount?: number
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}
function fingerprintLvl(fp?: string): number {
  if (!fp) return 0
  try {
    return Number((JSON.parse(fp) as { lvl?: number }).lvl) || 0
  } catch {
    return 0
  }
}

export function useInventoryItems(): InventoryItems {
  const inv = useInventory()
  const [meta, setMeta] = useState<InventoryMeta | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [relicInfo, setRelicInfo] = useState<Map<string, RelicSummary>>(new Map())

  useEffect(() => {
    cache.inventoryMeta().then(setMeta)
    cache
      .masteryCatalog()
      .then((c) => setNames(new Map(c.items.map((i) => [i.uniqueName, i.name]))))
    cache.relics().then((r) => setRelicInfo(new Map(r.map((s) => [s.id, s]))))
  }, [])

  const data = inv.data
  return useMemo(() => derive(meta, data, names, relicInfo), [meta, data, names, relicInfo])
}

function derive(
  meta: InventoryMeta | null,
  data: ReturnType<typeof useInventory>['data'],
  names: Map<string, string>,
  relicInfo: Map<string, RelicSummary>
): InventoryItems {
  const raw = data?.raw ?? {}
  if (!meta || !data)
    return { ready: false, relics: [], mods: [], arcanes: [], parts: [], misc: [] }

  // which gear each mod instance (by oid) is slotted in
  const equippedBy = new Map<string, Set<string>>()
  for (const section of GEAR_SECTIONS) {
    for (const g of arr<GearEntry>(raw[section])) {
      const gearName = (g.ItemType && names.get(g.ItemType)) || undefined
      if (!gearName) continue
      for (const cfg of g.Configs ?? [])
        for (const u of cfg.Upgrades ?? [])
          if (OID.test(u)) (equippedBy.get(u) ?? equippedBy.set(u, new Set()).get(u)!).add(gearName)
    }
  }

  // aggregate mods + arcanes from unranked stacks (RawUpgrades) and ranked instances (Upgrades)
  type Agg = {
    count: number
    rank: number
    equipped: Set<string>
    inUse: number
    byRank: Record<number, number>
  }
  const agg = new Map<string, Agg>()
  const bump = (type: string): Agg => {
    const a = agg.get(type) ?? { count: 0, rank: 0, equipped: new Set(), inUse: 0, byRank: {} }
    agg.set(type, a)
    return a
  }
  for (const s of arr<Stack>(raw.RawUpgrades))
    if (s.ItemType) {
      const a = bump(s.ItemType)
      a.count += s.ItemCount ?? 1
      a.byRank[0] = (a.byRank[0] ?? 0) + (s.ItemCount ?? 1) // unranked stacks
    }
  for (const u of arr<UpgradeInstance>(raw.Upgrades)) {
    if (!u.ItemType) continue
    const a = bump(u.ItemType)
    a.count += 1
    const lvl = fingerprintLvl(u.UpgradeFingerprint)
    a.rank = Math.max(a.rank, lvl)
    a.byRank[lvl] = (a.byRank[lvl] ?? 0) + 1
    const oid = u.ItemId?.$oid
    const gears = oid ? equippedBy.get(oid) : undefined
    if (gears?.size) a.inUse += 1
    for (const gear of gears ?? []) a.equipped.add(gear)
  }

  const mods: InvRow[] = []
  const arcanes: InvRow[] = []
  for (const [type, a] of agg) {
    const m = meta[type]
    if (!m || (m.kind !== 'mod' && m.kind !== 'arcane')) continue
    const row: InvRow = {
      key: type,
      kind: m.kind,
      name: m.name,
      image: m.image,
      rarity: m.rarity,
      modType: m.modType,
      rank: a.rank,
      maxRank: m.maxRank,
      count: a.count,
      slug: m.slug,
      tradable: m.tradable,
      isPrime: m.isPrime,
      equipped: a.equipped.size ? [...a.equipped] : undefined,
      equippedCopies: a.inUse,
      byRank: a.byRank
    }
    ;(m.kind === 'mod' ? mods : arcanes).push(row)
  }

  // tradable parts from MiscItems
  const parts: InvRow[] = []
  // built parts sit in MiscItems, Prime blueprints in Recipes
  for (const s of [...arr<Stack>(raw.MiscItems), ...arr<Stack>(raw.Recipes)]) {
    const m = s.ItemType && meta[s.ItemType]
    if (!m || m.kind !== 'part') continue
    parts.push({
      key: s.ItemType!,
      kind: 'part',
      name: m.name,
      image: m.image,
      count: s.ItemCount ?? 1,
      slug: m.slug,
      tradable: m.tradable,
      isPrime: m.isPrime,
      ducats: m.ducats,
      parent: m.parent,
      need: m.need
    })
  }

  // relics, from the already-parsed owned map
  const relics: InvRow[] = []
  for (const [id, byState] of Object.entries(data.relics)) {
    const info = relicInfo.get(id)
    for (const [refinement, count] of Object.entries(byState)) {
      if (!count) continue
      relics.push({
        key: `${id}#${refinement}`,
        kind: 'relic',
        name: info ? `${info.tier} ${info.name} ${refinement}` : refinement,
        image: info?.imageName,
        count,
        tradable: true,
        isPrime: false,
        vaulted: info?.vaulted,
        refinement,
        relicId: id,
        slug: info ? `${info.tier.toLowerCase()}_${info.name.toLowerCase()}_relic` : undefined
      })
    }
  }

  // misc items: stacks in MiscItems, one entry per owned weapon in the gear lists
  const miscCount = new Map<string, number>()
  for (const key of ['MiscItems', 'LongGuns', 'Pistols', 'Melee'])
    for (const s of arr<Stack>(raw[key]))
      if (s.ItemType && meta[s.ItemType]?.kind === 'misc')
        miscCount.set(s.ItemType, (miscCount.get(s.ItemType) ?? 0) + (s.ItemCount ?? 1))
  const misc: InvRow[] = [...miscCount].map(([type, count]) => {
    const m = meta[type]
    return {
      key: type,
      kind: 'misc',
      name: m.name,
      image: m.image,
      count,
      slug: m.slug,
      tradable: true,
      isPrime: m.isPrime
    }
  })

  return { ready: true, relics, mods, arcanes, parts, misc }
}
