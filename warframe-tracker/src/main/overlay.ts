// One see-through, always-on-top window over the game (borderless windowed only: exclusive
// fullscreen draws over every other window). It is click-through until Ctrl+Tab makes it
// clickable; that shortcut is only registered while a panel is showing.
import { BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getPrefs, setPrefs } from './appPrefs'
import { validateAccelerator } from '../renderer/src/hotkeys'

export type OverlayPanel = 'recommend' | 'rewards' | 'riven'
export interface OverlayState {
  panel: OverlayPanel | null
  interactive: boolean
  data?: unknown // panel payload (the rewards read off the screen)
}

let win: BrowserWindow | null = null
let state: OverlayState = { panel: null, interactive: false }

export const getOverlayState = (): OverlayState => state

function push(): void {
  if (!win || win.isDestroyed()) return
  win.setIgnoreMouseEvents(!state.interactive)
  win.webContents.send('overlay:state', state)
  if (state.panel) {
    if (!win.isVisible()) win.showInactive() // never take focus from the game
  } else win.hide()
}

// created hidden at startup so the first overlay shows instantly
export function ensureWindow(): BrowserWindow {
  if (win && !win.isDestroyed()) return win
  const { bounds } = screen.getPrimaryDisplay()
  win = new BrowserWindow({
    ...bounds,
    show: false,
    title: 'ToxicFrame Overlay',
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true)
  win.on('page-title-updated', (e) => e.preventDefault()) // keep a stable title for window rules
  win.webContents.on('did-finish-load', push)
  if (is.dev && process.env['ELECTRON_RENDERER_URL'])
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#overlay`)
  else win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'overlay' })
  win.on('closed', () => (win = null))
  return win
}

export function showOverlay(panel: OverlayPanel, data?: unknown): void {
  state = { panel, interactive: false, data }
  ensureWindow()
  registerInteract()
  push()
}

// cover the screen the game is on (it may not be the main one)
export function placeOverlay(bounds: Electron.Rectangle): void {
  const w = ensureWindow()
  const b = w.getBounds()
  if (
    b.x !== bounds.x ||
    b.y !== bounds.y ||
    b.width !== bounds.width ||
    b.height !== bounds.height
  )
    w.setBounds(bounds)
}

// new data for the panel that is showing, keeping whether it is clickable
export function setOverlayData(panel: OverlayPanel, data: unknown): void {
  if (state.panel !== panel) return
  state = { ...state, data }
  push()
}

// panel: only hide if that panel is the one showing (a late "closed" must not hide a newer one)
export function hideOverlay(panel?: OverlayPanel): void {
  if (panel && state.panel !== panel) return
  state = { panel: null, interactive: false }
  unregisterInteract()
  push()
}

export function destroyOverlay(): void {
  globalShortcut.unregisterAll()
  win?.destroy()
  win = null
}

// Interact key: only held while a panel shows, so it never steals the key otherwise.
let interactKey = ''
function registerInteract(): void {
  unregisterInteract()
  const k = getPrefs().overlayInteractKey
  if (!k) return
  const ok = globalShortcut.register(k, () => {
    state = { ...state, interactive: !state.interactive }
    push()
  })
  if (ok) interactKey = k
}
function unregisterInteract(): void {
  if (interactKey) globalShortcut.unregister(interactKey)
  interactKey = ''
}

// Toggle key: opens/closes Recommended relics; opens only while Warframe is the active window.
let toggleKey = ''
let gameCheck: (() => Promise<boolean>) | null = null
let openRecommend: (() => void) | null = null
const onToggle = async (): Promise<void> => {
  if (state.panel) return hideOverlay()
  if (gameCheck && openRecommend && (await gameCheck())) openRecommend()
}
function registerToggle(): void {
  if (toggleKey) globalShortcut.unregister(toggleKey)
  toggleKey = ''
  const k = getPrefs().overlayToggleKey
  if (k && globalShortcut.register(k, onToggle)) toggleKey = k
}

// Riven key: reads the riven card on screen (or closes the panel); only while Warframe is active.
let rivenKey = ''
let toggleRiven: (() => void) | null = null
function registerRiven(): void {
  if (rivenKey) globalShortcut.unregister(rivenKey)
  rivenKey = ''
  const k = getPrefs().overlayRivenKey
  const fire = async (): Promise<void> => {
    if (gameCheck && toggleRiven && (await gameCheck())) toggleRiven()
  }
  if (k && globalShortcut.register(k, fire)) rivenKey = k
}

export function registerOverlayHotkey(
  isGameActive: () => Promise<boolean>,
  onOpen: () => void,
  onRiven: () => void
): void {
  gameCheck = isGameActive
  openRecommend = onOpen
  toggleRiven = onRiven
  registerToggle()
  registerRiven()
}

type HotkeyName = 'toggle' | 'interact' | 'riven'
export const getHotkeys = (): Record<HotkeyName, string> => ({
  toggle: getPrefs().overlayToggleKey,
  interact: getPrefs().overlayInteractKey,
  riven: getPrefs().overlayRivenKey
})

export function setHotkey(
  which: HotkeyName,
  accel: string
): { ok: true } | { ok: false; error: string } {
  if (!['toggle', 'interact', 'riven'].includes(which))
    return { ok: false, error: 'Unknown hotkey' }
  if (typeof accel !== 'string') return { ok: false, error: 'Invalid key' }
  const bad = validateAccelerator(accel)
  if (bad) return { ok: false, error: bad }
  const cur = getHotkeys()
  if (accel === cur[which]) return { ok: true }
  if (accel && Object.entries(cur).some(([k, v]) => k !== which && v === accel))
    return { ok: false, error: 'Already used by another overlay hotkey' }
  if (accel) {
    // a key this app holds right now (the other hotkey) can't be test-registered; checked above
    let ok: boolean
    try {
      ok = globalShortcut.register(accel, () => {})
      if (ok) globalShortcut.unregister(accel)
    } catch {
      return { ok: false, error: 'Not a valid key combination' }
    }
    if (!ok) return { ok: false, error: 'Already used by another app' }
  }
  if (which === 'toggle') {
    setPrefs({ overlayToggleKey: accel })
    registerToggle()
  } else if (which === 'riven') {
    setPrefs({ overlayRivenKey: accel })
    registerRiven()
  } else {
    setPrefs({ overlayInteractKey: accel })
    if (state.panel) registerInteract()
  }
  return { ok: true }
}
