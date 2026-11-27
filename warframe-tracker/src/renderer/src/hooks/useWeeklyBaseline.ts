import { useEffect, useMemo } from 'react'
import { useInventory } from './useInventory'
import { usePersisted } from './usePersisted'
import { useNow } from './useWorldState'
import { weekKey, weeklyCounts, weekStatus, type WeeklyStart, type WeeklyTicks } from '../weekly'

// Runs app-wide (App.tsx), whatever page is open: records the weekly comparison point (the
// first inventory of the week) and whether Endgame was cleared, for the streak.
export function useWeeklyBaseline(): void {
  const inv = useInventory()
  const now = useNow(60_000)
  const week = weekKey(now)
  const [start, setStart] = usePersisted<WeeklyStart>('Weekly.start', null)
  const [ticks] = usePersisted<WeeklyTicks>('Weekly.ticks', { week, on: [], off: [] })
  const [hidden] = usePersisted<string[]>('Weekly.hidden', [])
  const [custom] = usePersisted<{ id: string; label: string }[]>('Weekly.custom', [])
  const [bothArchimedeas] = usePersisted('Weekly.bothArchimedeas', false)
  const [eliteRewards] = usePersisted('Weekly.eliteRewards', false)
  const [history, setHistory] = usePersisted<Record<string, boolean>>('Weekly.history', {})

  const counts = useMemo(() => {
    const misc = inv.data?.raw?.MiscItems
    return Array.isArray(misc)
      ? weeklyCounts(misc as { ItemType?: string; ItemCount?: number }[])
      : null
  }, [inv.data])
  const fetchedAt = inv.data?.fetchedAt ?? 0
  useEffect(() => {
    if (!counts || fetchedAt < Date.parse(week + 'T00:00:00Z')) return
    if (start?.week !== week) setStart({ week, counts })
    else if (Object.keys(counts).some((k) => !(k in start.counts)))
      setStart({ week, counts: { ...counts, ...start.counts } })
  }, [counts, start, week, setStart, fetchedAt])

  const endgameDone = weekStatus({
    week,
    counts,
    start,
    ticks,
    hidden,
    custom,
    bothArchimedeas,
    eliteRewards
  }).groupDone('Endgame')
  useEffect(() => {
    if (!!history[week] !== endgameDone) setHistory((h) => ({ ...h, [week]: endgameDone }))
  }, [endgameDone, week, history, setHistory])
}
