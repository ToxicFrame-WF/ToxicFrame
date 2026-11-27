// Tesseract `tsv` output -> text lines (words joined per block/par/line). Pure, so it is testable without Electron.
export function tsvLines(tsv: string): string[] {
  const lines = new Map<string, string[]>()
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const c = row.split('\t')
    // level 5 = word; conf -1 rows are structure only
    if (c.length < 12 || c[0] !== '5' || Number(c[10]) < 0) continue
    const w = c.slice(11).join('\t').trim()
    if (!w) continue
    const k = `${c[2]}.${c[3]}.${c[4]}`
    lines.set(k, [...(lines.get(k) ?? []), w])
  }
  return [...lines.values()].map((w) => w.join(' '))
}
