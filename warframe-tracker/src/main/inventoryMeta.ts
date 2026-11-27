// Display metadata for the Inventory page: mods, arcanes and prime parts keyed by their internal
// unique name, so the renderer can turn raw inventory entries into cards. Built once from
// @wfcd/items and cached. Plat prices come from warframe.market (priceService) and ducats from
// itemMeta in the renderer; this only supplies names, images, rarity, max rank and the market slug.

import { imageFor } from './browseIcons'
import Items from '@wfcd/items'
import { slugFromName } from './marketSlug'
import { WIKI_WARES } from './syndicateWares'
import { BARO_MODS } from './baroMods'
import { WIKI_RESOURCES } from './wikiResources'
import { attackModes, type AttackMode, type RawAttack } from './weaponStats'

// the wiki writes "Primed Bane of Grineer", the game data "Primed Bane Of Grineer": match without case
let baroIndex: Map<string, [number, number]> | null = null
const baroByName = (): Map<string, [number, number]> =>
  (baroIndex ??= new Map(Object.entries(BARO_MODS).map(([k, v]) => [k.toLowerCase(), v])))

export type InvKind = 'mod' | 'arcane' | 'part' | 'misc'

export interface InvMeta {
  kind: InvKind
  name: string
  image?: string
  rarity?: string
  modType?: string // mods: what they fit, e.g. "Shotgun", "Warframe"
  maxRank?: number
  slug?: string // warframe.market urlName, for prices/ducats/trade link
  tradable: boolean
  isPrime: boolean
  ducats?: number
  parent?: string // unique name of the item this part builds
  need?: number // how many that item's recipe uses
}

export type InventoryMeta = Record<string, InvMeta>

interface RawMod {
  uniqueName?: string
  wikiaThumbnail?: string
  name?: string
  imageName?: string
  rarity?: string
  fusionLimit?: number
  type?: string // "Shotgun Mod"
  tradable?: boolean
  isPrime?: boolean
  warframeMarket?: { urlName?: string }
}
interface RawArcane extends RawMod {
  levelStats?: unknown[]
}
interface RawParent {
  uniqueName?: string
  name?: string
  category?: string
  components?: {
    uniqueName?: string
    name?: string
    imageName?: string
    itemCount?: number
    tradable?: boolean
    ducats?: number
    warframeMarket?: { urlName?: string }
  }[]
}

