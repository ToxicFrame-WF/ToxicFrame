import { imageFor } from './browseIcons'
import Items from '@wfcd/items'
import { slugFromName } from './marketSlug'
import { WIKI_WARES } from './syndicateWares'

const STATES = ['Intact', 'Exceptional', 'Flawless', 'Radiant'] as const

export interface RelicReward {
  item: string
  slug?: string // warframe.market item name, used for prices, icons and ducats
  image?: string // icon of the actual part (chassis, barrel, ...), from the game data
  rarity: string
  chances: Record<string, number> // drop chance in % per refinement state
}

export interface RelicSummary {
  id: string
  tier: string
  name: string
  vaulted: boolean
  imageName?: string
  rewards: RelicReward[]
}

interface RawRelic {
  uniqueName: string
  name: string
  vaulted?: boolean
  imageName?: string
  rewards?: {
    rarity?: string
    chance?: number
    item?: { name?: string; uniqueName?: string; warframeMarket?: { urlName?: string } }
  }[]
}

let cache: RelicSummary[] | null = null

const PARENT_CATEGORIES = [
  'Warframes',
  'Primary',
  'Secondary',
  'Melee',
  'Sentinels',
  'Archwing',
  'Arch-Gun',
  'Arch-Melee',
  'Pets'
]

// Every craftable item lists its components (barrel, chassis, ...) with their own image,
// so map each component's unique name to that image.
function buildPartImages(): Map<string, string> {
  const map = new Map<string, string>()
  const parents = new Items({ category: PARENT_CATEGORIES as never }) as unknown as {
    name?: string
    components?: { uniqueName?: string; name?: string; imageName?: string }[]
  }[]
  for (const parent of parents) {
    for (const c of parent.components ?? []) {
      if (!c.imageName) continue
      const url = imageFor(c.uniqueName, c.imageName)!
      if (c.uniqueName && !map.has(c.uniqueName)) map.set(c.uniqueName, url)
      // Warframe parts are rewarded as "Wukong Prime Chassis Blueprint", whose unique name
      // differs from the component's, so also index by "<item> <component>" name.
      if (parent.name && c.name) {
        const key = `name:${parent.name} ${c.name}`.toLowerCase()
        if (!map.has(key)) map.set(key, url)
      }
    }
  }

  // Plain resources and misc items (Forma, ...), keyed by name. A "Forma Blueprint" reward
  // then gets the normal Forma icon.
  const misc = new Items({ category: ['Resources', 'Misc'] }) as unknown as {
    name?: string
    imageName?: string
    uniqueName?: string
  }[]
  for (const m of misc) {
    if (!m.name || !m.imageName) continue
    const key = `misc:${m.name}`.toLowerCase()
    if (!map.has(key)) map.set(key, imageFor(m.uniqueName, m.imageName)!)
  }
  return map
}

// Names look like "Axi A1 Exceptional": tier, relic name, refinement state.
const NAME_PATTERN = /^(\S+) (.+) (Intact|Exceptional|Flawless|Radiant)$/

function findPartImage(
  images: Map<string, string>,
  uniqueName?: string,
  name?: string
): string | undefined {
  if (uniqueName && images.has(uniqueName)) return images.get(uniqueName)
  if (!name) return undefined
  // rewards like "2X Forma Blueprint" use the icon of the single item
  const lower = name.toLowerCase().replace(/^\d+x\s+/, '')
  const stripped = lower.replace(/ blueprint$/, '')
  return (
    images.get(`name:${lower}`) ??
    images.get(`name:${stripped}`) ??
    images.get(`misc:${stripped}`) ??
    images.get(`misc:${lower}`)
  )
}

