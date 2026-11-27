import { app, net } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { findItemImage, findItemName } from './gameData'
import {
  buildWorldState,
  challengeName,
  parseIncursions,
  NO_NAMES,
  prettyPath,
  rollCycles,
  type Cycle,
  type Names,
  type WorldState
} from './worldMath'

export type { Cycle, Fissure, RewardEntry, StockItem, WorldState } from './worldMath'

// World state straight from DE's official feed (the one the game reads), with names from
// browse.wf's copy of the game data (ExportRegions for nodes and mission types, dict.en for
// texts). No third-party world-state service in between.
const FEED = 'https://api.warframe.com/cdn/worldState.php'
const BROWSE = 'https://browse.wf/warframe-public-export-plus/'
const UA = { 'User-Agent': 'ToxicFrame/0.1 (personal hobby tracker)' }

const MAX_AGE_MS = 60 * 1000
let cache: { at: number; data: WorldState } | null = null

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- browse.wf name data (node names, mission names, texts), kept on disk for a week ----
const FACTION: Record<string, string> = {
  FC_GRINEER: 'Grineer',
  FC_CORPUS: 'Corpus',
  FC_INFESTATION: 'Infested',
  FC_OROKIN: 'Orokin',
  FC_MITW: 'The Murmur',
  FC_SENTIENT: 'Sentient',
  FC_SCALDRA: 'Scaldra',
  FC_TECHROT: 'Techrot',
  FC_DUVIRI: 'Duviri',
  FC_TENNO: 'Tenno'
}
const NAMES_FILE = 'worldstate-names-5.json' // -5: all mission names in title case
// the dictionary has mission names in capitals; title case matches MISSION_TYPES and reads better
const titleCase = (s = ''): string => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
const NAMES_AGE = 7 * 24 * 60 * 60 * 1000
let names: Promise<Names> | null = null
let saved: { at: number; data: Names } | undefined // the copy on disk, even when too old

export function loadNames(): Promise<Names> {
  return (names ??= (async () => {
    const file = join(app.getPath('userData'), NAMES_FILE)
    try {
      saved = JSON.parse(readFileSync(file, 'utf8'))
      if (Date.now() - saved!.at < NAMES_AGE) return saved!.data
    } catch {
      // nothing saved yet
    }
    const get = async (n: string): Promise<any> => {
      const res = await net.fetch(BROWSE + n, { headers: UA })
      if (!res.ok) throw new Error(`${n} returned ${res.status}`)
      return res.json()
    }
    const [regions, dict] = await Promise.all([get('ExportRegions.json'), get('dict.en.json')])
    const nodes: Names['nodes'] = {}
    const missions: Record<string, string> = {}
    for (const [id, r] of Object.entries<any>(regions)) {
      const node = dict[r.name] ?? id
      const system = dict[r.systemName]?.replace(/ Proxima$/, '')
      nodes[id] = {
        value: system ? `${node} (${system})` : node,
        type: titleCase(dict[r.missionName]),
        enemy: FACTION[r.faction] ?? ''
      }
      if (r.missionType && dict[r.missionName])
        missions[r.missionType] ??= titleCase(dict[r.missionName])
    }
    // only the texts events use, not the whole 4 MB dictionary
    const keep: Record<string, string> = {}
    for (const [k, v] of Object.entries<string>(dict))
      if (/\/Lotus\/Language\/(G1Quests|Events|Alerts|Menu)\//.test(k)) keep[k] = v
    // extras (a failure only costs the nicer wording): every mission type's name, the in-game
    // text of bounty challenges, and the oracle dictionary with the Archimedea modifiers
    const [types, challengeList, osdict] = await Promise.all([
      get('ExportMissionTypes.json').catch(() => ({})),
      get('ExportChallenges.json').catch(() => ({})),
      net
        .fetch('https://oracle.browse.wf/dicts/en.json', { headers: UA })
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}))
    ])
    for (const [mt, t] of Object.entries<any>(types))
      if (dict[t?.name]) missions[mt] ??= titleCase(dict[t.name])
    const challenges: Record<string, string> = {}
    for (const [path, c] of Object.entries<any>(challengeList)) {
      const text = dict[c?.description]?.split('\r\n').pop()
      if (text) challenges[path] = text.split('|COUNT|').join(String(c.requiredCount ?? ''))
    }
    const os: Record<string, string> = {}
    for (const [k, v] of Object.entries<string>(osdict as Record<string, string>))
      if (/Conquest/.test(k)) os[k] = v
    const data: Names = { nodes, missions, dict: keep, challenges, os }
    try {
      writeFileSync(file, JSON.stringify({ at: Date.now(), data }))
    } catch {
      // not critical
    }
    return data
  })().catch((e) => {
    names = null // try again next time
    if (saved?.data) return saved.data // old names beat raw node ids while offline
    throw e
  }))
}