const PART_PARENTS = [
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

// The wiki's full mod card (e.g. PrimedReachMod.png) instead of the small texture; cache suffix dropped.
const modImage = (m: RawMod): string | undefined =>
  m.wikiaThumbnail?.split('?')[0] ?? imageFor(m.uniqueName, m.imageName)
const marketSlug = (m: RawMod): string | undefined =>
  m.warframeMarket?.urlName ?? (m.tradable && m.name ? slugFromName(m.name) : undefined)

let cache: InventoryMeta | null = null

export function getInventoryMeta(): InventoryMeta {
  if (cache) return cache
  const meta: InventoryMeta = {}

  for (const m of new Items({ category: ['Mods'] }) as unknown as RawMod[]) {
    if (!m.uniqueName) continue
    meta[m.uniqueName] = {
      kind: 'mod',
      name: m.name ?? 'Unknown',
      image: modImage(m),
      rarity: m.rarity,
      modType: m.type?.replace(/ Mod$/, ''),
      maxRank: m.fusionLimit ?? 0,
      slug: marketSlug(m),
      tradable: Boolean(m.tradable),
      isPrime: Boolean(m.isPrime)
    }
  }

  for (const a of new Items({ category: ['Arcanes'] }) as unknown as RawArcane[]) {
    if (!a.uniqueName) continue
    meta[a.uniqueName] = {
      kind: 'arcane',
      name: a.name ?? 'Unknown',
      image: modImage(a),
      rarity: a.rarity,
      maxRank: Math.max(0, (a.levelStats?.length ?? 1) - 1),
      slug: marketSlug(a),
      tradable: Boolean(a.tradable),
      isPrime: Boolean(a.isPrime)
    }
  }

  // Prime (and other tradable) parts are the components of craftable items.
  for (const parent of new Items({ category: PART_PARENTS as never }) as unknown as RawParent[]) {
    for (const c of parent.components ?? []) {
      if (!c.uniqueName || meta[c.uniqueName]) continue
      if (!c.ducats && !c.tradable) continue // skip plain build components with no trade value
      // resources used in recipes (Thrax Plasm, Orokin Ducats, ...) belong on the Resources page
      // (only the Ignis Wraith blueprint is a real part outside /Recipes/)
      if (!/\/Recipes\/|Blueprint$/.test(c.uniqueName)) continue
      meta[c.uniqueName] = {
        kind: 'part',
        name: c.name ? `${parent.name ?? ''} ${c.name}`.trim() : (parent.name ?? 'Unknown'),
        image: imageFor(c.uniqueName, c.imageName),
        // @wfcd lacks most part market names: "<item> <part>", plus "blueprint" for Warframe and
        // Archwing parts (lavos_prime_chassis_blueprint) but not weapon/sentinel parts
        slug:
          c.warframeMarket?.urlName ??
          (c.tradable && c.name
            ? slugFromName(
                `${parent.name ?? ''} ${c.name}${
                  /^(Warframes|Archwing)$/.test(parent.category ?? '') && c.name !== 'Blueprint'
                    ? ' Blueprint'
                    : ''
                }`
              )
            : undefined),
        tradable: Boolean(c.tradable),
        isPrime: /Prime/.test(parent.name ?? ''),
        ducats: c.ducats,
        parent: parent.uniqueName,
        need: c.itemCount ?? 1
      }
    }
  }
  // Warframe/Archwing parts drop as "...SystemsBlueprint" (in Recipes) but @wfcd lists only the
  // built "...SystemsComponent", so the unbuilt blueprint gets its own entry
  for (const [key, m] of Object.entries(meta)) {
    if (m.kind !== 'part' || !/\/Recipes\/.*Component$/.test(key)) continue
    const bp = key.replace(/Component$/, 'Blueprint')
    meta[bp] ??= { ...m, name: `${m.name} Blueprint` }
  }

  // Misc: other tradable things (fish, Ayatan treasures, scenes, Prisma weapons, Necramech parts).
  // The renderer only shows the ones warframe.market lists.
  for (const i of new Items({
    category: ['Fish', 'Misc', 'Resources', 'Primary', 'Secondary', 'Melee']
  }) as unknown as RawMod[]) {
    if (!i.uniqueName || !i.tradable || !i.name || meta[i.uniqueName]) continue
    meta[i.uniqueName] = {
      kind: 'misc',
      name: i.name,
      image: modImage(i),
      slug: i.warframeMarket?.urlName ?? slugFromName(i.name),
      tradable: true,
      isPrime: Boolean(i.isPrime)
    }
  }

  cache = meta
  return cache
}

// Resource catalog for the Resource inventory page: every craftable-resource-like item, keyed by
// the unique name used in the inventory's MiscItems list.
export interface ResourceMeta {
  uniqueName: string
  name: string
  image?: string
  imageFallback?: string
  type?: string // "Resource", "Captura", "Equipment Adapter"...
  description?: string
  drops: { location: string; chance: number; amount?: string }[]
}

let resourceCache: ResourceMeta[] | null = null

export function getResourceCatalog(): ResourceMeta[] {
  if (resourceCache) return resourceCache
  const out = new Map<string, ResourceMeta>()
  for (const i of new Items({ category: ['Resources', 'Misc'] }) as unknown as (RawMod & {
    description?: string
    drops?: { location?: string; chance?: number; type?: string }[]
  })[]) {
    if (!i.uniqueName) continue
    // normalise the store-item path variant the game sometimes uses
    const id = i.uniqueName.replace('/Lotus/StoreItems/', '/Lotus/')
    // only what the wiki lists as a resource (no gear, adapters, Captura, keys, boosters...)
    const wiki = WIKI_RESOURCES[id]
    if (!wiki) continue
    if (out.has(id)) continue
    out.set(id, {
      uniqueName: id,
      name: i.name ?? 'Unknown',
      image: imageFor(i.uniqueName, i.imageName),
      // some @wfcd pictures 404; the wiki has its own
      imageFallback: wiki[1]
        ? `https://wiki.warframe.com/images/${encodeURIComponent(wiki[1])}`
        : undefined,
      type: wiki[0],
      description: i.description,
      drops: (i.drops ?? [])
        .filter((d) => d.location)
        .map((d) => ({
          location: d.location!,
          chance: d.chance ?? 0,
          // "50X Aggristone" -> "50×"
          amount: /^(\d+)X /.exec(d.type ?? '')?.[1]
        }))
        .sort((a, b) => b.chance - a.chance)
    })
  }
  resourceCache = [...out.values()]
  return resourceCache
}

// Archon shard colours with their inventory unique names, images and effect tables (regular +
// Tauforged). Effect values are from the Warframe wiki (Tauforged = 1.5x regular); the wiki notes
// this table "may not be completely correct", so treat values as a guide.
export interface ShardEffect {
  name: string
  regular: string
  tauforged: string
}
export interface ArchonShard {
  color: string
  hex: string
  effects: ShardEffect[]
  regular: { uniqueName: string; image?: string }
  tauforged: { uniqueName: string; image?: string }
}

const E = (name: string, regular: string, tauforged: string): ShardEffect => ({
  name,
  regular,
  tauforged
})

const SHARD_DEFS: { color: string; hex: string; archon: string; effects: ShardEffect[] }[] = [
  {
    color: 'Crimson',
    hex: '#e0533d',
    archon: 'Amar',
    effects: [
      E('Ability strength', '+10% Strength', '+15% Strength'),
      E('Ability duration', '+10% Duration', '+15% Duration'),
      E('Melee critical damage', '+25%', '+37.5%'),
      E('Primary status chance', '+25%', '+37.5%'),
      E('Secondary critical chance', '+25%', '+37.5%')
    ]
  },
  {
    color: 'Amber',
    hex: '#e0a93d',
    archon: 'Nira',
    effects: [
      E('Max energy on spawn', '+30%', '+45%'),
      E('Health orb effectiveness', '+100%', '+150%'),
      E('Energy orb effectiveness', '+50%', '+75%'),
      E('Casting speed', '+25%', '+37.5%'),
      E('Parkour velocity', '+15%', '+22.5%')
    ]
  },
  {
    color: 'Azure',
    hex: '#3da6e0',
    archon: 'Boreal',
    effects: [
      E('Max health', '+150', '+225'),
      E('Shield capacity', '+150', '+225'),
      E('Armor', '+150', '+225'),
      E('Energy max', '+50', '+75'),
      E('Health regen', '+5 /s', '+7.5 /s')
    ]
  },
  {
    color: 'Emerald',
    hex: '#3de08a',
    archon: 'Green',
    effects: [
      E('Toxin status damage', '+30%', '+45%'),
      E('Health on toxin hit', '+2', '+3'),
      E('Ability damage vs corrosion', '+10%', '+15%'),
      E('Max corrosion stacks', '+2', '+3')
    ]
  },
  {
    color: 'Topaz',
    hex: '#e0773d',
    archon: 'Orange',
    effects: [
      E('Health per blast kill', '1 (cap 300)', '2 (cap 450)'),
      E('Shield regen on blast kill', '+5', '+7.5'),
      E('Secondary crit per heat kill', '1% (cap 50%)', '1.5% (cap 75%)'),
      E('Ability damage vs radiation', '+10%', '+15%')
    ]
  },
  {
    color: 'Violet',
    hex: '#b03de0',
    archon: 'Violet',
    effects: [
      E('Ability damage vs electricity', '+10%', '+15%'),
      E('Primary electricity damage', '+30%', '+45%'),
      E('Melee critical damage', '+25%', '+37.5%'),
      E('Health ↔ energy pickups', '+20%', '+30%')
    ]
  }
]

let shardCache: ArchonShard[] | null = null

export function getArchonShards(): ArchonShard[] {
  if (shardCache) return shardCache
  // Pictures from wiki.warframe.com (file names verified 2026-11-15); @wfcd's Tauforged images are dark.
  const wiki = (file: string): string => `https://wiki.warframe.com/images/${file}`
  const base = '/Lotus/Types/Gameplay/NarmerSorties/ArchonCrystal'
  shardCache = SHARD_DEFS.map((d) => ({
    color: d.color,
    hex: d.hex,
    effects: d.effects,
    regular: { uniqueName: `${base}${d.archon}`, image: wiki(`${d.color}ArchonShard.png`) },
    tauforged: {
      uniqueName: `${base}${d.archon}Mythic`,
      image: wiki(`Tauforged${d.color}ArchonShard.png`)
    }
  }))
  return shardCache
}

// Full detail for one mod or arcane, fetched on demand when its card is opened.
export interface ModDetail {
  name: string
  image?: string
  kind: 'mod' | 'arcane'
  modType?: string // e.g. "Warframe", "Rifle"
  rarity?: string
  drainMin?: number
  drainMax?: number
  polarity?: string
  maxRank: number
  slug?: string
  wikiUrl?: string
  levelStats: string[][] // stats per rank
  drops: { location: string; chance: number; note?: string; ducats?: number; credits?: number }[]
}

interface RawModFull extends RawMod {
  compatName?: string
  polarity?: string
  baseDrain?: number
  type?: string
  levelStats?: { stats?: string[] }[]
  wikiaUrl?: string
  drops?: { location?: string; chance?: number }[]
}

let modIndex: Map<string, RawModFull> | null = null

export function getModDetail(uniqueName: string): ModDetail | null {
  if (!modIndex) {
    modIndex = new Map()
    for (const m of new Items({ category: ['Mods', 'Arcanes'] }) as unknown as RawModFull[])
      if (m.uniqueName) modIndex.set(m.uniqueName, m)
  }
  const m = modIndex.get(uniqueName)
  if (!m) return null
  const isArcane = /CosmeticEnhancers/.test(uniqueName)
  const maxRank = isArcane ? Math.max(0, (m.levelStats?.length ?? 1) - 1) : (m.fusionLimit ?? 0)

  // keep the best-chance drop per location, most likely first
  const byLocation = new Map<string, number>()
  for (const d of m.drops ?? []) {
    if (!d.location) continue
    byLocation.set(d.location, Math.max(byLocation.get(d.location) ?? 0, d.chance ?? 0))
  }
  const drops: {
    location: string
    chance: number
    note?: string
    ducats?: number
    credits?: number
  }[] = [...byLocation.entries()]
    .map(([location, chance]) => ({ location, chance }))
    .sort((a, b) => b.chance - a.chance)
    .slice(0, 20)
  // vendors the drop data doesn't list: syndicate shops and Baro Ki'Teer (both from the wiki)
  for (const [syndicate, wares] of Object.entries(WIKI_WARES))
    for (const [name, , cost, rank] of wares)
      if (name === m.name)
        drops.push({
          location: `${syndicate} shop`,
          chance: 0,
          note: `rank ${rank}, ${cost.toLocaleString('en-US')} standing`
        })
  const baro = m.name ? baroByName().get(m.name.toLowerCase()) : undefined
  if (baro)
    drops.push({
      location: "Baro Ki'Teer (Void Trader)",
      chance: 0,
      ducats: baro[0],
      credits: baro[1]
    })

  return {
    name: m.name ?? 'Unknown',
    image: modImage(m),
    kind: isArcane ? 'arcane' : 'mod',
    modType: m.compatName ? m.compatName.charAt(0) + m.compatName.slice(1).toLowerCase() : m.type,
    rarity: m.rarity,
    drainMin: m.baseDrain,
    drainMax: m.baseDrain != null ? m.baseDrain + maxRank : undefined,
    polarity: m.polarity,
    maxRank,
    slug: marketSlug(m),
    wikiUrl: m.wikiaUrl,
    // strip the game's inline colour tags, e.g. "+45% <DT_ELECTRICITY_COLOR>Electricity"
    levelStats: (m.levelStats ?? []).map((l) =>
      (l.stats ?? []).map((s) =>
        s
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      )
    ),
    drops
  }
}

export interface ItemDetail extends WarframeDetail {
  weapon?: {
    type?: string
    mr?: number
    disposition?: number
    exilus?: string
    magazine?: number
    reload?: number
    trigger?: string
    noise?: string
    accuracy?: number
    multishot?: number
    buildPrice?: number
    buildTime?: number
    modes: AttackMode[]
  }
}

// Full detail for one Warframe, for the Warframe details window.
export interface WarframeDetail {
  uniqueName: string
  name: string
  description?: string
  image?: string
  wikiUrl?: string
  setSlug?: string
  stats: { health?: number; shield?: number; armor?: number; power?: number; sprint?: number }
  polarities: string[]
  aura?: string
  passive?: string
  abilities: { name: string; description: string; image?: string }[]
  components: {
    uniqueName: string
    name: string
    image?: string
    itemCount: number
    tradable: boolean
    ducats?: number
    slug?: string
    drops: { location: string; chance: number }[]
  }[]
}

interface RawFrame {
  uniqueName?: string
  name?: string
  description?: string
  imageName?: string
  wikiaUrl?: string
  health?: number
  shield?: number
  armor?: number
  power?: number
  sprintSpeed?: number
  polarities?: string[]
  aura?: string
  passiveDescription?: string
  isPrime?: boolean
  abilities?: { name?: string; description?: string; imageName?: string; uniqueName?: string }[]
  components?: {
    uniqueName?: string
    name?: string
    imageName?: string
    itemCount?: number
    tradable?: boolean
    ducats?: number
    warframeMarket?: { urlName?: string }
    drops?: { location?: string; chance?: number }[]
  }[]
}

let frameIndex: Map<string, RawFrame> | null = null
const clean = (s: string): string =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/\|[A-Z_]+\|/g, 'X')
    .trim()