export function loadRelics(): RelicSummary[] {
  if (cache) return cache

  const raw = new Items({ category: ['Relics'] }) as unknown as RawRelic[]

  // group the four refinement entries of each relic together
  const groups = new Map<string, { tier: string; name: string; states: Record<string, RawRelic> }>()
  for (const r of raw) {
    const m = NAME_PATTERN.exec(r.name ?? '')
    if (!m) continue
    const key = `${m[1]} ${m[2]}`
    const g = groups.get(key) ?? { tier: m[1], name: m[2], states: {} }
    g.states[m[3]] = r
    groups.set(key, g)
  }

  const partImages = buildPartImages()

  const result: RelicSummary[] = []
  for (const g of groups.values()) {
    const base = g.states.Intact
    if (!base) continue
    result.push({
      id: base.uniqueName,
      tier: g.tier,
      name: g.name,
      vaulted: Boolean(base.vaulted) && g.tier !== 'Requiem', // @wfcd marks Requiem vaulted; they never are
      imageName: imageFor(base.uniqueName, base.imageName), // full picture URL
      rewards: (base.rewards ?? []).map((rw) => {
        const chances: Record<string, number> = {}
        for (const s of STATES) {
          const match = g.states[s]?.rewards?.find((x) => x.item?.name === rw.item?.name)
          chances[s] = match?.chance ?? 0
        }
        return {
          item: rw.item?.name ?? 'Unknown',
          slug: rw.item?.warframeMarket?.urlName,
          image: findPartImage(partImages, rw.item?.uniqueName, rw.item?.name),
          rarity: rw.rarity ?? 'Unknown',
          chances
        }
      })
    })
  }

  result.sort((a, b) => a.tier.localeCompare(b.tier) || a.name.localeCompare(b.name))
  cache = result
  return cache
}

// Drop locations for one relic (by its Intact unique name), for the "Where to find it" list.
let relicIndex: Map<
  string | undefined,
  RawRelic & { drops?: { location?: string; chance?: number }[] }
> | null = null
export function getRelicDrops(id: string): { location: string; chance: number; note?: string }[] {
  // the relic list is built once, not on every pop-up
  relicIndex ??= new Map(
    (
      new Items({ category: ['Relics'] }) as unknown as (RawRelic & {
        drops?: { location?: string; chance?: number }[]
      })[]
    ).map((r) => [r.uniqueName, r])
  )
  const relic = relicIndex.get(id)
  // Requiem I-IV left the drop tables in Update 42 (wiki, checked 2026-11-21); the only source
  // left is Palladino's shop, which the drop data doesn't list
  if (relic?.name?.startsWith('Requiem ') && !relic.drops?.length)
    return [
      { location: 'Palladino, Iron Wake (Earth)', chance: 0, note: '10 Riven Slivers, 10 a week' }
    ]
  if (!relic?.drops) return []
  const byLocation = new Map<string, number>()
  for (const d of relic.drops) {
    if (!d.location) continue
    byLocation.set(d.location, Math.max(byLocation.get(d.location) ?? 0, d.chance ?? 0))
  }
  return [...byLocation.entries()]
    .map(([location, chance]) => ({ location, chance }))
    .sort((a, b) => b.chance - a.chance)
}

// The in-game icon of the Void Traces resource (shown next to the trace counter).
export function getVoidTraceIcon(): string | null {
  const items = new Items({ category: ['Resources', 'Misc'] }) as unknown as {
    name?: string
    imageName?: string
    uniqueName?: string
  }[]
  const found = items.find((i) => i.name === 'Void Traces' && i.imageName)
  return imageFor(found?.uniqueName, found?.imageName) ?? null
}

// Picture for any weapon, Warframe or mod by name (used for Baro, Prime Resurgence, the Circuit).
const IMAGE_CATEGORIES = [
  'Warframes',
  'Primary',
  'Secondary',
  'Melee',
  'Arch-Gun',
  'Arch-Melee',
  'Archwing',
  'Sentinels',
  'Pets',
  'Mods'
]
let imagesByName: Map<string, string> | null = null

// Every game item by its internal path. Worldstate entries carry that path (with an extra
// "/StoreItems" part), which matches far more reliably than the display name.
let imagesByUnique: Map<string, string> | null = null
let namesByUnique: Map<string, string> | null = null

