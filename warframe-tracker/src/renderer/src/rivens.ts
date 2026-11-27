// Rivens from the raw inventory. Unveiled rivens are Upgrades entries whose UpgradeFingerprint
// holds the weapon (compat), rank, MR (lvlReq), rerolls, polarity and the buff/curse tags.
// Veiled rivens are RawUpgrades stacks ("Raw…RandomMod").

export interface Riven {
  id: string
  type: string // Rifle, Shotgun, Pistol, Melee, …
  weapon: string // compat unique name
  rank: number
  mr: number
  rerolls: number
  polarity?: string
  buffs: string[]
  curses: string[]
  buffTags: string[] // raw game tags, for grading
  curseTags: string[]
  buffRolls: number[] // raw roll per stat (0 … 2^30), for the percentages
  curseRolls: number[]
  itemType: string // riven unique name (its type decides the base values)
}
export interface VeiledRiven {
  type: string
  count: number
}

const TYPE = /Randomized\/(?:Lotus|Player|Raw)(\w+?)(?:Weapon)?RandomMod/

// Game stat tag -> [abbreviation used by the grade sheet, readable name]. Tags as they appear in
// riven fingerprints (checked against a live inventory 2026-11-19).
export const STATS: Record<string, [string, string]> = {
  WeaponCritDamageMod: ['CD', 'Critical damage'],
  WeaponCritChanceMod: ['CC', 'Critical chance'],
  WeaponDamageAmountMod: ['DMG', 'Damage'],
  WeaponMeleeDamageMod: ['DMG', 'Melee damage'],
  WeaponFireIterationsMod: ['MS', 'Multishot'],
  WeaponFireRateMod: ['FR', 'Fire rate'],
  WeaponToxinDamageMod: ['TOX', 'Toxin'],
  WeaponFireDamageMod: ['HEAT', 'Heat'],
  WeaponFreezeDamageMod: ['COLD', 'Cold'],
  WeaponElectricityDamageMod: ['ELEC', 'Electricity'],
  WeaponCorrosiveDamageMod: ['CORRO', 'Corrosive'],
  WeaponGasDamageMod: ['GAS', 'Gas'],
  WeaponImpactDamageMod: ['IMP', 'Impact'],
  WeaponArmorPiercingDamageMod: ['PUNC', 'Puncture'],
  WeaponSlashDamageMod: ['SLASH', 'Slash'],
  WeaponStunChanceMod: ['SC', 'Status chance'],
  WeaponProcTimeMod: ['SD', 'Status duration'],
  WeaponReloadSpeedMod: ['RLS', 'Reload speed'],
  WeaponClipMaxMod: ['MAG', 'Magazine capacity'],
  WeaponAmmoMaxMod: ['AMMO', 'Ammo maximum'],
  WeaponAmmoEfficiency: ['AEFF', 'Ammo efficiency'],
  WeaponPunctureDepthMod: ['PT', 'Punch through'],
  WeaponProjectileSpeedMod: ['PFS', 'Projectile speed'],
  WeaponRecoilReductionMod: ['REC', 'Weapon recoil'],
  WeaponZoomFovMod: ['ZOOM', 'Zoom'],
  WeaponMeleeRangeIncMod: ['RANGE', 'Range'],
  WeaponMeleeComboInitialBonusMod: ['IC', 'Initial combo'],
  WeaponMeleeComboEfficiencyMod: ['EFF', 'Heavy attack efficiency'],
  WeaponMeleeFinisherDamageMod: ['FIN', 'Finisher damage'],
  WeaponMeleeComboBonusOnHitMod: ['CCC', 'Additional combo count chance'],
  WeaponMeleeComboPointsOnHitMod: ['CCC', 'Chance to gain combo count'],
  ComboDurationMod: ['COMBO', 'Combo duration'],
  SlideAttackCritChanceMod: ['SLIDE', 'Critical chance on slide']
}
const FACTION: Record<string, string> = {
  Grineer: 'DTG',
  Corpus: 'DTC',
  Infested: 'DTI',
  Corrupted: 'DTO'
}
const factionOf = (tag: string): string | undefined => /FactionDamage(\w+)/.exec(tag)?.[1]

