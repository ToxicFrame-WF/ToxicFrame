// Owned inventory from the Rust helper (tf-helper.exe, see ../helper).
// The helper reads the game's session from memory, asks DE's server for the inventory and
// prints the relevant parts as JSON. It only runs when triggered (Refresh button, later
// loading screens), never on a timer. The session itself never reaches this process.

import { app, BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { readFile, rename, writeFile } from 'fs/promises'
import { join } from 'path'
import { getGameInfo } from './logWatcher'
import { recordSnapshot } from './statsHistory'
import { toData, relicTotal, type HelperOutput, type InventoryData } from './inventoryData'

export { toData }
export type { InventoryData }

export interface InventoryStatus {
  state: 'none' | 'loading' | 'ok' | 'error'
  error?: string
  data?: InventoryData
  fromCache?: boolean // data was loaded from disk at startup, not refreshed in this session
  accountName?: string
  lastLoadAt?: number
}

// Exit codes of tf-helper (see helper/src/bin/tf-helper.rs).
const EXIT_MESSAGES: Record<number, string> = {
  1: 'Warframe is not running.',
  2: 'Could not open the game for reading.',
  3: 'Not logged in yet: reach the Orbiter, then refresh.',
  4: 'The game session was not accepted. Try again after a loading screen.',
  5: "Warframe's server or the network isn't answering. Try again in a few minutes."
}

let status: InventoryStatus = { state: 'none' }
let running: Promise<InventoryStatus> | null = null
let loaded = false

const cacheFile = (): string => join(app.getPath('userData'), 'inventory.json')

function helperPath(): string | null {
  if (process.platform !== 'win32') return null
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'tf-helper.exe')]
    : [join(app.getAppPath(), '..', 'helper', 'target', 'release', 'tf-helper.exe')]
  return candidates.find((p) => existsSync(p)) ?? null
}

const withGame = (s: InventoryStatus): InventoryStatus => ({ ...s, ...getGameInfo() })

function broadcast(): void {
  const s = withGame(status)
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('inventory:updated', s)
}

// Called when the log reports a login or a finished loading screen.
export const notifyGameInfo = (): void => broadcast()

// Last successful pull, saved so the app shows it after a restart.
async function loadCache(): Promise<void> {
  if (loaded) return
  loaded = true
  try {
    const saved = JSON.parse(await readFile(cacheFile(), 'utf8')) as {
      fetchedAt: number
      output: HelperOutput
    }
    if (status.state === 'none')
      status = { state: 'ok', data: toData(saved.output, saved.fetchedAt), fromCache: true }
  } catch {
    // nothing saved yet
  }
}

export async function getInventory(): Promise<InventoryStatus> {
  await loadCache()
  return withGame(status)
}

function runHelper(path: string): Promise<HelperOutput> {
  return new Promise((resolve, reject) => {
    execFile(
      path,
      [],
      { timeout: 90_000, maxBuffer: 128 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (err) {
          const code = typeof err.code === 'number' ? err.code : undefined
          // stderr is not shown: the helper keeps it free of secrets, but the UI only
          // needs the short message for the exit code.
          reject(new Error((code && EXIT_MESSAGES[code]) || 'The inventory helper failed.'))
          return
        }
        try {
          resolve(JSON.parse(stdout) as HelperOutput)
        } catch {
          reject(new Error('The inventory helper returned unreadable data.'))
        }
      }
    )
  })
}

// One run at a time; a second click while running gets the same result.
export function refreshInventory(): Promise<InventoryStatus> {
  if (running) return running
  running = (async () => {
    await loadCache()
    const path = helperPath()
    if (!path) {
      status = {
        ...status,
        state: 'error',
        error:
          process.platform === 'win32'
            ? 'Inventory helper not found. Build it with "cargo build --release" in the helper folder.'
            : 'Reading the inventory is only supported on Windows for now.'
      }
      broadcast()
      return status
    }
    status = { ...status, state: 'loading', error: undefined }
    broadcast()
    try {
      const output = await runHelper(path)
      const fetchedAt = Date.now()
      status = { state: 'ok', data: toData(output, fetchedAt), fromCache: false }
      // Full output kept on disk for later features (mastery helper etc.). It holds no session data.
      await writeFile(cacheFile() + '.tmp', JSON.stringify({ fetchedAt, output }))
        .then(() => rename(cacheFile() + '.tmp', cacheFile()))
        .catch(() => {})
      recordSnapshot(output.inventory ?? {}, relicTotal(output.relics))
    } catch (e) {
      status = { ...status, state: 'error', error: (e as Error).message }
    }
    broadcast()
    return withGame(status)
  })().finally(() => {
    running = null
  })
  return running
}
