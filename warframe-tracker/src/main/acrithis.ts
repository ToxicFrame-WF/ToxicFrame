import { net } from 'electron'
import { parseAcrithis } from './wikiText'

// Acrithis's weekly wares are random; players report them on the wiki each week. Read that page:
// the five items and the date they were seen. Asked once per session.
let loading: Promise<{ observed: string; items: string[] } | null> | null = null

export function getAcrithisWares(): Promise<{ observed: string; items: string[] } | null> {
  return (loading ??= load())
}

async function load(): Promise<{ observed: string; items: string[] } | null> {
  try {
    const res = await net.fetch(
      'https://wiki.warframe.com/w/Acrithis/Current_Offerings?action=raw',
      { headers: { 'User-Agent': 'ToxicFrame/0.1' } }
    )
    if (!res.ok) throw new Error(String(res.status))
    return parseAcrithis(await res.text())
  } catch {
    loading = null // try again next time
    return null
  }
}
