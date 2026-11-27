import { rivenStats, rollGrade, STATS } from './rivens.ts'

// Riven Finder: filter and match % of warframe.market listings, and a roll grade per listing stat.
type Attr = { slug: string; name: string; unit?: string; value: number; positive: boolean }
type Listing = { price: number; rerolls: number; rank: number; attrs: Attr[] }

export interface Want {
  slug: string // warframe.market attribute slug
  required: boolean // false = preferred: only raises the match %
}
export interface Filter {
  pos: Want[] // up to 3
  neg?: Want // up to 1
  priceMin?: number
  priceMax?: number
  rerollMin?: number
  rerollMax?: number
  minMatch: number // 0-100
  mustNeg: boolean
}

// Match % = wanted stats the listing has (a positive for pos, a negative for neg) / wanted stats.
// null = filtered out (a required stat is missing, or a range / min match / must-have-negative fails).
export function matchListing(
  l: Pick<Listing, 'price' | 'rerolls'> & { attrs: Pick<Attr, 'slug' | 'positive'>[] },
  f: Filter
): { pct: number; hit: Set<string> } | null {
  const inRange = (v: number, lo?: number, hi?: number): boolean =>
    (lo === undefined || v >= lo) && (hi === undefined || v <= hi)
  if (!inRange(l.price, f.priceMin, f.priceMax) || !inRange(l.rerolls, f.rerollMin, f.rerollMax))
    return null
  if (f.mustNeg && !l.attrs.some((a) => !a.positive)) return null
  const has = (w: Want, positive: boolean): boolean =>
    l.attrs.some((a) => a.slug === w.slug && a.positive === positive)
  const wants: [Want, boolean][] = [...f.pos.map((w): [Want, boolean] => [w, true])]
  if (f.neg) wants.push([f.neg, false])
  const hit = new Set<string>()
  for (const [w, positive] of wants) {
    if (has(w, positive)) hit.add(w.slug)
    else if (w.required) return null
  }
  const pct = wants.length ? Math.round((hit.size / wants.length) * 100) : 100
  return pct >= f.minMatch ? { pct, hit } : null
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\bvs\.?\b/g, 'to')
    .replace(/[^a-z]/g, '')
const TAG_BY_NAME = new Map(Object.entries(STATS).map(([tag, [, name]]) => [norm(name), tag]))
TAG_BY_NAME.set('fireratesattackspeed', 'WeaponFireRateMod')
TAG_BY_NAME.set('firerateattackspeed', 'WeaponFireRateMod') // wfm: "Fire Rate / Attack Speed"
TAG_BY_NAME.set('criticalchanceforslideattack', 'SlideAttackCritChanceMod')
// wfm calls both weapon kinds' damage stat just "Damage"
export const tagOf = (name: string, melee = false): string | undefined => {
  const f = /^Damage (?:to|vs\.?) (\w+)/i.exec(name)?.[1]
  if (f) return `WeaponFactionDamage${f === 'Orokin' ? 'Corrupted' : f}`
  return norm(name) === 'damage' || norm(name) === 'basedamagemeleedamage'
    ? melee
      ? 'WeaponMeleeDamageMod'
      : 'WeaponDamageAmountMod'
    : TAG_BY_NAME.get(norm(name))
}

// Roll quality 0..1 per attr (undefined = no base value known), from where the value sits between
// the lowest and highest possible roll at the listing's rank. Negatives: smaller is better.
// shortcut: a stat the game files lack (spliced Techrot / Scaldra damage...) leaves the whole
// listing ungraded; the flat-stat list above is hard-coded.
export function listingGrades(
  l: Listing,
  itemType: string,
  data: { values: Record<string, Record<string, number>> }
): ({ q: number; grade: string } | undefined)[] {
  const tags = l.attrs.map((a) => tagOf(a.name, /Melee|Zaw/.test(itemType)))
  if (tags.some((t) => !t)) return l.attrs.map(() => undefined)
  const pos = l.attrs.flatMap((a, i) => (a.positive ? [i] : []))
  const neg = l.attrs.flatMap((a, i) => (a.positive ? [] : [i]))
  const mk = (roll: number): number[] => {
    const r = rivenStats(
      {
        buffTags: pos.map((i) => tags[i]!),
        curseTags: neg.map((i) => tags[i]!),
        buffRolls: pos.map(() => roll),
        curseRolls: neg.map(() => roll),
        rank: l.rank,
        itemType
      },
      data
    )
    const out: number[] = []
    pos.forEach((i, k) => (out[i] = Math.abs(r.buffs[k] ?? NaN)))
    neg.forEach((i, k) => (out[i] = Math.abs(r.curses[k] ?? NaN)))
    return out
  }
  const [lo, hi] = [mk(0), mk(2 ** 30)]
  return l.attrs.map((a: Attr, i) => {
    // game fraction: percent -> /100, faction 'multiply' -> x1.3 means 0.3, flat stats as is
    const flat =
      a.unit === 'seconds' || a.slug === 'punch_through' || a.slug === 'channeling_damage'
    const v = a.unit === 'multiply' ? Math.abs(a.value - 1) : Math.abs(a.value) / (flat ? 1 : 100)
    const q = (v - lo[i]) / (hi[i] - lo[i])
    if (Number.isNaN(q)) return undefined
    const c = Math.min(1, Math.max(0, q))
    return { q: c, grade: rollGrade(a.positive ? c : 1 - c) }
  })
}
