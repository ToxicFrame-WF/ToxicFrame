import { execFile } from 'child_process'
import { getWfmSlug, getWfmStatus, getWfmToken } from './wfmAccount'
import { WFM_USER_AGENT, wfmFetch } from './wfm'

// Your warframe.market status (online / in game / invisible). warframe.market sets it over its
// websocket, not the REST API: sign in with the account token, then "@wfm|cmd/status/set".
// Message shapes from the wf-market client (github.com/Trollcraft1002/wf-market, src/ws/).
// The socket is opened only once you pick a status, so starting the app never changes it, and
// is kept open (re-sending the pick after a drop) because the status belongs to a live session.
const WS_URL = 'wss://ws.warframe.market/socket'
export type WfmPresence = 'invisible' | 'online' | 'ingame'

let ws: WebSocket | null = null
let wanted: WfmPresence | null = null
let current: WfmPresence | null = null
let retry: ReturnType<typeof setTimeout> | undefined
let onChange: (s: WfmPresence | null) => void = () => {}

export const setPresenceListener = (fn: (s: WfmPresence | null) => void): void => {
  onChange = fn
}
export const getPresence = (): WfmPresence | null => current

// What buyers see (also before the app has set a status): the public profile's status.
export async function getPublicStatus(): Promise<WfmPresence | 'offline' | null> {
  await getWfmStatus()
  const slug = getWfmSlug()
  if (!slug) return null
  try {
    const res = await wfmFetch(`https://api.warframe.market/v2/user/${encodeURIComponent(slug)}`, {
      headers: { Platform: 'pc', Accept: 'application/json' }
    })
    if (!res.ok) return null
    const st = ((await res.json()) as { data?: { status?: string } }).data?.status
    return st === 'online' || st === 'ingame' || st === 'invisible' || st === 'offline' ? st : null
  } catch {
    return null
  }
}

const id = (): string => Math.random().toString(36).slice(2, 13)
const send = (route: string, payload?: unknown): void =>
  ws?.send(
    JSON.stringify(payload === undefined ? { route, id: id() } : { route, payload, id: id() })
  )

// send the status and show it straight away; a later reply from warframe.market corrects it
function sendStatus(status: WfmPresence): void {
  send('@wfm|cmd/status/set', { status })
  current = status
  onChange(current)
}

export async function setPresence(status: WfmPresence): Promise<void> {
  wanted = status
  if (ws?.readyState === WebSocket.OPEN && signedIn) sendStatus(status)
  else await connect()
}

let signedIn = false
// one attempt at a time: two callers passing the `ws` check during the await would open two sockets
let connecting: Promise<void> | null = null
const connect = (): Promise<void> => (connecting ??= doConnect().finally(() => (connecting = null)))
async function doConnect(): Promise<void> {
  if (ws) return
  await getWfmStatus() // restores the saved login
  const token = getWfmToken()
  if (ws || !wanted) return // stopped while waiting
  if (!token) {
    clearTimeout(retry)
    retry = setTimeout(() => void connect(), 30_000) // not signed in yet: try again later
    return
  }
  signedIn = false
  // Cloudflare in front of warframe.market refuses Node's default User-Agent ("node", 403):
  // send ours. Headers are an option of Node's built-in WebSocket, not the browser API.
  const sock = new WebSocket(WS_URL, {
    protocols: 'wfm',
    headers: { 'User-Agent': WFM_USER_AGENT }
  } as unknown as string)
  ws = sock
  sock.onopen = () => {
    send('@wfm|cmd/auth/signIn', { token })
  }
  sock.onmessage = (e) => {
    let msg: {
      route?: string
      payload?: { status?: string; error?: string; user?: { status?: string } }
    }
    try {
      msg = JSON.parse(String(e.data))
    } catch {
      return
    }
    if (msg.route === '@wfm|cmd/auth/signIn:ok') {
      signedIn = true
      if (wanted) sendStatus(wanted)
    } else if (msg.route === '@wfm|cmd/auth/signIn:error') {
      console.error('warframe.market status: sign-in refused:', msg.payload?.error)
      wanted = null // a bad token won't get better by retrying
      sock.close()
    } else if (/^@wfm\|(event|cmd)\/status\/set/.test(msg.route ?? '')) {
      // the confirmation's exact form isn't documented: take the status wherever it is
      const st = msg.payload?.status ?? msg.payload?.user?.status
      if (st === 'invisible' || st === 'online' || st === 'ingame') {
        current = st
        onChange(current)
      }
    }
  }
  sock.onclose = () => {
    if (ws !== sock) return
    ws = null
    signedIn = false
    // the status lives with the session: reconnect and set it again while one is wanted
    clearTimeout(retry)
    if (wanted) retry = setTimeout(() => void connect(), 5000)
  }
  sock.onerror = () => {} // onclose follows and retries
}

// signing out of warframe.market in the app also drops the status connection
export function stopPresence(): void {
  clearInterval(autoTimer)
  wanted = null
  current = null
  clearTimeout(retry)
  ws?.close()
  ws = null
  onChange(null)
}

// Auto: while Warframe runs the status is "in game", otherwise the status you picked.
// shortcut: checks the process list every 15 s (tasklist, or pgrep on Linux);
// macOS never sees the game as running.
let autoTimer: ReturnType<typeof setInterval> | undefined
let manual: WfmPresence = 'online'
let lastRunning: boolean | undefined

function isGameRunning(): Promise<boolean> {
  if (process.platform === 'linux')
    return new Promise(
      (resolve) => execFile('pgrep', ['-f', 'Warframe.x64.exe'], (err) => resolve(!err)) // exit 1 = no match
    )
  if (process.platform !== 'win32') return Promise.resolve(false)
  return new Promise((resolve) =>
    execFile(
      'tasklist',
      ['/FI', 'IMAGENAME eq Warframe.x64.exe', '/NH'],
      { windowsHide: true },
      (err, stdout) => resolve(!err && /Warframe\.x64\.exe/i.test(stdout))
    )
  )
}

async function autoTick(): Promise<void> {
  const running = await isGameRunning()
  if (running === lastRunning) return // only act when the game starts or stops
  lastRunning = running
  try {
    await setPresence(running ? 'ingame' : manual)
  } catch (e) {
    lastRunning = undefined // retry on the next tick
    throw e
  }
}

export function setAutoPresence(on: boolean, base: WfmPresence): void {
  clearInterval(autoTimer)
  manual = base === 'ingame' ? 'online' : base // "in game" outside the game would be wrong
  lastRunning = undefined
  if (!on) return
  void autoTick()
  autoTimer = setInterval(() => void autoTick(), 15_000)
}
