// Catalog of every mastery-giving item, built once from @wfcd/items. The renderer joins this
// with the owned inventory (from the helper) to work out mastery rank, owned/mastered counts and
// the best items left to rank up. All item-specific numbers live here so the renderer stays data-only.

import { cdnImage, imageFor } from './browseIcons'
import Items from '@wfcd/items'

// productCategory (the inventory section an item is stored under) -> mastery group.
const FRAME_CATS = ['Suits', 'SpaceSuits', 'MechSuits']
const COMPANION_CATS = ['Sentinels', 'KubrowPets', 'MoaPets', 'ZanukaPets', 'CreaturePets']
// everything else masterable is a weapon (LongGuns, Pistols, Melee, SpaceGuns, SpaceMelee,
// SentinelWeapons, OperatorAmps, SpecialItems, ...)

export type MasteryGroup = 'frame' | 'weapon' | 'companion'

export interface MasteryItem {
  uniqueName: string
  name: string
  group: MasteryGroup
  productCategory: string
  maxRank: number // 30, or 40 for Kuva/Tenet/Coda/Paracesis and Necramechs
  pointsPerRank: number // 200 frames/companions, 100 weapons
  imageName?: string
  imageFallback?: string
  isPrime: boolean
  tradable: boolean
  vaulted: boolean
}

export interface MasteryCatalog {
  items: MasteryItem[]
  totals: { frame: number; weapon: number; companion: number }
  nodes: { normal: number; steelPath: number }
}

interface RawMasterable {
  uniqueName: string
  name?: string
  productCategory?: string
  maxLevelCap?: number
  imageName?: string
  isPrime?: boolean
  tradable?: boolean
  vaulted?: boolean
  masterable?: boolean
}

let cache: MasteryCatalog | null = null
export const resetMasteryCache = (): void => {
  cache = null
}

function groupOf(pc: string): MasteryGroup {
  if (FRAME_CATS.includes(pc)) return 'frame'
  if (COMPANION_CATS.includes(pc)) return 'companion'
  return 'weapon'
}

export function getMasteryCatalog(): MasteryCatalog {
  if (cache) return cache

  const all = new Items({}) as unknown as RawMasterable[]
  const items: MasteryItem[] = []
  const totals = { frame: 0, weapon: 0, companion: 0 }

  for (const i of all) {
    if (!i.masterable || !i.productCategory || !i.uniqueName) continue
    const group = groupOf(i.productCategory)
    // Necramechs rank to 40; so do Kuva/Tenet/Coda/Paracesis (maxLevelCap === 40).
    const maxRank = i.maxLevelCap === 40 || i.productCategory === 'MechSuits' ? 40 : 30
    const pointsPerRank = group === 'weapon' ? 100 : 200
    items.push({
      uniqueName: i.uniqueName,
      name: i.name ?? 'Unknown',
      group,
      productCategory: i.productCategory,
      maxRank,
      pointsPerRank,
      imageName: imageFor(i.uniqueName, i.imageName),
      imageFallback: cdnImage(i.imageName),
      isPrime: Boolean(i.isPrime),
      tradable: Boolean(i.tradable),
      vaulted: Boolean(i.vaulted)
    })
    totals[group] += 1
  }

  // Star chart node totals from the node list (nodeType 0 = regular mission node).
  // Steel Path reuses the same nodes. Junctions and some event nodes are not counted here.
  const nodes = new Items({ category: ['Node'] }) as unknown as { nodeType?: number }[]
  const normal = nodes.filter((n) => n.nodeType === 0).length

  cache = { items, totals, nodes: { normal, steelPath: normal } }
  return cache
}
