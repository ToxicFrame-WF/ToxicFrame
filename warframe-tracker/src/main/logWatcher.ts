// Watches Warframe's EE.log and refreshes the inventory when a loading screen finishes, the same
// moment AlecaFrame updates. The game writes "ExitState: Loading" when a load completes; we read
// only newly-appended bytes, never the whole file, and debounce so one load triggers one refresh.

import { closeSync, existsSync, openSync, readFileSync, readSync, fstatSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { chatPlayerFromLine } from './chatParse'
import { arbiLine } from './arbiTracker'
import { gameEventFromLine, type GameEvent } from './gameEvents'
import { isWarframeForeground } from './foreground'
import { getNotifyConfig, notify } from './notify'
import { NEW_SCAN, scanTrades, type LoggedTrade, type ScanState } from './tradeParse'

const MARKER = 'ExitState: Loading'
// "Logged in Cerberus2077" (a platform glyph may follow the name)
const LOGIN = /Logged in ([^\s(]+)/g
const DEBOUNCE_MS = 3000
const MIN_GAP_MS = 20_000 // never auto-refresh more often than this
const POLL_MS = 500 // a size check; the overlays must react quickly

// Linux: Warframe runs in a Proton prefix inside whichever Steam library holds the game.
function linuxLogPath(): string | null {
  const rel = join(
    'steamapps/compatdata/230410/pfx/drive_c/users/steamuser/AppData/Local/Warframe/EE.log'
  )
  const roots = [join(homedir(), '.local/share/Steam'), join(homedir(), '.steam/steam')]
  for (const root of [...roots]) {
    try {
      const vdf = readFileSync(join(root, 'steamapps/libraryfolders.vdf'), 'utf8')
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) roots.push(m[1].replace(/\\/g, '/'))
    } catch {
      /* no such Steam root */
    }
  }
  return roots.map((r) => join(r, rel)).find((p) => existsSync(p)) ?? null
}

function logPath(): string | null {
  if (process.platform === 'linux') return linuxLogPath()
  const local = process.env.LOCALAPPDATA
  if (!local) return null
  return join(local, 'Warframe', 'EE.log')
}

let position = 0
let fileId = '' // inode + creation time of the log we are reading
let tradeScan: ScanState = NEW_SCAN
let onTrade: (t: LoggedTrade) => void = () => {}
export const setTradeHandler = (fn: (t: LoggedTrade) => void): void => {
  onTrade = fn
}
let onGameEvent: (e: GameEvent) => void = () => {}
export const setGameEventHandler = (fn: (e: GameEvent) => void): void => {
  onGameEvent = fn
}
let partial = Buffer.alloc(0) // an unfinished last line, as bytes: a letter may be split across reads
let debounce: ReturnType<typeof setTimeout> | null = null
let lastRun = 0
let watched: string | null = null
let timer: ReturnType<typeof setInterval> | undefined

// What the log tells us about the game, shown in the sidebar profile.
export interface GameInfo {
  accountName?: string
  lastLoadAt?: number // when the last loading screen finished (this app session)
}
const info: GameInfo = {}
export const getGameInfo = (): GameInfo => ({ ...info })

const CHAT_DEDUPE_MS = 2 * 60_000
const chatSeen = new Map<string, number>()

async function noteChat(player: string): Promise<void> {
  const now = Date.now()
  if (now - (chatSeen.get(player) ?? 0) < CHAT_DEDUPE_MS) return
  chatSeen.set(player, now)
  const cfg = getNotifyConfig()
  if (cfg.chatOnlyBackground && (await isWarframeForeground())) return
  notify({
    kind: 'chat',
    title: 'New in-game message',
    body: `From ${player}`,
    discord: cfg.templates.chat.replaceAll('<PLAYER_NAME>', player)
  })
}

function noteLogin(text: string): boolean {
  let name: string | undefined
  for (const m of text.matchAll(LOGIN)) name = m[1]
  // drop private-use glyphs (platform icons) the game appends to names
  name = name?.replace(/[\uE000-\uF8FF]/g, '').trim()
  if (!name || name === info.accountName) return false
  info.accountName = name
  return true
}

function handleSize(path: string): number {
  const fd = openSync(path, 'r')
  try {
    return fstatSync(fd).size
  } finally {
    closeSync(fd)
  }
}

// Reads bytes appended since the last check: notes a login and reports whether a load completed.
function readNew(path: string, onInfo: () => void): boolean {
  // the size comes from an open handle: the path's size can lag while the game keeps the log open
  let read: number
  let buf: Buffer
  try {
    const fd = openSync(path, 'r')
    try {
      const st = fstatSync(fd)
      const size = st.size
      // a restarted game makes a new file, which can already be longer than our old position
      const id = `${st.ino}:${st.birthtimeMs}`
      if (size < position || (fileId && id !== fileId)) {
        position = 0
        partial = Buffer.alloc(0)
        tradeScan = NEW_SCAN
      }
      fileId = id
      if (size === position) return false
      buf = Buffer.alloc(size - position)
      read = readSync(fd, buf, 0, buf.length, position)
    } finally {
      closeSync(fd)
    }
  } catch {
    return false
  }
  position += read
  const all = Buffer.concat([partial, buf.subarray(0, read)])
  const cut = all.lastIndexOf(0x0a) + 1 // decode whole lines only
  partial = Buffer.from(all.subarray(cut))
  const text = all.toString('utf8', 0, cut)
  const scan = scanTrades(text, tradeScan)
  tradeScan = scan.state
  for (const t of scan.done) onTrade(t)
  for (const line of text.split('\n')) {
    const player = chatPlayerFromLine(line)
    if (player) void noteChat(player)
    const ev = gameEventFromLine(line)
    if (ev) onGameEvent(ev)
    arbiLine(line)
  }
  const loaded = text.includes(MARKER)
  if (loaded) info.lastLoadAt = Date.now()
  if (noteLogin(text) || loaded) onInfo()
  return loaded
}

export function startInventoryAutoRefresh(
  onLoadComplete: () => void,
  onInfo: () => void = () => {}
): void {
  const path = logPath()
  if (!path || watched) return

  // Start at the current end of the file so old lines don't trigger a refresh on launch.
  // The account name is logged once at login, so read it from what is already in the log.
  try {
    position = existsSync(path) ? handleSize(path) : 0
    partial = Buffer.alloc(0)
    if (position) {
      // the login line is near the start; the whole log can be tens of MB
      const fd = openSync(path, 'r')
      try {
        const head = Buffer.alloc(Math.min(position, 512 * 1024))
        noteLogin(head.toString('utf8', 0, readSync(fd, head, 0, head.length, 0)))
      } finally {
        closeSync(fd)
      }
    }
  } catch {
    position = 0
  }

  // a plain timer, not watchFile: that relies on the path's size/mtime, which can lag on Windows
  timer = setInterval(() => {
    if (!readNew(path, onInfo)) return
    if (debounce) clearTimeout(debounce)
    // too soon after the last refresh: delay it until the gap is up instead of dropping it
    const wait = Math.max(DEBOUNCE_MS, lastRun + MIN_GAP_MS - Date.now())
    debounce = setTimeout(() => {
      debounce = null
      lastRun = Date.now()
      onLoadComplete()
    }, wait)
  }, POLL_MS)
  watched = path
}

export function stopInventoryAutoRefresh(): void {
  if (timer) clearInterval(timer)
  timer = undefined
  watched = null
  if (debounce) {
    clearTimeout(debounce)
    debounce = null
  }
}
