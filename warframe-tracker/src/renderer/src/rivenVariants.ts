// A riven fits every variant of its base weapon, but warframe.market only lists the base weapons.
// Variant -> base is found by stripping variant words from real weapon names (from the mastery
// catalog) and keeping only results that are a real riven weapon.
// shortcut: the variant word list is hand-kept (the item data has no parent field); add new words here.
const WORDS = new Set(
  'prime kuva tenet coda prisma vandal wraith dex rakta sancti secura synoid telos vaykor carmine ceti mara sibear mk1 mk1-'.split(
    ' '
  )
)

/** "Acceltra Prime" -> "Acceltra" when that is one of baseNames; otherwise null. */
export function variantBase(name: string, baseNames: Map<string, string>): string | null {
  if (baseNames.has(name.toLowerCase())) return null // already a riven weapon itself
  const rest = name
    .replace(/\bMk1-/i, '')
    .split(/\s+/)
    .filter((w) => !WORDS.has(w.toLowerCase()))
    .join(' ')
  return rest && rest.toLowerCase() !== name.toLowerCase()
    ? (baseNames.get(rest.toLowerCase()) ?? null)
    : null
}

/** Variant weapon name -> base riven weapon name, for every variant that has one. */
export function variantMap(allNames: string[], baseNames: string[]): Record<string, string> {
  const base = new Map(baseNames.map((n) => [n.toLowerCase(), n]))
  const out: Record<string, string> = {}
  for (const n of allNames) {
    const b = variantBase(n, base)
    if (b) out[n] = b
  }
  return out
}
