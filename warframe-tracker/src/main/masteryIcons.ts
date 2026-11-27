// Mastery rank badge icons from the official wiki (File:IconRank<N>.png). Fetched once as a
// rank -> thumbnail-url map and cached ~30 days, like planetIcons.

import { app, net } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const WIKI = 'https://wiki.warframe.com'
const MAX_RANK = 40 // covers MR30 plus the Legendary ranks
const THUMB = 96
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const file = (): string => join(app.getPath('userData'), 'mastery-icons.json')

let cache: Record<number, string> | null = null

async function fetchIcons(): Promise<Record<number, string>> {
  const titles = Array.from({ length: MAX_RANK }, (_, i) => `File:IconRank${i + 1}.png`).join('|')
  const url =
    `${WIKI}/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=${THUMB}` +
    `&titles=${encodeURIComponent(titles)}`
  const res = await net.fetch(url, { headers: { 'User-Agent': 'ToxicFrame/0.1 (hobby tracker)' } })
  if (!res.ok) return {}
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { title?: string; imageinfo?: { thumburl?: string }[] }> }
  }
  const icons: Record<number, string> = {}
  for (const page of Object.values(json.query?.pages ?? {})) {
    const m = /IconRank(\d+)\.png/.exec(page.title ?? '')
    const thumb = page.imageinfo?.[0]?.thumburl
    if (m && thumb) icons[Number(m[1])] = thumb
  }
  return icons
}

export async function getMasteryIcons(): Promise<Record<number, string>> {
  if (cache) return cache

  try {
    const saved = JSON.parse(readFileSync(file(), 'utf8')) as {
      at: number
      icons: Record<number, string>
    }
    if (Date.now() - saved.at < MAX_AGE_MS && Object.keys(saved.icons).length > 0) {
      cache = saved.icons
      return cache
    }
  } catch {
    // nothing saved yet
  }

  const icons = await fetchIcons()
  if (Object.keys(icons).length > 0) {
    cache = icons
    try {
      writeFileSync(file(), JSON.stringify({ at: Date.now(), icons }))
    } catch {
      // not critical
    }
  }
  return cache ?? {}
}
