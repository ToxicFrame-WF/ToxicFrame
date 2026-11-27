// Relic expected-value maths shared by the Relic planner page and the in-game overlay.
// Pure: no React, no electron.

// a price as the price store holds it (structural, so this file needs no imports)
export type Get = (slug?: string) => { price: number | null } | 'error' | undefined

export const FORMA = /forma blueprint$/i

export const platOf = (get: Get, slug?: string): number => {
  const p = get(slug)
  return p && p !== 'error' ? (p.price ?? 0) : 0
}

export const ducatOf =
  (meta: ItemMeta) =>
  (rw: RelicReward): number =>
    rw.slug ? (meta[rw.slug]?.ducats ?? 0) : 0

// expected value of opening a relic at a given refinement
export const expected = (
  relic: RelicSummary,
  state: string,
  value: (rw: RelicReward) => number
): number =>
  relic.rewards.reduce((sum, rw) => sum + ((rw.chances[state] ?? 0) / 100) * value(rw), 0)

// When N players open the same relic, each of you can pick from what the squad rolls. This is the
// expected value of the best of N independent rolls (an estimate: it ignores who picks first).
export function expectedBest(
  relic: RelicSummary,
  state: string,
  value: (rw: RelicReward) => number,
  players: number
): number {
  if (players <= 1) return expected(relic, state, value)
  const items = relic.rewards
    .map((rw) => ({ p: rw.chances[state] ?? 0, v: value(rw) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => a.v - b.v)
  const total = items.reduce((t, x) => t + x.p, 0)
  if (!total) return 0
  let cum = 0
  let out = 0
  for (const x of items) {
    const before = cum / total
    cum += x.p
    out += x.v * (Math.pow(cum / total, players) - Math.pow(before, players))
  }
  return out
}

// tradable rewards (forma and untradable parts excluded)
export const tradable = (r: RelicSummary): RelicReward[] =>
  r.rewards.filter((rw) => rw.slug && !FORMA.test(rw.item))

export const allPartsHeld = (r: RelicSummary, heldBySlug: Map<string, number>): boolean =>
  tradable(r).every((rw) => (heldBySlug.get(rw.slug!) ?? 0) > 0)

export const REFINEMENTS = ['Intact', 'Exceptional', 'Flawless', 'Radiant']

// the filters "Apply filters to overlay" saves (localStorage key below)
export const OVERLAY_FILTERS_KEY = 'RelicList.overlayFilters'
export interface OverlayFilters {
  tier: string
  vaulted: 'any' | 'yes' | 'no'
  refinement: string | null
  copies10: 'any' | 'yes' | 'no'
  players: number
  allParts: 'any' | 'yes' | 'no'
  sort: string
}
export const DEFAULT_OVERLAY_FILTERS: OverlayFilters = {
  tier: 'All',
  vaulted: 'any',
  refinement: null,
  copies10: 'any',
  players: 1,
  allParts: 'any',
  sort: 'plat'
}

export interface Recommendation {
  relic: RelicSummary
  state: string
  count: number
  plat: number
  ducats: number
}

// Owned relics, one candidate per owned refinement, filtered and ranked by expected plat
// (or ducats when the saved sort is 'ducat'); returns the top `n`.
export function recommend(
  relics: RelicSummary[],
  counts: (relicId: string) => Record<string, number> | undefined,
  f: OverlayFilters,
  get: Get,
  meta: ItemMeta,
  heldBySlug: Map<string, number>,
  n = 4
): Recommendation[] {
  const out: Recommendation[] = []
  for (const relic of relics) {
    const c = counts(relic.id)
    if (!c) continue
    if (f.tier !== 'All' && relic.tier !== f.tier) continue
    if (f.vaulted !== 'any' && relic.vaulted !== (f.vaulted === 'yes')) continue
    const total = Object.values(c).reduce((a, b) => a + b, 0)
    if (f.copies10 !== 'any' && total >= 10 !== (f.copies10 === 'yes')) continue
    if (f.allParts !== 'any' && allPartsHeld(relic, heldBySlug) !== (f.allParts === 'yes')) continue
    for (const state of REFINEMENTS) {
      if ((c[state] ?? 0) <= 0 || (f.refinement && f.refinement !== state)) continue
      out.push({
        relic,
        state,
        count: c[state],
        plat: expectedBest(relic, state, (rw) => platOf(get, rw.slug), f.players),
        ducats: expectedBest(relic, state, ducatOf(meta), f.players)
      })
    }
  }
  const key = f.sort === 'ducat' ? 'ducats' : 'plat' // other page sorts have no meaning here
  return out.sort((a, b) => b[key] - a[key]).slice(0, n)
}
