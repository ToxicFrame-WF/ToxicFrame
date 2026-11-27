import { app, net } from 'electron'
import { join } from 'path'
import { loadNames } from './worldState'
import { NO_NAMES, type Names } from './worldMath'
import { readFileSync, writeFileSync } from 'fs'

export interface ArbitrationSlot {
  id: string
  name: string // "Ur (Uranus)"
  type: string // "Defense"
  enemy: string // "Corpus"
  tier?: string // community grade S/A/B/C/D/F, missing when unrated
  start: number // unix seconds
  end: number
}
export interface ArbitrationInfo {
  current?: ArbitrationSlot
  upcoming: ArbitrationSlot[]
}

// The hour-by-hour arbitration schedule from browse.wf (credit: https://browse.wf).
const SCHEDULE_URL = 'https://browse.wf/arbys.txt'
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const SLOT_SECONDS = 3600
const UA = 'ToxicFrame/0.1 (Warframe companion app)'

// Community tier list (credit: the Arbitration Goons, via browse.wf).
const TIERS_URL = 'https://browse.wf/supplemental-data/arbyTiers.js'
let tiers: Record<string, string> | null = null
let tiersLoadedAt = 0
const tiersCacheFile = (): string => join(app.getPath('userData'), 'arby-tiers.js')

function parseTiers(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  // lines look like:  SolNode450: "S",
  for (const m of text.matchAll(/^\s*([A-Za-z]+Node\d+)\s*:\s*"([SABCDF])"/gm)) out[m[1]] = m[2]
  return out
}

async function loadTiers(): Promise<Record<string, string>> {
  if (tiers && Date.now() - tiersLoadedAt < MAX_AGE_MS) return tiers
  try {
    const res = await net.fetch(TIERS_URL, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`tiers returned ${res.status}`)
    const text = await res.text()
    const parsed = parseTiers(text)
    if (Object.keys(parsed).length) {
      try {
        writeFileSync(tiersCacheFile(), text)
      } catch {
        // not critical
      }
      tiersLoadedAt = Date.now()
      return (tiers = parsed)
    }
  } catch (e) {
    console.error('Could not load the arbitration tier list:', e)
  }
  if (tiers)
    tiersLoadedAt = Date.now() - MAX_AGE_MS + 60 * 60 * 1000 // stale copy: retry in an hour
  else {
    try {
      tiers = parseTiers(readFileSync(tiersCacheFile(), 'utf8'))
      tiersLoadedAt = Date.now() - MAX_AGE_MS + 60 * 60 * 1000 // try again in an hour
    } catch {
      tiers = {} // unrated for now
      tiersLoadedAt = Date.now() - MAX_AGE_MS + 60 * 60 * 1000
    }
  }
  return tiers
}

let schedule: [number, string][] | null = null
let loadedAt = 0
type NodeTable = Names['nodes']

const cacheFile = (): string => join(app.getPath('userData'), 'arbys.txt')

// Every line is "<unix time>,<node id>", one per hour.
function parse(text: string): [number, string][] {
  const out: [number, string][] = []
  for (const line of text.split('\n')) {
    const [t, id] = line.trim().split(',')
    const ts = Number(t)
    if (ts && id) out.push([ts, id])
  }
  return out
}

async function loadSchedule(): Promise<[number, string][] | null> {
  if (schedule && Date.now() - loadedAt < MAX_AGE_MS) return schedule
  try {
    const res = await net.fetch(SCHEDULE_URL, {
      headers: { 'User-Agent': 'ToxicFrame/0.1 (personal hobby tracker)' }
    })
    if (!res.ok) throw new Error(`schedule returned ${res.status}`)
    const text = await res.text()
    const parsed = parse(text)
    if (parsed.length) {
      schedule = parsed
      loadedAt = Date.now()
      try {
        writeFileSync(cacheFile(), text)
      } catch {
        // not critical
      }
      return schedule
    }
  } catch (e) {
    console.error('Could not load arbitration schedule:', e)
  }
  if (schedule)
    loadedAt = Date.now() - MAX_AGE_MS + 60 * 60 * 1000 // stale copy: retry in an hour
  else {
    try {
      schedule = parse(readFileSync(cacheFile(), 'utf8'))
      loadedAt = Date.now() - MAX_AGE_MS + 60 * 60 * 1000 // try the network again in an hour
    } catch {
      // no saved copy either
    }
  }
  return schedule
}

// Node ids -> readable names, mission type and faction: the same browse.wf table world state uses.
const loadNodes = async (): Promise<NodeTable> => (await loadNames().catch(() => NO_NAMES)).nodes

export async function getArbitrations(): Promise<ArbitrationInfo> {
  const sched = await loadSchedule()
  if (!sched) return { upcoming: [] }
  const names = await loadNodes()
  const grades = await loadTiers()
  const nowSec = Math.floor(Date.now() / 1000)

  // first slot that has not ended yet
  const i = sched.findIndex(([t]) => t + SLOT_SECONDS > nowSec)
  if (i === -1) return { upcoming: [] }

  const slots: ArbitrationSlot[] = sched.slice(i, i + 6).map(([t, id]) => {
    const n = names[id]
    return {
      id,
      name: n?.value ?? id,
      type: n?.type ?? '',
      enemy: n?.enemy ?? '',
      tier: grades[id],
      start: t,
      end: t + SLOT_SECONDS
    }
  })
  const current = slots[0].start <= nowSec ? slots[0] : undefined
  return { current, upcoming: current ? slots.slice(1) : slots }
}

// Every slot from the current hour to a week ahead (for the Schedule page). The first entry may be
// the slot that is running right now.
export async function getArbitrationForecast(days = 8): Promise<ArbitrationSlot[]> {
  const sched = await loadSchedule()
  if (!sched) return []
  const names = await loadNodes()
  const grades = await loadTiers()
  const nowSec = Math.floor(Date.now() / 1000)
  const limit = nowSec + days * 86400
  return sched
    .filter(([t]) => t + SLOT_SECONDS > nowSec && t < limit)
    .map(([t, id]) => {
      const n = names[id]
      return {
        id,
        name: n?.value ?? id,
        type: n?.type ?? '',
        enemy: n?.enemy ?? '',
        tier: grades[id],
        start: t,
        end: t + SLOT_SECONDS
      }
    })
}
