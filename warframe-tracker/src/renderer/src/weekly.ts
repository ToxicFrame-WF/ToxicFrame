// Weekly Tracker: the task list, the weekly reset, and the ticks that can be read from the
// inventory. Pure, so it can be tested.

export interface WeeklyTask {
  id: string
  label: string
  note?: string
  group: string
  auto?: string // how it ticks itself; shown as a hint
  max?: number // a counter instead of a tick: runs per week (Netracells work theirs out)
  reward?: string // what it is worth (wiki, Nov 2026)
}

// Reward lines, kept apart so the task list stays readable.
const REWARDS: Record<string, string> = {
  archon: "Archon shard in the Archon's colour, chance of Tauforged",
  deep: 'Archon shards, melee arcanes, 3 Lanthorns; Vosfor in Elite',
  temporal: 'Archon shards, arcanes, Omni Forma; Pix Chips in Elite',
  netracells: 'Entrati Lanthorn + a reward roll each',
  icebind: 'Riven Splicer, Kuva, and a Riven, shard or Forma roll each',
  palladino: '1 Riven Cipher, 3 Riven Transmuters, Requiem relics',
  teshin: 'Rotating Steel Essence offer',
  acrithis: '5 rotating wares',
  nightcap: 'Ayatan sculpture, Kuva, Vapor Specters',
  bird3: '1 Archon shard for Cavia standing (colour rotates)',
  clem: 'Clem Clone Blueprint',
  maroo: 'Ayatan sculpture (rotates weekly)',
  kahl: 'Stock and a Garrison rank',
  nightwave: 'Nightwave standing'
}

export const WEEKLY_GROUPS = ['Endgame', 'Vendors & shops', 'Quests & side tasks', 'Custom']

export const WEEKLY_TASKS: WeeklyTask[] = [
  // manual: shards also come from the Archimedeas, Bird 3 and the Icebind, so a new shard
  // doesn't prove a hunt
  { id: 'archon', label: 'Archon Hunt', group: 'Endgame' },
  {
    id: 'deep',
    label: 'Deep Archimedea',
    note: 'normal or Elite, 2 Search Pulses',
    group: 'Endgame',
    auto: 'Ticks when you gain 3 or more Entrati Lanthorns (its 15-point reward)'
  },
  {
    id: 'temporal',
    label: 'Temporal Archimedea',
    note: 'normal or Elite, 2 Search Pulses',
    group: 'Endgame',
    auto: 'Ticks when your Pix Chips go up (Elite reward)'
  },
  // a counter: how many runs the week's Search Pulses still allow (see netracellRuns)
  { id: 'netracells', label: 'Netracells', note: '1 Search Pulse each', group: 'Endgame', max: 5 },
  {
    id: 'icebind',
    label: 'The Icebind',
    note: 'Cryobells',
    group: 'Endgame',
    max: 3,
    auto: 'Counts a run for each Riven Splicer you gain (every run gives one)'
  },
  {
    id: 'palladino',
    label: 'Palladino',
    note: 'Riven Slivers, Iron Wake',
    group: 'Vendors & shops',
    auto: 'Ticks when you spend Riven Slivers'
  },
  { id: 'teshin', label: 'Teshin', note: 'Steel Path Honors rotation', group: 'Vendors & shops' },
  { id: 'acrithis', label: 'Acrithis', note: 'Duviri weekly wares', group: 'Vendors & shops' },
  { id: 'nightcap', label: 'Nightcap', note: 'Fibonacci weekly', group: 'Vendors & shops' },
  { id: 'yonta', label: 'Yonta', note: 'Kuva for Voidplumes', group: 'Vendors & shops' },
  { id: 'bird3', label: 'Bird 3', note: 'Archon shard', group: 'Vendors & shops' },
  { id: 'clem', label: 'Help Clem', group: 'Quests & side tasks' },
  { id: 'maroo', label: "Maroo's Ayatan hunt", group: 'Quests & side tasks' },
  {
    id: 'kahl',
    label: "Kahl's Garrison",
    note: 'weekly mission',
    group: 'Quests & side tasks',
    auto: "Ticks when you gain Stock (only Kahl's missions give it)"
  },
  { id: 'nightwave', label: 'Nightwave', note: 'weekly acts', group: 'Quests & side tasks' }
]

