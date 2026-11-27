import { app } from 'electron'
import { join } from 'path'
import { copyFileSync, existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { mergeDays, mergeTrades, parseAlecaFrame, removeImported } from './afImport'
import { getStatsHistory, saveStatsHistory } from './statsHistory'
import { localDay } from './statsMath'

// Trades made through the app (the Sold button on My Orders), kept on disk for "Your trading".
// warframe.market has no trade history to download, so this log is the only record.
import type { Trade } from './afImport'
export type { Trade }

const file = (): string => join(app.getPath('userData'), 'trade-log.json')

export function getTrades(): Trade[] {
  let text: string
  try {
    text = readFileSync(file(), 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e // locked or unreadable: an empty list here would be saved over the real history
  }
  const t = JSON.parse(text) // a broken file throws too, so nothing overwrites it
  if (!Array.isArray(t)) throw new Error('trade-log.json is not a list')
  return t
}

export function addTrade(t: Trade): void {
  saveTrades([...getTrades(), t])
}

export function saveTrades(all: Trade[]): void {
  // temp file + rename, so a crash mid-write can't wipe the history
  writeFileSync(file() + '.tmp', JSON.stringify(all))
  renameSync(file() + '.tmp', file())
}

// Last good copy of your orders, shown at once while the fresh list loads.
const ordersFile = (): string => join(app.getPath('userData'), 'my-orders.json')
export function readSavedOrders<T>(): { at: number; orders: T[] } | null {
  try {
    return JSON.parse(readFileSync(ordersFile(), 'utf8'))
  } catch {
    return null
  }
}
export function saveOrders<T>(orders: T[]): void {
  try {
    writeFileSync(ordersFile() + '.tmp', JSON.stringify({ at: Date.now(), orders }))
    renameSync(ordersFile() + '.tmp', ordersFile())
  } catch {
    // only a cache
  }
}

// AlecaFrame JSON export -> stats history (gaps only) and trade log (new trades only).
// Both files are copied to *.before-import-<time>.json first, so an import can be undone by hand.
export function importAlecaFrame(text: string): { days: number; trades: number } {
  const parsed = parseAlecaFrame(JSON.parse(text))
  const statsFile = join(app.getPath('userData'), 'stats-history.json')
  for (const f of [statsFile, file()])
    if (existsSync(f)) copyFileSync(f, f.replace(/\.json$/, `.before-import-${Date.now()}.json`))
  const stats = mergeDays(getStatsHistory(), parsed.days, localDay())
  saveStatsHistory(stats.history)
  const log = mergeTrades(getTrades(), parsed.trades)
  saveTrades(log.trades)
  // what this import added, so "Undo last import" can take out exactly that
  writeFileSync(
    lastImportFile(),
    JSON.stringify({ at: Date.now(), days: stats.added, trades: log.added })
  )
  return { days: stats.added.length, trades: log.added.length }
}

const lastImportFile = (): string => join(app.getPath('userData'), 'last-import.json')

// Removes what the last import added; days and trades recorded since are kept.
export function undoLastImport(): { days: number; trades: number } | null {
  if (!existsSync(lastImportFile())) return null
  const added = JSON.parse(readFileSync(lastImportFile(), 'utf8')) as {
    days: string[]
    trades: number[]
  }
  const before = getTrades().length
  const out = removeImported(getStatsHistory(), getTrades(), added)
  saveStatsHistory(out.history)
  saveTrades(out.trades)
  unlinkSync(lastImportFile())
  return { days: added.days.length, trades: before - out.trades.length }
}
