import { useSyncExternalStore } from 'react'

// One shared price store: cards, the sort and the "load all" button all read from it,
// so a price is only ever requested once.
export type PriceState = PriceResult | 'error'

const MAX_AGE_MS = 10 * 60 * 1000
const prices = new Map<string, PriceState>()
const RETRY_MS = 60 * 1000
const failedAt = new Map<string, number>()
const pending = new Set<string>()
const listeners = new Set<() => void>()
let version = 0
let timer: ReturnType<typeof setTimeout> | null = null

// Batch UI updates so a burst of arriving prices re-renders at most 4 times a second.
function emit(): void {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    version++
    listeners.forEach((l) => l())
  }, 250)
}

// A key is a slug, or "slug#rank" for one rank of a mod or arcane.
export const priceKey = (slug: string, rank?: number): string =>
  rank != null ? `${slug}#${rank}` : slug

function load(slug: string, force: boolean): void {
  pending.add(slug)
  const [itemSlug, rank] = slug.split('#')
  window.api
    .getPrice(itemSlug, force, rank !== undefined ? Number(rank) : undefined)
    .then((r) => prices.set(slug, r))
    .catch(() => {
      prices.set(slug, 'error')
      failedAt.set(slug, Date.now())
    })
    .finally(() => {
      pending.delete(slug)
      emit()
    })
}

// Load every price saved on disk (even old ones) so the list is usable immediately.
export async function seedFromCache(): Promise<void> {
  try {
    for (const r of await window.api.getCachedPrices()) {
      if (!prices.has(r.slug)) prices.set(r.slug, r)
    }
    emit()
  } catch {
    // no saved prices yet
  }
}

export function requestPrices(slugs: string[]): void {
  for (const slug of slugs) {
    const cur = prices.get(slug)
    if (pending.has(slug)) continue
    if (cur === 'error' && Date.now() - (failedAt.get(slug) ?? 0) < RETRY_MS) continue
    if (cur && cur !== 'error' && Date.now() - cur.fetchedAt < MAX_AGE_MS) continue
    load(slug, false)
  }
}

export function refreshPrice(slug: string): void {
  prices.delete(slug)
  pending.delete(slug)
  load(slug, true)
  emit()
}

export function usePriceStore(): {
  get: (slug?: string) => PriceState | undefined
  version: number
} {
  const v = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version
  )
  return { get: (slug) => (slug ? prices.get(slug) : undefined), version: v }
}
