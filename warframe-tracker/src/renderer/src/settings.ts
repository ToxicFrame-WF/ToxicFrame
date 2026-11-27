import { useSyncExternalStore } from 'react'

export type Refinement = 'Intact' | 'Exceptional' | 'Flawless' | 'Radiant'
export interface AlertSettings {
  notify: boolean // desktop notification when a matching reward appears
  catalysts: boolean
  reactors: boolean
  exilus: boolean
  parts: string[] // weapon parts the user wants to be told about
}
// Which arbitrations you want to hear about (an empty group means "anything").
export interface ArbPrefs {
  notify: boolean // recurring alerts for every rotation that matches
  missionTypes: string[]
  planets: string[]
  factions: string[]
  tiers: string[] // S, A, B, C, D or Unrated
  nodes: string[] // specific nodes, e.g. "Elara (Jupiter)"
  favOnly: boolean
  advanceMin: number // minutes of notice before a rotation starts
  alsoAtStart: boolean
  showInTimers: boolean // the Arbitrations card in Timers & Events
}
export interface Settings {
  alerts: AlertSettings
  showRightPanel: boolean
  preloadPrices: boolean
  cardRefinement: Refinement
  closeWarning: boolean
  autoTrackTrades: boolean // mark warframe.market orders sold when an in-game trade finishes
  overlayRecommend: boolean // in-game Recommended relics overlay
  overlayRewards: boolean // in-game relic reward prices
  overlayRiven: boolean // in-game riven grades and listings
  overlayKeepTabbed: boolean // overlays stay up when alt-tabbed out
  autoOpenArbi: boolean // switch to the Arbitrations > Live tab when a run starts
  recommendSize: number // percent, 75-175
  recommendOpacity: number // percent, 40-100
  recommendCorner: 'top-right' | 'bottom-right' | 'bottom-left'
  recommendRows: number // rows shown before the list scrolls, 1-4
  rewardsSize: number // percent, 75-150
  rewardsOpacity: number // percent, 40-100
  menuScale: number // the game's Menu Scale, so the reward reader finds the names
  dealAlert: number // Market activity: notify about live deals worth at least this much (0 = off)
  moveToSecondary: boolean
  enableStats: boolean
  inGameOnly: boolean // Buy / Sell: only list traders who are in game
  rememberWfmAuto: boolean // keep warframe.market 'Auto' status on across restarts
  relicOwned: Record<string, number> // relic id -> how many copies you say you own
  relicFavorites: string[] // relic ids you starred
  masteryFavorites: string[] // item unique names starred on the mastery helper
  partFavorites: string[] // Warframe components starred in the Warframe details window
  craftingFavorites: string[] // craftable unique names in the crafting-helper plan
  setupDone: boolean // the first-run screen was accepted
  manualInventory: boolean // the inventory helper only runs on the Refresh button
  staleAfterMinutes: number // inventory counts as old after this long without an update (0 = never)
  keepForCrafting: 'unowned' | 'unmastered' | 'favorites' // Inventory: which parts to hold back from "Safe to list"
  rankAware: boolean // My orders and Compare look at the rank of mods and arcanes
  arbFavorites: string[] // arbitration nodes you starred, e.g. "Elara (Jupiter)"
  loadAllItems: boolean // Foundry, Inventory and Relic pages draw every item at once
  hideFounders: boolean // Mastery: skip the Founders items unless owned or levelled
  formaLevels: boolean // Mastery: count levels 31-40 that need formas
  arbPrefs: ArbPrefs
  cycleAlerts: { minutes: number; picks: string[] } // picks: "cetus:night" = notify before it starts
  arbReminders: number[] // start times (unix seconds) of rotations you set a one-time reminder for
}

const KEY = 'toxicframe.settings'
const DEFAULTS: Settings = {
  alerts: { notify: false, catalysts: true, reactors: true, exilus: true, parts: [] },
  showRightPanel: true,
  preloadPrices: true,
  cardRefinement: 'Radiant',
  closeWarning: false,
  autoTrackTrades: true,
  dealAlert: 30,
  overlayRecommend: true,
  overlayRewards: true,
  overlayRiven: true,
  overlayKeepTabbed: false,
  autoOpenArbi: true,
  menuScale: 100,
  recommendSize: 125,
  recommendOpacity: 90,
  recommendCorner: 'top-right',
  recommendRows: 2,
  rewardsSize: 100,
  rewardsOpacity: 90,
  moveToSecondary: false,
  enableStats: true,
  inGameOnly: true,
  rememberWfmAuto: true,
  relicOwned: {},
  relicFavorites: [],
  masteryFavorites: [],
  craftingFavorites: [],
  partFavorites: [],
  setupDone: false,
  manualInventory: false,
  staleAfterMinutes: 60,
  keepForCrafting: 'unowned',
  rankAware: true,
  loadAllItems: false,
  hideFounders: true,
  formaLevels: true,
  arbFavorites: [],
  arbPrefs: {
    notify: false,
    missionTypes: [],
    planets: [],
    factions: [],
    tiers: [],
    nodes: [],
    favOnly: false,
    advanceMin: 10,
    alsoAtStart: true,
    showInTimers: true
  },
  cycleAlerts: { minutes: 3, picks: [] },
  arbReminders: []
}

