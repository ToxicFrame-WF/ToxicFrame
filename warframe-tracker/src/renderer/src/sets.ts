// Set math shared by the Sets tab's card, sort and filter. Pure, so it can be tested.

export interface SetPart {
  have: number
  need: number
  slug?: string
}

// What buying the parts you lack would cost; 0 for a complete set, null when a lacking part
// has no market price (untradable, or not loaded yet), since such a set can't be finished by buying.
export function missingCost(parts: SetPart[], price: (slug?: string) => number): number | null {
  let total = 0
  for (const p of parts) {
    if (p.have >= p.need) continue
    const each = price(p.slug)
    if (!each) return null
    total += (p.need - p.have) * each
  }
  return total
}
