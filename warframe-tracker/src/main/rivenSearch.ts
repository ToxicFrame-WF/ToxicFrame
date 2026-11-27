import { getRivenCatalog } from './marketContracts'
import { wfmFetch } from './wfm'
import { recordRivenSnapshot } from './rivenHistory'

// One place that asks warframe.market for riven auctions (used by the Finder page and the riven
// overlay). Legacy v1 route, no login needed (checked live 2026-11-26). Rate limit: wfmFetch;
// results are cached 60 s per weapon so repeated filter changes never hit the API.
export interface Listing {
  id: string
  price: number
  rerolls: number
  mr: number
  rank: number
  polarity?: string
  name: string
  seller: string
  status: string // ingame | online | offline
  url: string
  attrs: { slug: string; name: string; unit?: string; value: number; positive: boolean }[]
}

const cache = new Map<string, { at: number; list: Listing[] }>()

// shortcut: filters run on the cheapest page wfm returns (it caps the list); upgrade to the
// positive_stats / negative_stats query params if a weapon has more listings than that.
export async function searchAuctions(slug: string): Promise<Listing[]> {
  const hit = cache.get(slug)
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.list
  const cat = await getRivenCatalog()
  const res = await wfmFetch(
    `https://api.warframe.market/v1/auctions/search?type=riven&weapon_url_name=${encodeURIComponent(slug)}&sort_by=price_asc&buyout_policy=with`,
    { headers: { Platform: 'pc', Language: 'en', Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error(`warframe.market answered with status ${res.status}`)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const raw: any[] = ((await res.json()) as any)?.payload?.auctions ?? []
  const list = raw
    .filter((a) => a.visible !== false && !a.closed)
    .map((a): Listing => ({
      id: String(a.id),
      price: Number(a.buyout_price ?? a.starting_price ?? 0),
      rerolls: Number(a.item?.re_rolls ?? 0),
      mr: Number(a.item?.mastery_level ?? 0),
      rank: Number(a.item?.mod_rank ?? 0),
      polarity: a.item?.polarity,
      name: String(a.item?.name ?? ''),
      seller: String(a.owner?.ingame_name ?? ''),
      status: String(a.owner?.status ?? 'offline'),
      url: `https://warframe.market/auction/${a.id}`,
      attrs: (a.item?.attributes ?? []).map((x: any) => ({
        slug: x.url_name,
        name: cat.attrs[x.url_name]?.name ?? x.url_name,
        unit: cat.attrs[x.url_name]?.unit,
        value: Number(x.value),
        positive: !!x.positive
      }))
    }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
  cache.set(slug, { at: Date.now(), list })
  recordRivenSnapshot(slug, list)
  return list
}
