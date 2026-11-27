// One row per day (UTC). Balances are the last values seen that day; relics opened is the sum of
// every drop in your total relic count between refreshes.
// shortcut: a drop also counts relics you sold or traded away, until trades are read from EE.log.
export { localDay } from '../renderer/src/localDay.ts'

export interface DayStat {
  platinum: number
  credits: number
  ducats: number
  endo: number
  aya: number
  vitus: number
  relicsOpened: number
  mr?: number // mastery rank that day (from AlecaFrame imports)
  completion?: number // prime completion % that day (from AlecaFrame imports)
}
export interface StatsHistory {
  days: Record<string, DayStat>
  lastRelics?: number // total relic count at the previous snapshot
}

export function applySnapshot(
  h: StatsHistory,
  day: string,
  balances: Omit<DayStat, 'relicsOpened'>,
  relicTotal: number
): StatsHistory {
  const opened = h.lastRelics != null ? Math.max(0, h.lastRelics - relicTotal) : 0
  const prev = h.days[day]
  return {
    days: {
      ...h.days,
      [day]: { ...prev, ...balances, relicsOpened: (prev?.relicsOpened ?? 0) + opened }
    },
    lastRelics: relicTotal
  }
}
