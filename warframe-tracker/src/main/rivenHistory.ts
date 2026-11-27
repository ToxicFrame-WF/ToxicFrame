import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import type { Listing } from './rivenSearch'
import { addSnap, type Snap } from './rivenSnap'

// Own riven price history: warframe.market has none, so each searched / sniped weapon's listings are
// snapshotted here (at most once per 6 h per weapon) and the Finder's Price trends tab reads them.
// One file per weapon in userData/riven-history. Bounded: snapshots older than a year go, those
// older than 30 days thin out to one per day, and a snapshot keeps the 150 cheapest listings.
// shortcut: the cheapest 150 only, so averages describe the cheap end of the market.
const dir = (): string => join(app.getPath('userData'), 'riven-history')
const fileOf = (slug: string): string | null =>
  /^[a-z0-9_]+$/.test(slug) ? join(dir(), `${slug}.json`) : null

// throws when the file is there but unreadable or broken, so a new snapshot never writes over it
function readSnaps(f: string): Snap[] {
  let text: string
  try {
    text = readFileSync(f, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
  const s = JSON.parse(text)
  if (!Array.isArray(s)) throw new Error(`${f} is not a list`)
  return s
}
export function getRivenHistory(slug: string): Snap[] {
  const f = fileOf(slug)
  if (!f) return []
  try {
    return readSnaps(f)
  } catch {
    return []
  }
}

export function recordRivenSnapshot(slug: string, list: Listing[]): void {
  try {
    const f = fileOf(slug)
    const next = f && addSnap(readSnaps(f), list, Date.now())
    if (!f || !next) return
    mkdirSync(dir(), { recursive: true })
    writeFileSync(`${f}.tmp`, JSON.stringify(next))
    renameSync(`${f}.tmp`, f)
  } catch (e) {
    console.warn('riven history not saved:', e)
  }
}
