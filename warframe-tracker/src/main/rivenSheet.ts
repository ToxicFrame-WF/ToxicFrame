// Parsing for the riven grade sheet (no Electron here, so tests can load it).
export interface GradeRule {
  core: string[] // required stats (stand alone in the sheet: "MS SC FR/PT" -> MS, SC)
  good: string[] // every wanted stat, core included, e.g. ['CD', 'MS', 'DMG']
  neg: string[] // acceptable negatives
}

// Minimal CSV: commas, quoted fields with "" escapes, newlines inside quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

const stats = (field: string): string[] =>
  field
    .toUpperCase()
    .split(/[\s/]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== 'OR') // "CD AS RANGE or CD RANGE AS": alternatives, kept as one list

// Sheet legend: groups are separated by spaces; a stat on its own is required, "A/B/C" means any
// of them. "or" starts an alternative set of rules; the first set decides what is required.
// When nothing stands alone, the first stat of the first group counts as core (the sheet lists
// the most important one first; AlecaFrame shows it the same way, e.g. CD for Dual Toxocyst).
const coreOf = (field: string): string[] => {
  const groups = (field.split(/\bor\b/i)[0] ?? '').toUpperCase().split(/\s+/).filter(Boolean)
  const alone = groups.filter((g) => !g.includes('/'))
  return alone.length ? alone : groups[0] ? [groups[0].split('/')[0]] : []
}

export function rulesFromCsv(csv: string): Record<string, GradeRule> {
  const out: Record<string, GradeRule> = {}
  for (const [name, good, ...rest] of parseCsv(csv).slice(1)) {
    if (!name?.trim() || !good?.trim()) continue
    // the negatives sit in a different column per tab; take the first filled cell that is not a note
    const neg = rest.find((c) => c.trim() && !c.trim().startsWith('(')) ?? ''
    out[name.trim().toLowerCase()] = { core: coreOf(good), good: stats(good), neg: stats(neg) }
  }
  return out
}