// readable name; fire rate reads "Attack speed" on melee
export function statName(tag: string, melee = false): string {
  const faction = factionOf(tag)
  if (faction) return `Damage to ${faction === 'Corrupted' ? 'Orokin' : faction}`
  if (melee && tag === 'WeaponFireRateMod') return 'Attack speed'
  const known = STATS[tag]?.[1]
  if (known) return known
  const words = tag
    .replace(/^Weapon/, '')
    .replace(/Mod$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// abbreviation used by the grade sheet; fire rate is "AS" on melee
export const abbr = (tag: string, melee: boolean): string => {
  const faction = factionOf(tag)
  const a = faction ? (FACTION[faction] ?? tag) : (STATS[tag]?.[0] ?? tag)
  return melee && a === 'FR' ? 'AS' : a
}

export function rivenType(itemType: string): string {
  const m = TYPE.exec(itemType)
  return m ? m[1].replace(/^Modular/, 'Modular ').replace('Archgun', 'Arch-gun') : 'Riven'
}

interface Raw {
  ItemType?: string
  ItemCount?: number
  ItemId?: { $oid?: string }
  UpgradeFingerprint?: string
}

export function parseRivens(raw: Record<string, unknown>): {
  unveiled: Riven[]
  veiled: VeiledRiven[]
} {
  const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : [])
  const unveiled: Riven[] = []
  for (const u of arr(raw.Upgrades)) {
    if (!u.ItemType || !/Randomized\/.*RandomModRare$/.test(u.ItemType)) continue
    let fp: {
      compat?: string
      lvl?: number
      lvlReq?: number
      rerolls?: number
      pol?: string
      buffs?: { Tag?: string; Value?: number }[]
      curses?: { Tag?: string; Value?: number }[]
    } = {}
    try {
      fp = JSON.parse(u.UpgradeFingerprint ?? '{}')
    } catch {
      // unreadable fingerprint: still list the riven with what we know
    }
    unveiled.push({
      id: u.ItemId?.$oid ?? `${u.ItemType}#${unveiled.length}`,
      type: rivenType(u.ItemType),
      weapon: fp.compat ?? '',
      rank: fp.lvl ?? 0,
      mr: fp.lvlReq ?? 0,
      rerolls: fp.rerolls ?? 0,
      polarity: fp.pol?.replace(/^AP_/, '').toLowerCase(),
      buffs: (fp.buffs ?? []).map((b) => statName(b.Tag ?? '', /Melee/.test(u.ItemType!))),
      curses: (fp.curses ?? []).map((c) => statName(c.Tag ?? '', /Melee/.test(u.ItemType!))),
      buffTags: (fp.buffs ?? []).map((b) => b.Tag ?? ''),
      curseTags: (fp.curses ?? []).map((c) => c.Tag ?? ''),
      buffRolls: (fp.buffs ?? []).map((b) => b.Value ?? 0),
      curseRolls: (fp.curses ?? []).map((c) => c.Value ?? 0),
      itemType: u.ItemType
    })
  }
  const veiled = arr(raw.RawUpgrades)
    .filter((u) => u.ItemType && /Randomized\/Raw\w+RandomMod$/.test(u.ItemType))
    .map((u) => ({ type: rivenType(u.ItemType!), count: u.ItemCount ?? 1 }))
  return { unveiled, veiled }
}

export type Grade = 'Perfect' | 'Good' | 'OK' | 'Bad'
// Our reading of the sheet (AlecaFrame does not publish its exact formula):
// every required stat present, every positive wanted and the negative (if any) acceptable ->
// Perfect; at least 2 wanted positives (any negative) -> Good; at least 1 wanted
// positive -> OK; else Bad.
export function gradeRiven(
  r: Pick<Riven, 'buffTags' | 'curseTags' | 'type'>,
  rule: { core?: string[]; good: string[]; neg: string[] } | undefined
): Grade | undefined {
  if (!rule) return undefined
  const melee = /Melee/.test(r.type)
  const wanted = r.buffTags.filter((t) => rule.good.includes(abbr(t, melee))).length
  const negOk = r.curseTags.every((t) => rule.neg.includes(abbr(t, melee)))
  const tags = r.buffTags.map((t) => abbr(t, melee))
  const coreOk = (rule.core ?? []).every((c) => tags.includes(c))
  if (wanted === r.buffTags.length && wanted > 0 && negOk && coreOk) return 'Perfect'
  if (wanted >= 2) return 'Good' // a non-preferred negative only costs Perfect
  if (wanted >= 1) return 'OK'
  return 'Bad'
}

// Riven stat values, the formula the community calculators use (it matches in-game numbers):
// base value x 90 x 1.2 (dispositions were retired; every weapon is 1.2) x count multiplier x roll (0.9 … 1.1) x (rank + 1) / 9.
// Count multiplier: 2 positives 0.99 (1.2375 with a negative), 3 positives 0.75 (0.9375);
// the negative itself is x -0.495 with 2 positives, x -0.75 with 3.
export function rivenStats(
  r: Pick<Riven, 'buffTags' | 'curseTags' | 'buffRolls' | 'curseRolls' | 'rank' | 'itemType'>,
  data: { values: Record<string, Record<string, number>> }
): { buffs: (number | undefined)[]; curses: (number | undefined)[] } {
  const disp = 1.2
  const table = data.values[r.itemType] ?? {}
  // a stat no longer in the type's table (old rivens): borrow its base from any riven type
  const base = (tag: string): number | undefined =>
    table[tag] ?? Object.values(data.values).find((t) => tag in t)?.[tag] ?? SPLICED[tag]?.base
  const two = r.buffTags.length === 2
  const neg = r.curseTags.length > 0
  const buffMult = two ? (neg ? 1.2375 : 0.99) : neg ? 0.9375 : 0.75
  const curseMult = two ? -0.495 : -0.75
  const val = (tag: string, roll: number, mult: number): number | undefined => {
    const b = base(tag)
    if (b === undefined) return undefined
    return b * 90 * disp * mult * (0.9 + (0.2 * roll) / 2 ** 30) * ((r.rank + 1) / 9)
  }
  return {
    buffs: r.buffTags.map((t, i) => val(t, r.buffRolls[i] ?? 0, buffMult)),
    curses: r.curseTags.map((t, i) => val(t, r.curseRolls[i] ?? 0, curseMult))
  }
}

// How the game shows each stat: % for most, x1.15 for faction damage, flat for punch through,
// seconds for combo duration, a plain number for initial combo.
export function formatStat(tag: string, v: number): string {
  const sign = v < 0 ? '-' : '+'
  const a = Math.abs(v)
  if (/FactionDamage/.test(tag)) return `x${(1 + v).toFixed(2)}`
  if (tag === 'WeaponPunctureDepthMod') return `${sign}${a.toFixed(1)}`
  if (tag === 'ComboDurationMod') return `${sign}${a.toFixed(1)}s`
  if (tag === 'WeaponMeleeComboInitialBonusMod') return `${sign}${Math.round(a)}`
  return `${sign}${(a * 100).toFixed(1)}%`
}

// Riven name from its positive stats, checked against 15 live rivens: sort the positives by their
// roll (highest first); 2 stats -> prefix(1st) + suffix(2nd), 3 stats -> prefix(1st) "-"
// prefix(2nd) + suffix(3rd). Undefined when a part is unknown (stats that no longer roll).
export function rivenName(
  r: Pick<Riven, 'buffTags' | 'buffRolls'>,
  affix: Record<string, [string, string]>
): string | undefined {
  const order = r.buffTags
    .map((t, i) => ({ t, v: r.buffRolls[i] ?? 0 }))
    .sort((a, b) => b.v - a.v)
    .map((x) => affix[x.t] ?? SPLICED[x.t]?.affix)
  if (order.length < 2 || order.some((a) => !a)) return undefined
  const [a, b, c] = order as [string, string][]
  // a stat that no longer rolls may have only a prefix; the name is unknown if a needed part is
  if (c ? !a[0] || !b[0] || !c[1] : !a[0] || !b[1]) return undefined
  const name = c ? `${a[0]}-${b[0]}${c[1]}` : `${a[0]}${b[1]}`
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// Letter for how good one roll is (0 = worst possible, 1 = best). Negatives are better when
// smaller, so pass 1 - roll for them. Our own scale, close to what AlecaFrame shows.
export function rollGrade(q: number): string {
  const steps: [number, string][] = [
    [0.95, 'S'], // AlecaFrame's top letter: a near-max roll
    [0.85, 'A+'],
    [0.75, 'A'],
    [0.7, 'A-'],
    [0.55, 'B+'],
    [0.45, 'B'],
    [0.35, 'B-'],
    [0.25, 'C+'],
    [0.15, 'C'],
    [0.05, 'C-']
  ]
  return steps.find(([min]) => q >= min)?.[1] ?? 'D'
}

// Readable name for a sheet abbreviation, for the recommended-stats lists.
const ABBR_NAME: Record<string, string> = {
  AS: 'Attack speed',
  CORRO: 'Corrosive',
  VIRAL: 'Viral',
  WEAKDMG: 'Weak point damage',
  SDMG: 'Status damage',
  DTG: 'Damage to Grineer',
  DTC: 'Damage to Corpus',
  DTI: 'Damage to Infested',
  DTO: 'Damage to Orokin',
  DTS: 'Damage to Scaldra',
  DTT: 'Damage to Techrot',
  WUP: 'Wind up speed',
  SLAMDAM: 'Slam damage'
}
export function abbrName(a: string): string {
  return ABBR_NAME[a] ?? Object.values(STATS).find(([ab]) => ab === a)?.[1] ?? a
}

// Spliced traits (Update 44.1 Riven Splicing) are missing from the game's normal riven stat
// tables. Values from wiki.warframe.com/w/Riven_Mods: base value at rank 8 / 90 (Gas and Corrosive
// 90%, Ammo Efficiency 45%) and the name parts.
// shortcut: only the spliced traits seen on a live account so far; add Viral, Radiation, Blast,
// Magnetic, Status Damage, Weakpoint and melee ones when their game tags show up in a riven.
const SPLICED: Record<string, { base: number; affix: [string, string] }> = {
  WeaponGasDamageMod: { base: 0.01, affix: ['cali', 'fel'] },
  WeaponCorrosiveDamageMod: { base: 0.01, affix: ['cori', 'or'] },
  WeaponAmmoEfficiency: { base: 0.005, affix: ['parci', 'pia'] }
}

// What the riven overlay shows for one card: each stat graded, the cheapest similar listings,
// the sheet's wanted stats and an overall verdict.
export interface RivenCard {
  name: string
  weapon: string
  verdict?: 'Bad' | 'OK' | 'Good' | 'Great'
  stats: { text: string; grade?: string; q?: number; curse: boolean; tag?: string }[]
  // the weapon's rolling plan, when there is one (tags, not names, so it lines up with `stats`)
  plan?: {
    pos: { tag: string; name: string; required: boolean }[]
    negs: { tag: string; name: string }[]
    minRoll?: number
    odds?: { cycles: number; kuva: number }
  }
  // locking one stat vs not: expected cycles and kuva to reach the plan / key stats
  lock?: {
    name: string
    free: { cycles: number; kuva: number }
    locked: { cycles: number; kuva: number }
    already: boolean // the cycle price is already doubled
  }
  similar: { price: number; attrs: { text: string; matched: boolean; positive: boolean }[] }[]
  wanted: { name: string; core: boolean }[] // sheet: wanted stats
  negatives: string[] // sheet: acceptable negatives
  find?: { slug: string; pos: string[]; neg?: string } // warframe.market slugs, for Find similar
}
