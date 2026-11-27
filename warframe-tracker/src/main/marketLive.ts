import { BrowserWindow } from 'electron'
import { notify } from './notify'
import { getMarketStats } from './marketScan'
import { getTopOrders } from './marketOrders'
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
