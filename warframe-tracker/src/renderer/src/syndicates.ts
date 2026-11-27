// Syndicate facts from wiki.warframe.com/w/Syndicate, the faction pages and /w/Syndicate_Medallions.

// Rank titles, index = rank + 2 (ranks -2 … 5).
export const TITLES: Record<string, string[]> = {
  SteelMeridianSyndicate: [
    'Enemy',
    'Outcast',
    'Neutral',
    'Brave',
    'Valiant',
    'Defender',
    'Protector',
    'General'
  ],
  ArbitersSyndicate: [
    'Fraud',
    'Deceiver',
    'Neutral',
    'Principled',
    'Authentic',
    'Lawful',
    'Crusader',
    'Maxim'
  ],
  CephalonSudaSyndicate: [
    'Waste',
    'Debris',
    'Neutral',
    'Competent',
    'Intriguing',
    'Intelligent',
    'Wise',
    'Genius'
  ],
  PerrinSyndicate: [
    'Write-Off',
    'Liability',
    'Neutral',
    'Associate',
    'Senior Associate',
    'Executive',
    'Senior Executive',
    'Partner'
  ],
  RedVeilSyndicate: [
    'Corrupt',
    'Suspect',
    'Neutral',
    'Respected',
    'Honored',
    'Esteemed',
    'Revered',
    'Exalted'
  ],
  NewLokaSyndicate: [
    'Exiled',
    'Condemned',
    'Neutral',
    'Humane',
    'Bountiful',
    'Benevolent',
    'Pure',
    'Flawless'
  ],
  CetusSyndicate: ['', '', 'Neutral', 'Offworlder', 'Visitor', 'Trusted', 'Surah', 'Kin'],
  QuillsSyndicate: ['', '', 'Neutral', 'Mote', 'Observer', 'Adherent', 'Instrument', 'Architect'],
  SolarisSyndicate: ['', '', 'Neutral', 'Outworlder', 'Rapscallion', 'Doer', 'Cove', 'Old Mate'],
  VoxSyndicate: ['', '', 'Neutral', 'Operative', 'Agent', 'Hand', 'Instrument', 'Shadow'],
  VentKidsSyndicate: ['', '', 'Neutral', 'Glinty', 'Whozit', 'Proper Felon', 'Primo', 'Logical'],
  EntratiSyndicate: [
    '',
    '',
    'Stranger',
    'Acquaintance',
    'Associate',
    'Friend',
    'Confidant',
    'Family'
  ]
}
export const title = (tag: string, rank: number): string | undefined =>
  TITLES[tag]?.[rank + 2] || undefined

// Inventory "Standing" is cumulative: rank r spans [lo, hi). Rank 0 is the -5,000…5,000 band.
const RANGES: Record<number, [number, number]> = {
  [-2]: [-71000, -27000],
  [-1]: [-27000, -5000],
  0: [-5000, 5000],
  1: [5000, 27000],
  2: [27000, 71000],
  3: [71000, 141000],
  4: [141000, 240000],
  5: [240000, 372000]
}
// progress inside the current rank (0…1), or undefined when the syndicate uses another scale
export function rankProgress(
  rank: number,
  standing: number
): { pct: number; toNext: number } | undefined {
  const r = RANGES[rank]
  if (!r || standing < r[0] || standing > r[1]) return undefined
  return { pct: (standing - r[0]) / (r[1] - r[0]), toNext: r[1] - standing }
}

// Shared faction daily cap; each open-world syndicate and Simaris have their own of the same size.
export const dailyCap = (mr: number): number => 16000 + 500 * mr

// Gaining standing with a faction moves the others by these shares.
export const RELATIONS: Record<string, Record<string, number>> = {
  SteelMeridianSyndicate: { RedVeilSyndicate: 0.5, NewLokaSyndicate: -0.5, PerrinSyndicate: -1 },
  ArbitersSyndicate: { CephalonSudaSyndicate: 0.5, PerrinSyndicate: -0.5, RedVeilSyndicate: -1 },
  CephalonSudaSyndicate: { ArbitersSyndicate: 0.5, RedVeilSyndicate: -0.5, NewLokaSyndicate: -1 },
  PerrinSyndicate: { NewLokaSyndicate: 0.5, ArbitersSyndicate: -0.5, SteelMeridianSyndicate: -1 },
  RedVeilSyndicate: {
    SteelMeridianSyndicate: 0.5,
    CephalonSudaSyndicate: -0.5,
    ArbitersSyndicate: -1
  },
  NewLokaSyndicate: {
    PerrinSyndicate: 0.5,
    SteelMeridianSyndicate: -0.5,
    CephalonSudaSyndicate: -1
  }
}

// Rank-up sacrifice to reach rank r (faction syndicates). Rank 1 and 3 differ per faction.
const RANK1: Record<string, string> = {
  SteelMeridianSyndicate: '2 Morphics',
  ArbitersSyndicate: '2 Gallium',
  CephalonSudaSyndicate: '2 Control Module',
  PerrinSyndicate: '2 Detonite Ampule',
  RedVeilSyndicate: '2 Gallium',
  NewLokaSyndicate: '2 Fieldron Sample'
}
const CATALYST = new Set(['SteelMeridianSyndicate', 'CephalonSudaSyndicate', 'RedVeilSyndicate'])
export function sacrifice(
  tag: string,
  toRank: number
): { credits: number; items: string } | undefined {
  if (!RANK1[tag]) return undefined
  const table: Record<number, [number, string]> = {
    1: [30000, RANK1[tag]],
    2: [50000, '1 Forma'],
    3: [100000, CATALYST.has(tag) ? '1 Orokin Catalyst' : '1 Orokin Reactor'],
    4: [250000, '2 Aya'],
    5: [500000, '3 Aya']
  }
  const t = table[toRank]
  return t && { credits: t[0], items: t[1] }
}

// Medallions in MiscItems ("…/SyndicateDogTags/NewLokaRareDogTag") -> standing per faction.
const PREFIX: Record<string, string> = {
  SteelMeridian: 'SteelMeridianSyndicate',
  Arbiters: 'ArbitersSyndicate',
  Cephalon: 'CephalonSudaSyndicate',
  Perrin: 'PerrinSyndicate',
  RedVeil: 'RedVeilSyndicate',
  NewLoka: 'NewLokaSyndicate'
}
const WORTH = { Common: 500, Uncommon: 1000, Rare: 5000 }
export function medallions(misc: { ItemType?: string; ItemCount?: number }[]): {
  byTag: Record<string, { count: number; standing: number }>
  universal: number
} {
  const byTag: Record<string, { count: number; standing: number }> = {}
  let universal = 0
  for (const m of misc) {
    const hit = /SyndicateDogTags\/(\w+?)(Common|Uncommon|Rare)?DogTag$/.exec(m.ItemType ?? '')
    if (!hit) continue
    const n = m.ItemCount ?? 0
    if (hit[1].startsWith('Universal')) universal += n
    const tag = PREFIX[hit[1]]
    if (!tag) continue
    const e = (byTag[tag] ??= { count: 0, standing: 0 })
    e.count += n
    e.standing += n * WORTH[(hit[2] ?? 'Common') as keyof typeof WORTH]
  }
  return { byTag, universal }
}
