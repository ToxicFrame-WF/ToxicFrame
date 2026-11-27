import { wfmFetch } from './wfm'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, renameSync, writeFileSync } from 'fs'

export interface ItemMetaEntry {
  id: string // warframe.market item id (orders refer to items by this)
  name: string
  tags: string[]
  icon?: string // full image URL
  ducats: number
}
export type ItemMeta = Record<string, ItemMetaEntry>

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_VERSION = 3 // bump when the saved shape or icon choice changes
const ASSETS = 'https://warframe.market/static/assets/'
let meta: ItemMeta | null = null
let loading: Promise<ItemMeta> | null = null
const file = (): string => join(app.getPath('userData'), 'item-meta.json')

// One request to warframe.market for every tradable item's icon and ducat value,
// cached on disk for a week.
// every caller waits for the same download
export function getItemMeta(): Promise<ItemMeta> {
  if (meta) return Promise.resolve(meta)
  return (loading ??= loadItemMeta().finally(() => (loading = null)))
}

async function loadItemMeta(): Promise<ItemMeta> {
  let stale: ItemMeta | undefined
  try {
    const saved = JSON.parse(readFileSync(file(), 'utf8')) as {
      v?: number
      at: number
      meta: ItemMeta
    }
    if (saved.v === CACHE_VERSION) {
      if (Date.now() - saved.at < MAX_AGE_MS) return (meta = saved.meta)
      stale = saved.meta
    }
  } catch {
    // no usable cache
  }

  try {
    const res = await wfmFetch('https://api.warframe.market/v2/items', {
      headers: {
        Language: 'en',
        Accept: 'application/json'
      }
    })
    if (!res.ok) throw new Error(`items request returned ${res.status}`)
    const json = (await res.json()) as {
      data?: {
        id: string
        slug: string
        tags?: string[]
        ducats?: number
        i18n?: { en?: { name?: string; icon?: string; thumb?: string; subIcon?: string } }
      }[]
    }
    const result: ItemMeta = {}
    let withIcon = 0
    for (const it of json.data ?? []) {
      // parts (barrels, chassis...) carry the whole item's picture as icon; subIcon is the part itself
      const path = it.i18n?.en?.subIcon ?? it.i18n?.en?.thumb ?? it.i18n?.en?.icon
      if (path) withIcon++
      result[it.slug] = {
        id: it.id,
        name: it.i18n?.en?.name ?? it.slug,
        tags: it.tags ?? [],
        icon: path ? ASSETS + path : undefined,
        ducats: it.ducats ?? 0
      }
    }
    console.log(`Item meta: ${Object.keys(result).length} items, ${withIcon} with icons`)
    meta = result
    try {
      writeFileSync(file() + '.tmp', JSON.stringify({ v: CACHE_VERSION, at: Date.now(), meta }))
      renameSync(file() + '.tmp', file())
    } catch (e) {
      console.error('Could not save item meta cache:', e)
    }
    return meta
  } catch (e) {
    console.error('Could not load item meta:', e)
    return stale ?? {} // not kept in `meta`, so the next call tries the download again
  }
}
