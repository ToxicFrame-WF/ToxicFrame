// Our stats history + trade log -> the same JSON layout as AlecaFrame's "Export data as JSON",
// so the file can be read by anything that reads AlecaFrame exports (and by our own import).
import type { Trade } from './tradeStats'
import { localDay } from './localDay.ts'

interface DayStat {
  platinum: number
  credits: number
  ducats: number
  endo: number
  aya: number
  vitus: number
  relicsOpened: number
  mr?: number
  completion?: number
}

const PLAT = { name: '/AF_Special/Platinum', displayName: 'Platinum', rank: -1 }

export function toAlecaFrame(
  days: Record<string, DayStat>,
  trades: Trade[],
  nameOf: (itemId: string) => string | undefined,
  now = new Date()
): unknown {
  const perDay = new Map<string, number>()
  for (const t of trades) {
    const d = localDay(new Date(t.at))
    perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }
  let prev: number | undefined
  const generalDataPoints = Object.keys(days)
    .sort()
    .map((day) => {
      const s = days[day]
      const point = {
        ts: `${day}T00:00:00.000Z`,
        plat: s.platinum,
        credits: s.credits,
        endo: s.endo,
        ducats: s.ducats,
        aya: s.aya,
        vitus: s.vitus || null,
        relicOpened: s.relicsOpened,
        trades: perDay.get(day) ?? 0,
        mr: s.mr ?? null,
        percentageCompletion: s.completion ?? null,
        ...(prev != null ? { platGain: s.platinum - prev } : {})
      }
      prev = s.platinum
      return point
    })

  const exportTrades = [...trades]
    .sort((a, b) => a.at - b.at)
    .map((t) => {
      const total = Math.round(t.platinum * t.quantity)
      const item = {
        name: t.path && t.path !== 'set' ? t.path : t.itemId || t.name || '',
        displayName: t.name ?? nameOf(t.itemId) ?? 'Unknown item',
        cnt: t.quantity,
        rank: -1
      }
      const plat = { ...PLAT, cnt: total }
      const type = t.type === 'sell' ? 0 : t.type === 'buy' ? 1 : 2
      // imported and swap trades keep both sides in full: write them back as they came
      if (t.gave || t.got) {
        const side = (list: typeof t.gave, p?: number): unknown[] => [
          ...(list ?? []).map((i) => ({
            name: i.path ?? i.name,
            displayName: i.name,
            cnt: i.count,
            rank: i.rank ?? -1,
            ...(i.picture ? { picture: i.picture } : {})
          })),
          ...(p ? [{ ...PLAT, cnt: p }] : [])
        ]
        return {
          ts: new Date(t.at).toISOString(),
          tx: side(t.gave, t.platGave),
          rx: side(t.got, t.platGot),
          user: t.user ?? '',
          type,
          totalPlat: type === 2 ? 0 : total
        }
      }
      return {
        ts: new Date(t.at).toISOString(),
        tx: [t.type === 'sell' ? item : plat],
        rx: [t.type === 'sell' ? plat : item],
        user: t.user ?? '',
        type,
        totalPlat: total
      }
    })

  return { generalDataPoints, trades: exportTrades, lastUpdate: now.toISOString() }
}
