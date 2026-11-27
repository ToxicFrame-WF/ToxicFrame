import { app, net } from 'electron'

// Shared rules for every request to warframe.market (see their third-party tool guidelines):
// - identify the app with a descriptive User-Agent (never pretend to be a browser)
// - stay under the documented limit of about 3 requests per second, across the whole app
// Add a contact link to the User-Agent once the project has a public page.
const CONTACT = 'https://toxicframe-wf.github.io' // so warframe.market can reach us instead of blocking the app
export const WFM_USER_AGENT = `ToxicFrame/${app.getVersion()} (Warframe companion app${CONTACT ? `; ${CONTACT}` : ''})`

const MIN_GAP_MS = 400 // ~2.5 requests/second
let nextSlot = 0

export async function wfmFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const now = Date.now()
  const start = Math.max(now, nextSlot)
  nextSlot = start + MIN_GAP_MS // reserve the slot before waiting so concurrent callers queue up
  if (start > now) await new Promise((r) => setTimeout(r, start - now))
  const headers = new Headers(init.headers)
  headers.set('User-Agent', WFM_USER_AGENT)
  const res = await net.fetch(url, {
    ...init,
    headers,
    // no stored cookies: a logged-out "JWT" cookie overrides the login header on v1 (401 on every
    // own-account v1 route until this, found 2026-11-27); the app always logs in by header
    credentials: 'omit',
    signal: init.signal ?? AbortSignal.timeout(20_000) // a hung request must not freeze single-flight guards
  })
  if (res.status === 429) {
    const ra = Number(res.headers.get('Retry-After'))
    nextSlot = Math.max(nextSlot, Date.now() + (ra > 0 ? ra * 1000 : 5000)) // everyone backs off
  }
  return res
}
