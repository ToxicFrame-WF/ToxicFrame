import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getRelics: () => ipcRenderer.invoke('relics:list'),
  getPrice: (slug: string, force = false, rank?: number) =>
    ipcRenderer.invoke('prices:get', slug, force, rank),
  getCachedPrices: () => ipcRenderer.invoke('prices:cached'),
  getArbitrationForecast: () => ipcRenderer.invoke('arbitrations:forecast'),
  getMyOrders: () => ipcRenderer.invoke('market:myOrders'),
  getSavedOrders: () => ipcRenderer.invoke('market:savedOrders'),
  getTrades: () => ipcRenderer.invoke('trades:list'),
  importAlecaFrame: (text: string) => ipcRenderer.invoke('import:alecaframe', text),
  undoLastImport: () => ipcRenderer.invoke('import:undo'),
  getMyContracts: () => ipcRenderer.invoke('market:myContracts'),
  getSavedContracts: () => ipcRenderer.invoke('market:savedContracts'),
  updateContract: (id: string, change: Record<string, unknown>) =>
    ipcRenderer.invoke('contract:update', id, change),
  removeContract: (id: string) => ipcRenderer.invoke('contract:remove', id),
  setAllContractsVisible: (visible: boolean) => ipcRenderer.invoke('contract:allVisible', visible),
  createContract: (body: unknown) => ipcRenderer.invoke('contract:create', body),
  updateOrder: (id: string, edit: { platinum?: number; quantity?: number; visible?: boolean }) =>
    ipcRenderer.invoke('market:updateOrder', id, edit),
  closeOrder: (id: string, quantity: number) =>
    ipcRenderer.invoke('market:closeOrder', id, quantity),
  deleteOrder: (id: string) => ipcRenderer.invoke('market:deleteOrder', id),
  getItemOrders: (slug: string) => ipcRenderer.invoke('market:orders', slug),
  getTopOrders: (slug: string) => ipcRenderer.invoke('market:top', slug),
  createOrder: (o: {
    itemId: string
    type: 'sell' | 'buy'
    platinum: number
    quantity: number
    rank?: number
  }) => ipcRenderer.invoke('market:createOrder', o),
  getWfmStatus: () => ipcRenderer.invoke('wfm:status'),
  wfmLogin: (email: string, password: string) => ipcRenderer.invoke('wfm:login', email, password),
  wfmLogout: () => ipcRenderer.invoke('wfm:logout'),
  setAppPrefs: (prefs: {
    closeWarning?: boolean
    moveToSecondary?: boolean
    autoTrackTrades?: boolean
    dealAlert?: number
    overlayRecommend?: boolean
    overlayRewards?: boolean
    overlayRiven?: boolean
    overlayKeepTabbed?: boolean
    autoOpenArbi?: boolean
    menuScale?: number
    manualInventory?: boolean
    setupDone?: boolean
  }) => ipcRenderer.send('prefs:set', prefs),
  getNotifyConfig: () => ipcRenderer.invoke('notify:getConfig'),
  setNotifyConfig: (patch: unknown) => ipcRenderer.invoke('notify:setConfig', patch),
  testNotify: () => ipcRenderer.invoke('notify:test'),
  notify: (n: { kind: string; title: string; body: string; discord?: string }) =>
    ipcRenderer.send('notify:send', n),
  getArbiState: () => ipcRenderer.invoke('arbi:get'),
  getArbiRuns: () => ipcRenderer.invoke('arbi:runs'),
  onArbiShow: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('arbi:show', listener)
    return () => {
      ipcRenderer.removeListener('arbi:show', listener)
    }
  },
  onArbiState: (cb: (s: unknown) => void) => {
    const listener = (_e: unknown, s: unknown): void => cb(s)
    ipcRenderer.on('arbi:state', listener)
    return () => {
      ipcRenderer.removeListener('arbi:state', listener)
    }
  },
  // a run was saved: the history page refetches
  onArbiRuns: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('arbi:runs', listener)
    return () => {
      ipcRenderer.removeListener('arbi:runs', listener)
    }
  },
  getOverlayState: () => ipcRenderer.invoke('overlay:get'),
  closeOverlay: () => ipcRenderer.send('overlay:close'),
  getOverlayHotkeys: () => ipcRenderer.invoke('overlay:getHotkeys'),
  setOverlayHotkey: (which: 'toggle' | 'interact' | 'riven', accel: string) =>
    ipcRenderer.invoke('overlay:setHotkey', which, accel),
  previewOverlay: (kind: 'recommend' | 'rewards' | null) =>
    ipcRenderer.send('overlay:preview', kind),
  simulateGameEvent: (ev: { type: string; item?: string; file?: string }) =>
    ipcRenderer.send('overlay:simulate', ev),
  onOverlayState: (cb: (s: unknown) => void) => {
    const listener = (_e: unknown, s: unknown): void => cb(s)
    ipcRenderer.on('overlay:state', listener)
    return () => {
      ipcRenderer.removeListener('overlay:state', listener)
    }
  },
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximize: (cb: (maximized: boolean) => void) => {
    const listener = (_e: unknown, v: boolean): void => cb(v)
    ipcRenderer.on('window:maximized', listener)
    return () => {
      ipcRenderer.removeListener('window:maximized', listener)
    }
  },
  getPlanetIcons: () => ipcRenderer.invoke('icons:planets'),
  getArbitrations: () => ipcRenderer.invoke('arbitrations:get'),
  getWorldState: () => ipcRenderer.invoke('worldstate:get'),
  getItemMeta: () => ipcRenderer.invoke('items:meta'),
  getSyndicateShop: () => ipcRenderer.invoke('syndicates:shop'),
  getVoidTraceIcon: () => ipcRenderer.invoke('icons:voidTraces'),
  getRelicDrops: (id: string) => ipcRenderer.invoke('relics:drops', id),
  getMasteryCatalog: () => ipcRenderer.invoke('mastery:catalog'),
  getStarchartData: () => ipcRenderer.invoke('mastery:starchart'),
  getMasteryIcons: () => ipcRenderer.invoke('mastery:icons'),
  getInventoryMeta: () => ipcRenderer.invoke('inventory:meta'),
  getModDetail: (uniqueName: string) => ipcRenderer.invoke('inventory:modDetail', uniqueName),
  getResourceCatalog: () => ipcRenderer.invoke('inventory:resources'),
  getCraftables: () => ipcRenderer.invoke('crafting:catalog'),
  getRecipeMap: () => ipcRenderer.invoke('crafting:recipes'),
  getAcrithisWares: () => ipcRenderer.invoke('weekly:acrithis'),
  getArchonShards: () => ipcRenderer.invoke('inventory:shards'),
  getStatsHistory: () => ipcRenderer.invoke('stats:history'),
  getHour12: () => ipcRenderer.invoke('system:hour12'),
  getRivenGrades: () => ipcRenderer.invoke('rivens:grades'),
  getRivenData: () => ipcRenderer.invoke('rivens:data'),
  getRivenCatalog: () => ipcRenderer.invoke('rivens:catalog'),
  searchRivenAuctions: (slug: string) => ipcRenderer.invoke('rivens:search', slug),
  getRivenHistory: (slug: string) => ipcRenderer.invoke('rivens:history', slug),
  sniperList: () => ipcRenderer.invoke('sniper:list'),
  sniperAdd: (a: unknown) => ipcRenderer.invoke('sniper:add', a),
  sniperUpdate: (id: string, p: unknown) => ipcRenderer.invoke('sniper:update', id, p),
  sniperDelete: (id: string) => ipcRenderer.invoke('sniper:delete', id),
  getWikiAcquisition: (item: string) => ipcRenderer.invoke('wiki:acquisition', item),
  getWarframeDetail: (uniqueName: string) =>
    ipcRenderer.invoke('inventory:warframeDetail', uniqueName),
  getItemDetail: (uniqueName: string) => ipcRenderer.invoke('inventory:itemDetail', uniqueName),
  getInventory: () => ipcRenderer.invoke('inventory:get'),
  refreshInventory: () => ipcRenderer.invoke('inventory:refresh'),
  getWfmPresence: () => ipcRenderer.invoke('wfm:presence:get'),
  getWfmPublicStatus: () => ipcRenderer.invoke('wfm:presence:public'),
  setWfmPresence: (s: string) => ipcRenderer.invoke('wfm:presence:set', s),
  setWfmPresenceAuto: (on: boolean, base: string) =>
    ipcRenderer.invoke('wfm:presence:auto', on, base),
  onWfmPresence: (cb: (s: unknown) => void) => {
    const listener = (_e: unknown, s: unknown): void => cb(s)
    ipcRenderer.on('wfm:presence', listener)
    return () => {
      ipcRenderer.removeListener('wfm:presence', listener)
    }
  },
  getMarketStats: () => ipcRenderer.invoke('market:stats'),
  getLiveDeals: () => ipcRenderer.invoke('market:live'),
  onLiveDeals: (cb: (d: unknown) => void) => {
    const listener = (_e: unknown, d: unknown): void => cb(d)
    ipcRenderer.on('market:live', listener)
    return () => {
      ipcRenderer.removeListener('market:live', listener)
    }
  },
  findSimilarRiven: (f: { slug: string; pos: string[]; neg?: string }) =>
    ipcRenderer.send('riven:find', f),
  onFinderPrefill: (cb: (d: { slug: string; filter: unknown }) => void) => {
    const listener = (_e: unknown, d: { slug: string; filter: unknown }): void => cb(d)
    ipcRenderer.on('finder:prefill', listener)
    return () => {
      ipcRenderer.removeListener('finder:prefill', listener)
    }
  },
  onNavigate: (cb: (page: string) => void) => {
    const listener = (_e: unknown, page: string): void => cb(page)
    ipcRenderer.on('nav:page', listener)
    return () => {
      ipcRenderer.removeListener('nav:page', listener)
    }
  },
  startMarketScan: () => ipcRenderer.invoke('market:scan'),
  onMarketProgress: (cb: (p: unknown) => void) => {
    const listener = (_e: unknown, p: unknown): void => cb(p)
    ipcRenderer.on('market:progress', listener)
    return () => {
      ipcRenderer.removeListener('market:progress', listener)
    }
  },
  onInventory: (cb: (status: unknown) => void) => {
    const listener = (_e: unknown, status: unknown): void => cb(status)
    ipcRenderer.on('inventory:updated', listener)
    return () => {
      ipcRenderer.removeListener('inventory:updated', listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
