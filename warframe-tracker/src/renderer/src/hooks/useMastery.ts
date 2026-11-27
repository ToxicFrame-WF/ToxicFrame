import { useEffect, useMemo, useState } from 'react'
import * as cache from '../apiCache'
import { useInventory } from './useInventory'
import { rankFromXp } from '../masteryMath'
import { useSettings } from '../settings'

const FOUNDERS = ['Excalibur Prime', 'Skana Prime', 'Lato Prime']

// Joins the mastery catalog (from the main process) with the owned inventory to produce everything
// the Mastery helper page shows. All the Warframe-specific rules live here.
//
// Rank from affinity (confirmed against live data): rank = floor(sqrt(xp / base)), base 1000 for
// frames/companions and 500 for weapons, capped at the item's max rank. Mastery points earned for an
// item = rank * pointsPerRank (200 frames/companions, 100 weapons). Mastery rank R needs 2500*R^2
// points in total; the step to the next rank is 2500*(2R+1).

export interface MasteryRow {
  item: MasteryItem
  owned: boolean
  rank: number // current rank from affinity (0..maxRank)
  mastered: boolean // reached max rank (counts even if the item was sold)
  earned: number // mastery points already earned from it
  remaining: number // points still available by maxing it
}

export interface MasterySummary {
  rank: number | null // mastery rank (from the game when available)
  points: number // total mastery points counted here
  within: number // points into the current rank
  toNext: number // points the current rank spans
  content: Record<MasteryGroup, { mastered: number; total: number }>
  starchart: {
    normalDone: number
    normalTotal: number
    spDone: number
    spTotal: number
    junctionsDone: number
    junctionsTotal: number
    spJunctionsDone: number
    spJunctionsTotal: number
  }
  intrinsics: { railjack: number; railjackTotal: number; duviri: number; duviriTotal: number }
}

export interface Mastery {
  ready: boolean
  rows: MasteryRow[]
  summary: MasterySummary
}

const RAILJACK_KEYS = [
  'LPS_TACTICAL',
  'LPS_PILOTING',
  'LPS_ENGINEERING',
  'LPS_GUNNERY',
  'LPS_COMMAND'
]
const DUVIRI_KEYS = [
  'LPS_DRIFT_RIDING',
  'LPS_DRIFT_COMBAT',
  'LPS_DRIFT_OPPORTUNITY',
  'LPS_DRIFT_ENDURANCE'
]

let starchartPromise: Promise<StarchartData | null> | null = null

function asArray(v: unknown): { ItemType?: string; XP?: number }[] {
  return Array.isArray(v) ? v : []
}
function asRecord(v: unknown): Record<string, number> {
  return v && typeof v === 'object' ? (v as Record<string, number>) : {}
}
function num(v: unknown): number {
  return typeof v === 'number' ? v : 0
}

