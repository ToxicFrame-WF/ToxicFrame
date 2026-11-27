// Finished in-game trades, read from EE.log. Pure (no electron) so it can be tested.
// The game logs the confirm dialog, then a result dialog:
//   ...Dialog::CreateOkCancel(description=Are you sure you want to accept this trade? You are offering
//   Khora Prime Neuroptics Blueprint
//   and will receive from SomePlayer the following:
//   Platinum x 30
//   , leftItem=/Menu/Confirm_Item_Ok, rightItem=/Menu/Confirm_Item_Cancel)
//   ...Dialog::CreateOk(description=The trade was successful!, ...)
// shortcut: wording taken from known EE.log trade lines, not yet seen in this user's log; check
// against a real trade and adjust the patterns if a trade is not picked up.

export interface TradeItem {
  name: string
  count: number
}
export interface LoggedTrade {
  user: string
  gave: TradeItem[]
  got: TradeItem[]
}

const START = 'Are you sure you want to accept this trade? You are offering'
const RECEIVE = /^and will receive from (.+?) the following:\s*$/
const END = /leftItem=/
const SUCCESS = /The trade was successful/i
const FAILED = /trade (failed|was cancell?ed)/i

function item(line: string): TradeItem | null {
  const t = line.trim()
  if (!t) return null
  const m = /^(.*?)\s+x\s*(\d+)$/.exec(t)
  return m ? { name: m[1].trim(), count: Number(m[2]) } : { name: t, count: 1 }
}

// State carried between reads: a dialog being read, and a confirmed trade waiting for its result.
export interface ScanState {
  reading: { trade: LoggedTrade; side: 'gave' | 'got' } | null
  pending: LoggedTrade | null
}
export const NEW_SCAN: ScanState = { reading: null, pending: null }

// Feeds new log text (whole lines); returns finished trades and the state for the next read.
export function scanTrades(
  text: string,
  state: ScanState
): { done: LoggedTrade[]; state: ScanState } {
  const done: LoggedTrade[] = []
  let { reading, pending } = state
  for (const line of text.split(/\r?\n/)) {
    if (line.includes(START)) {
      reading = { trade: { user: '', gave: [], got: [] }, side: 'gave' }
      const rest = line.slice(line.indexOf(START) + START.length)
      const first = item(rest)
      if (first) reading.trade.gave.push(first)
      continue
    }
    if (reading) {
      const rec = RECEIVE.exec(line.trim())
      if (rec) {
        reading.trade.user = rec[1]
        reading.side = 'got'
      } else if (END.test(line)) {
        const head = item(line.slice(0, line.search(/,?\s*leftItem=/)))
        if (head) reading.trade[reading.side].push(head)
        pending = reading.trade
        reading = null
      } else {
        const it = item(line)
        if (it) reading.trade[reading.side].push(it)
      }
      continue
    }
    if (SUCCESS.test(line) && pending) {
      done.push(pending)
      pending = null
    } else if (FAILED.test(line)) pending = null
  }
  return { done, state: { reading, pending } }
}

const isPlat = (i: TradeItem): boolean => /^platinum$/i.test(i.name)
export const platOf = (items: TradeItem[]): number =>
  items.filter(isPlat).reduce((n, i) => n + i.count, 0)

export interface OrderLike {
  id: string
  type: string
  itemId: string
  quantity: number
  platinum: number
}

// What a finished trade means for you. The side with more platinum paid: if you got more
// platinum than you gave it is a sale of the items you gave, otherwise a purchase of the items you
// got (items on the paying side count as part of the price). Pure swaps (no net platinum) are skipped.
// - closes: the warframe.market orders it completes (sell or buy, by exact item name; a set order
//   when every part of the set is in the trade, as many sets as the scarcest part allows)
// - lines: every traded item for the trade log, including extra copies beyond an order and items
//   you had no order for. The net platinum is split over them by your listed prices (items without
//   an order weigh the average listed price).
export interface TradeLine {
  name: string
  quantity: number
  platinum: number // per unit
  order?: OrderLike
}
export interface TradePlan {
  type: 'sell' | 'buy'
  closes: { order: OrderLike; quantity: number }[]
  lines: TradeLine[]
}

export function planTrade(
  trade: LoggedTrade,
  orders: OrderLike[],
  nameOf: (itemId: string) => string | undefined,
  partsOf: (setName: string) => { name: string; count: number }[] = () => []
): TradePlan | null {
  const net = platOf(trade.got) - platOf(trade.gave)
  if (net === 0) return null
  const type = net > 0 ? 'sell' : 'buy'
  const plat = Math.abs(net)
  // counts left to place, by lower-case name (display name kept for the log)
  const left = new Map<string, number>()
  const display = new Map<string, string>()
  for (const i of (type === 'sell' ? trade.gave : trade.got).filter((i) => !isPlat(i))) {
    const k = i.name.toLowerCase()
    left.set(k, (left.get(k) ?? 0) + i.count)
    display.set(k, i.name)
  }
  if (!left.size) return null
  const closes: TradePlan['closes'] = []
  const raw: { name: string; quantity: number; weight?: number; order?: OrderLike }[] = []
  const open = (o: OrderLike): boolean => o.type === type && o.quantity > 0

  for (const o of orders) {
    const name = nameOf(o.itemId)
    if (!open(o) || !name || !/ set$/i.test(name)) continue
    const parts = partsOf(name).map((p) => ({
      key: p.name.toLowerCase(),
      count: Math.max(1, p.count)
    }))
    if (!parts.length) continue
    const sets = Math.min(
      o.quantity,
      ...parts.map((p) => Math.floor((left.get(p.key) ?? 0) / p.count))
    )
    if (sets <= 0) continue
    for (const p of parts) left.set(p.key, (left.get(p.key) ?? 0) - sets * p.count)
    closes.push({ order: o, quantity: sets })
    raw.push({ name, quantity: sets, weight: o.platinum, order: o })
  }
  for (const [k, count] of left) {
    if (count <= 0) continue
    const order = orders.find((o) => open(o) && nameOf(o.itemId)?.toLowerCase() === k)
    const covered = order ? Math.min(count, order.quantity) : 0
    if (order && covered > 0) {
      closes.push({ order, quantity: covered })
      raw.push({ name: display.get(k)!, quantity: covered, weight: order.platinum, order })
    }
    if (count > covered)
      raw.push({ name: display.get(k)!, quantity: count - covered, weight: order?.platinum })
  }

  const known = raw.filter((r) => r.weight)
  const avg = known.length ? known.reduce((n, r) => n + r.weight!, 0) / known.length : 1
  const total = raw.reduce((n, r) => n + (r.weight || avg) * r.quantity, 0)
  const lines = raw.map((r) => ({
    name: r.name,
    quantity: r.quantity,
    platinum: (plat * (r.weight || avg)) / total,
    order: r.order
  }))
  return { type, closes, lines }
}
