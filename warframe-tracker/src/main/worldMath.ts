// Pure world-state math (no electron), so tests can import it.
export interface Cycle {
  state: string
  expiry: string
}

const iso = (ms: number): string => new Date(ms).toISOString()

// Plains of Eidolon: the Ostron bounty cycle is 150 min, night is its last 50 min.
export function cetusCycle(bountyEnd: number, now = Date.now()): Cycle {
  const nightStart = bountyEnd - 50 * 60 * 1000
  return now < nightStart
    ? { state: 'day', expiry: iso(nightStart) }
    : { state: 'night', expiry: iso(bountyEnd) }
}

// A cached world state's cycles moved on to `now`: the computed ones recomputed, the Plains (and
// the Cambion Drift on the same clock) rolled forward from the last known bounty end, which
// repeats every 150 min. Lets a cached state count down correctly past a phase change.
export function rollCycles(d: WorldState, now = Date.now()): WorldState {
  d.vallis = vallisCycle(now)
  d.duviri = duviriCycle(now)
  if (d.cetus) {
    const exp = Date.parse(d.cetus.expiry)
    let end = d.cetus.state === 'night' ? exp : exp + 50 * 60 * 1000
    while (end <= now) end += 150 * 60 * 1000
    d.cetus = cetusCycle(end, now)
    d.cambion = { ...d.cetus, state: d.cetus.state === 'day' ? 'fass' : 'vome' }
  }
  return d
}

// shortcut: Orb Vallis epoch and 400 s warm / 1600 s loop are from memory, verify against the game if it drifts.
const VALLIS_EPOCH = Date.UTC(2018, 10, 10, 8, 13, 48)
const VALLIS_LOOP = 1_600_000
const VALLIS_WARM = 400_000
export function vallisCycle(now = Date.now()): Cycle {
  const t = (((now - VALLIS_EPOCH) % VALLIS_LOOP) + VALLIS_LOOP) % VALLIS_LOOP
  const start = now - t
  return t < VALLIS_WARM
    ? { state: 'warm', expiry: iso(start + VALLIS_WARM) }
    : { state: 'cold', expiry: iso(start + VALLIS_LOOP) }
}

// shortcut: Duviri mood assumed to rotate every 2 h aligned to the Unix epoch, verify if it drifts.
const MOODS = ['sorrow', 'fear', 'joy', 'anger', 'envy']
const MOOD_MS = 2 * 60 * 60 * 1000
export function duviriCycle(now = Date.now()): Cycle {
  const n = Math.floor(now / MOOD_MS)
  return { state: MOODS[n % MOODS.length], expiry: iso((n + 1) * MOOD_MS) }
}

// "/Lotus/StoreItems/Types/Items/MiscItems/OrokinCatalyst" -> "Orokin Catalyst"
export function prettyPath(path: string): string {
  const last = path.split('/').pop() ?? path
  return last
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .trim()
}

export interface Fissure {
  id: string
  node: string
  missionType: string
  tier: string
  expiry: string
  isHard: boolean // Steel Path
  isStorm: boolean // Void Storm (Railjack)
}
export interface StockItem {
  name: string
  image?: string
  ducats?: number
  credits?: number
}
export interface RewardEntry {
  id: string
  kind: 'alert' | 'invasion' | 'event'
  title: string
  rewards: string[] // reward names, e.g. "Orokin Catalyst Blueprint", "3x Fieldron"
  icons?: Record<string, string> // reward name -> picture
  expiry?: string
}
export interface WorldState {
  rewardEntries: RewardEntry[]
  cetus?: Cycle
  vallis?: Cycle
  cambion?: Cycle
  zariman?: Cycle
  duviri?: Cycle
  baro?: {
    active: boolean
    location: string
    activation: string
    expiry: string
    inventory: StockItem[]
  }
  sortieExpiry?: string
  prime?: { active: boolean; expiry: string; items: StockItem[] } // Prime Resurgence
  circuit?: { warframes: StockItem[]; weapons: StockItem[] } // this week's Circuit rewards
  fissures: Fissure[]
  incursions?: { nodes: string[]; types?: string[]; expiry: string } // today's Steel Path incursions
  bounties?: { syndicate: string; expiry: string; list: { node: string; challenge: string }[] }[]
  archimedea?: Archimedea[] // Deep and Temporal Archimedea of this week
  fetchedAt: number
}
export interface Modifier {
  name: string
  desc?: string
}
export interface Archimedea {
  kind: string // "Deep Archimedea" / "Temporal Archimedea"
  expiry: string
  missions: { mission: string; faction: string; deviation: Modifier; risks: Modifier[] }[]
  variables: Modifier[] // personal modifiers
}

