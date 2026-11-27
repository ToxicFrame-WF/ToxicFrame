import { app, net } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

// Item pictures from browse.wf (credit: https://browse.wf). Every item in the game's export files
// has an `icon` path; https://browse.wf + that path is the picture. One map game path -> icon path,
// built from the exports and kept on disk for a week. Blueprints have no icon of their own and
// show what they build.
const BASE = 'https://browse.wf'
const EXPORTS = 'https://browse.wf/warframe-public-export-plus/'
const FILES = [
  'ExportWarframes',
  'ExportWeapons',
  'ExportUpgrades',
  'ExportArcanes',
  'ExportRelics',
  'ExportResources',
  'ExportSentinels',
  'ExportCustoms',
  'ExportGear',
  'ExportKeys',
  'ExportFlavour',
  'ExportRailjackWeapons',
  'ExportDrones',
  'ExportBoosters',
  'ExportAbilities'
]
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const file = (): string => join(app.getPath('userData'), 'browse-icons.json')

let icons: Record<string, string> | null = null
let refreshing: Promise<void> | null = null

const plain = (path: string): string => path.replace(/^\/Lotus\/StoreItems\//, '/Lotus/')

// Picture URL for a game path, or undefined when browse.wf has none (or the map is not loaded yet).
export function browseIcon(uniqueName?: string): string | undefined {
  if (!uniqueName) return undefined
  if (!icons) loadSaved()
  const icon = icons?.[plain(uniqueName)]
  return icon ? BASE + icon : undefined
}

// browse.wf picture when there is one, else the old @wfcd picture by file name.
// shortcut: keeps the warframestat.us fallback until all item data comes from browse.wf.
// The old picture host, as a backup: browse.wf lacks files for some brand-new items (404).
export const cdnImage = (imageName?: string): string | undefined =>
  imageName ? `https://cdn.warframestat.us/img/${imageName}` : undefined

export function imageFor(uniqueName: string | undefined, imageName?: string): string | undefined {
  return (
    browseIcon(uniqueName) ??
    (imageName ? `https://cdn.warframestat.us/img/${imageName}` : undefined)
  )
}

export const allBrowseIcons = (): Record<string, string> => {
  if (!icons) loadSaved()
  return icons ?? {}
}

function loadSaved(): void {
  try {
    const saved = JSON.parse(readFileSync(file(), 'utf8')) as {
      at: number
      icons: Record<string, string>
    }
    icons = saved.icons
    if (Date.now() - saved.at > MAX_AGE_MS) void refreshBrowseIcons()
  } catch {
    icons = {}
    void refreshBrowseIcons()
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function refreshBrowseIcons(): Promise<void> {
  return (refreshing ??= (async () => {
    const map: Record<string, string> = {}
    for (const f of FILES) {
      try {
        const res = await net.fetch(`${EXPORTS}${f}.json`)
        if (!res.ok) continue
        for (const [k, v] of Object.entries<any>(await res.json()))
          if (v && typeof v.icon === 'string') map[k] = v.icon
      } catch {
        // one missing file only costs its pictures
      }
    }
    try {
      // blueprints show what they build
      const res = await net.fetch(`${EXPORTS}ExportRecipes.json`)
      if (res.ok)
        for (const [k, v] of Object.entries<any>(await res.json()))
          if (!map[k] && v?.resultType && map[v.resultType]) map[k] = map[v.resultType]
    } catch {
      // keep the rest
    }
    if (Object.keys(map).length < 1000) return // a bad download: keep what we had
    icons = map
    try {
      writeFileSync(file(), JSON.stringify({ at: Date.now(), icons: map }))
    } catch {
      // not critical
    }
  })().finally(() => {
    refreshing = null
  }))
}
