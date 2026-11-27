import { useSyncExternalStore } from 'react'

// Owned inventory from the game (via the helper in the main process). Shared by every
// component; updates arrive over IPC whenever a refresh starts or finishes.

let status: InventoryStatus = { state: 'none' }
const listeners = new Set<() => void>()
let started = false

function set(next: InventoryStatus): void {
  status = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true
    window.api.onInventory(set)
    window.api.getInventory().then((s) => {
      // don't overwrite a refresh that already reported back
      if (status.state === 'none') set(s)
    })
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInventory(): InventoryStatus {
  return useSyncExternalStore(subscribe, () => status)
}

export function refreshInventory(): void {
  window.api.refreshInventory()
}

// Copies of a relic the game says you own, per refinement. Undefined when there is no
// inventory data (then the manual "I own N" counter is used).
export function relicCounts(
  inv: InventoryStatus,
  relicId: string
): Record<string, number> | undefined {
  if (!inv.data) return undefined
  return inv.data.relics[relicId] ?? {}
}

export function totalOf(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

// How many of a build part you own: built parts and resources sit in MiscItems, blueprints in
// Recipes; a part (…Component) also counts its own blueprint (…Blueprint).
export function partCounter(raw: Record<string, unknown>): (uniqueName: string) => number {
  const counts = new Map<string, number>()
  for (const key of ['MiscItems', 'Recipes']) {
    const list = raw[key]
    if (!Array.isArray(list)) continue
    for (const e of list as { ItemType?: string; ItemCount?: number }[])
      if (e.ItemType) {
        const id = e.ItemType.replace('/Lotus/StoreItems/', '/Lotus/')
        counts.set(id, (counts.get(id) ?? 0) + (e.ItemCount ?? 0))
      }
  }
  return (u) =>
    (counts.get(u) ?? 0) +
    (u.endsWith('Component') ? (counts.get(u.replace(/Component$/, 'Blueprint')) ?? 0) : 0)
}