function mapComponents(name: string, comps: RawFrame['components']): WarframeDetail['components'] {
  return (comps ?? []).map((c) => {
    // one row per relic: prefer the Intact chance, else the best listed
    const byRelic = new Map<string, number>()
    for (const d of c.drops ?? []) {
      if (!d.location) continue
      const base = d.location.replace(/\s*\((Exceptional|Flawless|Radiant)\)$/, '')
      const intact = base === d.location
      const prev = byRelic.get(base)
      if (prev === undefined || intact) byRelic.set(base, d.chance ?? 0)
    }
    const part = c.name ?? ''
    const isPart = !!c.tradable && part !== 'Blueprint'
    return {
      uniqueName: c.uniqueName ?? part,
      name: c.tradable ? `${name} ${part}${isPart ? ' Blueprint' : ''}` : part,
      image: imageFor(c.uniqueName, c.imageName),
      itemCount: c.itemCount ?? 1,
      tradable: !!c.tradable,
      ducats: c.ducats,
      // @wfcd often lacks the market name for parts; it follows "<item> <part> blueprint"
      slug:
        c.warframeMarket?.urlName ??
        (c.tradable
          ? `${name} ${part}${isPart ? ' Blueprint' : ''}`.toLowerCase().replace(/\s+/g, '_')
          : undefined),
      drops: [...byRelic]
        .map(([location, chance]) => ({ location, chance }))
        .sort((a, b) => b.chance - a.chance)
    }
  })
}

