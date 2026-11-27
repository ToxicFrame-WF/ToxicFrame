export const UNDERCUT_REPEAT_MS = 6 * 3_600_000 // same undercut is announced again after this long

// Which sell orders to announce: someone online sells cheaper, and it is new, lower than what was
// announced before, or the repeat window has passed. `told` is updated for the ones returned.
export function undercutsToTell(
  orders: { id: string; platinum: number }[],
  lowest: Map<string, number | undefined>,
  told: Map<string, { low: number; at: number }>,
  now: number
): { id: string; low: number }[] {
  const out: { id: string; low: number }[] = []
  for (const o of orders) {
    const low = lowest.get(o.id)
    if (low == null || low >= o.platinum) {
      told.delete(o.id) // no longer undercut: a later undercut counts as new
      continue
    }
    const t = told.get(o.id)
    if (t && low >= t.low && now - t.at <= UNDERCUT_REPEAT_MS) continue
    told.set(o.id, { low, at: now })
    out.push({ id: o.id, low })
  }
  return out
}
