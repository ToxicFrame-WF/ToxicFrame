import { net } from 'electron'
import { parseAcrithis } from './wikiText'

// Acrithis's weekly wares are random; players report them on the wiki each week. Read that page:
// the five items and the date they were seen. Refetched after an hour or a failure.
type Wares = { observed: string; items: string[] } | null
let loading: Promise<Wares> | null = null
let loadedAt = 0

export function getAcrithisWares(): Promise<Wares> {
  if (Date.now() - loadedAt > 3_600_000) loading = null
  return (loading ??= load())
}

async function load(): Promise<Wares> {
  loadedAt = Date.now()
  try {
    const res = await net.fetch(
      'https://wiki.warframe.com/w/Acrithis/Current_Offerings?action=raw',
      { headers: { 'User-Agent': 'ToxicFrame/0.1' } }
    )
    if (!res.ok) throw new Error(String(res.status))
    const r = parseAcrithis(await res.text())
    if (!r) loadedAt = 0 // nothing parsed: retry next call
    return r
  } catch {
    loadedAt = 0 // try again next time
    return null
  }
}
