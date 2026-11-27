import { execFile } from 'child_process'
import { allBrowseIcons, onIconsUpdated } from './browseIcons'
import { autoTrackTrade } from './autoTrack'
import { getTrades, importAlecaFrame, undoLastImport } from './tradeLog'
import { app, shell, BrowserWindow, ipcMain, dialog, screen, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  resetGameDataImages,
  loadRelics,
  getVoidTraceIcon,
  getRelicDrops,
  getSyndicateShop
} from './gameData'
import { getPrice, getCachedPrices, loadPriceCache } from './priceService'
import { getItemMeta } from './itemMeta'
import { getWorldState } from './worldState'
import { getArbitrations, getArbitrationForecast } from './arbitrations'
import { getPlanetIcons } from './planetIcons'
import { getPrefs, setPrefs, setPrefsFromRenderer } from './appPrefs'
import { getArbiRuns, getArbiState } from './arbiTracker'
import { getMaskedConfig, notify, setNotifyConfig, testNotify } from './notify'
import { getInventory, notifyGameInfo, refreshInventory } from './inventory'
import {
  startInventoryAutoRefresh,
  setTradeHandler,
  setGameEventHandler,
  stopInventoryAutoRefresh
} from './logWatcher'
import { getMasteryCatalog, resetMasteryCache } from './masteryData'
import { getStarchartData } from './starchart'
import { getMasteryIcons } from './masteryIcons'
import {
  getInventoryMeta,
  getModDetail,
  getWarframeDetail,
  getItemDetail,
  getResourceCatalog,
  getArchonShards,
  resetInventoryMetaImages
} from './inventoryMeta'
import { getCraftables, resetCraftingCache } from './craftingData'
import { getRecipeMap } from './recipes'
import { getAcrithisWares } from './acrithis'
import { getStatsHistory } from './statsHistory'
import { getMarketStats, onScanDone, prioritizeMarketItem, startMarketScan } from './marketScan'
import { checkContractChange, checkContractCreate } from './contractInput'
import { clearUndercutTold, getLiveDeals, liveRound, undercutRound } from './marketLive'
import { getRivenGrades } from './rivenGrades'
import { getRivenData } from './rivenData'
import { searchAuctions } from './rivenSearch'
import { getRivenHistory } from './rivenHistory'
import { startSniper } from './rivenSniper'
import { getRivenCatalog } from './marketContracts'
import { wikiAcquisition } from './wikiAcquisition'
import { getWfmStatus, wfmLogin, wfmLogout } from './wfmAccount'
import {
  getPresence,
  getPublicStatus,
  setPresence,
  setAutoPresence,
  setPresenceListener,
  stopPresence,
  type WfmPresence
} from './wfmPresence'
import {
  getMyOrders,
  getSavedOrders,
  getTopOrders,
  getItemOrders,
  updateOrder,
  closeOrder,
  deleteOrder,
  createOrder,
  type NewOrder,
  type OrderEdit
} from './marketOrders'
import {
  createContract,
  getMyContracts,
  getSavedContracts,
  removeContract,
  setAllContractsVisible,
  updateContract
} from './marketContracts'
import {
  destroyOverlay,
  ensureWindow,
  getHotkeys,
  setHotkey,
  getOverlayState,
  hideOverlay,
  placeOverlay,
  registerOverlayHotkey,
  showOverlay
} from './overlay'
import type { GameEvent } from './gameEvents'
import { isWarframeActive, shutdownOcr, warmOcr } from './ocr'
import {
  onGameEvent,
  rewardLayout,
  showRecommend,
  showRewards,
  startScreenWatch,
  toggleRivenPanel
} from './overlayFlow'

// One data folder for dev and installed builds: "ToxicFrame", or the pre-rename folder where it already exists
const legacyData = join(app.getPath('appData'), 'warframe-tracker')
app.setPath(
  'userData',
  existsSync(legacyData) ? legacyData : join(app.getPath('appData'), 'ToxicFrame')
)

