import { net } from 'electron'

// What each craftable thing is made of, from the game's own recipe export (via browse.wf):
// result unique name -> [ingredient unique name, count][]. Covers parts like a Warframe's
// Chassis, which @wfcd lists without their resources. Fetched once per session (~2 MB).
export type RecipeMap = Record<string, [string, number][]>

let loading: Promise<RecipeMap> | null = null

export function getRecipeMap(): Promise<RecipeMap> {
  return (loading ??= load())
}

async function load(): Promise<RecipeMap> {
  try {
    const res = await net.fetch('https://browse.wf/warframe-public-export-plus/ExportRecipes.json')
    if (!res.ok) throw new Error(String(res.status))
    const raw = (await res.json()) as Record<
      string,
      { resultType?: string; ingredients?: { ItemType?: string; ItemCount?: number }[] }
    >
    const out: RecipeMap = {}
    for (const r of Object.values(raw)) {
      if (!r.resultType || out[r.resultType] || !r.ingredients?.length) continue
      out[r.resultType] = r.ingredients
        .filter((i) => i.ItemType)
        .map((i) => [i.ItemType!.replace('/Lotus/StoreItems/', '/Lotus/'), i.ItemCount ?? 1])
    }
    return out
  } catch (e) {
    loading = null // try again next time; callers fall back to the direct resources
    throw e // an empty result would be cached by the window for the whole session
  }
}