function indexByUnique(): void {
  if (imagesByUnique && namesByUnique) return
  imagesByUnique = new Map()
  namesByUnique = new Map()
  const all = new Items({}) as unknown as {
    uniqueName?: string
    imageName?: string
    name?: string
  }[]
  for (const i of all) {
    if (!i.uniqueName) continue
    if (i.imageName) imagesByUnique.set(i.uniqueName, imageFor(i.uniqueName, i.imageName)!)
    if (i.name) namesByUnique.set(i.uniqueName, i.name)
  }
}
const plainPath = (u: string): string => u.replace('/Lotus/StoreItems/', '/Lotus/')

function findImageByUnique(uniqueName?: string): string | undefined {
  if (!uniqueName) return undefined
  indexByUnique()
  return imagesByUnique!.get(plainPath(uniqueName))
}

// Item name by game path (as world-state rewards and shops give them), if the item list knows it.
export function findItemName(uniqueName: string): string | undefined {
  indexByUnique()
  return namesByUnique!.get(plainPath(uniqueName))
}

// Prime Resurgence packs are called e.g. "M P V Nidus Saryn Prime Dual Pack": use the first
// frame's picture ("Nidus Prime").
function packImage(name: string): string | undefined {
  const m = /^M P V (\w+)(?: \w+)* Prime (?:Single|Dual|Triple)? ?Pack$/i.exec(name)
  return m ? findItemImage(`${m[1]} Prime`) : undefined
}

export function findItemImage(name: string, uniqueName?: string): string | undefined {
  const byPath = findImageByUnique(uniqueName)
  if (byPath) return byPath
  const byName = findImageByName(name)
  return byName ?? packImage(name)
}

function findImageByName(name: string): string | undefined {
  if (!imagesByName) {
    imagesByName = new Map()
    const all = new Items({ category: IMAGE_CATEGORIES as never }) as unknown as {
      name?: string
      imageName?: string
      uniqueName?: string
    }[]
    for (const i of all) {
      const key = i.name?.toLowerCase()
      if (key && i.imageName && !imagesByName.has(key))
        imagesByName.set(key, imageFor(i.uniqueName, i.imageName)!)
    }
  }
  const lower = name.toLowerCase()
  return (
    imagesByName.get(lower) ??
    imagesByName.get(lower.replace(/ (collection|access|pack|bundle|set)$/, ''))
  )
}

