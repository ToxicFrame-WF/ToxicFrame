import { matchListing, type Filter } from './rivenFilter.ts'

// Price trends from the locally saved snapshots (see main/rivenSnap.ts): the average price of the
// saved listings, the same with the Finder's filters applied, and per positive stat its average
// price and popularity (share of the listings that have it).
const DAY = 86_400_000
export function trends(
  snaps: { t: number; l: [number, number, string[]][] }[],
  f: Filter,
  days: number | null,
  now: number
): {
  snaps: number
  listings: number
  avg?: number
  filteredAvg?: number
  filtered: number
  attrs: { slug: string; avg: number; share: number }[]
} {
  const rows = snaps
    .filter((s) => days === null || now - s.t <= days * DAY)
    .flatMap((s) => s.l)
    .map(([price, rerolls, a]) => ({
      price,
      rerolls,
      rank: 0,
      attrs: a.map((x) => ({ slug: x.replace(/^-/, ''), positive: !x.startsWith('-') }))
    }))
  const mean = (xs: { price: number }[]): number | undefined =>
    xs.length ? Math.round(xs.reduce((n, x) => n + x.price, 0) / xs.length) : undefined
  const kept = rows.filter((r) => matchListing(r, f))
  const by = new Map<string, number[]>()
  for (const r of rows)
    for (const a of r.attrs) if (a.positive) by.set(a.slug, [...(by.get(a.slug) ?? []), r.price])
  return {
    snaps: snaps.filter((s) => days === null || now - s.t <= days * DAY).length,
    listings: rows.length,
    avg: mean(rows),
    filteredAvg: mean(kept),
    filtered: kept.length,
    attrs: [...by]
      .map(([slug, p]) => ({
        slug,
        avg: Math.round(p.reduce((a, b) => a + b, 0) / p.length),
        share: p.length / rows.length
      }))
      .sort((a, b) => b.share - a.share)
  }
}
