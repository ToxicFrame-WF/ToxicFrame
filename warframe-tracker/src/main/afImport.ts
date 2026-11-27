// AlecaFrame "Export data as JSON" -> our stats history and trade log. Pure (no electron) for tests.
import type { DayStat, StatsHistory } from './statsMath'

export interface TradeStack {
  name: string // display name
  count: number
  path?: string // game path (or AlecaFrame's own), for categories
  rank?: number // mod / arcane rank, -1 or missing when it has none
  picture?: string // picture from the export, for items warframe.market does not list
}
export interface Trade {
  at: number
  type: 'sell' | 'buy' | 'trade' // trade = items for items, no net platinum
  itemId: string // warframe.market id; '' for imported trades
  platinum: number // per unit, net platinum of the trade
  quantity: number
  name?: string // imported trades carry their own name, category path and partner
  path?: string
  user?: string
  gave?: TradeStack[] // everything given / received apart from platinum (imports, swaps)
  got?: TradeStack[]
  platGave?: number
  platGot?: number
}

interface AfItem {
  name?: string
  displayName?: string
  cnt?: number
  rank?: number
  picture?: string
}
interface AfTrade {
  ts?: string
  tx?: AfItem[]
  rx?: AfItem[]
  user?: string
  type?: number // 0 sale, 1 purchase, 2 item swap
  totalPlat?: number
}
interface AfPoint {
  ts?: string
  plat?: number | null
  credits?: number | null
  endo?: number | null
  ducats?: number | null
  aya?: number | null
  vitus?: number | null
  relicOpened?: number | null
  mr?: number | null
  percentageCompletion?: number | null
}

const PLAT = '/AF_Special/Platinum'

// Several items in one trade: "Khora Prime Set" when they share the first two words, else "A +3".
function bundleName(items: AfItem[]): string {
  const names = items.map((i) => i.displayName ?? '?')
  if (names.length === 1) return names[0]
  const head = names[0].split(' ').slice(0, 2).join(' ')
  return names.every((n) => n.startsWith(head + ' ')) && names.length >= 3
    ? `${head} Set`
    : `${names[0]} +${names.length - 1}`
}

export function parseAlecaFrame(json: unknown): { days: Record<string, DayStat>; trades: Trade[] } {
  const data = json as { generalDataPoints?: AfPoint[]; trades?: AfTrade[] }
  if (!data || (!Array.isArray(data.generalDataPoints) && !Array.isArray(data.trades)))
    throw new Error('This is not a ToxicFrame or AlecaFrame stats export.')
  const n = (v: number | null | undefined): number => (typeof v === 'number' ? v : 0)

  const days: Record<string, DayStat> = {}
  for (const p of data.generalDataPoints ?? []) {
    if (!p.ts) continue
    days[p.ts.slice(0, 10)] = {
      platinum: n(p.plat),
      credits: n(p.credits),
      ducats: n(p.ducats),
      endo: n(p.endo),
      aya: n(p.aya),
      vitus: n(p.vitus),
      relicsOpened: n(p.relicOpened),
      ...(typeof p.mr === 'number' ? { mr: p.mr } : {}),
      ...(typeof p.percentageCompletion === 'number' ? { completion: p.percentageCompletion } : {})
    }
  }

  // every trade, both sides kept in full; the net platinum decides sale / purchase / swap
  const stack = (i: AfItem): TradeStack => ({
    name: i.displayName ?? i.name ?? '?',
    count: Math.max(1, n(i.cnt)),
    ...(i.name ? { path: i.name } : {}),
    ...(typeof i.rank === 'number' && i.rank >= 0 ? { rank: i.rank } : {}),
    ...(i.picture ? { picture: i.picture } : {})
  })
  const platIn = (list?: AfItem[]): number =>
    (list ?? []).filter((i) => i.name === PLAT).reduce((s, i) => s + n(i.cnt), 0)
  const trades: Trade[] = []
  for (const t of data.trades ?? []) {
    const at = Date.parse(t.ts ?? '')
    if (!at) continue
    const gaveItems = (t.tx ?? []).filter((i) => i.name !== PLAT)
    const gotItems = (t.rx ?? []).filter((i) => i.name !== PLAT)
    const platGave = platIn(t.tx)
    const platGot = platIn(t.rx)
    const net = platGot - platGave
    const type = net > 0 ? 'sell' : net < 0 ? 'buy' : 'trade'
    // the item side that matters: what you sold, what you bought, or what you got in a swap
    const items = type === 'sell' ? gaveItems : gotItems.length ? gotItems : gaveItems
    if (!items.length && !gaveItems.length) continue
    const qty = items.length === 1 ? Math.max(1, n(items[0].cnt)) : 1
    const name = items.length ? bundleName(items) : 'Platinum'
    trades.push({
      at,
      type,
      itemId: '',
      platinum: Math.abs(net) / qty,
      quantity: qty,
      name,
      path: items.length >= 3 && name.endsWith(' Set') ? 'set' : items[0]?.name,
      user: t.user,
      gave: gaveItems.map(stack),
      got: gotItems.map(stack),
      platGave,
      platGot
    })
  }
  return { days, trades }
}

// Imported days only fill gaps: days the app recorded itself are kept.
export function mergeDays(
  h: StatsHistory,
  days: Record<string, DayStat>,
  today?: string // live snapshots own this day
): { history: StatsHistory; added: string[] } {
  const merged = { ...h.days }
  const added: string[] = []
  for (const [d, v] of Object.entries(days))
    // today belongs to live snapshots: an imported row would be deleted with them on undo
    if (!merged[d] && d !== today) {
      merged[d] = v
      added.push(d)
    }
  return { history: { ...h, days: merged }, added }
}

// Trades are matched by time, so importing the same file twice adds nothing.
export function mergeTrades(log: Trade[], add: Trade[]): { trades: Trade[]; added: number[] } {
  const seen = new Set(log.map((t) => t.at))
  const fresh = add.filter((t) => !seen.has(t.at))
  return { trades: [...log, ...fresh].sort((a, b) => a.at - b.at), added: fresh.map((t) => t.at) }
}

// Undo an import: drop exactly the days and trades it added (by day / trade time), keep the rest.
export function removeImported(
  h: StatsHistory,
  log: Trade[],
  added: { days: string[]; trades: number[] }
): { history: StatsHistory; trades: Trade[] } {
  const days = { ...h.days }
  for (const d of added.days) delete days[d]
  const gone = new Set(added.trades)
  return { history: { ...h, days }, trades: log.filter((t) => !gone.has(t.at)) }
}
