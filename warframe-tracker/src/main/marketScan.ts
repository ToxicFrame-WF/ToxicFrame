import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { readFileSync, renameSync, writeFileSync } from 'fs'
import { wfmFetch } from './wfm'
import { getItemMeta } from './itemMeta'
import { summarize, type MarketStat, type StatsPayload } from './marketMath'

// Market activity's data: every warframe.market item's 90-day statistics and every set's
// parts, fetched one by one in the background and kept on disk. One request at a time
// through wfmFetch's shared queue, so other requests slot in between and wait at most one gap;
// resumes with the oldest data first, so a restart never starts over.
const V1 = 'https://api.warframe.market/v1'
const V2 = 'https://api.warframe.market/v2'
const VERSION = 3 // bump when the saved shape or meaning changes
const DAY = 86_400_000
const STAT_AGE = DAY
const DEAD_AGE = 7 * DAY // items that hardly ever sell change little: refresh weekly
const DEAD_VOL = 0.05 // sales per day over 90 days (about 5 in total)
// only items that really trade need daily data; slow ones change slowly (halves the traffic)
const BUSY_VOL = 5 // sales per day
const SLOW_AGE = 3 * DAY
const stale = (st: MarketStat | undefined, now: number): boolean =>
  !st || now - st.at >= (st.vol90 < DEAD_VOL ? DEAD_AGE : st.vol90 < BUSY_VOL ? SLOW_AGE : STAT_AGE)
const SET_AGE = 7 * DAY // set contents hardly change

export interface SetPart {
  slug: string
  qty: number
}
interface Saved {
  v: number
  items: Record<string, MarketStat>
  sets: Record<string, { at: number; parts: SetPart[] }>
}
let data: Saved | null = null
let running = false
let whenDone: (() => void) | null = null
// called after each finished scan (the live check of the best deals runs then)
export const onScanDone = (cb: () => void): void => {
  whenDone = cb
}
// items opened in Buy / Sell jump the queue (refreshed when older than an hour)
const URGENT_AGE = 3_600_000
const urgent: string[] = []
let done = 0
let total = 0
const file = (): string => join(app.getPath('userData'), 'market-stats.json')

function load(): Saved {
  if (data) return data
  try {
    const saved = JSON.parse(readFileSync(file(), 'utf8')) as Saved
    if (saved.v !== VERSION && saved.sets) {
      // older summaries mixed relic refinements and miscounted the week: refetch every item,
      // keep the set contents (unchanged)
      saved.items = {}
      saved.v = VERSION
    }
    if (saved.v === VERSION) return (data = saved)
  } catch {
    // nothing saved yet
  }
  return (data = { v: VERSION, items: {}, sets: {} })
}
// temp file + rename: a crash mid-write leaves the last good copy
const save = (): void => {
  try {
    writeFileSync(file() + '.tmp', JSON.stringify(load()))
    renameSync(file() + '.tmp', file())
  } catch {
    // locked for a moment: the next save tries again, the scan keeps going
  }
}
const emit = (): void => {
  for (const w of BrowserWindow.getAllWindows())
    w.webContents.send('market:progress', { scanning: running, done, total })
}

export function getMarketStats(): {
  items: Record<string, MarketStat>
  sets: Record<string, SetPart[]>
  scanning: boolean
  done: number
  total: number
} {
  const d = load()
  const sets = Object.fromEntries(Object.entries(d.sets).map(([k, v]) => [k, v.parts]))
  return { items: d.items, sets, scanning: running, done, total }
}

export function prioritizeMarketItem(slug: string): void {
  if (!urgent.includes(slug)) urgent.push(slug)
  void startMarketScan() // already running: the scan picks it up after its current request
}

export async function startMarketScan(): Promise<void> {
  if (running) return
  running = true
  try {
    const meta = await getItemMeta()
    const d = load()
    const now = Date.now()
    // items known to sell first, then never-scanned ones, rarely-sold ones last; oldest first
    const rank = (s: string): number => {
      const st = d.items[s]
      return !st ? 1 : st.vol90 >= DEAD_VOL ? 0 : 2
    }
    const slugs = Object.keys(meta)
      .filter((s) => stale(d.items[s], now))
      .sort((a, b) => rank(a) - rank(b) || (d.items[a]?.at ?? 0) - (d.items[b]?.at ?? 0))
    const sets = Object.keys(meta).filter(
      (s) => meta[s].tags.includes('set') && !(d.sets[s] && now - d.sets[s].at < SET_AGE)
    )
    done = 0
    total = sets.length + slugs.length
    emit()
    const fetchStat = async (s: string): Promise<void> => {
      try {
        const r = await wfmFetch(`${V1}/items/${s}/statistics`)
        if (r.ok) {
          const j = (await r.json()) as { payload?: StatsPayload }
          if (j.payload) d.items[s] = summarize(j.payload, Date.now())
        }
      } catch {
        // skipped; the next scan tries again
      }
    }
    const drainUrgent = async (): Promise<void> => {
      for (let s = urgent.shift(); s; s = urgent.shift()) {
        if (d.items[s] && Date.now() - d.items[s].at < URGENT_AGE) continue
        await fetchStat(s)
        emit()
      }
    }
    const step = async (): Promise<void> => {
      done++
      if (done % 25 === 0) emit()
      if (done % 100 === 0) save()
      await drainUrgent()
    }
    const fresh = (s: string): boolean => !stale(d.items[s], Date.now())
    const stat = async (s: string): Promise<void> => {
      if (fresh(s)) return
      await fetchStat(s)
      await step()
    }
    await drainUrgent()
    // each set with its parts first, so Set vs parts fills in row by row; then everything else
    for (const s of sets) {
      try {
        const r = await wfmFetch(`${V2}/item/${s}/set`, { headers: { Language: 'en' } })
        if (r.ok) {
          const j = (await r.json()) as {
            data?: { items?: { slug: string; setRoot?: boolean; quantityInSet?: number }[] }
          }
          const parts = (j.data?.items ?? [])
            .filter((i) => !i.setRoot)
            .map((i) => ({ slug: i.slug, qty: i.quantityInSet ?? 1 }))
          d.sets[s] = { at: Date.now(), parts }
        }
      } catch {
        // skipped; the next scan tries again
      }
      await step()
      for (const part of [s, ...(d.sets[s]?.parts ?? []).map((x) => x.slug)]) await stat(part)
    }
    for (const s of slugs) await stat(s)
    await drainUrgent()
    save()
  } finally {
    running = false
    emit()
    whenDone?.()
  }
}
