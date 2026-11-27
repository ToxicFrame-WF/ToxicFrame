import { app, net } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

// Numbers needed to turn a riven's raw rolls into percentages, from the game files as published by
// browse.wf: each riven type's base value per stat. Cut down to those numbers and cached for a
// week. (Dispositions were retired: every weapon is 1.2 now, see rivens.ts.)
const BASE = 'https://browse.wf/warframe-public-export-plus/'
const MAX_AGE = 7 * 24 * 60 * 60 * 1000
const file = (): string => join(app.getPath('userData'), 'riven-values-2.json') // bump when the shape changes

export interface RivenData {
  values: Record<string, Record<string, number>> // riven unique name -> stat tag -> base value
  affix: Record<string, [string, string]> // stat tag -> [name prefix, name suffix], e.g. ['acri', 'tis']
}

export async function getRivenData(): Promise<RivenData> {
  try {
    const saved = JSON.parse(readFileSync(file(), 'utf8')) as { at: number; data: RivenData }
    if (Date.now() - saved.at < MAX_AGE) return saved.data
  } catch {
    // nothing saved yet
  }
  const data: RivenData = { values: {}, affix: {} }
  try {
    const get = async (name: string): Promise<Record<string, unknown>> => {
      const res = await net.fetch(BASE + name, { headers: { 'User-Agent': 'ToxicFrame/0.1' } })
      if (!res.ok) throw new Error(`${name} returned ${res.status}`)
      return (await res.json()) as Record<string, unknown>
    }
    const upgrades = (await get('ExportUpgrades.json')) as Record<
      string,
      {
        upgradeEntries?: {
          tag?: string
          prefixTag?: string
          suffixTag?: string
          upgradeValues?: { value?: number }[]
        }[]
      }
    >
    for (const [id, u] of Object.entries(upgrades)) {
      if (!/\/Randomized\/.*RandomModRare$/.test(id) || !u.upgradeEntries) continue
      data.values[id] = Object.fromEntries(
        u.upgradeEntries
          .filter((e) => e.tag && typeof e.upgradeValues?.[0]?.value === 'number')
          .map((e) => [e.tag!, e.upgradeValues![0].value!])
      )
    }
    const dict = (await get('dict.en.json')) as Record<string, string>
    for (const u of Object.values(upgrades))
      for (const e of u.upgradeEntries ?? [])
        if (e.tag && e.prefixTag && e.suffixTag && dict[e.prefixTag] && dict[e.suffixTag])
          data.affix[e.tag] = [dict[e.prefixTag], dict[e.suffixTag]]
    writeFileSync(file(), JSON.stringify({ at: Date.now(), data }))
  } catch (e) {
    console.error('Could not load riven data from browse.wf:', e)
  }
  return data
}
