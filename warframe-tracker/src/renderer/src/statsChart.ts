// Scale and labels for the balance line chart on the Stats page. Pure, so it can be tested.

// A round top for the value scale, at or above `max`: 1, 2, 2.5 or 5 times a power of ten
// (e.g. 2,180 -> 2,500), so the gridlines carry readable numbers.
export function niceTop(max: number): number {
  if (max <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p
  return 10 * p
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2024-07-11" -> "11 Jul 2024", for the summary and the hover label
export const niceDate = (d: string): string =>
  `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`

// Month labels along the bottom, at a regular calendar step: every 1, 2, 3, 6 or 12 months (the
// smallest step that keeps at most `most` labels), aligned to the calendar (every 3 months =
// Jan / Apr / Jul / Oct), each under the first recorded day of its month ("Aug '24").
// `days` are sorted "YYYY-MM-DD" strings.
export function monthTicks(days: string[], most = 8): { i: number; label: string }[] {
  const firsts: { i: number; m: number; label: string }[] = []
  days.forEach((d, i) => {
    if (i === 0 || d.slice(0, 7) !== days[i - 1].slice(0, 7)) {
      const month = Number(d.slice(5, 7)) - 1
      firsts.push({
        i,
        m: Number(d.slice(0, 4)) * 12 + month,
        label: `${MONTHS[month]} '${d.slice(2, 4)}`
      })
    }
  })
  if (!firsts.length) return []
  const span = firsts[firsts.length - 1].m - firsts[0].m + 1
  const step = [1, 2, 3, 6, 12].find((s) => Math.ceil(span / s) <= most) ?? 12
  return firsts.filter((t) => t.m % step === 0).map(({ i, label }) => ({ i, label }))
}

// Scale top for counts: an even, whole number (so the middle line is whole too): 2, 4, 6, 8, 10 × 10ⁿ.
export function countTop(max: number): number {
  if (max <= 2) return 2
  const p = 10 ** Math.floor(Math.log10(max))
  for (const m of [2, 4, 6, 8, 10]) if (m * p >= max) return m * p
  return 20 * p
}
