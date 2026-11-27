import { app } from 'electron'
import { join } from 'path'
import { readFileSync, renameSync, writeFileSync } from 'fs'
import { wfmFetch } from './wfm'
import { type ContractChange } from './contractInput'
import { getWfmSlug, getWfmStatus, getWfmToken } from './wfmAccount'

// Riven contracts (warframe.market auctions) for the linked account. Only v1 has auctions.
// GET /v1/profile/auctions (logged in) lists your own, hidden ones included; the public
// /v1/profile/{slug}/auctions (visible only) is the fallback. v1 needs the login header with no
// stored cookies (see wfmFetch).
const V1 = 'https://api.warframe.market/v1'
const V2 = 'https://api.warframe.market/v2'

export interface ContractAttr {
  name: string
  value: number
  positive: boolean
  unit?: string
}
export interface Contract {
  id: string
  directSale: boolean
  price: number // buyout, or starting price for auctions without a buyout
  visible: boolean
  weapon: string
  weaponSlug: string
  weaponRef?: string // game unique name, used to match inventory rivens
  weaponIcon?: string
  rivenType: string // rifle | shotgun | pistol | melee | kitgun | zaw | archgun …
  name: string // riven name, e.g. visi-acridra
  rerolls?: number
  mastery?: number
  rank?: number
  polarity?: string
  attributes: ContractAttr[]
  updated?: string
  startingPrice?: number // auctions
  buyoutPrice?: number // auctions: undefined when there is no buyout
  topBid?: number // auctions: highest bid so far
  minRep?: number
  note?: string
}
export interface ContractsResult {
  ok: boolean
  contracts: Contract[]
  error?: string
  savedAt?: number // set when this is the saved copy, not a fresh download
}

interface RivenCatalog {
  weapons: Record<string, { name: string; gameRef?: string; rivenType: string; icon?: string }>
  attrs: Record<string, { name: string; unit?: string }>
}
const CATALOG_MAX_AGE = 7 * 24 * 60 * 60 * 1000
const ASSETS = 'https://warframe.market/static/assets/'
let catalog: Promise<RivenCatalog> | null = null
const catalogFile = (): string => join(app.getPath('userData'), 'riven-catalog.json')

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadCatalog(): Promise<RivenCatalog> {
  try {
    const saved = JSON.parse(readFileSync(catalogFile(), 'utf8')) as { at: number; c: RivenCatalog }
    if (Date.now() - saved.at < CATALOG_MAX_AGE) return saved.c
  } catch {
    // nothing saved yet
  }
  const hdr = { Language: 'en', Accept: 'application/json' }
  const c: RivenCatalog = { weapons: {}, attrs: {} }
  try {
    const w = await wfmFetch(`${V2}/riven/weapons`, { headers: hdr })
    if (w.ok)
      for (const r of ((await w.json()) as { data?: any[] }).data ?? [])
        c.weapons[r.slug] = {
          name: r.i18n?.en?.name ?? r.slug,
          gameRef: r.gameRef,
          // Arch-guns have rivenType 'rifle' but group 'archgun' (checked live 2026-11-15).
          rivenType: r.group === 'archgun' ? 'archgun' : String(r.rivenType ?? r.group ?? 'other'),
          icon: r.i18n?.en?.thumb ? ASSETS + r.i18n.en.thumb : undefined
        }
    const a = await wfmFetch(`${V2}/riven/attributes`, { headers: hdr })
    if (a.ok)
      for (const r of ((await a.json()) as { data?: any[] }).data ?? [])
        c.attrs[r.slug] = { name: r.i18n?.en?.name ?? r.slug, unit: r.unit }
  } catch {
    // fall back to slugs
  }
  if (Object.keys(c.weapons).length && Object.keys(c.attrs).length) {
    try {
      writeFileSync(catalogFile() + '.tmp', JSON.stringify({ at: Date.now(), c }))
      renameSync(catalogFile() + '.tmp', catalogFile())
    } catch {
      // not critical
    }
  } else {
    catalog = null // incomplete: try again on the next load
  }
  return c
}

export const getRivenCatalog = (): Promise<RivenCatalog> => (catalog ??= loadCatalog())

// The last list loaded, shown at once when the tab opens while the live one downloads.
const savedFile = (): string => join(app.getPath('userData'), 'contracts-saved.json')
export function getSavedContracts(): ContractsResult | null {
  try {
    const s = JSON.parse(readFileSync(savedFile(), 'utf8')) as {
      at: number
      slug?: string
      contracts: Contract[]
    }
    if (!s.slug || s.slug !== getWfmSlug()) return null // another account's list
    return { ok: true, contracts: s.contracts, savedAt: s.at }
  } catch {
    return null
  }
}

