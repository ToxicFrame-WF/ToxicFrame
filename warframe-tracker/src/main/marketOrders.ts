import { wfmFetch } from './wfm'
import { getWfmStatus, getWfmToken, wfmLogout } from './wfmAccount'
import { saveTrade, readSavedOrders, saveOrders } from './tradeLog'

// Read-only market data: the linked account's own orders, and the top orders for any item.
const V2 = 'https://api.warframe.market/v2'

export interface MyOrder {
  id: string
  type: string // 'sell' | 'buy'
  platinum: number
  quantity: number
  visible: boolean
  itemId: string
  rank?: number
}
export interface MyOrdersResult {
  ok: boolean
  orders: MyOrder[]
  error?: string
  savedAt?: number // set when this is the saved copy, not a fresh download
}

let known: MyOrder[] = readSavedOrders<MyOrder>()?.orders ?? []
export function getSavedOrders(): MyOrdersResult | null {
  const saved = readSavedOrders<MyOrder>()
  return saved ? { ok: true, orders: saved.orders, savedAt: saved.at } : null
}
export interface TopOrder {
  id: string
  platinum: number
  quantity: number
  user: string
  status: string
}
export interface TopOrders {
  sell: TopOrder[]
  buy: TopOrder[]
}

export interface ItemOrder {
  id: string
  type: string
  platinum: number
  quantity: number
  user: string
  status: string // 'ingame' | 'online' | 'offline' | 'invisible'
  rank?: number
  platform?: string // 'pc' | 'ps4' | 'xbox' | 'switch' | 'mobile'
}
export interface ItemOrders {
  sell: ItemOrder[]
  buy: ItemOrder[]
}

const headers = (token?: string): Record<string, string> => ({
  Platform: 'pc',
  Language: 'en',
  Accept: 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
})

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getMyOrders(): Promise<MyOrdersResult> {
  await getWfmStatus() // restores the saved login if needed
  const token = getWfmToken()
  if (!token)
    return { ok: false, orders: [], error: 'Link your warframe.market account in Settings first.' }
  try {
    const res = await wfmFetch(`${V2}/orders/my`, { headers: headers(token) })
    if (res.status === 401) {
      wfmLogout()
      return {
        ok: false,
        orders: [],
        error: 'Your warframe.market login expired. Link your account again in Settings.'
      }
    }
    if (!res.ok)
      return { ok: false, orders: [], error: `warframe.market answered with status ${res.status}.` }
    const json = (await res.json()) as { data?: any[] }
    const orders: MyOrder[] = (json.data ?? []).map((o) => ({
      id: String(o.id),
      type: String(o.type ?? 'sell'),
      platinum: Number(o.platinum ?? 0),
      quantity: Number(o.quantity ?? 1),
      visible: o.visible !== false,
      itemId: String(o.itemId ?? o.item?.id ?? ''),
      rank: typeof o.rank === 'number' ? o.rank : undefined
    }))
    known = orders
    saveOrders(orders)
    return { ok: true, orders }
  } catch {
    return { ok: false, orders: [], error: 'Could not reach warframe.market.' }
  }
}

const mapTop = (list: any[] | undefined): TopOrder[] =>
  (list ?? []).map((o) => ({
    id: String(o.id),
    platinum: Number(o.platinum ?? 0),
    quantity: Number(o.quantity ?? 1),
    user: String(o.user?.ingameName ?? o.user?.slug ?? '?'),
    status: String(o.user?.status ?? 'online')
  }))

