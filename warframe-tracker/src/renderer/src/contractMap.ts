import { rivenName, rivenStats, type Riven } from './rivens.ts'
import { tagOf } from './rivenFilter.ts'

// Turns an inventory riven into the item part of a warframe.market contract. Nothing is guessed:
// a weapon, stat, polarity or name that cannot be mapped is reported in `problems`.
type Catalog = {
  weapons: Record<string, { name: string; gameRef?: string }>
  attrs: Record<string, { name: string; unit?: string }>
}
type Data = {
  values: Record<string, Record<string, number>>
  affix: Record<string, [string, string]>
}
export interface ContractItem {
  type: 'riven'
  attributes: { url_name: string; value: number; positive: boolean }[]
  polarity: string
  mod_rank: number
  name: string
  re_rolls: number
  mastery_level: number
  weapon_url_name: string
}

// fingerprint polarity (AP_ prefix removed, lowercased) -> warframe.market name
const POLARITY: Record<string, string> = {
  attack: 'madurai',
  defense: 'vazarin',
  tactic: 'naramon',
  power: 'zenurik',
  ward: 'unairu',
  madurai: 'madurai',
  vazarin: 'vazarin',
  naramon: 'naramon',
  zenurik: 'zenurik',
  unairu: 'unairu'
}
// rivens may name the internal base class ("…/QuadShotgunBase" = Hek), see weaponLookup
const baseless = (w: string | undefined): string | undefined => w?.replace(/Base$/, '')
const round = (n: number, d: number): number => Math.round(n * 10 ** d) / 10 ** d

// Reverse direction: the inventory riven a contract was listed from. Same weapon (game unique
// name) and the same stat set (stat + sign); among several, the one agreeing on rerolls / rank /
// MR / polarity wins. undefined = none (sold, traded, inventory not loaded).
export function matchContractRiven(
  c: {
    weaponRef?: string
    attributes: { name: string; positive: boolean }[]
    rerolls?: number
    rank?: number
    mastery?: number
    polarity?: string
  },
  rivens: Riven[]
): Riven | undefined {
  if (!c.weaponRef) return undefined
  const key = (tag: string | undefined, positive: boolean): string =>
    `${positive ? '+' : '-'}${tag}`
  let best: Riven | undefined
  let bestScore = -1
  for (const r of rivens) {
    if (baseless(r.weapon) !== baseless(c.weaponRef)) continue
    const melee = /Melee|Zaw/.test(r.itemType)
    const mine = new Set([
      ...r.buffTags.map((t) => key(t, true)),
      ...r.curseTags.map((t) => key(t, false))
    ])
    const theirs = c.attributes.map((a) => key(tagOf(a.name, melee), a.positive))
    if (theirs.length !== mine.size || !theirs.every((k) => mine.has(k))) continue
    const score =
      Number(r.rerolls === c.rerolls) +
      Number(r.rank === c.rank) +
      Number(r.mr === c.mastery) +
      Number(r.polarity?.toLowerCase() === c.polarity?.toLowerCase())
    if (score > bestScore) [best, bestScore] = [r, score]
  }
  return best
}

export function toContractItem(
  r: Riven,
  cat: Catalog,
  data: Data
): { item?: ContractItem; problems: string[] } {
  const problems: string[] = []
  const weaponSlug = Object.keys(cat.weapons).find(
    (k) => baseless(cat.weapons[k].gameRef) === baseless(r.weapon)
  )
  if (!weaponSlug) problems.push(`Weapon "${r.weapon || 'unknown'}" is not on warframe.market`)
  const polarity = POLARITY[r.polarity ?? '']
  if (!polarity) problems.push(`Polarity "${r.polarity ?? 'none'}" is unknown`)
  const name = rivenName(r, data.affix)
  if (!name) problems.push('The riven name could not be worked out')
  const melee = /Melee|Zaw/.test(r.itemType)
  const v = rivenStats(r, data)
  const attributes: ContractItem['attributes'] = []
  const add = (tag: string, val: number | undefined, positive: boolean): void => {
    const slugs = Object.keys(cat.attrs).filter((s) => tagOf(cat.attrs[s].name, melee) === tag)
    if (slugs.length !== 1)
      return void problems.push(`Stat ${tag} has no single warframe.market match`)
    if (val === undefined) return void problems.push(`Stat ${tag} has no known base value`)
    const unit = cat.attrs[slugs[0]].unit
    // wfm shows percent as 120.5, faction damage as a multiplier (x1.3), the rest as is
    const value =
      unit === 'percent'
        ? round(val * 100, 1)
        : unit === 'multiply'
          ? round(1 + val, 2)
          : round(val, 1)
    attributes.push({ url_name: slugs[0], value, positive })
  }
  r.buffTags.forEach((t, i) => add(t, v.buffs[i], true))
  r.curseTags.forEach((t, i) => add(t, v.curses[i], false))
  if (problems.length) return { problems }
  return {
    problems,
    item: {
      type: 'riven',
      attributes,
      polarity,
      mod_rank: r.rank,
      name: name!,
      re_rolls: r.rerolls,
      mastery_level: r.mr,
      weapon_url_name: weaponSlug!
    }
  }
}

// Are the stats a contract was listed with out of date? (dispositions change; wfm cannot edit a
// listing's riven.) Compares the listing with what the matched inventory riven maps to today:
// per stat within 0.5% relative or one rounding step (0.1, or 0.01 for multipliers), whichever is
// larger; a different stat set is stale too. `item` is the current item (undefined = not mappable,
// then nothing is claimed).
export interface StatDiff {
  name: string
  listed?: number
  now?: number
  unit?: string
}
export function staleStats(
  c: { attributes: { name: string; value: number; positive: boolean }[] },
  r: Riven,
  cat: Catalog,
  data: Data
): { stale: boolean; item?: ContractItem; diffs: StatDiff[] } {
  const item = toContractItem(r, cat, data).item
  if (!item) return { stale: false, diffs: [] }
  const diffs: StatDiff[] = []
  const now = item.attributes.map((a) => ({
    name: cat.attrs[a.url_name]?.name ?? a.url_name,
    unit: cat.attrs[a.url_name]?.unit,
    value: a.value,
    positive: a.positive
  }))
  for (const n of now) {
    const l = c.attributes.find((a) => a.name === n.name && a.positive === n.positive)
    const step = n.unit === 'multiply' ? 0.01 : 0.1
    if (!l || Math.abs(l.value - n.value) > Math.max(Math.abs(n.value) * 0.005, step))
      diffs.push({ name: n.name, listed: l?.value, now: n.value, unit: n.unit })
  }
  for (const l of c.attributes)
    if (!now.some((n) => n.name === l.name && n.positive === l.positive))
      diffs.push({ name: l.name, listed: l.value })
  return { stale: diffs.length > 0, item, diffs }
}
