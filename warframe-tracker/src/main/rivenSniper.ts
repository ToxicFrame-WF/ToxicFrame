import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { copyFileSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { getNotifyConfig, notify, setNotifyConfig, validWebhook } from './notify'
import { searchAuctions, type Listing } from './rivenSearch'
import type { Filter } from '../renderer/src/rivenFilter'
import { newHits } from '../renderer/src/rivenFair'
import { migratePlans } from '../renderer/src/rivenPlan'

// Riven sniper: saved alerts (weapon + Finder filter + optional "x% under fair" threshold), polled in
// the background one weapon at a time, at least 60 s apart per weapon, through searchAuctions (and
// so the shared warframe.market rate limit). Each auction id is announced once; only online / in-game
// sellers count. A new alert's first poll only marks what is already listed as seen.
export interface Alert {
  id: string
  name: string
  slug: string
  filter: Filter
  minDeal?: number // percent under the fair price, undefined = off
  paused: boolean // Snipe switch is off
  use: boolean // Use for rolling: the overlay follows this plan (one per weapon)
  negs: string[] // accepted negative wfm slugs (empty = any)
  minRoll?: number // percent, average roll strength of the wanted stats
  seeded: boolean
  lastPoll?: number
  lastHit?: { at: number; text: string }
  error?: string
}
interface Saved {
  alerts: Alert[]
  seen: string[]
  webhook: string
  v?: number
}
const MAX_SEEN = 2000
const MAX_PER_POLL = 5
let state: Saved | null = null
const file = (): string => join(app.getPath('userData'), 'riven-sniper.json')

function load(): Saved {
  if (state) return state
  try {
    const { state: m, changed } = migratePlans(JSON.parse(readFileSync(file(), 'utf8')))
    state = m as unknown as Saved
    if (changed) {
      try {
        copyFileSync(file(), `${file()}.bak`) // alerts became plans: keep the old file
      } catch (e) {
        console.warn('sniper backup failed:', e)
      }
      save()
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      try {
        copyFileSync(file(), `${file()}.bak`) // unreadable/corrupt: keep it before the next save overwrites
      } catch (e2) {
        console.warn('sniper backup failed:', e2)
      }
    }
    state = { alerts: [], seen: [], webhook: '', v: 2 }
  }
  // the sniper used to have its own webhook; it now goes through Settings > Notifications
  if (state.webhook) {
    if (!validWebhook(getNotifyConfig().webhook) && validWebhook(state.webhook))
      setNotifyConfig({ webhook: state.webhook, routes: { sniper: { discord: true } } })
    state.webhook = ''
    save()
  }
  return state
}
function save(): void {
  try {
    writeFileSync(`${file()}.tmp`, JSON.stringify(state))
    renameSync(`${file()}.tmp`, file())
  } catch (e) {
    console.warn('sniper not saved:', e)
  }
}

type PlanPatch = Partial<Pick<Alert, 'paused' | 'minDeal' | 'use' | 'negs' | 'minRoll' | 'filter'>>

// one rolling plan per weapon
function setUse(a: Alert, on: boolean): void {
  if (on) for (const x of load().alerts) if (x.slug === a.slug) x.use = false
  a.use = on
}
export const rollingPlan = (slug: string): Alert | undefined =>
  load().alerts.find((x) => x.slug === slug && x.use)

async function pollOne(): Promise<void> {
  const s = load()
  const due = s.alerts.filter((a) => !a.paused && Date.now() - (a.lastPoll ?? 0) >= 60_000)
  if (!due.length) return
  const slug = due.sort((a, b) => (a.lastPoll ?? 0) - (b.lastPoll ?? 0))[0].slug
  const mine = s.alerts.filter((x) => x.slug === slug && !x.paused)
  let list: Listing[]
  try {
    list = await searchAuctions(slug)
  } catch (e) {
    for (const a of mine) {
      a.lastPoll = Date.now()
      a.error = e instanceof Error ? e.message : 'Request failed'
    }
    return save()
  }
  const seen = new Set(s.seen)
  const added: string[] = []
  for (const a of mine) {
    a.lastPoll = Date.now()
    a.error = undefined
    const hits = newHits(a, list, seen) // every alert sees the original set, not other alerts' hits
    hits.forEach((h) => added.push(h.id))
    if (!a.seeded) {
      a.seeded = true
      continue
    }
    for (const h of hits.slice(0, MAX_PER_POLL)) {
      const text = `${h.price}p ${h.name}: ${h.attrs.map((x) => (x.positive ? '+' : '-') + x.name).join(', ')} (${h.seller})`
      a.lastHit = { at: Date.now(), text }
      notify({
        kind: 'sniper',
        title: `Riven sniper: ${a.name}`,
        body: text,
        discord: `**Riven sniper: ${a.name}**\n${text}\n${h.url}`,
        onClick: () => {
          const w = BrowserWindow.getAllWindows()[0]
          if (!w) return
          if (w.isMinimized()) w.restore()
          w.focus()
          w.webContents.send('nav:page', 'rivens-sniper')
        }
      })
    }
  }
  added.forEach((id) => seen.add(id))
  s.seen = [...seen].slice(-MAX_SEEN) // a Set keeps insertion order: the oldest ids go
  save()
}

export function startSniper(): void {
  let busy = false
  setInterval(() => {
    if (busy) return
    busy = true
    pollOne()
      .catch((e) => console.warn('sniper poll failed:', e))
      .finally(() => (busy = false))
  }, 10_000)
  ipcMain.handle('sniper:list', () => {
    return { alerts: load().alerts }
  })
  ipcMain.handle(
    'sniper:add',
    (
      _e,
      a: Pick<Alert, 'name' | 'slug' | 'filter' | 'minDeal'> &
        Partial<Pick<Alert, 'negs' | 'minRoll' | 'use'>>
    ) => {
      if (!/^[a-z0-9_]+$/.test(String(a?.slug)) || !a.filter) return false
      load().alerts.push({
        id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        name: String(a.name).slice(0, 80),
        slug: a.slug,
        filter: a.filter,
        minDeal: Number(a.minDeal) > 0 ? Number(a.minDeal) : undefined,
        negs: Array.isArray(a.negs) ? a.negs.map(String) : [],
        minRoll: Number(a.minRoll) > 0 ? Number(a.minRoll) : undefined,
        use: false,
        paused: false,
        seeded: false
      })
      if (a.use) setUse(load().alerts[load().alerts.length - 1], true)
      save()
      return true
    }
  )
  ipcMain.handle('sniper:update', (_e, id: string, p: PlanPatch) => {
    const a = load().alerts.find((x) => x.id === id)
    if (!a) return
    if (typeof p.paused === 'boolean') a.paused = p.paused
    if (typeof p.use === 'boolean') setUse(a, p.use)
    if (Array.isArray(p.negs)) a.negs = p.negs.map(String)
    if (p.minRoll !== undefined) a.minRoll = Number(p.minRoll) > 0 ? Number(p.minRoll) : undefined
    if (p.filter) {
      a.filter = p.filter
      a.seeded = false // a changed filter would otherwise announce everything already listed
    }
    if (p.minDeal !== undefined) a.minDeal = Number(p.minDeal) > 0 ? Number(p.minDeal) : undefined
    save()
  })
  ipcMain.handle('sniper:delete', (_e, id: string) => {
    const s = load()
    s.alerts = s.alerts.filter((x) => x.id !== id)
    save()
  })
}
