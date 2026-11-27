// One item's warframe.market statistics boiled down to what Market activity needs.
export interface MarketStat {
  vol7: number // sales per day, last 7 days
  vol90: number // sales per day, last 90 days
  med7: number // volume-weighted median sale price, last 7 days
  med90: number
  low?: number // lowest sell order in the latest hour (online or not)
  high?: number // highest buy order in the latest hour
  at: number // when fetched
}
interface Closed {
  datetime: string // the day (closed) or hour (live) the row covers
  volume: number
  median: number
  mod_rank?: number
  subtype?: string // relic refinement (intact, radiant...) and other item variants
}
interface Live extends Closed {
  order_type: 'buy' | 'sell'
  min_price: number
  max_price: number
}
export interface StatsPayload {
  statistics_closed?: { '90days'?: Closed[] }
  statistics_live?: { '48hours'?: Live[] }
}

const DAY = 86_400_000
const LIVE_AGE = 3 * 3_600_000

// shortcut: mods and arcanes use their unranked rows only; add per-rank stats if ranked trading matters
const unranked = <T extends { mod_rank?: number }>(xs: T[]): T[] => xs.filter((x) => !x.mod_rank)
const volume = (xs: Closed[]): number => xs.reduce((a, x) => a + x.volume, 0)
const median = (xs: Closed[]): number => {
  const v = volume(xs)
  return v ? xs.reduce((a, x) => a + x.median * x.volume, 0) / v : 0
}

// Items with variants keep one: Intact for relics, else the variant that sells most. Mixing them
// paired an Intact buy order with a Radiant listing.
function oneVariant(closed: Closed[], live: Live[]): [Closed[], Live[]] {
  const vol = new Map<string, number>()
  for (const x of closed) if (x.subtype) vol.set(x.subtype, (vol.get(x.subtype) ?? 0) + x.volume)
  for (const x of live) if (x.subtype && !vol.has(x.subtype)) vol.set(x.subtype, 0)
  if (!vol.size) return [closed, live]
  const pick = vol.has('intact') ? 'intact' : [...vol].sort((a, b) => b[1] - a[1])[0][0]
  return [closed.filter((x) => x.subtype === pick), live.filter((x) => x.subtype === pick)]
}

export function summarize(p: StatsPayload, at: number): MarketStat {
  const [days, live] = oneVariant(
    unranked(p.statistics_closed?.['90days'] ?? []), // one row per day (and variant) with sales
    unranked(p.statistics_live?.['48hours'] ?? [])
  )
  // rows exist only for days with sales: count the last 7 calendar days, not the last 7 rows
  const week = days.filter((x) => Date.parse(x.datetime) >= at - 7 * DAY)
  // the newest order row of each side, if it is recent: an hour-old-plus listing may be gone
  const latest = (type: 'buy' | 'sell'): Live | undefined =>
    [...live]
      .reverse()
      .find((x) => x.order_type === type && Date.parse(x.datetime) >= at - LIVE_AGE)
  return {
    vol7: volume(week) / 7,
    vol90: volume(days) / 90,
    med7: median(week),
    med90: median(days),
    low: latest('sell')?.min_price,
    high: latest('buy')?.max_price,
    at
  }
}
