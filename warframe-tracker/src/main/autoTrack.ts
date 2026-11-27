import { getPrefs } from './appPrefs'
import { notify } from './notify'
import { getItemMeta } from './itemMeta'
import { setPartCounts } from './gameData'
import { closeOrder, getMyOrders, knownOrders } from './marketOrders'
import { saveTrade } from './tradeLog'
import { planTrade, type LoggedTrade } from './tradeParse'
import type { TradeStack } from './afImport'

// Auto-track: when EE.log shows a finished trade, close the warframe.market orders it completes and
// write every traded item to the trade log (also extra copies and items without an order).
// Off with Settings > Auto-track trades.

// Items for items with no net platinum (or a trade that could not be matched): logged as a swap
// with both sides, no order touched. `warn` replaces the success title.
async function logSwap(trade: LoggedTrade, warn?: string): Promise<void> {
  const items = (list: typeof trade.gave): TradeStack[] =>
    list.filter((i) => !/^platinum$/i.test(i.name)).map((i) => ({ name: i.name, count: i.count }))
  const gave = items(trade.gave)
  const got = items(trade.got)
  if (!gave.length && !got.length) return
  const plat = (list: typeof trade.gave): number =>
    list.filter((i) => /^platinum$/i.test(i.name)).reduce((n, i) => n + i.count, 0)
  const saved = await saveTrade({
    at: Date.now(),
    type: 'trade',
    itemId: '',
    platinum: 0,
    quantity: 1,
    name: got[0]?.name ?? gave[0]?.name,
    user: trade.user,
    gave,
    got,
    platGave: plat(trade.gave),
    platGot: plat(trade.got)
  })
  if (!saved) {
    notify({
      kind: 'trade',
      title: 'Trade could not be saved',
      body: `Trade with ${trade.user} was not written to the trade log.`
    })
    return
  }
  notify({
    kind: 'trade',
    title: warn ?? 'Trade tracked',
    body: `Traded with ${trade.user}: ${gave.map((i) => `${i.count}× ${i.name}`).join(', ')} ⇄ ${got.map((i) => `${i.count}× ${i.name}`).join(', ')}`
  })
}

export async function autoTrackTrade(trade: LoggedTrade): Promise<void> {
  if (!getPrefs().autoTrackTrades) return
  try {
    await track(trade)
  } catch (e) {
    // never lose the trade: keep the raw record even when matching it to orders failed
    console.error('Auto-track failed:', e)
    await logSwap(trade, 'Trade could not be matched to orders').catch((e2) =>
      console.error('Auto-track could not save the raw trade:', e2)
    )
  }
}

async function track(trade: LoggedTrade): Promise<void> {
  const r = await getMyOrders() // fresh list: the cache is stale after relisting on the website
  const orders = r.ok ? r.orders : knownOrders()
  const meta = await getItemMeta()
  const entries = Object.values(meta)
  const names = new Map(entries.map((e) => [e.id, e.name]))
  const idByName = new Map(entries.map((e) => [e.name.toLowerCase(), e.id]))
  // parts of "Khora Prime Set": the tradable items named "Khora Prime …" that are components
  // and how many of each the set needs ("Kestrel Prime Blade" x2), from the game data
  const partsOf = (setName: string): { name: string; count: number }[] => {
    const base = setName.replace(/ set$/i, '')
    const counts = setPartCounts(base)
    return entries
      .filter((e) => e.name.startsWith(base + ' ') && !/ set$/i.test(e.name))
      .filter((e) => e.tags.some((t) => /component|blueprint/i.test(t)))
      .map((e) => {
        // "Khora Prime Chassis Blueprint" -> "chassis"; "Khora Prime Blueprint" -> "blueprint"
        const part = e.name.slice(base.length + 1).replace(/ blueprint$/i, '') || 'Blueprint'
        return { name: e.name, count: counts.get(part.toLowerCase()) ?? 1 }
      })
  }

  const plan = planTrade(trade, orders, (id) => names.get(id), partsOf)
  if (!plan) return logSwap(trade)

  const closed: string[] = []
  for (const c of plan.closes) {
    const res = await closeOrder(c.order.id, c.quantity, { log: false })
    if (res.ok) closed.push(`${c.quantity}× ${names.get(c.order.itemId) ?? 'item'}`)
    else console.error('Auto-track could not close the order:', res.error)
  }

  const at = Date.now()
  let allSaved = true
  for (const [n, line] of plan.lines.entries()) {
    const ok = await saveTrade({
      at: at + n, // one trade can log several items; distinct times keep them apart
      type: plan.type,
      itemId: line.order?.itemId ?? idByName.get(line.name.toLowerCase()) ?? '',
      platinum: line.platinum,
      quantity: line.quantity,
      name: line.name,
      user: trade.user
    })
    allSaved = allSaved && ok
  }
  if (!allSaved) {
    notify({
      kind: 'trade',
      title: 'Trade could not be saved',
      body: `Trade with ${trade.user}: orders were closed (${closed.join(', ') || 'none'}) but the trade log could not be written.`
    })
    return
  }

  const verb = plan.type === 'sell' ? 'Sold to' : 'Bought from'
  notify({
    kind: 'trade',
    title: 'Trade tracked',
    body:
      `${verb} ${trade.user}: ${plan.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}` +
      (closed.length ? `\nOrders closed: ${closed.join(', ')}` : '\nNo matching order to close.')
  })
}