export async function getTopOrders(slug: string): Promise<TopOrders | null> {
  try {
    const res = await wfmFetch(`${V2}/orders/item/${encodeURIComponent(slug)}/top`, {
      headers: headers()
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { sell?: any[]; buy?: any[] } }
    return { sell: mapTop(json.data?.sell), buy: mapTop(json.data?.buy) }
  } catch {
    return null
  }
}

// Every order on one item (not just the top five), for the Buy / Sell tab.
export async function getItemOrders(slug: string): Promise<ItemOrders | null> {
  try {
    const res = await wfmFetch(`${V2}/orders/item/${encodeURIComponent(slug)}`, {
      headers: headers()
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: any[] }
    const out: ItemOrders = { sell: [], buy: [] }
    for (const o of json.data ?? []) {
      const order: ItemOrder = {
        id: String(o.id),
        type: String(o.type),
        platinum: Number(o.platinum ?? 0),
        quantity: Number(o.quantity ?? 1),
        user: String(o.user?.ingameName ?? o.user?.slug ?? '?'),
        status: String(o.user?.status ?? 'offline'),
        rank: typeof o.rank === 'number' ? o.rank : undefined,
        platform: o.user?.platform ? String(o.user.platform) : undefined
      }
      if (o.type === 'buy') out.buy.push(order)
      else out.sell.push(order)
    }
    return out
  } catch {
    return null
  }
}

// ---- Editing your own orders (needs the linked account) ----
// Routes and bodies taken from the community OpenAPI spec / wf-market client; not yet tested live.
export interface OrderEdit {
  platinum?: number
  quantity?: number
  visible?: boolean
}
export interface OrderActionResult {
  ok: boolean
  error?: string
}

async function orderRequest(
  method: 'PATCH' | 'POST' | 'DELETE',
  path: string,
  body?: unknown
): Promise<OrderActionResult> {
  await getWfmStatus()
  const token = getWfmToken()
  if (!token) return { ok: false, error: 'Link your warframe.market account in Settings first.' }
  try {
    const res = await wfmFetch(`${V2}${path}`, {
      method,
      headers: { ...headers(token), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    })
    if (res.status === 401) {
      wfmLogout()
      return {
        ok: false,
        error: 'Your warframe.market login expired. Link your account again in Settings.'
      }
    }
    if (res.status === 403)
      return { ok: false, error: 'warframe.market says this order is not yours.' }
    if (res.status === 404)
      return { ok: false, error: 'That order no longer exists. Reload your orders.' }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`Order ${method} ${path} failed: ${res.status} ${text.slice(0, 300)}`)
      return { ok: false, error: `warframe.market answered with status ${res.status}.` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach warframe.market.' }
  }
}

const safeId = (id: string): string => encodeURIComponent(id)

export function updateOrder(id: string, edit: OrderEdit): Promise<OrderActionResult> {
  const body: OrderEdit = {}
  if (typeof edit.platinum === 'number' && edit.platinum > 0)
    body.platinum = Math.floor(edit.platinum)
  if (typeof edit.quantity === 'number' && edit.quantity > 0)
    body.quantity = Math.floor(edit.quantity)
  if (typeof edit.visible === 'boolean') body.visible = edit.visible
  if (!Object.keys(body).length) return Promise.resolve({ ok: false, error: 'Nothing to change.' })
  return orderRequest('PATCH', `/order/${safeId(id)}`, body)
}

// Records a sale of `quantity` units (removes the order when none are left).
// Each successful close is written to the trade log (price and item from the known order).
export const knownOrders = (): MyOrder[] => known

// `actual` overrides what is logged: the platinum really paid and who paid it (auto-track).
export async function closeOrder(
  id: string,
  quantity: number,
  actual?: { platinum?: number; user?: string; log?: boolean } // log: false = caller logs it
): Promise<OrderActionResult> {
  const qty = Math.max(1, Math.floor(quantity))
  const res = await orderRequest('POST', `/order/${safeId(id)}/close`, { quantity: qty })
  const o = known.find((k) => k.id === id)
  if (res.ok && o) {
    let logged = true
    if (actual?.log !== false)
      logged = await saveTrade({
        at: Date.now(),
        type: o.type === 'buy' ? 'buy' : 'sell',
        itemId: o.itemId,
        platinum: actual?.platinum ?? o.platinum,
        quantity: qty,
        user: actual?.user
      })
    o.quantity -= qty
    known = known.filter((k) => k.quantity > 0)
    saveOrders(known)
    // the close did happen, so stay ok:true; the message tells the user the log missed it
    if (!logged)
      return { ok: true, error: 'Closed, but the sale could not be saved to the trade log.' }
  } else if (res.ok && actual?.log !== false)
    return { ok: true, error: 'Closed, but not logged (order not in the loaded list).' }
  return res
}

// New order on warframe.market. Route and body from the v2 spec; not yet tested live.
export interface NewOrder {
  itemId: string
  type: 'sell' | 'buy'
  platinum: number
  quantity: number
  rank?: number
}
export function createOrder(o: NewOrder): Promise<OrderActionResult> {
  const platinum = Math.floor(o.platinum)
  const quantity = Math.floor(o.quantity)
  if (!o.itemId || !(platinum > 0) || !(quantity > 0))
    return Promise.resolve({
      ok: false,
      error: 'Price and quantity must be whole numbers above 0.'
    })
  return orderRequest('POST', '/order', {
    itemId: o.itemId,
    type: o.type === 'buy' ? 'buy' : 'sell',
    platinum,
    quantity,
    visible: true,
    ...(typeof o.rank === 'number' && o.rank >= 0 ? { rank: Math.floor(o.rank) } : {})
  })
}

export function deleteOrder(id: string): Promise<OrderActionResult> {
  return orderRequest('DELETE', `/order/${safeId(id)}`)
}
