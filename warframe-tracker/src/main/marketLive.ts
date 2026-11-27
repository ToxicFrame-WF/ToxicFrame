import { BrowserWindow } from 'electron'
import { notify } from './notify'
import { getMarketStats } from './marketScan'
import { getTopOrders, getItemOrders, getMyOrders } from './marketOrders'
import { undercutsToTell } from './undercutLogic'
import { getItemMeta } from './itemMeta'
import { getPrefs } from './appPrefs'
import {
  flips,
  liveFlip,
  liveSet,
  onlineBest,
  setDeals,
  type Best
} from '../renderer/src/marketTools'

// Live check of Market activity's best deals: the top 10 of Set vs parts and of Flip finder are
// priced from the orders of players online right now, after each scan and every 10 minutes.
// A deal worth at least the chosen amount (Settings: dealAlert, 0 = off) raises a notification.
const TOP = 10
const REPEAT_MS = 6 * 3_600_000 // the same deal is announced again only after this long

export interface LiveDeal {
  kind: 'set' | 'flip'
  slug: string
  at: number
  profit: number | null // null: not doable right now
  buy: number
  sell: number
}
let live: Record<string, LiveDeal> = {}
let running = false
const told = new Map<string, number>() // deal key -> when it was announced

export const getLiveDeals = (): Record<string, LiveDeal> => live

export async function liveRound(): Promise<void> {
  const { items, sets, scanning } = getMarketStats()
  if (running || scanning || !Object.keys(items).length) return
  running = true
  try {
    const deals = setDeals(sets, items).slice(0, TOP)
    const fl = flips(items).slice(0, TOP)
    const slugs = new Set([
      ...deals.flatMap((d) => [d.slug, ...sets[d.slug].map((p) => p.slug)]),
      ...fl.map((f) => f.slug)
    ])
    const best: Record<string, Best> = {}
    for (const s of slugs) {
      const o = await getTopOrders(s)
      if (o) best[s] = onlineBest(o)
    }
    const at = Date.now()
    const next: Record<string, LiveDeal> = {}
    for (const d of deals)
      next[`set:${d.slug}`] = {
        kind: 'set',
        slug: d.slug,
        at,
        ...liveSet(d.slug, sets[d.slug], best)
      }
    for (const f of fl)
      next[`flip:${f.slug}`] = { kind: 'flip', slug: f.slug, at, ...liveFlip(best[f.slug]) }
    live = next
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('market:live', live)
    await announce(next)
  } catch {
    // network trouble: the next round tries again
  } finally {
    running = false
  }
}

async function announce(deals: Record<string, LiveDeal>): Promise<void> {
  const min = getPrefs().dealAlert
  if (!min) return
  const now = Date.now()
  const fresh = Object.entries(deals)
    .filter(([k, d]) => d.profit != null && d.profit >= min && now - (told.get(k) ?? 0) > REPEAT_MS)
    .sort((a, b) => b[1].profit! - a[1].profit!)
  if (!fresh.length) return
  for (const [k] of fresh) told.set(k, now)
  const meta = await getItemMeta()
  const line = ([, d]: [string, LiveDeal]): string =>
    `${meta[d.slug]?.name ?? d.slug}: +${d.profit} p (${d.kind === 'set' ? 'parts → set' : `buy ${d.buy}, sell ${d.sell}`})`
  notify({
    kind: 'marketDeal',
    title:
      fresh.length === 1
        ? 'Live deal on warframe.market'
        : `${fresh.length} live deals on warframe.market`,
    body:
      fresh.slice(0, 3).map(line).join('\n') +
      (fresh.length > 3 ? `\n+${fresh.length - 3} more` : ''),
    onClick: () => {
      const w = BrowserWindow.getAllWindows()[0]
      if (!w) return
      if (w.isMinimized()) w.restore()
      w.focus()
      w.webContents.send('nav:page', 'analytics-market')
    }
  })
}

// Undercut alerts: every 10 minutes (linked account only) your visible sell orders are compared
// with the cheapest online / in-game seller of the same rank. One request per item, so the
// shared 400 ms gap in wfmFetch spaces them out.
const undercutTold = new Map<string, { low: number; at: number }>()
let undercutRunning = false

export const clearUndercutTold = (): void => undercutTold.clear() // on logout

export async function undercutRound(): Promise<void> {
  if (undercutRunning) return
  undercutRunning = true
  try {
    const mine = await getMyOrders() // ok:false without a linked account
    if (!mine.ok) return
    const meta = await getItemMeta()
    const bySlug = new Map(Object.entries(meta).map(([slug, e]) => [e.id, { slug, name: e.name }]))
    const sells = mine.orders.filter((o) => o.type === 'sell' && o.visible && bySlug.has(o.itemId))
    for (const k of undercutTold.keys()) if (!sells.some((o) => o.id === k)) undercutTold.delete(k)
    const lowest = new Map<string, number | undefined>()
    const checked: typeof sells = [] // orders whose item orders were fetched
    const fetched = new Map<string, Awaited<ReturnType<typeof getItemOrders>>>()
    for (const o of sells) {
      const slug = bySlug.get(o.itemId)!.slug
      if (!fetched.has(slug)) fetched.set(slug, await getItemOrders(slug))
      if (!fetched.get(slug)) continue // failed fetch: keep its told entry, check again next round
      checked.push(o)
      const prices = (fetched.get(slug)?.sell ?? [])
        .filter((x) => x.id !== o.id && x.status !== 'offline' && x.status !== 'invisible')
        .filter((x) => o.rank == null || x.rank === o.rank) // never compare across ranks
        .map((x) => x.platinum)
      lowest.set(o.id, prices.length ? Math.min(...prices) : undefined)
    }
    const fresh = undercutsToTell(checked, lowest, undercutTold, Date.now())
    for (const f of fresh) {
      const o = sells.find((s) => s.id === f.id)!
      notify({
        kind: 'undercut',
        title: `${bySlug.get(o.itemId)!.name} undercut`,
        body: `${bySlug.get(o.itemId)!.name} undercut: someone sells at ${f.low}p, you're at ${o.platinum}p`,
        onClick: () => {
          const w = BrowserWindow.getAllWindows()[0]
          if (!w) return
          if (w.isMinimized()) w.restore()
          w.focus()
          w.webContents.send('nav:page', 'market-orders')
        }
      })
    }
  } catch {
    // network trouble: the next round tries again
  } finally {
    undercutRunning = false
  }
}
