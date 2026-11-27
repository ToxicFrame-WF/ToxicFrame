import { matchListing, type Filter } from './rivenFilter.ts'
// Riven fair price and deal score, from the other listings of the same weapon.
type L = { id: string; price: number; attrs: { slug: string; positive: boolean }[] }

// asks are not sales: a fair price needs this many similar listings to be worth showing
export const MIN_COMPARABLES = 6
// Asks run from realistic to wishful (2000-10000p), so their median is what sellers hope for; the
// lower quartile is the going price a buyer can actually get (Acceltra: median said 500p = 77% under).
const QUANTILE = 0.25
const hasNeg = (l: L): boolean => l.attrs.some((a) => !a.positive)
const pos = (l: L): Set<string> => new Set(l.attrs.filter((a) => a.positive).map((a) => a.slug))

// Comparable = another listing with the same layout (number of positives, negative or not: a 3-stat
// riven with no curse costs many times a 2-stat one with a curse) sharing at least 2 positive stats with `l`. When at least 3 of them
// also have every core stat `l` has (core = the grade sheet's core stats, as wfm slugs), only those
// count. Price = lower quartile after dropping the cheapest and dearest 10% (1p troll / absurd listings).
// undefined = fewer than MIN_COMPARABLES comparables.
export function fairPrice(l: L, all: L[], core: Set<string> = new Set()): number | undefined {
  const mine = pos(l)
  const need = [...mine].filter((s) => core.has(s))
  const comp = all.filter(
    (o) =>
      o.id !== l.id &&
      pos(o).size === mine.size &&
      hasNeg(o) === hasNeg(l) &&
      [...pos(o)].filter((s) => mine.has(s)).length >= 2
  )
  const strict = comp.filter((o) => need.every((s) => pos(o).has(s)))
  const use = need.length && strict.length >= MIN_COMPARABLES ? strict : comp
  if (use.length < MIN_COMPARABLES) return undefined
  const p = use.map((o) => o.price).sort((a, b) => a - b)
  const cut = Math.floor(p.length * 0.1)
  const m = p.slice(cut, p.length - cut)
  return m[Math.floor((m.length - 1) * QUANTILE)]
}

// 20-50% under: a deal; more than that is too good to trust from asks alone (troll price, wrong
// stats, a seller who never answers), so it is flagged for a check instead
export const dealKind = (d: number | undefined): 'deal' | 'check' | undefined =>
  d === undefined || d < 0.2 ? undefined : d > 0.5 ? 'check' : 'deal'

// Share under the fair price (0.3 = 30% under; negative = dearer than fair).
export const dealScore = (price: number, fair: number | undefined): number | undefined =>
  fair ? (fair - price) / fair : undefined

// Pure: the listings an alert should announce (online / in-game, matches, deal threshold, unseen).
export function newHits<T extends L & { status: string; rerolls: number; rank: number }>(
  a: { filter: Filter; minDeal?: number },
  list: T[],
  seen: Set<string>
): T[] {
  return list.filter((l) => {
    if (seen.has(l.id) || (l.status !== 'online' && l.status !== 'ingame')) return false
    if (!matchListing(l, a.filter)) return false
    if (!a.minDeal) return true
    const d = dealScore(l.price, fairPrice(l, list))
    return d !== undefined && d * 100 >= a.minDeal
  })
}