// What each syndicate sells (augment mods, weapons), from the drop data: entries whose source is
// the syndicate's own name ("Steel Meridian", "Solaris United (The Business)", …).
export interface ShopItem {
  name: string
  image?: string
  slug?: string
  kind: ShopKind // tab in the shop pop-up
  card?: ShopCard // mods and arcanes: what their card shows
  cost?: number // standing, where known (wiki lists)
  rank?: number // syndicate rank needed
}
export interface ShopCard {
  rarity?: string
  polarity?: string
  drain?: number
  maxRank?: number
  type?: string
}
interface RawShopItem {
  rarity?: string
  polarity?: string
  baseDrain?: number
  fusionLimit?: number
  type?: string
  levelStats?: unknown[]
}
// mods: rarity, polarity, drain, ranks; arcanes: rarity and ranks (from their level stats)
function shopCard(kind: ShopKind, i?: RawShopItem): ShopCard | undefined {
  if (!i || (kind !== 'Mods' && kind !== 'Arcanes')) return undefined
  return {
    rarity: i.rarity,
    polarity: i.polarity,
    drain: i.baseDrain,
    maxRank: i.fusionLimit ?? (i.levelStats ? i.levelStats.length - 1 : undefined),
    type: i.type
  }
}
export type ShopKind = 'Mods' | 'Arcanes' | 'Weapons' | 'Blueprints' | 'Other'
const WEAPONS = new Set(['Primary', 'Secondary', 'Melee', 'Arch-Gun', 'Arch-Melee'])
function shopKind(name: string, category?: string): ShopKind {
  if (/Blueprint$/.test(name)) return 'Blueprints'
  if (category === 'Mods' || category === 'Arcanes') return category
  return category && WEAPONS.has(category) ? 'Weapons' : 'Other'
}
let shop: Record<string, ShopItem[]> | null = null
export function getSyndicateShop(): Record<string, ShopItem[]> {
  if (shop) return shop
  shop = {}
  const all = new Items({
    category: ['Mods', 'Arcanes', 'Primary', 'Secondary', 'Melee', 'Arch-Gun'] as never
  }) as unknown as ({
    name?: string
    imageName?: string
    uniqueName?: string
    category?: string
    tradable?: boolean
    drops?: { location?: string }[]
  } & RawShopItem)[]
  for (const i of all) {
    // the drop data also lists the hidden Beginner / Expert copies of common mods (Flow,
    // Intensify, …) as shop items; nobody can buy those, and they would repeat the name
    if (!i.name || /\/(Beginner|Expert)\//.test(i.uniqueName ?? '')) continue
    const seen = new Set<string>()
    for (const d of i.drops ?? []) {
      const src = (d.location ?? '')
        .split(',')[0]
        .replace(/ \(.*\)$/, '')
        .trim()
      if (!src || seen.has(src) || /Relic|Rotation|Bounty|Mission/.test(src)) continue
      seen.add(src)
      if (shop[src]?.some((x) => x.name === i.name)) continue // one row per name
      ;(shop[src] ??= []).push({
        name: i.name,
        image: imageFor(i.uniqueName, i.imageName),
        slug: i.tradable ? slugFromName(i.name) : undefined,
        kind: shopKind(i.name, i.category),
        card: shopCard(shopKind(i.name, i.category), i)
      })
    }
  }
  // the drop data has no (or a partial) shop for some syndicates: the wiki's lists replace it
  const index = new Map(
    // only the categories these lists use: loading every item would block for a moment
    (
      new Items({
        category: [
          'Mods',
          'Arcanes',
          'Misc',
          'Warframes',
          'Melee',
          'Secondary',
          'Primary',
          'Resources',
          'Gear',
          'Pets',
          'Skins',
          'Sentinels',
          'SentinelWeapons',
          'Arch-Gun'
        ] as never
      }) as unknown as typeof all
    )
      .filter((i) => i.name)
      .map((i) => [i.name!, i])
  )
  for (const [src, wares] of Object.entries(WIKI_WARES)) {
    shop[src] = wares.map(([name, from, cost, rank, wikiFile]) => {
      const i = index.get(name)
      // blueprints and parts aren't stored by their shop name: picture of the item they build
      const pic = i ?? index.get(name.replace(/ Blueprint$/, '')) ?? index.get(from)
      const kind = shopKind(name, i?.category)
      return {
        name,
        // the wiki's own picture where the item data has none (newer items, decorations, …)
        image: pic
          ? imageFor(pic.uniqueName, pic.imageName)
          : `https://wiki.warframe.com/images/${encodeURIComponent(wikiFile)}`,
        slug: i?.tradable ? slugFromName(name) : undefined,
        kind,
        card: shopCard(kind, i),
        cost,
        rank
      }
    })
  }
  return shop
}

// How many of each tradable part a set needs ("Kestrel Prime" -> blade 2, blueprint 1, grip 1),
// keyed by the game's component name in lower case. Empty when the item is unknown.
let byName: Map<
  string,
  { components?: { name?: string; itemCount?: number; tradable?: boolean }[] }
> | null = null
export function setPartCounts(base: string): Map<string, number> {
  byName ??= new Map(
    (
      new Items({}) as unknown as {
        name?: string
        components?: { name?: string; itemCount?: number; tradable?: boolean }[]
      }[]
    )
      .filter((i) => i.name && i.components)
      .map((i) => [i.name!.toLowerCase(), i])
  )
  const out = new Map<string, number>()
  for (const c of byName.get(base.toLowerCase())?.components ?? [])
    if (c.tradable && c.name) out.set(c.name.toLowerCase(), c.itemCount ?? 1)
  return out
}
