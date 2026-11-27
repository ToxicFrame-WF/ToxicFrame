import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { wfmFetch } from './wfm'
import { getWfmSlug, getWfmStatus, getWfmToken } from './wfmAccount'

// Riven contracts (warframe.market auctions) for the linked account. Read-only.
// The auction route is NOT in the v2 spec; this uses the legacy v1 profile route
// GET /v1/profile/{slug}/auctions with the login token. UNVERIFIED: whether it returns hidden
// auctions and which auth header it wants.
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
}
export interface ContractsResult {
  ok: boolean
  contracts: Contract[]
  error?: string
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
      writeFileSync(catalogFile(), JSON.stringify({ at: Date.now(), c }))
    } catch {
      // not critical
    }
  } else {
    catalog = null // incomplete: try again on the next load
  }
  return c
}

export const getRivenCatalog = (): Promise<RivenCatalog> => (catalog ??= loadCatalog())

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
    const res = await wfmFetch(`${V1}/profile/${encodeURIComponent(slug)}/auctions`, {
      headers: {
        Platform: 'pc',
        Language: 'en',
        Accept: 'application/json',
        Authorization: `JWT ${token}`
      }
    })
    const json = res.ok ? ((await res.json()) as any) : null
    const list: any[] = json?.payload?.auctions ?? []
    // No logout on 401 here: the header format is unconfirmed and that would wipe a good login.
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
          attributes: (x.item.attributes ?? []).map((at: any) => ({
            name: cat.attrs[at.url_name]?.name ?? at.url_name,
            unit: cat.attrs[at.url_name]?.unit,
            value: Number(at.value),
            positive: !!at.positive
          }))
        }
      })
    return { ok: true, contracts }
  } catch {
    return { ok: false, contracts: [], error: 'Could not reach warframe.market.' }
  }
}
