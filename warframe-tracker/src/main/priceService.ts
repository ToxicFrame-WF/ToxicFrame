import { wfmFetch } from './wfm'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { getWfmSlug } from './wfmAccount'

export interface PriceResult {
  slug: string
  price: number | null // median of the cheapest online sell orders
  lowest?: number | null // the single cheapest online sell order
  sellers: number // how many orders the median is based on
  fetchedAt: number
}

const API = 'https://api.warframe.market/v2'
const MAX_AGE_MS = 10 * 60 * 1000 // cached prices count as fresh for 10 minutes
const SAMPLE = 5 // the top endpoint returns at most 5 sell orders

const cache = new Map<string, PriceResult>()
const inFlight = new Map<string, Promise<PriceResult>>()
const queue: { run: () => Promise<void>; age: number }[] = []
let pumping = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const cacheFile = (): string => join(app.getPath('userData'), 'prices.json')

export function loadPriceCache(): void {
  try {
    const saved = JSON.parse(readFileSync(cacheFile(), 'utf8')) as PriceResult[]
    for (const p of saved) cache.set(p.slug, p)
  } catch {
    // no cache yet
  }
}

function scheduleSave(): void {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      writeFileSync(cacheFile(), JSON.stringify([...cache.values()]))
    } catch {
      // not critical
    }
  }, 2000)
}

// Lower median: with an even count take the cheaper middle order, never their average. Two
// sellers at 24 and 100 would otherwise price the item at 62, which nobody is asking.
function median(sorted: number[]): number | null {
  if (!sorted.length) return null
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

// Ranked items (mods, arcanes) are priced per rank, under the key "slug#rank".
const keyOf = (slug: string, rank?: number): string => (rank != null ? `${slug}#${rank}` : slug)

async function fetchFromMarket(slug: string, rank?: number): Promise<PriceResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await wfmFetch(
      `${API}/orders/item/${encodeURIComponent(slug)}/top${rank != null ? `?rank=${rank}` : ''}`,
      {
        headers: {
          Platform: 'pc',
          Language: 'en',
          Accept: 'application/json'
        }
      }
    )
    if (res.status === 429) {
      await sleep(2000)
      continue
    }
    if (res.status === 404)
      return {
        slug: keyOf(slug, rank),
        price: null,
        lowest: null,
        sellers: 0,
        fetchedAt: Date.now()
      }
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200)
      throw new Error(`warframe.market returned ${res.status}: ${body}`)
    }

    const json = (await res.json()) as {
      data?: { sell?: { platinum?: number; user?: { status?: string; slug?: string } }[] }
    }
    const me = getWfmSlug()
    const prices = (json.data?.sell ?? [])
      // offline sellers can't trade, and your own order must not set your price
      .filter((o) => o.user?.status !== 'offline' && o.user?.status !== 'invisible')
      .filter((o) => !me || o.user?.slug !== me)
      .map((o) => o.platinum)
      .filter((n): n is number => typeof n === 'number')
      .sort((a, b) => a - b)
      .slice(0, SAMPLE)
    return {
      slug: keyOf(slug, rank),
      price: median(prices),
      lowest: prices[0] ?? null,
      sellers: prices.length,
      fetchedAt: Date.now()
    }
  }
  throw new Error('rate limited by warframe.market')
}

async function pump(): Promise<void> {
  if (pumping) return
  pumping = true
  while (queue.length) {
    // stalest first: prices never fetched (age 0), then the oldest saved ones
    let i = 0
    for (let j = 1; j < queue.length; j++) if (queue[j].age < queue[i].age) i = j
    await queue.splice(i, 1)[0].run() // never throws; wfmFetch spaces the requests
  }
  pumping = false
}

export function getPrice(slug: string, force = false, rank?: number): Promise<PriceResult> {
  const key = keyOf(slug, rank)
  const cached = cache.get(key)
  if (!force && cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return Promise.resolve(cached)

  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = new Promise<PriceResult>((resolve, reject) => {
    queue.push({
      age: force ? -1 : (cached?.fetchedAt ?? 0), // forced (live re-check) requests jump the queue
      run: async () => {
        try {
          const result = await fetchFromMarket(slug, rank)
          cache.set(key, result)
          scheduleSave()
          resolve(result)
        } catch (e) {
          reject(e)
        } finally {
          inFlight.delete(key)
        }
      }
    })
  })
  inFlight.set(key, promise)
  void pump()
  return promise
}

// Every price saved so far, even old ones, so the UI can show them instantly on launch.
export function getCachedPrices(): PriceResult[] {
  return [...cache.values()]
}