for (const t of WEEKLY_TASKS) t.reward = REWARDS[t.id]

// Start of the current Warframe week: Monday 00:00 UTC, as "YYYY-MM-DD".
export function weekKey(now = Date.now()): string {
  const d = new Date(now)
  const sinceMonday = (d.getUTCDay() + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday))
    .toISOString()
    .slice(0, 10)
}

export function nextReset(now = Date.now()): number {
  return Date.parse(weekKey(now) + 'T00:00:00Z') + 7 * 86_400_000
}

// The numbers the automatic ticks compare against the week's first inventory.
export interface WeeklyCounts {
  slivers: number // Riven Slivers: only spent at Palladino
  stock: number // Stock: only earned from Kahl's weekly mission
  lanthorns: number // Entrati Lanthorns: 3 from Deep Archimedea (Netracells give 1)
  pixChips: number // Pix Chips: Elite Temporal Archimedea
  splicers: number // Riven Splicers: 1 per Icebind run
  vosfor: number // Vosfor: Elite Deep Archimedea (dissolving arcanes gives it too)
}

// inventory item (last part of its unique name) -> the count it feeds
const ITEM_COUNT: Record<string, keyof WeeklyCounts> = {
  RivenFragment: 'slivers',
  KahlCreds: 'stock',
  EntratiLanthornBundle: 'lanthorns',
  '1999ConquestBucks': 'pixChips',
  RivenSplicer: 'splicers',
  DistillPoints: 'vosfor'
}

export function weeklyCounts(misc: { ItemType?: string; ItemCount?: number }[]): WeeklyCounts {
  const c: WeeklyCounts = {
    slivers: 0,
    stock: 0,
    lanthorns: 0,
    pixChips: 0,
    splicers: 0,
    vosfor: 0
  }
  for (const m of misc) {
    const k = ITEM_COUNT[(m.ItemType ?? '').split('/').pop() ?? '']
    if (k) c[k] += m.ItemCount ?? 0
  }
  return c
}

// Only tasks whose reward can come from nowhere else tick themselves. Older saved
// comparison points lack a field; those compare as 0 and only miss that week's auto tick.
export function autoDone(start: WeeklyCounts, now: WeeklyCounts): string[] {
  const out: string[] = []
  if (now.slivers < (start.slivers ?? 0)) out.push('palladino')
  if (start.stock != null && now.stock > start.stock) out.push('kahl')
  if (start.lanthorns != null && now.lanthorns - start.lanthorns >= 3) out.push('deep')
  if (start.pixChips != null && now.pixChips > start.pixChips) out.push('temporal')
  return out
}

// Icebind runs this week, read from Riven Splicers gained (using one lowers the count, so this
// can undercount; the manual counter still works and the higher of the two is shown).
export function icebindRuns(start: WeeklyCounts, now: WeeklyCounts): number {
  return start.splicers == null ? 0 : Math.max(0, Math.min(3, now.splicers - start.splicers))
}

// 5 Search Pulses a week, shared: each Archimedea unlock takes 2, each Netracell 1.
export const SEARCH_PULSES = 5
export function netracellRuns(deepDone: boolean, temporalDone: boolean): number {
  return Math.max(0, SEARCH_PULSES - (deepDone ? 2 : 0) - (temporalDone ? 2 : 0))
}

// Weeks in a row (counting back from the current or the last finished week) with the Endgame
// group fully done. history: week key -> was Endgame done that week.
export function endgameStreak(history: Record<string, boolean>, current: string): number {
  const day = 86_400_000
  let w = Date.parse(current + 'T00:00:00Z')
  if (!history[current]) w -= 7 * day // this week is not over yet: start from last week
  let n = 0
  while (history[new Date(w).toISOString().slice(0, 10)]) {
    n++
    w -= 7 * day
  }
  return n
}

// Elite Archimedea reward tier reached this week, from its fixed rewards: Deep pays 20 Vosfor at
// 28 points and 50 more at 37, Temporal 6 Pix Chips at 28 and 9 more at 37. 0 = not yet seen.
export function eliteTier(
  kind: 'deep' | 'temporal',
  start: WeeklyCounts,
  now: WeeklyCounts
): number {
  const [field, at28, at37] =
    kind === 'deep' ? (['vosfor', 20, 70] as const) : (['pixChips', 6, 15] as const)
  if (start[field] == null) return 0
  const gain = now[field] - start[field]
  return gain >= at37 ? 37 : gain >= at28 ? 28 : 0
}