export async function getMyContracts(): Promise<ContractsResult> {
  await getWfmStatus()
  const token = getWfmToken()
  const slug = getWfmSlug()
  if (!token)
    return {
      ok: false,
      contracts: [],
      error: 'Link your warframe.market account in Settings first.'
    }
  if (!slug)
    return {
      ok: false,
      contracts: [],
      error:
        'Could not read your warframe.market profile name. Link your account again in Settings.'
    }
  const cat = await (catalog ??= loadCatalog())
  try {
    const get = (path: string): Promise<Response> =>
      wfmFetch(`${V1}${path}`, {
        headers: {
          Platform: 'pc',
          Language: 'en',
          Accept: 'application/json',
          Authorization: `JWT ${token}`
        }
      })
    // your own list (hidden ones included); the public profile list is the fallback
    let res = await get('/profile/auctions')
    const own = res.ok // the public fallback omits hidden contracts: not saved
    if (!res.ok) res = await get(`/profile/${encodeURIComponent(slug)}/auctions`)
    const json = res.ok ? ((await res.json()) as any) : null
    const list: any[] = json?.payload?.auctions ?? []
    // No logout on 401 here: that would wipe a good login over a route quirk.
    if (!res.ok)
      return {
        ok: false,
        contracts: [],
        error: `warframe.market answered with status ${res.status}.`
      }
    const contracts: Contract[] = list
      .filter((x) => !x.closed && x.item?.type === 'riven')
      .map((x) => {
        const w = cat.weapons[x.item.weapon_url_name] ?? {
          name: x.item.weapon_url_name,
          rivenType: 'other'
        }
        return {
          id: String(x.id),
          directSale: !!x.is_direct_sell,
          price: Number(x.buyout_price ?? x.starting_price ?? 0),
          visible: x.visible !== false && x.private !== true,
          weapon: w.name,
          weaponSlug: x.item.weapon_url_name,
          weaponRef: w.gameRef,
          weaponIcon: w.icon,
          rivenType: w.rivenType,
          name: String(x.item.name ?? ''),
          rerolls: x.item.re_rolls,
          mastery: x.item.mastery_level,
          rank: x.item.mod_rank,
          polarity: x.item.polarity,
          updated: x.updated,
          minRep: x.minimal_reputation == null ? undefined : Number(x.minimal_reputation),
          note: x.note ? String(x.note) : undefined,
          startingPrice: x.starting_price == null ? undefined : Number(x.starting_price),
          buyoutPrice: x.buyout_price == null ? undefined : Number(x.buyout_price),
          // shortcut: top_bid's shape when set is unseen (always null so far); number or {value|bid}
          topBid:
            x.top_bid == null
              ? undefined
              : Number(
                  typeof x.top_bid === 'object' ? (x.top_bid.value ?? x.top_bid.bid) : x.top_bid
                ) || undefined,
          attributes: (x.item.attributes ?? []).map((at: any) => ({
            name: cat.attrs[at.url_name]?.name ?? at.url_name,
            unit: cat.attrs[at.url_name]?.unit,
            value: Number(at.value),
            positive: !!at.positive
          }))
        }
      })
    if (own)
      try {
        writeFileSync(savedFile() + '.tmp', JSON.stringify({ at: Date.now(), slug, contracts }))
        renameSync(savedFile() + '.tmp', savedFile())
      } catch {
        // not critical: only makes the next opening faster
      }
    return { ok: true, contracts }
  } catch {
    return { ok: false, contracts: [], error: 'Could not reach warframe.market.' }
  }
}

// ---- changing contracts (v1; request shapes from the open-source Merframe client, 2026-11-27) ----
export type { ContractChange }
export interface ContractActionResult {
  ok: boolean
  error?: string
}

async function write(method: string, path: string, body?: unknown): Promise<ContractActionResult> {
  const token = getWfmToken()
  if (!token) return { ok: false, error: 'Link your warframe.market account in Settings first.' }
  try {
    const res = await wfmFetch(`${V1}${path}`, {
      method,
      headers: {
        Platform: 'pc',
        Language: 'en',
        Accept: 'application/json',
        Authorization: `JWT ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (res.ok) return { ok: true }
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    return {
      ok: false,
      error: `warframe.market answered with status ${res.status}. ${detail}`.trim()
    }
  } catch {
    return { ok: false, error: 'Could not reach warframe.market.' }
  }
}

const entry = (id: string): string => `/auctions/entry/${encodeURIComponent(id)}`
export const updateContract = (id: string, change: ContractChange): Promise<ContractActionResult> =>
  write('PUT', entry(id), change)
// "close" removes the contract from warframe.market
export const removeContract = (id: string): Promise<ContractActionResult> =>
  write('PUT', `${entry(id)}/close`)
export const setAllContractsVisible = (visible: boolean): Promise<ContractActionResult> =>
  write('PUT', '/profile/auctions/visibility', { visibility: visible })
export const createContract = (body: unknown): Promise<ContractActionResult> =>
  write('POST', '/auctions/create', body)
