function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

/** Best catalogue name for OCR text (wrapped lines may be joined with spaces/newlines). Score 0..1. */
export function matchPart(
  ocrText: string,
  names: string[],
  threshold = 0.7
): { name: string; score: number; quantity: number } | null {
  let t = norm(ocrText)
  let quantity = 1
  const q = /^(\d+) ?x /.exec(t)
  if (q) {
    quantity = Number(q[1])
    t = t.slice(q[0].length)
  }
  if (t.length < 3) return null
  let best: { name: string; score: number; quantity: number } | null = null
  for (const name of names) {
    const n = norm(name)
    const score = 1 - lev(t, n) / Math.max(t.length, n.length)
    if (!best || score > best.score) best = { name, score, quantity }
  }
  return best && best.score >= threshold ? best : null
}

// "LITH ERA" from the relic picker's top-left label; Omnia fissures take any era (null)
const ERAS = ['Lith', 'Meso', 'Neo', 'Axi', 'Requiem']
export function eraFromText(text: string): string | null {
  const m = /\b(lith|meso|neo|axi|requiem)\s*era\b/i.exec(text)
  return m ? ERAS.find((e) => e.toLowerCase() === m[1].toLowerCase())! : null
}

// the relic screens' titles; OCR often drops or doubles the spacing of the wide title letters
export function screenFromTitle(text: string): 'picker' | 'rewards' | null {
  const t = text.toUpperCase().replace(/[^A-Z]/g, '')
  if (t.includes('VOIDRELICS') || t.includes('RELICSREFINEMENT')) return 'picker'
  // the dim "VOID FISSURE/" part often does not read; other "…/REWARDS" screens only cost a read
  // that finds no reward names (the panel then stays hidden)
  if (t.includes('REWARDS') || t.includes('VOIDFISSURE')) return 'rewards'
  return null
}

// the button under the riven card: "CYCLE FOR 3,500" or "CONFIRM"
export const isRivenButton = (text: string): boolean => /CYCLE|CONFIRM/i.test(text)