export function getWarframeDetail(uniqueName: string): WarframeDetail | null {
  if (!frameIndex) {
    frameIndex = new Map()
    for (const f of new Items({ category: ['Warframes'] }) as unknown as RawFrame[])
      if (f.uniqueName) frameIndex.set(f.uniqueName, f)
  }
  const f = frameIndex.get(uniqueName)
  if (!f) return null
  const name = f.name ?? 'Unknown'
  return {
    uniqueName,
    name,
    description: f.description,
    image: imageFor(f.uniqueName, f.imageName),
    wikiUrl: f.wikiaUrl,
    setSlug: /Prime$/.test(name) ? `${name.toLowerCase().replace(/\s+/g, '_')}_set` : undefined,
    stats: {
      health: f.health,
      shield: f.shield,
      armor: f.armor,
      power: f.power,
      sprint: f.sprintSpeed
    },
    polarities: f.polarities ?? [],
    aura: f.aura,
    passive: f.passiveDescription ? clean(f.passiveDescription) : undefined,
    abilities: (f.abilities ?? []).map((a) => ({
      name: a.name ?? '',
      description: clean(a.description ?? ''),
      image: imageFor(a.uniqueName, a.imageName)
    })),
    components: mapComponents(name, f.components)
  }
}

// Weapons, companions and archwing: the Warframe window's shape plus a `weapon` block with
// stats per attack mode.
const WEAPON_CATS = [
  'Primary',
  'Secondary',
  'Melee',
  'Arch-Gun',
  'Arch-Melee',
  'Archwing',
  'Sentinels',
  'Pets'
]
interface RawWeapon extends RawFrame {
  type?: string
  masteryReq?: number
  disposition?: number
  exilusPolarity?: string
  criticalChance?: number
  criticalMultiplier?: number
  procChance?: number
  fireRate?: number
  magazineSize?: number
  reloadTime?: number
  trigger?: string
  noise?: string
  accuracy?: number
  multishot?: number
  buildPrice?: number
  buildTime?: number
  damage?: Record<string, number>
  attacks?: RawAttack[]
}
let weaponIndex: Map<string, RawWeapon> | null = null

