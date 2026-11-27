import { wfmFetch } from './wfm'
import { app, safeStorage } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { readFileSync, renameSync, writeFileSync } from 'fs'

// Links a warframe.market account. The password is sent straight to warframe.market and is never
// saved or logged; only the login token that comes back is kept, encrypted with the operating
// system's secure storage (Windows DPAPI).
const V1 = 'https://api.warframe.market/v1'
const V2 = 'https://api.warframe.market/v2'

export interface WfmStatus {
  linked: boolean
  name?: string
}
export interface WfmLoginResult {
  ok: boolean
  name?: string
  error?: string
}

interface Saved {
  deviceId: string
  token?: string // encrypted, base64
}

let session: { token: string; name: string; slug?: string } | null = null
let restoring: Promise<void> | null = null
const file = (): string => join(app.getPath('userData'), 'wfm-account.json')

function readSaved(): Saved {
  try {
    const s = JSON.parse(readFileSync(file(), 'utf8')) as Saved
    if (s.deviceId) return s
  } catch {
    // first run
  }
  const fresh = { deviceId: randomUUID() }
  writeSaved(fresh)
  return fresh
}
function writeSaved(s: Saved): void {
  try {
    // temp file + rename: a crash mid-write must not lose the login token
    writeFileSync(file() + '.tmp', JSON.stringify(s))
    renameSync(file() + '.tmp', file())
  } catch {
    // not critical
  }
}

// The account's in-game name + profile slug; 'rejected' when warframe.market refuses the token,
// null when it could not be asked (offline, server down): then the token is kept for later.
async function fetchMe(
  token: string
): Promise<{ name: string; slug?: string } | 'rejected' | null> {
  try {
    const res = await wfmFetch(`${V2}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Platform: 'pc',
        Language: 'en',
        Accept: 'application/json'
      }
    })
    if (res.status === 401 || res.status === 403) return 'rejected'
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { ingameName?: string; slug?: string } }
    return {
      name: json.data?.ingameName ?? json.data?.slug ?? 'your account',
      slug: json.data?.slug
    }
  } catch {
    return null
  }
}

// Every caller waits for the same restore, so none of them sees "not linked" while it is still running.
function restore(): Promise<void> {
  return (restoring ??= doRestore())
}

async function doRestore(): Promise<void> {
  const saved = readSaved()
  if (!saved.token || !safeStorage.isEncryptionAvailable()) return
  try {
    const token = safeStorage.decryptString(Buffer.from(saved.token, 'base64'))
    const me = await fetchMe(token)
    if (me === 'rejected')
      writeSaved({ deviceId: saved.deviceId }) // token expired: forget it
    else if (me) session = { token, ...me }
    else restoring = null // not reachable: keep the token, the next status check tries again
  } catch {
    writeSaved({ deviceId: saved.deviceId }) // could not decrypt: no use keeping it
  }
}

export async function getWfmStatus(): Promise<WfmStatus> {
  await restore()
  return session ? { linked: true, name: session.name } : { linked: false }
}

export async function wfmLogin(email: string, password: string): Promise<WfmLoginResult> {
  const saved = readSaved()
  try {
    const res = await wfmFetch(`${V1}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'JWT',
        Platform: 'pc',
        Language: 'en'
      },
      body: JSON.stringify({ auth_type: 'header', email, password, device_id: saved.deviceId })
    })
    if (res.status === 400 || res.status === 401) {
      return {
        ok: false,
        error: 'Wrong email or password, or warframe.market refused the sign-in.'
      }
    }
    if (!res.ok) return { ok: false, error: `warframe.market answered with status ${res.status}.` }

    const token = (res.headers.get('authorization') ?? '').replace(/^JWT\s+/i, '')
    if (!token) return { ok: false, error: 'Signed in, but no login token came back.' }

    const found = await fetchMe(token)
    const me = found && found !== 'rejected' ? found : { name: 'your account' }
    const name = me.name
    session = { token, ...me }
    restoring = found && found !== 'rejected' ? Promise.resolve() : null // profile missing: next status check retries
    if (safeStorage.isEncryptionAvailable()) {
      writeSaved({
        deviceId: saved.deviceId,
        token: safeStorage.encryptString(token).toString('base64')
      })
    }
    return { ok: true, name }
  } catch {
    return { ok: false, error: 'Could not reach warframe.market.' }
  }
}

export function wfmLogout(): void {
  session = null
  restoring = Promise.resolve()
  writeSaved({ deviceId: readSaved().deviceId })
}

// For features that need the account later (own orders, trading).
export const getWfmToken = (): string | null => session?.token ?? null
export const getWfmSlug = (): string | null => session?.slug ?? null