// ---- shop previews (wiki, Nov 2026) ----
export interface Ware {
  name: string
  detail?: string // cost or weekly limit
}

const WEEK_MS = 7 * 86_400_000
// position in a weekly rotation that started at `from` (a Monday) and repeats every `length` weeks
const rotation = (from: string, length: number, now: number): number =>
  Math.floor(((now - Date.parse(from + 'T00:00:00Z')) % (WEEK_MS * length)) / WEEK_MS)

// Teshin's Steel Path Honors: one offer a week, 8-week loop from 16 Nov 2020
export const TESHIN: Ware[] = [
  { name: 'Umbra Forma Blueprint', detail: '150 Steel Essence' },
  { name: '50,000 Kuva', detail: '55 Steel Essence' },
  { name: 'Kitgun Riven Mod', detail: '75 Steel Essence' },
  { name: '3× Forma', detail: '75 Steel Essence' },
  { name: 'Zaw Riven Mod', detail: '75 Steel Essence' },
  { name: '30,000 Endo', detail: '150 Steel Essence' },
  { name: 'Rifle Riven Mod', detail: '75 Steel Essence' },
  { name: 'Shotgun Riven Mod', detail: '75 Steel Essence' }
]
// Bird 3: one Archon shard a week for 30,000 Cavia standing, 3-week loop from 12 Sep 2022
export const BIRD3 = ['Azure', 'Amber', 'Crimson']

export function teshinOffer(now = Date.now()): { now: Ware; next: Ware } {
  const i = rotation('2020-11-16', 8, now)
  return { now: TESHIN[i], next: TESHIN[(i + 1) % 8] }
}
export function bird3Shard(now = Date.now()): { now: string; next: string } {
  const i = rotation('2022-09-12', 3, now)
  return { now: BIRD3[i], next: BIRD3[(i + 1) % 3] }
}

// shops with a fixed weekly list
export const FIXED_WARES: Record<string, Ware[]> = {
  palladino: [
    { name: 'Riven Cipher', detail: '1 a week' },
    { name: 'Riven Transmuter', detail: '3 a week' },
    { name: 'Requiem I–IV relics', detail: '10 of each a week' },
    { name: 'Requiem Ultimatum', detail: '1 a week' },
    { name: '6,000 Endo', detail: '1 a week' }
  ],
  nightcap: [
    { name: 'Ayatan Chattraka Sculpture', detail: '1 a week' },
    { name: 'Kuva', detail: '6 a week' },
    { name: 'Vapor Specter', detail: '7 a week' }
  ],
  yonta: [{ name: '35,000 Kuva', detail: '5 Voidplume Pinions, once a week' }]
}

// What the page shows as done, from the manual ticks (on/off), the inventory's auto ticks and the
// Elite tiers. Netracell pulses count an Archimedea as run as soon as any sign of it shows, even
// before it counts as done (Elite mode only ticks at 37 points, but the pulses went at the unlock).
export function weekTicks(o: {
  on: Set<string>
  off: Set<string>
  auto: Set<string>
  tiers: Record<string, number> // Elite tier per Archimedea, 0 when not tracked or not seen
  elite: boolean // "Track Elite Archimedea rewards"
  both: boolean // "I run both Archimedeas every week"
}): { ticked: (id: string) => boolean; autoTicks: (id: string) => boolean; netracellMax: number } {
  const arch = (id: string): boolean => id === 'deep' || id === 'temporal'
  const autoTicks = (id: string): boolean =>
    o.elite && arch(id) ? (o.tiers[id] ?? 0) === 37 : o.auto.has(id)
  const ticked = (id: string): boolean => o.on.has(id) || (autoTicks(id) && !o.off.has(id))
  const ran = (id: string): boolean => ticked(id) || o.auto.has(id) || (o.tiers[id] ?? 0) > 0
  return {
    ticked,
    autoTicks,
    netracellMax: o.both ? netracellRuns(true, true) : netracellRuns(ran('deep'), ran('temporal'))
  }
}