export function getItemDetail(uniqueName: string): ItemDetail | null {
  if (!weaponIndex) {
    weaponIndex = new Map()
    for (const w of new Items({ category: WEAPON_CATS as never }) as unknown as RawWeapon[])
      if (w.uniqueName) weaponIndex.set(w.uniqueName, w)
  }
  const w = weaponIndex.get(uniqueName)
  if (!w) return getWarframeDetail(uniqueName)
  const name = w.name ?? 'Unknown'
  return {
    uniqueName,
    name,
    description: w.description,
    image: imageFor(w.uniqueName, w.imageName),
    wikiUrl: w.wikiaUrl,
    stats: {},
    polarities: w.polarities ?? [],
    abilities: [],
    components: mapComponents(name, w.components),
    weapon: {
      type: w.type,
      mr: w.masteryReq,
      disposition: w.disposition,
      exilus: w.exilusPolarity,
      magazine: w.magazineSize,
      reload: w.reloadTime,
      trigger: w.trigger,
      noise: w.noise,
      accuracy: w.accuracy,
      multishot: w.multishot,
      buildPrice: w.buildPrice,
      buildTime: w.buildTime,
      modes: attackModes(w.attacks, {
        crit: w.criticalChance != null ? w.criticalChance * 100 : undefined,
        critMult: w.criticalMultiplier,
        status: w.procChance != null ? w.procChance * 100 : undefined,
        fireRate: w.fireRate,
        damage: w.damage
      })
    }
  }
}

// cached rows hold image URLs; drop them when the browse.wf icon map arrives (first run)
export function resetInventoryMetaImages(): void {
  cache = null
  resourceCache = null
  shardCache = null
}
