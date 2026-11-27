import type { InvRow } from './useInventoryItems'

// One row per item you own at least one tradable part of: its parts, how many full sets you
// could build, and the set's market name. Shared by the Inventory page and My orders.
export type SetOwner = Map<
  string,
  { item?: { name: string; imageName?: string }; mastered?: boolean }
>

export function buildSets(
  invMeta: Record<string, InvMeta>,
  parts: { key: string; count: number }[],
  byItem: SetOwner
): InvRow[] {
  const owned = new Map(parts.map((p) => [p.key, p.count]))
  const byParent = new Map<string, { id: string; m: InvMeta }[]>()
  for (const [id, m] of Object.entries(invMeta))
    if (m.kind === 'part' && m.parent && m.tradable)
      byParent.set(m.parent, [...(byParent.get(m.parent) ?? []), { id, m }])
  const out: InvRow[] = []
  for (const [parent, list] of byParent) {
    if (!list.some(({ id }) => owned.has(id))) continue
    const item = byItem.get(parent)?.item
    const name = item?.name ?? list[0].m.name.split(' ').slice(0, -1).join(' ')
    const setParts = list
      .map(({ id, m }) => ({
        name: m.name.startsWith(name) ? m.name.slice(name.length).trim() : m.name,
        image: m.image,
        have: owned.get(id) ?? 0,
        need: m.need ?? 1,
        slug: m.slug
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    out.push({
      key: `set:${parent}`,
      kind: 'part',
      name: `${name} Set`,
      image: item?.imageName,
      count: Math.min(...setParts.map((x) => Math.floor(x.have / x.need))),
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_set`,
      ducats: list.reduce((n, { m }) => n + (m.ducats ?? 0) * (m.need ?? 1), 0) || undefined,
      tradable: true,
      isPrime: list[0].m.isPrime,
      parent,
      setParts,
      mastered: byItem.get(parent)?.mastered
    })
  }
  return out
}
