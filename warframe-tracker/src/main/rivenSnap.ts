import type { Listing } from './rivenSearch'

// Pure part of the riven price history (rivenHistory.ts does the disk work).
export type Snap = { t: number; l: [price: number, rerolls: number, attrs: string[]][] } // attrs: slug, '-slug' = negative
const HOUR = 3_600_000
const DAY = 24 * HOUR
// Pure: the snapshots after adding one (undefined = too soon after the last, nothing to save).
export function addSnap(old: Snap[], list: Listing[], now: number): Snap[] | undefined {
  if (!list.length || (old.length && now - old[old.length - 1].t < 6 * HOUR)) return undefined
  const snap: Snap = {
    t: now,
    l: list
      .slice(0, 150)
      .map((x) => [x.price, x.rerolls, x.attrs.map((a) => (a.positive ? '' : '-') + a.slug)])
  }
  const days = new Set<number>()
  return [...old, snap].filter((s) => {
    if (now - s.t > 365 * DAY) return false
    if (now - s.t < 30 * DAY || s === snap) return true
    const d = Math.floor(s.t / DAY)
    return !days.has(d) && !!days.add(d)
  })
}