export interface Names {
  nodes: Record<string, { value: string; type: string; enemy: string }>
  missions: Record<string, string>
  dict: Record<string, string>
  challenges?: Record<string, string> // bounty challenge path -> in-game wording
  os?: Record<string, string> // Archimedea texts (browse.wf oracle dictionary)
}
export const NO_NAMES: Names = { nodes: {}, missions: {}, dict: {} }

const FACTION_NAMES: Record<string, string> = {
  FC_GRINEER: 'Grineer',
  FC_CORPUS: 'Corpus',
  FC_INFESTATION: 'Infested',
  FC_OROKIN: 'Orokin',
  FC_MITW: 'The Murmur',
  FC_SENTIENT: 'Sentient',
  FC_SCALDRA: 'Scaldra',
  FC_TECHROT: 'Techrot'
}

// Personal modifiers added in late 2026 that browse.wf's dictionary does not have yet: tag ->
// [name, description], from the wiki's Temporal Archimedea update notes. AoeDebuff is Low Yield
// by its meaning (the wiki does not name tags). shortcut: drop entries once the dictionary has them.
const NEW_MODS: Record<string, [string, string]> = {
  AoeDebuff: ['Low Yield', 'Blast radius of weapons with radial attacks set to 3m.'],
  ChannelDrain: [
    'Channeled Greed',
    'While a channeled ability is active, maximum shields and overshields are reduced each second. 10s cooldown to fully recover.'
  ],
  NoPets: ['No Pets Allowed', 'Companions are disabled.']
}

// Strip the game's colour tags and the number placeholders it fills in-game ("reduced by |val|%"),
// which the dictionary leaves unfilled.
export const cleanModText = (t: string): string =>
  t
    .replace(/<[^>]+>/g, '')
    .replace(/\s*(?:by\s*)?\|[A-Za-z_]+\|%?/g, '')
    .trim()

