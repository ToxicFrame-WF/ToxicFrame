// Craftable-item catalog for the Crafting helper: every buildable, masterable item with its
// bill of materials (resources, the blueprint, and sub-components to craft), built once from
// @wfcd/items. The renderer aggregates these across the player's favourites into a shopping list.

import { cdnImage, imageFor } from './browseIcons'
import Items from '@wfcd/items'

export type CompKind = 'resource' | 'blueprint' | 'component'

export interface CraftComponent {
  uniqueName: string
  name: string
  itemCount: number
  kind: CompKind
  image?: string
  imageFallback?: string
}

export interface CraftItem {
  uniqueName: string
  name: string
  type: string
  masteryReq: number
  productCategory?: string
  image?: string
  buildPrice: number
  components: CraftComponent[]
}

interface RawComp {
  uniqueName?: string
  name?: string
  itemCount?: number
  imageName?: string
}
interface RawCraft {
  uniqueName?: string
  name?: string
  type?: string
  masteryReq?: number
  productCategory?: string
  imageName?: string
  buildPrice?: number
  masterable?: boolean
  components?: RawComp[]
}

function kindOf(c: RawComp): CompKind {
  const u = c.uniqueName ?? ''
  if (!u.includes('/Recipes/')) return 'resource'
  return c.name === 'Blueprint' ? 'blueprint' : 'component'
}

let cache: CraftItem[] | null = null
export const resetCraftingCache = (): void => {
  cache = null
}

export function getCraftables(): CraftItem[] {
  if (cache) return cache
  const out: CraftItem[] = []
  for (const i of new Items({}) as unknown as RawCraft[]) {
    if (!i.uniqueName || !i.masterable || !i.components?.length) continue
    out.push({
      uniqueName: i.uniqueName,
      name: i.name ?? 'Unknown',
      type: i.type ?? 'Item',
      masteryReq: i.masteryReq ?? 0,
      productCategory: i.productCategory,
      image: imageFor(i.uniqueName, i.imageName),
      buildPrice: i.buildPrice ?? 0,
      components: i.components.map((c) => ({
        uniqueName: (c.uniqueName ?? '').replace('/Lotus/StoreItems/', '/Lotus/'),
        name: c.name ?? 'Unknown',
        itemCount: c.itemCount ?? 1,
        kind: kindOf(c),
        image: imageFor(c.uniqueName, c.imageName),
        imageFallback: cdnImage(c.imageName)
      }))
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  cache = out
  return cache
}