function createWindow(): void {
  // reopen where it was left, if that spot is still on a connected monitor
  const saved = getPrefs().window
  const onScreen =
    !!saved &&
    screen.getAllDisplays().some((d) => {
      const b = d.workArea
      return (
        saved.x < b.x + b.width - 100 &&
        saved.x + saved.width > b.x + 100 &&
        saved.y >= b.y - 10 &&
        saved.y < b.y + b.height - 50
      )
    })
  const width = onScreen ? saved.width : 1280
  const height = onScreen ? saved.height : 800

  // Optionally open on a secondary monitor (centered there) when there is one.
  const position: { x?: number; y?: number } = onScreen ? { x: saved.x, y: saved.y } : {}
  if (!onScreen && getPrefs().moveToSecondary) {
    const primary = screen.getPrimaryDisplay()
    const other = screen.getAllDisplays().find((d) => d.id !== primary.id)
    if (other) {
      position.x = Math.round(other.bounds.x + (other.bounds.width - width) / 2)
      position.y = Math.round(other.bounds.y + (other.bounds.height - height) / 2)
    }
  }

  const mainWindow = new BrowserWindow({
    width,
    height,
    ...position,
    show: false,
    autoHideMenuBar: true,
    frame: false, // custom title bar in the renderer (see App.tsx header)
    backgroundColor: '#0b0e18',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // dev runs electron.exe, so Windows shows its logo in the taskbar for our app id unless told otherwise
  if (is.dev && process.platform === 'win32')
    mainWindow.setAppDetails({
      appId: 'com.toxicframe.app',
      appIconPath: join(app.getAppPath(), 'build/icon.ico')
    })
  mainWindow.on('closed', destroyOverlay) // the hidden overlay must not keep the app alive
  mainWindow.on('ready-to-show', () => {
    if (onScreen && saved.maximized) mainWindow.maximize()
    mainWindow.show()
  })
  // remember size, place and maximized state for next start (normal bounds, so un-maximizing later
  // goes back to the size you had)
  const remember = (): void => {
    const b = mainWindow.getNormalBounds()
    setPrefs({
      window: { ...b, maximized: mainWindow.isMaximized() || mainWindow.isFullScreen() }
    })
  }

  // Tell the renderer when the maximize state changes, so its button icon can follow.
  const sendMaxState = (): void =>
    mainWindow.webContents.send('window:maximized', mainWindow.isMaximized())
  mainWindow.on('maximize', sendMaxState)
  mainWindow.on('unmaximize', sendMaxState)

  // "Show warning when trying to close the main app window"
  let confirmed = false
  mainWindow.on('close', (e) => {
    if (confirmed || !getPrefs().closeWarning) return remember()
    e.preventDefault()
    dialog
      .showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Close ToxicFrame', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: 'Close ToxicFrame?',
        detail: 'Prices and timers stop updating while the app is closed.'
      })
      .then((r) => {
        if (r.response === 0) {
          remember()
          confirmed = true
          mainWindow.close()
        }
      })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // only web pages: file:// or app protocols could start programs
    if (details.url.startsWith('https://')) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Linux: XWayland keeps always-on-top, click-through and xdotool working for the overlay.
if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform', 'x11')

// One copy only: two would both watch EE.log and double-close trades.
const gotLock = app.requestSingleInstanceLock()
if (gotLock)
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows().find((x) => !x.isAlwaysOnTop()) // not the overlay
    if (!w) return
    if (w.isMinimized()) w.restore()
    w.show()
    w.focus()
  })
else app.quit()

app.whenReady().then(() => {
  if (!gotLock) return // quitting: start nothing
  electronApp.setAppUserModelId('com.toxicframe.app') // must match appId in electron-builder.yml, or Windows drops notifications

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Custom window controls (the native frame is disabled).
  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('window:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize()
  })
  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle(
    'window:isMaximized',
    (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false
  )

  // Data for the UI
  ipcMain.handle('relics:list', () => loadRelics())
  ipcMain.handle('prices:get', (_e, slug: string, force?: boolean, rank?: number) =>
    getPrice(slug, force, rank)
  )
  ipcMain.handle('prices:cached', () => getCachedPrices())
  ipcMain.handle('items:meta', () => getItemMeta())
  ipcMain.handle('syndicates:shop', () => getSyndicateShop())
  ipcMain.handle('worldstate:get', () => getWorldState())
  ipcMain.handle('arbitrations:get', () => getArbitrations())
  ipcMain.handle('arbitrations:forecast', () => getArbitrationForecast())
  ipcMain.handle('icons:planets', () => getPlanetIcons())
  ipcMain.handle('icons:voidTraces', () => getVoidTraceIcon())
  ipcMain.handle('relics:drops', (_e, id: string) => getRelicDrops(String(id)))
  ipcMain.on('prefs:set', (_e, patch) => setPrefsFromRenderer(patch))
  ipcMain.handle('notify:getConfig', () => getMaskedConfig())
  ipcMain.handle('notify:setConfig', (_e, patch) => setNotifyConfig(patch ?? {}))
  ipcMain.handle('notify:test', () => testNotify())
  ipcMain.on('notify:send', (_e, n) => {
    // renderer may only raise its own kinds, and never pass a click handler
    if (['arbitration', 'reward', 'cycle'].includes(n?.kind))
      notify({ kind: n.kind, title: String(n.title), body: String(n.body), discord: n.discord })
  })
  ipcMain.handle('inventory:get', () => getInventory())
  ipcMain.handle('inventory:refresh', () => refreshInventory())
  onIconsUpdated(() => {
    resetGameDataImages()
    resetMasteryCache()
    resetCraftingCache()
    resetInventoryMetaImages()
  })
  allBrowseIcons() // load the browse.wf picture map (downloads it on first run)
  // Re-read the inventory when a loading screen finishes (see logWatcher).
  startInventoryAutoRefresh(() => {
    const p = getPrefs()
    if (p.setupDone && !p.manualInventory) void refreshInventory() // not before setup; manual: Refresh only
  }, notifyGameInfo)
  setTradeHandler((t) => void autoTrackTrade(t))
  setGameEventHandler(onGameEvent)
  registerOverlayHotkey(isWarframeActive, showRecommend, toggleRivenPanel)
  // after the main window, so they do not slow the start
  setTimeout(() => {
    ensureWindow()
    startScreenWatch() // idle until setupDone
    if (getPrefs().setupDone) warmOcr()
  }, 5000)
  ipcMain.handle('arbi:get', () => getArbiState())
  ipcMain.handle('arbi:runs', () => getArbiRuns())
  ipcMain.handle('overlay:get', () => getOverlayState())
  ipcMain.handle('overlay:getHotkeys', () => getHotkeys())
  ipcMain.handle('overlay:setHotkey', (_e, which, accel) => setHotkey(which, accel))
  ipcMain.on('overlay:close', () => {
    if (getOverlayState().panel === 'riven') return toggleRivenPanel() // stays closed on this screen
    hideOverlay()
  })
  // Settings > Overlays: show the real overlay on the desktop so the sliders can be judged live
  ipcMain.on('overlay:preview', (_e, kind: 'recommend' | 'rewards' | null) => {
    if (!kind) return hideOverlay()
    placeOverlay(screen.getPrimaryDisplay().bounds)
    if (kind === 'recommend') return showOverlay('recommend', { era: null })
    showOverlay('rewards', {
      items: [
        { name: 'Burston Prime Stock', quantity: 1, slug: 'burston_prime_stock' },
        {
          name: 'Citrine Prime Systems Blueprint',
          quantity: 1,
          slug: 'citrine_prime_systems_blueprint',
          vaulted: false
        },
        { name: 'Forma Blueprint', quantity: 2 }
      ],
      layout: rewardLayout(3)
    })
  })
  // dev only: feed a game event without running the game
  // (a 'rewards' event with a file path reads that screenshot instead of the screen)
  if (is.dev)
    ipcMain.on('overlay:simulate', (_e, ev: GameEvent & { file?: string }) =>
      ev.type === 'rewards' && ev.file
        ? void showRewards(nativeImage.createFromPath(ev.file))
        : onGameEvent(ev)
    )
  ipcMain.handle('mastery:catalog', () => getMasteryCatalog())
  ipcMain.handle('mastery:starchart', () => getStarchartData())
  ipcMain.handle('mastery:icons', () => getMasteryIcons())
  ipcMain.handle('inventory:meta', () => getInventoryMeta())
  ipcMain.handle('inventory:modDetail', (_e, uniqueName: string) =>
    getModDetail(String(uniqueName))
  )
  ipcMain.handle('inventory:warframeDetail', (_e, uniqueName: string) =>
    getWarframeDetail(String(uniqueName))
  )
  ipcMain.handle('inventory:itemDetail', (_e, uniqueName: string) =>
    getItemDetail(String(uniqueName))
  )
  ipcMain.handle('inventory:resources', () => getResourceCatalog())
  ipcMain.handle('crafting:catalog', () => getCraftables())
  ipcMain.handle('crafting:recipes', () => getRecipeMap())
  ipcMain.handle('weekly:acrithis', () => getAcrithisWares())
  ipcMain.handle('stats:history', () => getStatsHistory())
  // Windows' own clock setting (Region > Short time), e.g. "HH:mm" = 24-hour; null elsewhere
  ipcMain.handle(
    'system:hour12',
    () =>
      new Promise<boolean | null>((done) => {
        if (process.platform !== 'win32') return done(null)
        execFile(
          'reg',
          ['query', 'HKCU\\Control Panel\\International', '/v', 'sShortTime'],
          (err, out) => {
            const fmt = err ? null : /sShortTime\s+REG_SZ\s+(.+)/.exec(out)?.[1]
            done(fmt ? !fmt.includes('H') : null)
          }
        )
      })
  )
  ipcMain.handle('rivens:grades', () => getRivenGrades())
  ipcMain.handle('rivens:data', () => getRivenData())
  ipcMain.handle('rivens:catalog', () => getRivenCatalog())
  ipcMain.handle('rivens:search', (_e, slug: string) => searchAuctions(String(slug)))
  ipcMain.handle('rivens:history', (_e, slug: string) => getRivenHistory(String(slug)))
  startSniper()
  // overlay's "Find similar": show the main window and open the Finder on this riven's stats
  ipcMain.on('riven:find', (e, f: { slug: string; pos: string[]; neg?: string }) => {
    const w = BrowserWindow.getAllWindows().find((x) => x.webContents !== e.sender)
    if (!w || typeof f?.slug !== 'string' || !Array.isArray(f.pos)) return
    if (w.isMinimized()) w.restore()
    w.show()
    w.focus()
    w.webContents.send('finder:prefill', {
      slug: f.slug,
      filter: {
        pos: f.pos.slice(0, 3).map((slug) => ({ slug: String(slug), required: false })),
        neg: f.neg ? { slug: String(f.neg), required: false } : undefined,
        minMatch: 0,
        mustNeg: false
      }
    })
  })
  ipcMain.handle('wiki:acquisition', (_e, item: string) => wikiAcquisition(String(item)))
  ipcMain.handle('inventory:shards', () => getArchonShards())
  ipcMain.handle('wfm:status', () => getWfmStatus())
  ipcMain.handle('wfm:login', (_e, email: string, password: string) => wfmLogin(email, password))
  ipcMain.handle('wfm:logout', () => {
    stopPresence()
    wfmLogout()
    clearUndercutTold()
  })
  ipcMain.handle('wfm:presence:get', () => getPresence())
  ipcMain.handle('wfm:presence:public', () => getPublicStatus())
  ipcMain.handle('wfm:presence:set', (_e, s: WfmPresence) => setPresence(s))
  ipcMain.handle('wfm:presence:auto', (_e, on: boolean, base: WfmPresence) =>
    setAutoPresence(on, base)
  )
  setPresenceListener((s) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('wfm:presence', s)
  })
  ipcMain.handle('market:myOrders', () => getMyOrders())
  ipcMain.handle('market:myContracts', () => getMyContracts())
  ipcMain.handle('market:savedContracts', () => getSavedContracts())
  ipcMain.handle('contract:update', (_e, id: string, change: unknown) => {
    const c = checkContractChange(change)
    return c.ok ? updateContract(String(id), c.value) : { ok: false, error: c.error }
  })
  ipcMain.handle('contract:remove', (_e, id: string) => removeContract(String(id)))
  ipcMain.handle('contract:allVisible', (_e, visible: boolean) => setAllContractsVisible(!!visible))
  ipcMain.handle('contract:create', (_e, body: unknown) => {
    const c = checkContractCreate(body)
    return c.ok ? createContract(c.value) : { ok: false, error: c.error }
  })
  ipcMain.handle('market:updateOrder', (_e, id: string, edit: OrderEdit) =>
    updateOrder(String(id), edit)
  )
  ipcMain.handle('market:closeOrder', (_e, id: string, qty: number) =>
    closeOrder(String(id), Number(qty))
  )
  ipcMain.handle('market:createOrder', (_e, o: NewOrder) => createOrder(o))
  ipcMain.handle('market:savedOrders', () => getSavedOrders())
  ipcMain.handle('trades:list', () => {
    try {
      return getTrades()
    } catch {
      return [] // only for showing; writes still refuse an unreadable log
    }
  })
  ipcMain.handle('market:stats', () => getMarketStats())
  ipcMain.handle('market:live', () => getLiveDeals())
  ipcMain.handle('market:scan', () => {
    void startMarketScan() // runs in the background; progress arrives as market:progress
  })
  ipcMain.handle('import:undo', () => undoLastImport())
  ipcMain.handle('import:alecaframe', (_e, text: string) => {
    try {
      return { ok: true, ...importAlecaFrame(String(text)) }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
  ipcMain.handle('market:deleteOrder', (_e, id: string) => deleteOrder(String(id)))
  ipcMain.handle('market:orders', (_e, slug: string) => {
    prioritizeMarketItem(String(slug)) // an item looked at in Buy / Sell gets fresh statistics first
    return getItemOrders(slug)
  })
  ipcMain.handle('market:top', (_e, slug: string) => getTopOrders(slug))
  loadPriceCache()

  createWindow()
  // the market scan starts with the app, after startup's own requests, so Market activity is
  // usually ready by the time it is opened
  setTimeout(() => void startMarketScan(), 30_000)
  setInterval(() => void startMarketScan(), 6 * 3_600_000) // only stale items are fetched again
  // live prices of the best deals: after every scan, then every 10 minutes
  onScanDone(() => void liveRound())
  setInterval(() => void liveRound(), 10 * 60_000)
  setTimeout(() => void undercutRound(), 60_000)
  setInterval(() => void undercutRound(), 10 * 60_000)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopInventoryAutoRefresh()
  shutdownOcr()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
