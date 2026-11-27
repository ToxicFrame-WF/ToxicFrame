// Big, fixed game-data lists from the main process, requested once per session and shared by
// every page. (Each page kept its own copy before, so the first visit to every page paid for
// the same transfer again, and the Relic planner fetched all relics on every visit.)
const once = <T>(load: () => Promise<T>): (() => Promise<T>) => {
  let p: Promise<T> | null = null
  return () =>
    (p ??= load().catch((e) => {
      p = null // a failed load is tried again next time
      throw e
    }))
}

export const relics = once(() => window.api.getRelics())
export const masteryCatalog = once(() => window.api.getMasteryCatalog())
export const craftables = once(() => window.api.getCraftables())
export const recipeMap = once(() => window.api.getRecipeMap())
export const inventoryMeta = once(() => window.api.getInventoryMeta())
export const archonShards = once(() => window.api.getArchonShards())
export const masteryIcons = once(() => window.api.getMasteryIcons())
export const resourceCatalog = once(() => window.api.getResourceCatalog())
