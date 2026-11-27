import { tagOf, type Filter } from './rivenFilter.ts'

// "Find similar": open the Finder on this weapon with the riven's own stats as preferred filters
// (negative as preferred).
export async function findSimilar(
  weaponName: string,
  posTags: string[],
  negTag?: string
): Promise<void> {
  const cat = await window.api.getRivenCatalog()
  const slug = Object.keys(cat.weapons).find((k) => cat.weapons[k].name === weaponName)
  if (!slug) return
  const melee = /^(melee|zaw)$/.test(cat.weapons[slug].rivenType)
  const slugOf = (tag: string): string | undefined =>
    Object.keys(cat.attrs).find((s) => tagOf(cat.attrs[s].name, melee) === tag)
  const filter: Filter = {
    pos: posTags
      .flatMap((t) => slugOf(t) ?? [])
      .slice(0, 3)
      .map((s) => ({ slug: s, required: false })),
    neg: negTag && slugOf(negTag) ? { slug: slugOf(negTag)!, required: false } : undefined,
    minMatch: 0,
    mustNeg: false
  }
  openFinder(slug, filter)
}

// One-time handover to the Fixer: it opens on this weapon and filter, then forgets them (the Fixer
// itself starts empty every time you open it).
let pending: { slug: string; filter: Filter } | null = null
export function takeFinderPrefill(): { slug: string; filter: Filter } | null {
  const p = pending
  pending = null
  return p
}

export function openFinder(slug: string, filter: Filter): void {
  pending = { slug, filter }
  // the Fixer may already be open: it listens for this, otherwise it reads `pending` when it mounts
  window.dispatchEvent(new CustomEvent('toxicframe:finder-prefill'))
  window.dispatchEvent(new CustomEvent('toxicframe:navigate', { detail: 'rivens-finder' }))
}