export function useMastery(): Mastery {
  const inv = useInventory()
  const { hideFounders, formaLevels } = useSettings()
  const [catalog, setCatalog] = useState<MasteryCatalog | null>(null)
  const [star, setStar] = useState<StarchartData | null>(null)

  useEffect(() => {
    const request = cache.masteryCatalog()
    request.then(setCatalog)
    const sc = starchartPromise ?? (starchartPromise = window.api.getStarchartData())
    sc.then(setStar)
  }, [])

  return useMemo((): Mastery => {
    const raw = inv.data?.raw ?? {}
    const empty: MasterySummary = {
      rank: inv.data?.masteryRank ?? null,
      points: 0,
      within: 0,
      toNext: 0,
      content: {
        frame: { mastered: 0, total: 0 },
        weapon: { mastered: 0, total: 0 },
        companion: { mastered: 0, total: 0 }
      },
      starchart: {
        normalDone: 0,
        normalTotal: 0,
        spDone: 0,
        spTotal: 0,
        junctionsDone: 0,
        junctionsTotal: 0,
        spJunctionsDone: 0,
        spJunctionsTotal: 0
      },
      intrinsics: { railjack: 0, railjackTotal: 50, duviri: 0, duviriTotal: 40 }
    }
    if (!catalog) return { ready: false, rows: [], summary: empty }

    // affinity per item, from XPInfo (covers items already sold too)
    const xpByType = new Map<string, number>()
    for (const e of asArray(raw.XPInfo)) if (e.ItemType) xpByType.set(e.ItemType, num(e.XP))

    // owned unique names, from the per-category ownership lists
    const ownedTypes = new Set<string>()
    for (const key of new Set(catalog.items.map((i) => i.productCategory)))
      for (const e of asArray(raw[key])) if (e.ItemType) ownedTypes.add(e.ItemType)

    const rows: MasteryRow[] = []
    const content = {
      frame: { mastered: 0, total: catalog.totals.frame },
      weapon: { mastered: 0, total: catalog.totals.weapon },
      companion: { mastered: 0, total: catalog.totals.companion }
    }
    let itemPoints = 0

    for (const item of catalog.items) {
      const xp = xpByType.get(item.uniqueName) ?? 0
      const owned = ownedTypes.has(item.uniqueName)
      if (hideFounders && !owned && xp === 0 && FOUNDERS.includes(item.name)) {
        content[item.group].total -= 1
        continue
      }
      const maxRank = formaLevels ? item.maxRank : Math.min(30, item.maxRank)
      const rank = rankFromXp(xp, item.group, maxRank)
      const mastered = rank >= maxRank
      const earned = rank * item.pointsPerRank
      itemPoints += earned
      if (mastered) content[item.group].mastered += 1
      rows.push({
        item,
        owned,
        rank,
        mastered,
        earned,
        remaining: (maxRank - rank) * item.pointsPerRank
      })
    }

    // star chart: each completed node (and its Steel Path copy, Tier 1) grants mastery. Node values
    // come from DE's ExportRegions (via `star`); without it we fall back to node counts only.
    const missions = asArray(raw.Missions) as { Tag?: string; Tier?: number }[]
    let normalDone = 0
    let spDone = 0
    let junctionsDone = 0
    let spJunctionsDone = 0
    let starPoints = 0
    const seenNormal = new Set<string>()
    const seenSp = new Set<string>()
    for (const m of missions) {
      if (!m.Tag) continue
      const node = star?.nodes[m.Tag]
      if (star && !node) continue // unknown or non-mastery node
      const xp = node?.xp ?? 0
      const junction = node?.junction ?? false
      // any completion implies the normal node is done
      if (!seenNormal.has(m.Tag)) {
        seenNormal.add(m.Tag)
        if (junction) junctionsDone += 1
        else normalDone += 1
        starPoints += xp
      }
      // Tier 1 marks the Steel Path copy, worth the same again
      if (m.Tier === 1 && !seenSp.has(m.Tag)) {
        seenSp.add(m.Tag)
        if (junction) spJunctionsDone += 1
        else spDone += 1
        starPoints += xp
      }
    }
    const starchart = {
      normalDone,
      normalTotal: star?.normalCount ?? catalog.nodes.normal,
      spDone,
      spTotal: star?.normalCount ?? catalog.nodes.steelPath,
      junctionsDone,
      junctionsTotal: star?.junctionCount ?? 0,
      spJunctionsDone,
      spJunctionsTotal: star?.junctionCount ?? 0
    }

    // intrinsics: Railjack + Duviri skill ranks
    const skills = {
      ...asRecord(raw.PlayerSkills),
      ...asRecord(raw.PlayerIntrinsics),
      ...asRecord(raw.ParadoxIntrinsics)
    }
    const sumRanks = (keys: string[]): number =>
      keys.reduce((s, k) => s + Math.min(10, num(skills[k])), 0)
    const railjack = sumRanks(RAILJACK_KEYS)
    const duviri = sumRanks(DUVIRI_KEYS)
    const intrinsicPoints = (railjack + duviri) * 1500

    const points = itemPoints + intrinsicPoints + starPoints
    const rankNum = inv.data?.masteryRank ?? null
    // progress within the current rank. The rank number itself comes from the game; the bar is the
    // sum of item, intrinsic and star-chart points (the last needs ExportRegions, see starchart.ts).
    const R = rankNum ?? 0
    const threshold = 2500 * R * R
    const toNext = 2500 * (2 * R + 1)
    const within = Math.max(0, Math.min(toNext, points - threshold))

    return {
      ready: true,
      rows,
      summary: {
        rank: rankNum,
        points,
        within,
        toNext,
        content,
        starchart,
        intrinsics: { railjack, railjackTotal: 50, duviri, duviriTotal: 40 }
      }
    }
  }, [inv.data, catalog, star, hideFounders, formaLevels])
}
