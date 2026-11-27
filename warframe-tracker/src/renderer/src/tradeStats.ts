// Totals for Trading > Analytics, from the app's trade log (see src/main/tradeLog.ts).
export interface TradeStack {
  name: string // display name
  count: number
  path?: string // game path (or AlecaFrame's own), for categories
  rank?: number // mod / arcane rank, -1 or missing when it has none
  picture?: string // picture from the export, for items warframe.market does not list
}
export interface Trade {
  at: number
  type: 'sell' | 'buy' | 'trade' // trade = items for items, no net platinum
  itemId: string // warframe.market id; '' for imported trades
  platinum: number // per unit, net platinum of the trade
  quantity: number
  name?: string // imported trades carry their own name, category path and partner
  path?: string
  user?: string
  gave?: TradeStack[] // everything given / received apart from platinum (imports, swaps)
  got?: TradeStack[]
  platGave?: number
  platGot?: number
}
export interface ItemInfo {
  name: string
  tags: string[]
  icon?: string
}
export interface Ranked {
  name: string
  quantity: number
  platinum: number
  icon?: string
}
// an item you both bought and sold: profit on the units that went through both sides
export interface Flip {
  name: string
  icon?: string
  units: number // min(bought, sold)
  buyAvg: number
  sellAvg: number
  profit: number // units * (sellAvg - buyAvg)
  trades: FlipTrade[] // the trades behind it, oldest first
  // a set sold after buying some of its parts: buyAvg = paid for those parts per set,
  // farmed parts count as free
  parts?: { name: string; units: number; paid: number }[]
}
// one buy or sale of a resold item; `via` = it went with other items in that trade (a set)
export interface FlipTrade {
  at: number
  type: 'buy' | 'sell'
  quantity: number
  platinum: number // whole trade
  user?: string
  via?: string
  item?: string // a part bought for a set (set rows only)
}
export interface TradeStats {
  received: number
  spent: number
  byCategory: Record<string, { received: number; spent: number }>
  largestSale?: Ranked
  largestPurchase?: Ranked
  topSales: Ranked[]
  topPurchases: Ranked[]
  topPartners: Ranked[] // quantity = number of trades
  flips: Flip[] // best profit first
  held: Held[] // bought more than sold, most paid first
  busiest?: { day: number; hour: number; count: number; sales: number } // 3-hour window (local) with most sales
  lastAt?: number // newest trade
}
// units bought and not (yet) sold again
export interface Held {
  name: string
  icon?: string
  units: number
  paid: number // units * average buy price
}

// game path of an imported item -> category (no warframe.market tags for those)
export function pathCategory(path = ''): string {
  if (path === 'set') return 'Sets'
  if (/Projections\/|Relic/.test(path)) return 'Relics'
  if (/Riven|Randomized/.test(path)) return 'Rivens'
  if (/CosmeticEnhancers/.test(path)) return 'Arcanes'
  if (/Upgrades\/Mods|AugmentCard|SentinelPrecepts|MeleeTrees/.test(path)) return 'Mods'
  if (/Prime/.test(path) && /Recipes/.test(path)) return 'Prime parts'
  return 'Other'
}

// warframe.market tags -> the page's categories
export function tradeCategory(tags: string[]): string {
  const t = tags.map((x) => x.toLowerCase())
  if (t.includes('set')) return 'Sets'
  if (t.includes('relic')) return 'Relics'
  if (t.some((x) => x.includes('riven'))) return 'Rivens'
  if (t.some((x) => x.includes('arcane'))) return 'Arcanes'
  if (t.includes('mod')) return 'Mods'
  if (t.includes('prime') && (t.includes('component') || t.includes('blueprint')))
    return 'Prime parts'
  return 'Other'
}