/* eslint-disable @typescript-eslint/no-explicit-any */
// The world state's "Conquests" block -> this week's Deep / Temporal Archimedea, worded the way
// browse.wf/live does it (text from the oracle dictionary; two tags are named differently there).
export function buildConquests(
  conquests: any[] | undefined,
  N: Names,
  now = Date.now()
): Archimedea[] {
  const os = N.os ?? {}
  const ms = (d: any): number => Number(d?.$date?.$numberLong ?? 0)
  const mod = (prefix: string, tag: string): Modifier => {
    const desc = os[prefix + tag + '_Desc']
    return {
      name: os[prefix + tag] ?? NEW_MODS[tag]?.[0] ?? prettyPath(tag),
      desc: desc ? cleanModText(desc) : NEW_MODS[tag]?.[1]
    }
  }
  const risk = (t: string): string => (t === 'EMPBlackHole' ? 'MagneticHounds' : t)
  const variable = (t: string): string =>
    t === 'DullBlades' ? 'ComboCountChance' : t === 'Undersupplied' ? 'MaxAmmo' : t
  const out: Archimedea[] = []
  for (const c of conquests ?? []) {
    if (!(ms(c.Activation) <= now && now < ms(c.Expiry))) continue
    const lab = c.Type === 'CT_LAB'
    if (!lab && c.Type !== 'CT_HEX') continue
    out.push({
      kind: lab
        ? (os['/Lotus/Language/Conquest/SolarMapLabConquestNode'] ?? 'Deep Archimedea')
        : (os['/Lotus/Language/1999Echoes/1999HexConquestNode'] ?? 'Temporal Archimedea'),
      expiry: new Date(ms(c.Expiry)).toISOString(),
      missions: (c.Missions ?? []).map((m: any) => ({
        // the game spells some mission names in capitals ("SURVIVAL"); title-case them like /live
        mission: (
          N.missions[m.missionType] ?? prettyPath(String(m.missionType ?? '').replace(/^MT_/, ''))
        ).replace(/\b([A-Z])([A-Z]+)\b/g, (_: string, a: string, b: string) => a + b.toLowerCase()),
        faction: FACTION_NAMES[m.faction] ?? '',
        deviation: mod(
          `/Lotus/Language/Conquest/MissionVariant_${lab ? 'LabConquest' : 'HexConquest'}_`,
          m.difficulties?.[0]?.deviation ?? ''
        ),
        risks: (m.difficulties?.[1]?.risks ?? []).map((t: string) =>
          mod('/Lotus/Language/Conquest/Condition_', risk(t))
        )
      })),
      variables: (c.Variables ?? []).map((t: string) =>
        mod('/Lotus/Language/Conquest/PersonalMod_', variable(t))
      )
    })
  }
  return out
}
/* eslint-enable @typescript-eslint/no-explicit-any */
interface Lookups {
  itemName: (path: string) => string
  itemImage: (name: string, uniqueName?: string) => string | undefined
  zariman?: Cycle
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// ---- helpers for DE's raw format ----
const date = (d: any): string | undefined => {
  const ms = Number(d?.$date?.$numberLong ?? d?.$date ?? d)
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : undefined
}
const live = (o: any, now = Date.now()): boolean => {
  const a = Date.parse(date(o?.Activation) ?? '')
  const e = Date.parse(date(o?.Expiry) ?? '')
  return (!a || a <= now) && (!e || e > now)
}
const TIERS: Record<string, string> = {
  VoidT1: 'Lith',
  VoidT2: 'Meso',
  VoidT3: 'Neo',
  VoidT4: 'Axi',
  VoidT5: 'Requiem',
  VoidT6: 'Omnia'
}
const HUBS: Record<string, string> = {
  EarthHUB: 'Strata Relay (Earth)',
  MercuryHUB: 'Larunda Relay (Mercury)',
  VenusHUB: 'Vesper Relay (Venus)',
  SaturnHUB: 'Kronia Relay (Saturn)',
  ErisHUB: 'Kuiper Relay (Eris)',
  EuropaHUB: 'Leonov Relay (Europa)',
  PlutoHUB: 'Orcus Relay (Pluto)',
  TennoConHUB: 'TennoCon Relay',
  TradeHUB1: 'Maroo’s Bazaar (Mars)'
}

// "3x Exilus Warframe Adapter" style names plus their pictures
function rewards(L: Lookups, ...rs: any[]): { names: string[]; icons: Record<string, string> } {
  const out: string[] = []
  const icons: Record<string, string> = {}
  for (const r of rs) {
    for (const c of r?.countedItems ?? []) {
      const n = `${c.ItemCount ?? 1}x ${L.itemName(String(c.ItemType ?? ''))}`
      out.push(n)
      const img = L.itemImage(n.replace(/^\d+x /, ''), c.ItemType)
      if (img) icons[n] = img
    }
    for (const i of r?.items ?? []) {
      const n = L.itemName(String(i))
      out.push(n)
      const img = L.itemImage(n, String(i))
      if (img) icons[n] = img
    }
  }
  return { names: out, icons }
}

function stock(L: Lookups, manifest: any[] | undefined): StockItem[] {
  return (manifest ?? []).map((m) => {
    const name = L.itemName(String(m.ItemType ?? ''))
    return {
      name,
      image: L.itemImage(name, m.ItemType),
      ducats: typeof m.PrimePrice === 'number' ? m.PrimePrice : undefined,
      credits: typeof m.RegularPrice === 'number' ? m.RegularPrice : undefined
    }
  })
}

// DE's raw worldState.php JSON -> what the screens show.
export function buildWorldState(ws: any, N: Names, L: Lookups, now = Date.now()): WorldState {
  const node = (id: string): string => N.nodes[id]?.value ?? HUBS[id] ?? id
  const mission = (mt: string): string =>
    N.missions[mt] ??
    mt
      .replace(/^MT_/, '')
      .toLowerCase()
      .replace(/^./, (c) => c.toUpperCase())

  // reward entries: alerts, invasions, events
  const entries: RewardEntry[] = []
  for (const a of ws.Alerts ?? []) {
    if (!live(a, now)) continue
    const r = rewards(L, a.MissionInfo?.missionReward)
    entries.push({
      id: `alert-${a._id?.$oid}`,
      kind: 'alert',
      title: `${mission(a.MissionInfo?.missionType ?? '')} · ${node(a.MissionInfo?.location ?? '')}`,
      rewards: r.names,
      icons: r.icons,
      expiry: date(a.Expiry)
    })
  }
  for (const i of ws.Invasions ?? []) {
    if (i.Completed) continue
    const r = rewards(L, i.AttackerReward, i.DefenderReward)
    entries.push({
      id: `invasion-${i._id?.$oid}`,
      kind: 'invasion',
      title: node(i.Node ?? ''),
      rewards: r.names,
      icons: r.icons
    })
  }
  for (const g of ws.Goals ?? []) {
    if (!live(g, now)) continue
    const r = rewards(L, g.Reward)
    entries.push({
      id: `event-${g._id?.$oid}`,
      kind: 'event',
      title: N.dict[g.Desc] ?? 'Event',
      rewards: r.names,
      icons: r.icons,
      expiry: date(g.Expiry)
    })
  }

  const bounty = (ws.SyndicateMissions ?? []).find((s: any) => s.Tag === 'CetusSyndicate')
  const cetusEnd = date(bounty?.Expiry)
  const cetus = cetusEnd ? cetusCycle(Date.parse(cetusEnd), now) : undefined
  const baro = (ws.VoidTraders ?? [])[0]
  const vault = (ws.PrimeVaultTraders ?? [])[0]
  const circuit =
    (ws.EndlessXpSchedule ?? []).find((c: any) => live(c, now)) ?? (ws.EndlessXpSchedule ?? [])[0]
  const choices = (cat: string): StockItem[] =>
    (circuit?.CategoryChoices?.find((c: any) => c.Category === cat)?.Choices ?? []).map(
      (name: string) => ({ name, image: L.itemImage(name) })
    )
  // Steel Path choices are Incarnon Genesis adapters, named by the weapon's internal name
  // ("CeramicDagger"): show the adapter's own name and picture, found by its game path
  const incarnon = (it: StockItem): StockItem => {
    for (const slot of ['Primary', 'Secondary', 'Melee']) {
      const path = `/Lotus/Types/Items/MiscItems/IncarnonAdapters/${slot}/${it.name}IncarnonUnlocker`
      const image = L.itemImage('', path)
      if (image) return { name: L.itemName(path), image }
    }
    return it
  }

  const data: WorldState = {
    cetus,
    vallis: vallisCycle(now),
    // the Cambion Drift runs on the Plains' clock: day is Fass, night is Vome
    cambion: cetus && { ...cetus, state: cetus.state === 'day' ? 'fass' : 'vome' },
    zariman: L.zariman,
    duviri: duviriCycle(now),
    baro: baro
      ? {
          active: live(baro, now),
          location: node(baro.Node ?? ''),
          activation: date(baro.Activation) ?? '',
          expiry: date(baro.Expiry) ?? '',
          inventory: stock(L, baro.Manifest)
        }
      : undefined,
    sortieExpiry: date(ws.Sorties?.[0]?.Expiry),
    prime: vault
      ? {
          active: live(vault, now),
          expiry: date(vault.Expiry) ?? '',
          items: stock(L, vault.Manifest)
        }
      : undefined,
    circuit: circuit
      ? { warframes: choices('EXC_NORMAL'), weapons: choices('EXC_HARD').map(incarnon) }
      : undefined,
    rewardEntries: entries.filter((e) => e.rewards.length),
    archimedea: buildConquests(ws.Conquests, N, now),
    fissures: [
      ...(ws.ActiveMissions ?? [])
        .filter((f: any) => live(f, now))
        .map((f: any) => ({
          id: String(f._id?.$oid ?? `${f.Node}-${date(f.Expiry)}`),
          node: node(f.Node ?? ''),
          missionType: mission(f.MissionType ?? ''),
          tier: TIERS[f.Modifier] ?? String(f.Modifier ?? ''),
          expiry: date(f.Expiry) ?? '',
          isHard: Boolean(f.Hard),
          isStorm: false
        })),
      ...(ws.VoidStorms ?? [])
        .filter((f: any) => live(f, now))
        .map((f: any) => ({
          id: String(f._id?.$oid ?? `${f.Node}-${date(f.Expiry)}`),
          node: node(f.Node ?? ''),
          missionType: 'Void Storm',
          tier: TIERS[f.ActiveMissionTier] ?? String(f.ActiveMissionTier ?? ''),
          expiry: date(f.Expiry) ?? '',
          isHard: false,
          isStorm: true
        }))
    ],
    fetchedAt: now
  }
  return data
}

// Steel Path incursions from browse.wf's sp-incursions.txt: one line per UTC day,
// "<day start, unix seconds>;<node>,<node>,...". Returns the day that is running now.
export function parseIncursions(
  text: string,
  now = Date.now()
): { nodes: string[]; expiry: string } | undefined {
  let best: { start: number; nodes: string[] } | undefined
  for (const line of text.split(/\r?\n/)) {
    const [ts, list] = line.split(';')
    const start = Number(ts) * 1000
    if (!start || !list || start > now) continue
    if (!best || start > best.start) best = { start, nodes: list.split(',').filter(Boolean) }
  }
  return best && { nodes: best.nodes, expiry: new Date(best.start + 864e5).toISOString() }
}

// Bounty challenge path -> readable text:
// "/Lotus/Types/Challenges/Zariman/ZarimanKillAsOperatorEasyChallenge" -> "Kill As Operator Easy"
export function challengeName(path: string): string {
  const parts = path.split('/')
  const group = parts[parts.length - 2] ?? ''
  return prettyPath(path)
    .replace(/ Challenge$/, '')
    .replace(new RegExp(`^${group} `), '')
}
