// Market activity's four tools, from the scanned statistics (see src/main/marketMath.ts).
// Prices from "low" / "high" are the best listed orders in the latest hour, online or not,
// so they are a guide: check the live orders before trading.
export interface Stat {
  vol7: number
  vol90: number
  med7: number
  med90: number
  low?: number
  high?: number
}
type Stats = Record<string, Stat>

export interface SetDeal {
  slug: string
  partsCost: number // every part at its lowest sell order
  setPrice: number // what the set sold for this week (median)
  profit: number
  vol7: number // set sales per day
}
// Buy every part at the lowest sell order, sell the set at this week's median.
export function setDeals(
  sets: Record<string, { slug: string; qty: number }[]>,
  st: Stats
): SetDeal[] {
  const out: SetDeal[] = []
  for (const [slug, parts] of Object.entries(sets)) {
    const set = st[slug]
    if (!set?.med7 || !parts.length) continue
    let partsCost = 0
    if (!parts.every((p) => st[p.slug]?.low)) continue // a part nobody sells: no deal
    for (const p of parts) partsCost += st[p.slug].low! * p.qty
    out.push({ slug, partsCost, setPrice: set.med7, profit: set.med7 - partsCost, vol7: set.vol7 })
  }
  return out.sort((a, b) => b.profit - a.profit)
}

export interface Flip {
  slug: string
  buy: number // place a buy order 1 above the best one
  sell: number // list 1 below the lowest seller
  margin: number
  vol7: number
}
// Items with room between buy and sell orders that also sell often enough to turn over.
export function flips(st: Stats, minVol = 3, minMargin = 5): Flip[] {
  const out: Flip[] = []
  for (const [slug, s] of Object.entries(st)) {
    if (s.low == null || s.high == null || s.vol7 < minVol) continue
    const buy = s.high + 1
    const sell = s.low - 1
    if (sell - buy < minMargin) continue
    out.push({ slug, buy, sell, margin: sell - buy, vol7: s.vol7 })
  }
  return out.sort((a, b) => b.margin * Math.min(b.vol7, 20) - a.margin * Math.min(a.vol7, 20))
}

export interface Mover {
  slug: string
  med90: number
  med7: number
  change: number // med7 / med90 - 1
  vol7: number
}
// This week's median against the 90-day one, for items that actually trade.
export function movers(st: Stats, minVol = 2, minPrice = 5): Mover[] {
  const out: Mover[] = []
  for (const [slug, s] of Object.entries(st)) {
    if (s.vol7 < minVol || s.med90 < minPrice || !s.med7) continue
    out.push({ slug, med90: s.med90, med7: s.med7, change: s.med7 / s.med90 - 1, vol7: s.vol7 })
  }
  return out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

export interface Liquid {
  slug: string
  price: number
  vol7: number
  value: number // platinum changing hands per day
}
export function liquidity(st: Stats): Liquid[] {
  return Object.entries(st)
    .filter(([, s]) => s.vol7 > 0 && s.med7 > 0)
    .map(([slug, s]) => ({ slug, price: s.med7, vol7: s.vol7, value: s.med7 * s.vol7 }))
    .sort((a, b) => b.value - a.value)
}

// ---- live checks: the best orders of players who are online right now ----
export interface Best {
  low?: number // cheapest online seller
  high?: number // best online buyer
  sellers: number // online sellers among the top orders
}
type TopList = { platinum: number; status: string }[]
const online = (o: { status: string }): boolean =>
  o.status !== 'offline' && o.status !== 'invisible'
export function onlineBest(o: { sell: TopList; buy: TopList }): Best {
  const sell = o.sell.filter(online).map((x) => x.platinum)
  const buy = o.buy.filter(online).map((x) => x.platinum)
  return {
    low: sell.length ? Math.min(...sell) : undefined,
    high: buy.length ? Math.max(...buy) : undefined,
    sellers: sell.length
  }
}

export interface Live {
  profit: number | null // null: can't be done right now (nobody online sells a part, or the set)
  buy: number // parts cost (set) or buy order (flip)
  sell: number // set listing or resale listing: 1 under the cheapest online seller
}
// Set vs parts, live: every part from its cheapest online seller, the set listed 1 under the cheapest.
export function liveSet(
  set: string,
  parts: { slug: string; qty: number }[],
  best: Record<string, Best>
): Live {
  let buy = 0
  for (const p of parts) {
    const low = best[p.slug]?.low
    if (low == null) return { profit: null, buy: 0, sell: 0 }
    buy += low * p.qty
  }
  const low = best[set]?.low
  if (low == null) return { profit: null, buy, sell: 0 }
  return { profit: low - 1 - buy, buy, sell: low - 1 }
}
// Flip, live: buy order 1 above the best online buyer, resell 1 under the cheapest online seller.
export function liveFlip(b: Best | undefined): Live {
  if (b?.low == null || b.high == null) return { profit: null, buy: 0, sell: 0 }
  return { profit: b.low - 1 - (b.high + 1), buy: b.high + 1, sell: b.low - 1 }
}
