// How much of each resource a set of blueprints needs, counting through their parts (a
// Warframe's Chassis, a weapon's Barrel...). Pure, so it can be tested.

export interface NeedItem {
  uniqueName: string
  components: { uniqueName: string; itemCount: number; kind: string }[]
}

// result unique name -> [ingredient unique name, count][] (the game's recipe export)
export type Recipes = Record<string, [string, number][]>

export function resourceNeeds(
  items: NeedItem[],
  include: (id: string) => boolean,
  recipes: Recipes = {},
  owned: (id: string) => number = () => 0,
  isResource: (id: string) => boolean = () => false
): Map<string, number> {
  const out = new Map<string, number>()
  const addLeaf = (id: string, n: number): void => {
    out.set(id, (out.get(id) ?? 0) + n)
  }
  // a part you lack is broken down into what it is built from; parts you already own count as done
  const add = (id: string, n: number, depth: number): void => {
    const recipe = recipes[id]
    // resources stay whole even when they are refined from something (Axidrol Alloy from ore)
    if (!recipe || isResource(id) || depth > 4) return addLeaf(id, n)
    const missing = n - owned(id)
    if (missing <= 0) return
    for (const [c, k] of recipe) add(c, missing * k, depth + 1)
  }
  for (const it of items) {
    if (!include(it.uniqueName)) continue
    const recipe = recipes[it.uniqueName]
    if (recipe) for (const [c, k] of recipe) add(c, k, 1)
    // no recipe data (not loaded, or not in the export): the item's direct resources only
    else
      for (const c of it.components) if (c.kind === 'resource') addLeaf(c.uniqueName, c.itemCount)
  }
  return out
}