// browse.wf's "oracle" (credit: https://browse.wf): Zariman faction, every syndicate's bounties and
// invasion mission types. Plus the daily Steel Path incursions. Cached a few minutes.
const ORACLE = 'https://oracle.browse.wf/'
const INCURSIONS = 'https://browse.wf/sp-incursions.txt'
const SYNDICATES: Record<string, string> = {
  CetusSyndicate: 'Ostrons',
  SolarisSyndicate: 'Solaris United',
  EntratiSyndicate: 'Entrati',
  ZarimanSyndicate: 'The Holdfasts',
  EntratiLabSyndicate: 'Cavia',
  HexSyndicate: 'The Hex'
}
interface Oracle {
  zariman?: Cycle
  bounties?: WorldState['bounties']
  invasionTypes: Map<string, string[]> // invasion id -> mission types
  incursions?: WorldState['incursions']
}
let oracleCache: { at: number; data: Oracle } | null = null

async function getJson(url: string): Promise<any> {
  const res = await net.fetch(url, { headers: { Accept: 'application/json', ...UA } })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return res.json()
}

async function fetchOracle(
  nodeName: (id: string) => string,
  nodeType: (id: string) => string,
  challengeText: Record<string, string> = {}
): Promise<Oracle> {
  if (oracleCache && Date.now() - oracleCache.at < 5 * 60 * 1000) return oracleCache.data
  const data: Oracle = { invasionTypes: new Map() }
  const [bounty, invasions, incursions] = await Promise.allSettled([
    getJson(ORACLE + 'bounty-cycle'),
    getJson(ORACLE + 'invasions'),
    net.fetch(INCURSIONS, { headers: UA }).then((r) => (r.ok ? r.text() : ''))
  ])
  if (bounty.status === 'fulfilled' && bounty.value?.expiry) {
    const b = bounty.value
    const expiry = new Date(b.expiry < 1e11 ? b.expiry * 1000 : b.expiry).toISOString()
    if (b.zarimanFaction)
      data.zariman = { state: b.zarimanFaction === 'FC_GRINEER' ? 'grineer' : 'corpus', expiry }
    data.bounties = Object.entries<any[]>(b.bounties ?? {}).map(([tag, list]) => ({
      syndicate: SYNDICATES[tag] ?? prettyPath(tag.replace(/Syndicate$/, '')),
      expiry,
      list: (list ?? []).map((x) => ({
        node: nodeName(String(x.node ?? '')),
        challenge: challengeText[x.challenge] ?? challengeName(String(x.challenge ?? ''))
      }))
    }))
  } else if (bounty.status === 'rejected')
    console.error('browse.wf oracle bounties:', bounty.reason)
  if (invasions.status === 'fulfilled')
    for (const inv of invasions.value?.invasions ?? [])
      if (inv.id && Array.isArray(inv.missions))
        data.invasionTypes.set(String(inv.id), inv.missions)
  if (incursions.status === 'fulfilled' && incursions.value) {
    const today = parseIncursions(incursions.value)
    if (today)
      data.incursions = {
        nodes: today.nodes.map(nodeName),
        types: today.nodes.map(nodeType),
        expiry: today.expiry
      }
  }
  oracleCache = { at: Date.now(), data }
  return data
}

export async function getWorldState(): Promise<WorldState | null> {
  if (cache && Date.now() - cache.at < MAX_AGE_MS) {
    // the cycles must roll over on time, not wait for the cached minute to end
    return rollCycles(cache.data)
  }
  try {
    // names are a nice-to-have: without browse.wf the screens show raw node ids instead of nothing
    const [res, n] = await Promise.all([
      net.fetch(FEED, { headers: UA }),
      loadNames().catch((e) => {
        console.error('Could not load browse.wf names:', e)
        return NO_NAMES
      })
    ])
    if (!res.ok) throw new Error(`DE world state returned ${res.status}`)
    const ws: any = await res.json()
    const oracle = await fetchOracle(
      (id) => n.nodes[id]?.value ?? id,
      (id) => n.nodes[id]?.type ?? '',
      n.challenges
    )
    const data = buildWorldState(ws, n, {
      itemName: (path) => findItemName(path) ?? prettyPath(path),
      itemImage: findItemImage,
      zariman: oracle.zariman
    })
    data.bounties = oracle.bounties
    data.incursions = oracle.incursions
    // invasion titles get their mission types, e.g. "Kiliken (Venus) · Exterminate / Sabotage"
    for (const e of data.rewardEntries) {
      const types =
        e.kind === 'invasion' && oracle.invasionTypes.get(e.id.replace(/^invasion-/, ''))
      if (types) e.title += ` · ${[...new Set(types)].join(' / ')}`
    }
    cache = { at: Date.now(), data }
    return data
  } catch (e) {
    console.error('Could not load world state:', e)
    return cache?.data ?? null
  }
}