// Night City is the only look; main.css keys its styles on data-mode="nightcity".
function applyTheme(): void {
  document.documentElement.dataset.mode = 'nightcity'
}

// keep a saved value only when its type matches the default (a hand-edited or imported file can't crash the app)
function keep<T extends object>(base: T, saved: unknown): T {
  const out = { ...base } as Record<string, unknown>
  if (!saved || typeof saved !== 'object') return out as T
  for (const [k, d] of Object.entries(base)) {
    const v = (saved as Record<string, unknown>)[k]
    if (
      v !== undefined &&
      (d === null || (v !== null && typeof v === typeof d && Array.isArray(v) === Array.isArray(d)))
    )
      out[k] = v
  }
  return out as T
}

function merge(saved: unknown): Settings {
  const s = keep(DEFAULTS, saved)
  const o = (saved ?? {}) as Record<string, unknown>
  s.alerts = keep(DEFAULTS.alerts, o.alerts)
  s.arbPrefs = keep(DEFAULTS.arbPrefs, o.arbPrefs)
  s.cycleAlerts = keep(DEFAULTS.cycleAlerts, o.cycleAlerts)
  return s
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return merge(JSON.parse(raw))
  } catch {
    // storage unavailable or damaged: use the defaults
  }
  return DEFAULTS
}

// The main process needs two of the settings before the page loads, so mirror them there.
function syncMain(prev: Settings | null, s: Settings): void {
  if (
    prev &&
    prev.closeWarning === s.closeWarning &&
    prev.moveToSecondary === s.moveToSecondary &&
    prev.autoTrackTrades === s.autoTrackTrades &&
    prev.dealAlert === s.dealAlert &&
    prev.overlayRecommend === s.overlayRecommend &&
    prev.overlayRewards === s.overlayRewards &&
    prev.overlayRiven === s.overlayRiven &&
    prev.overlayKeepTabbed === s.overlayKeepTabbed &&
    prev.autoOpenArbi === s.autoOpenArbi &&
    prev.menuScale === s.menuScale &&
    prev.manualInventory === s.manualInventory &&
    prev.setupDone === s.setupDone
  )
    return
  try {
    window.api?.setAppPrefs({
      closeWarning: s.closeWarning,
      moveToSecondary: s.moveToSecondary,
      autoTrackTrades: s.autoTrackTrades,
      dealAlert: s.dealAlert,
      overlayRecommend: s.overlayRecommend,
      overlayRewards: s.overlayRewards,
      overlayRiven: s.overlayRiven,
      overlayKeepTabbed: s.overlayKeepTabbed,
      autoOpenArbi: s.autoOpenArbi,
      menuScale: s.menuScale,
      manualInventory: s.manualInventory,
      setupDone: s.setupDone
    })
  } catch {
    // not critical
  }
}

let current = load()
applyTheme()
syncMain(null, current)
const listeners = new Set<() => void>()

export function updateSettings(patch: Partial<Settings>): void {
  const previous = current
  current = merge({ ...current, ...patch })
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // not critical
  }
  applyTheme()
  syncMain(previous, current)
  listeners.forEach((l) => l())
}

export function setRelicOwned(id: string, count: number): void {
  const owned = { ...current.relicOwned }
  if (count > 0) owned[id] = Math.floor(count)
  else delete owned[id]
  updateSettings({ relicOwned: owned })
}
export function toggleRelicFavorite(id: string): void {
  const list = current.relicFavorites
  updateSettings({
    relicFavorites: list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  })
}
export function toggleMasteryFavorite(id: string): void {
  const list = current.masteryFavorites
  updateSettings({
    masteryFavorites: list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  })
}
export function toggleCraftingFavorite(id: string): void {
  const list = current.craftingFavorites
  updateSettings({
    craftingFavorites: list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  })
}
export function togglePartFavorite(id: string): void {
  const list = current.partFavorites ?? []
  updateSettings({
    partFavorites: list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  })
}
export const getSettings = (): Settings => current
export const resetSettings = (): void => updateSettings({ ...DEFAULTS })
export const exportSettings = (): string => JSON.stringify(current, null, 2)
export function importSettings(text: string): boolean {
  try {
    updateSettings({ ...merge(JSON.parse(text)), setupDone: current.setupDone })
    return true
  } catch {
    return false
  }
}

// the overlay window shares this origin: re-read when another window saves
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  current = load()
  listeners.forEach((l) => l())
})

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current
  )
}
