import { net } from 'electron'
import { acquisitionText } from './wikiText'

// "How to obtain" text for an item: the Acquisition section of its wiki.warframe.com page, turned
// into plain text. Kept in memory for the session; the wiki is asked once per item.
const cache = new Map<string, Promise<string | null>>()

export function wikiAcquisition(item: string): Promise<string | null> {
  const key = item.trim()
  if (!key) return Promise.resolve(null)
  let hit = cache.get(key)
  if (!hit) {
    // a network error is not remembered, so the item is asked again later
    hit = load(key).catch(() => {
      cache.delete(key)
      return null
    })
    cache.set(key, hit)
  }
  return hit
}

// throws on network errors; null = the page has no acquisition text
async function load(item: string): Promise<string | null> {
  const page = encodeURIComponent(item.replace(/ /g, '_'))
  const res = await net.fetch(
    `https://wiki.warframe.com/api.php?action=parse&format=json&page=${page}&prop=text&redirects=1&disabletoc=1`,
    { headers: { 'User-Agent': 'ToxicFrame/0.1' } }
  )
  if (res.status >= 500) throw new Error(`wiki answered ${res.status}`)
  if (!res.ok) return null
  const json = (await res.json()) as { parse?: { text?: { '*'?: string } } }
  return acquisitionText(json.parse?.text?.['*'] ?? '')
}
