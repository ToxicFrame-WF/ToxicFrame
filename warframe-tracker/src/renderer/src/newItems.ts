// "New items found" after a mission: owned counts are compared with a saved baseline.
// Pure, so it can be tested without the app.

export type Counts = Record<string, number>

// New copies since the baseline: items whose count went up, with how many more.
export function newCopies(baseline: Counts, current: Counts): Counts {
  const out: Counts = {}
  for (const [k, n] of Object.entries(current)) {
    const extra = n - (baseline[k] ?? 0)
    if (extra > 0) out[k] = extra
  }
  return out
}

// Copies sold, traded or used lower the baseline, so a later new copy still shows as new.
// (Raising it is "Mark as seen": the baseline becomes the current counts.)
export function lowerBaseline(baseline: Counts, current: Counts): Counts {
  const out: Counts = {}
  for (const [k, n] of Object.entries(baseline)) {
    const now = current[k] ?? 0
    if (now > 0) out[k] = Math.min(n, now)
  }
  return out
}
