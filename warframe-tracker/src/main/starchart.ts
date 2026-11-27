// Star-chart mastery data from DE's public export (ExportRegions), used to score the player's
// completed nodes toward mastery rank. Fetched once and cached ~30 days, like planetIcons.
//
// Each regular node (nodeType 0) grants its masteryExp on first completion, and the same again on
// Steel Path. Junctions (nodeType 7) grant a flat amount each (their masteryExp is 0 in the export,
// so we use the community-known 1000), on normal and again on Steel Path.

import { app, net } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const URL = 'https://browse.wf/warframe-public-export-plus/ExportRegions.json'
const JUNCTION_XP = 1000
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const file = (): string => join(app.getPath('userData'), 'starchart.json')

export interface StarchartData {
  // node id (matches a Missions "Tag") -> its mastery value and whether it is a junction
  nodes: Record<string, { xp: number; junction: boolean }>
  normalCount: number // regular nodes that grant mastery
  normalXpTotal: number // their summed masteryExp
  junctionCount: number
  junctionXpEach: number
}

let cache: StarchartData | null = null

function build(raw: Record<string, { nodeType?: number; masteryExp?: number }>): StarchartData {
  const nodes: StarchartData['nodes'] = {}
  let normalCount = 0
  let normalXpTotal = 0
  let junctionCount = 0
  for (const [id, n] of Object.entries(raw)) {
    if (n.nodeType === 0 && (n.masteryExp ?? 0) > 0) {
      nodes[id] = { xp: n.masteryExp ?? 0, junction: false }
      normalCount += 1
      normalXpTotal += n.masteryExp ?? 0
    } else if (n.nodeType === 7) {
      nodes[id] = { xp: JUNCTION_XP, junction: true }
      junctionCount += 1
    }
  }
  return { nodes, normalCount, normalXpTotal, junctionCount, junctionXpEach: JUNCTION_XP }
}

export async function getStarchartData(): Promise<StarchartData | null> {
  if (cache) return cache

  let stale: StarchartData | null = null // too old, but better than nothing when offline
  try {
    const saved = JSON.parse(readFileSync(file(), 'utf8')) as { at: number; data: StarchartData }
    if (saved.data?.normalCount > 0) {
      if (Date.now() - saved.at < MAX_AGE_MS) return (cache = saved.data)
      stale = saved.data
    }
  } catch {
    // nothing saved yet
  }

  try {
    const res = await net.fetch(URL, { headers: { 'User-Agent': 'ToxicFrame/0.1' } })
    if (!res.ok) return stale
    const raw = (await res.json()) as Record<string, { nodeType?: number; masteryExp?: number }>
    const data = build(raw)
    if (data.normalCount > 0) {
      cache = data
      try {
        writeFileSync(file(), JSON.stringify({ at: Date.now(), data }))
      } catch {
        // not critical
      }
    }
    return cache ?? stale
  } catch {
    return stale // offline: the old copy, or null so the page falls back to node counts
  }
}
