// Electron-free part of inventory.ts (so tests can import it).
const STATE_BY_SUFFIX: Record<string, string> = {
  Bronze: 'Intact',
  Silver: 'Exceptional',
  Gold: 'Flawless',
  Platinum: 'Radiant'
}
const RELIC = /^(\/Lotus\/Types\/Game\/Projections\/.+)(Bronze|Silver|Gold|Platinum)$/

export interface InventoryData {
  fetchedAt: number
  masteryRank: number | null
  // relic id (the Intact unique name, same as RelicSummary.id) -> refinement -> count
  relics: Record<string, Record<string, number>>
  // raw inventory sections from the helper (XPInfo, Suits, Missions, ...), for the mastery page
  raw: Record<string, unknown>
}

export interface HelperOutput {
  relics?: { ItemType?: string; ItemCount?: number }[]
  mastery?: { rank?: number | null }
  inventory?: Record<string, unknown>
}

export function toData(out: HelperOutput, fetchedAt: number): InventoryData {
  const relics: Record<string, Record<string, number>> = {}
  for (const r of out.relics ?? []) {
    const m = RELIC.exec(r.ItemType ?? '')
    if (!m || !r.ItemCount) continue // zero-count rows own nothing: skipped on purpose
    const id = m[1] + 'Bronze'
    const states = (relics[id] ??= {})
    const state = STATE_BY_SUFFIX[m[2]]
    states[state] = (states[state] ?? 0) + r.ItemCount
  }
  const rank = out.mastery?.rank
  return {
    fetchedAt,
    masteryRank: typeof rank === 'number' ? rank : null,
    relics,
    raw: out.inventory ?? {}
  }
}
