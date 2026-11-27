import { app } from 'electron'
import { join } from 'path'
import { copyFileSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { applySnapshot, localDay, type StatsHistory } from './statsMath'

// Saves one stats row per day each time the inventory refreshes, for the Stats page.
const file = (): string => join(app.getPath('userData'), 'stats-history.json')
const AYA = '/Lotus/Types/Items/MiscItems/SchismKey'
const VITUS = '/Lotus/Types/Items/MiscItems/Elitium'
const DUCATS = '/Lotus/Types/Items/MiscItems/PrimeBucks' // not PrimeTokens, which is another currency

export function getStatsHistory(): StatsHistory {
  let text: string
  try {
    text = readFileSync(file(), 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { days: {} }
    throw e // locked or unreadable: an empty history here would be saved over the real one
  }
  try {
    const h = JSON.parse(text) as StatsHistory
    if (h && typeof h.days === 'object') return h
  } catch {
    // broken JSON: falls through
  }
  // a file that reads but is broken is kept as .bak before anything overwrites it
  copyFileSync(file(), `${file()}.bak-${Date.now()}`)
  return { days: {} }
}

export function recordSnapshot(raw: Record<string, unknown>, relicTotal: number): void {
  const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
  const misc = Array.isArray(raw.MiscItems)
    ? (raw.MiscItems as { ItemType?: string; ItemCount?: number }[])
    : []
  const count = (id: string): number => misc.find((m) => m.ItemType === id)?.ItemCount ?? 0
  try {
    const next = applySnapshot(
      getStatsHistory(),
      localDay(),
      {
        platinum: num(raw.PremiumCredits),
        credits: num(raw.RegularCredits),
        ducats: count(DUCATS),
        endo: num(raw.FusionPoints),
        aya: count(AYA),
        vitus: count(VITUS)
      },
      relicTotal
    )
    saveStatsHistory(next)
  } catch {
    // not critical: the next refresh tries again
  }
}

// write a temp file and swap it in, so a crash mid-write can't leave a broken history
export function saveStatsHistory(h: StatsHistory): void {
  writeFileSync(file() + '.tmp', JSON.stringify(h))
  renameSync(file() + '.tmp', file())
}