export function tradeStats(
  trades: Trade[],
  itemOf: (id: string) => ItemInfo | undefined,
  perSet: (part: string) => number = () => 1 // how many of a part one set needs
): TradeStats {
  const out: TradeStats = {
    received: 0,
    spent: 0,
    byCategory: {},
    topSales: [],
    topPurchases: [],
    topPartners: [],
    flips: [],
    held: []
  }
  const history = new Map<string, FlipTrade[]>()
  const log = (name: string, e: FlipTrade): void => {
    const list = history.get(name)
    if (list) list.push(e)
    else history.set(name, [e])
  }
  const windows = new Map<number, number>() // day * 8 + hour / 3 -> sales
  const partners = new Map<string, Ranked>()
  const per: Record<'sell' | 'buy', Map<string, Ranked>> = { sell: new Map(), buy: new Map() }
  for (const t of trades) {
    if (!(t.quantity > 0)) continue // imported quantity 0 would divide by zero below
    const item = itemOf(t.itemId)
    const name = item?.name ?? t.name ?? 'Unknown item'
    const total = t.platinum * t.quantity
    const catName = item ? tradeCategory(item.tags) : pathCategory(t.path)
    out.lastAt = Math.max(out.lastAt ?? 0, t.at)
    const cat = (out.byCategory[catName] ??= { received: 0, spent: 0 })
    if (t.user) {
      const p = partners.get(t.user) ?? { name: t.user, quantity: 0, platinum: 0 }
      p.quantity += 1
      p.platinum += total
      partners.set(t.user, p)
    }
    if (t.type === 'trade') continue // swaps move no platinum; counted as trades only
    const base = { at: t.at, type: t.type, platinum: total, ...(t.user ? { user: t.user } : {}) }
    const stacks = t.type === 'sell' ? t.gave : t.got
    if (stacks && stacks.length > 1)
      for (const s of stacks) log(s.name, { ...base, quantity: s.count, via: name })
    log(name, { ...base, quantity: t.quantity })
    if (t.type === 'sell') {
      const d = new Date(t.at)
      const w = d.getDay() * 8 + Math.floor(d.getHours() / 3)
      windows.set(w, (windows.get(w) ?? 0) + 1)
      out.received += total
      cat.received += total
    } else {
      out.spent += total
      cat.spent += total
    }
    const one = { name, quantity: t.quantity, platinum: total }
    if (t.type === 'sell' && total > (out.largestSale?.platinum ?? 0)) out.largestSale = one
    if (t.type === 'buy' && total > (out.largestPurchase?.platinum ?? 0)) out.largestPurchase = one
    const r =
      per[t.type].get(name) ??
      (item?.icon
        ? { name, quantity: 0, platinum: 0, icon: item.icon }
        : { name, quantity: 0, platinum: 0 })
    r.quantity += t.quantity
    r.platinum += total
    per[t.type].set(name, r)
  }
  const top = (m: Map<string, Ranked>): Ranked[] =>
    [...m.values()].sort((a, b) => b.platinum - a.platinum)
  out.topSales = top(per.sell)
  out.topPurchases = top(per.buy)
  out.topPartners = top(partners)
  // sets sold after buying parts of them ("Titania Prime Set" <- "Titania Prime ...")
  const usedInSets = new Map<string, number>()
  for (const set of per.sell.values()) {
    if (!set.name.endsWith(' Set')) continue
    const prefix = set.name.slice(0, -3)
    const parts: { name: string; units: number; paid: number }[] = []
    for (const b of per.buy.values()) {
      if (b.name === set.name || !b.name.startsWith(prefix)) continue
      const spare =
        b.quantity - (per.sell.get(b.name)?.quantity ?? 0) - (usedInSets.get(b.name) ?? 0)
      const units = Math.min(spare, set.quantity * perSet(b.name))
      if (units <= 0) continue
      usedInSets.set(b.name, (usedInSets.get(b.name) ?? 0) + units)
      parts.push({ name: b.name, units, paid: (units * b.platinum) / b.quantity })
    }
    if (!parts.length) continue
    const paid = parts.reduce((a, p) => a + p.paid, 0)
    const sellAvg = set.platinum / set.quantity
    const partBuys = parts.flatMap((p) =>
      (history.get(p.name) ?? [])
        .filter((e) => e.type === 'buy')
        .map((e) => ({ ...e, item: p.name }))
    )
    out.flips.push({
      name: set.name,
      icon: set.icon,
      units: set.quantity,
      buyAvg: paid / set.quantity,
      sellAvg,
      profit: set.platinum - paid,
      trades: [...(history.get(set.name) ?? []).filter((e) => e.type === 'sell'), ...partBuys].sort(
        (x, y) => x.at - y.at
      ),
      parts
    })
  }
  for (const b of per.buy.values()) {
    const sold = per.sell.get(b.name)
    const left = b.quantity - (sold?.quantity ?? 0) - (usedInSets.get(b.name) ?? 0)
    if (left > 0)
      out.held.push({
        name: b.name,
        icon: b.icon,
        units: left,
        paid: (left * b.platinum) / b.quantity
      })
    if (!sold) continue
    const buyAvg = b.platinum / b.quantity
    const sellAvg = sold.platinum / sold.quantity
    const units = Math.min(b.quantity, sold.quantity)
    out.flips.push({
      name: b.name,
      icon: b.icon,
      units,
      buyAvg,
      sellAvg,
      profit: units * (sellAvg - buyAvg),
      trades: (history.get(b.name) ?? []).filter((e) => !e.via).sort((x, y) => x.at - y.at)
    })
  }
  out.flips.sort((a, b) => b.profit - a.profit)
  out.held.sort((a, b) => b.paid - a.paid)
  const sales = [...windows.values()].reduce((a, b) => a + b, 0)
  let peak = -1
  for (const [w, n] of windows) if (peak < 0 || n > windows.get(peak)!) peak = w
  if (peak >= 0)
    out.busiest = {
      day: Math.floor(peak / 8),
      hour: (peak % 8) * 3,
      count: windows.get(peak)!,
      sales
    }
  return out
}
