// Item rank from affinity (confirmed against live data): floor(sqrt(xp / base)), base 1000 for
// frames/companions and 500 for weapons, capped at the item's max rank.
export function rankFromXp(xp: number, group: MasteryGroup, maxRank: number): number {
  const base = group === 'weapon' ? 500 : 1000
  return Math.min(maxRank, Math.floor(Math.sqrt(Math.max(0, xp) / base)))
}
