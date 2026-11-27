import { app } from 'electron'
import { join } from 'path'
import { readFileSync, renameSync, writeFileSync } from 'fs'
import type { NotifyConfig } from './notify'

// Settings the main process needs before the page has loaded (window position, close warning).
// The settings dialog sends them here whenever they change.
export interface AppPrefs {
  closeWarning: boolean
  moveToSecondary: boolean
  autoTrackTrades: boolean // close matching warframe.market orders when an in-game trade finishes
  dealAlert: number // notify about live market deals worth at least this much platinum (0 = off)
  overlayRecommend: boolean // Recommended relics overlay on the in-game relic picker
  overlayRewards: boolean // prices over the fissure reward screen
  overlayRiven: boolean // grades and listings beside the riven card on the riven screens
  overlayKeepTabbed: boolean // overlays stay up when Warframe is not the active window
  overlayRivenKey: string // global hotkey: read the riven card on screen ('' = off)
  overlayToggleKey: string // global hotkey: show/hide Recommended relics ('' = off)
  overlayInteractKey: string // global hotkey: make the overlay clickable ('' = off)
  autoOpenArbi: boolean // switch to the Arbitrations > Live tab when a run starts
  manualInventory: boolean // the inventory helper only runs on the Refresh button
  setupDone: boolean // the first-run screen was accepted
  menuScale: number // the game's Menu Scale (it is saved with the account, so the player sets it)
  notify?: NotifyConfig // routing of notifications; see notify.ts (webhook stays in the main process)
  // where the window was when it last closed (normal size + position) and whether it was maximized
  window?: { x: number; y: number; width: number; height: number; maximized: boolean }
}

let prefs: AppPrefs = {
  closeWarning: false,
  moveToSecondary: false,
  autoTrackTrades: true,
  dealAlert: 30,
  overlayRecommend: true,
  overlayRewards: true,
  overlayRiven: true,
  overlayKeepTabbed: false,
  overlayRivenKey: '',
  overlayToggleKey: '',
  overlayInteractKey: 'Control+Tab',
  autoOpenArbi: true,
  menuScale: 100,
  manualInventory: false,
  setupDone: false
}
let loaded = false
const file = (): string => join(app.getPath('userData'), 'app-prefs.json')

export function getPrefs(): AppPrefs {
  if (!loaded) {
    loaded = true
    try {
      prefs = { ...prefs, ...JSON.parse(readFileSync(file(), 'utf8')) }
    } catch {
      // nothing saved yet
    }
  }
  return prefs
}

export function setPrefs(patch: Partial<AppPrefs>): void {
  prefs = { ...getPrefs(), ...patch }
  try {
    // temp file + rename, so a crash mid-write can't leave broken settings
    writeFileSync(file() + '.tmp', JSON.stringify(prefs))
    renameSync(file() + '.tmp', file())
  } catch {
    // not critical
  }
}
