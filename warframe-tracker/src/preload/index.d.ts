import { ElectronAPI } from '@electron-toolkit/preload'

// saved Arbitration run (written by main/arbiTracker.ts)
export interface ArbiRun {
  id: string
  node: string // SolNode146
  name: string // "Draco (Ceres)"
  mode: string // MT_SURVIVAL
  role: 'client' | 'host'
  startedAt: number // wall clock ms
  durationSec: number
  rotations: number | null // null: this mode's rotations are not visible in the log
  lastRotationAt?: number // wall clock ms of the newest rotation; the countdown restarts from it
  drones: number
  completed: boolean
  vitus: number // expected Vitus Essence
}

export interface ArbiState {
  phase: 'idle' | 'recording' | 'done'
  run: ArbiRun | null
}
declare global {
  type WfmPresence = 'invisible' | 'online' | 'ingame'
  type NotifyKind =
    'arbitration' | 'marketDeal' | 'undercut' | 'trade' | 'reward' | 'chat' | 'cycle' | 'sniper'
  // notification settings as the page sees them: the webhook itself never leaves the main process
  interface NotifyConfigView {
    webhookSet: boolean
    webhookTail: string
    routes: Record<NotifyKind, { windows: boolean; discord: boolean }>
    templates: { chat: string }
    chatOnlyBackground: boolean
  }
  interface OverlayState {
    panel: 'recommend' | 'rewards' | 'riven' | null
    interactive: boolean
    data?: unknown
  }
  type ShopKind = 'Mods' | 'Arcanes' | 'Weapons' | 'Blueprints' | 'Other'
  interface RelicReward {
    item: string
    slug?: string
    image?: string
    rarity: string
    chances: Record<string, number>
  }
  interface RelicSummary {
    id: string
    tier: string
    name: string
    vaulted: boolean
    imageName?: string
    rewards: RelicReward[]
  }
  // Market activity: one item's 90-day statistics (see src/main/marketMath.ts)
  interface MarketStat {
    vol7: number
    vol90: number
    med7: number
    med90: number
    low?: number
    high?: number
    at: number
  }
  // a top deal priced from online players' orders (see src/main/marketLive.ts)
  interface LiveDeal {
    kind: 'set' | 'flip'
    slug: string
    at: number
    profit: number | null
    buy: number
    sell: number
  }
  interface MarketProgress {
    scanning: boolean
    done: number
    total: number
  }
  interface MarketStats extends MarketProgress {
    items: Record<string, MarketStat>
    sets: Record<string, { slug: string; qty: number }[]>
  }
  interface PriceResult {
    slug: string
    price: number | null
    lowest?: number | null
    sellers: number
    fetchedAt: number
  }
  interface ArbitrationSlot {
    id: string
    name: string
    type: string
    enemy: string
    tier?: string // community grade S-F; missing = unrated
    start: number
    end: number
  }
  interface ArbitrationInfo {
    current?: ArbitrationSlot
    upcoming: ArbitrationSlot[]
  }
  interface WorldCycle {
    state: string
    expiry: string
  }
  interface WorldFissure {
    id: string
    node: string
    missionType: string
    tier: string
    expiry: string
    isHard: boolean
    isStorm: boolean
  }
  interface StockItem {
    name: string
    image?: string
    ducats?: number
    credits?: number
  }
  interface RewardEntry {
    id: string
    kind: 'alert' | 'invasion' | 'event'
    title: string
    rewards: string[]
    icons?: Record<string, string>
    expiry?: string
  }
  interface WorldState {
    rewardEntries: RewardEntry[]
    cetus?: WorldCycle
    vallis?: WorldCycle
    cambion?: WorldCycle
    zariman?: WorldCycle
    duviri?: WorldCycle
    baro?: {
      active: boolean
      location: string
      activation: string
      expiry: string
      inventory: StockItem[]
    }
    sortieExpiry?: string
    prime?: { active: boolean; expiry: string; items: StockItem[] }
    circuit?: { warframes: StockItem[]; weapons: StockItem[] }
    arbitration?: { node: string; type: string; enemy: string; expiry: string }
    fissures: WorldFissure[]
    incursions?: { nodes: string[]; types?: string[]; expiry: string }
    archimedea?: {
      kind: string
      expiry: string
      missions: {
        mission: string
        faction: string
        deviation: { name: string; desc?: string }
        risks: { name: string; desc?: string }[]
      }[]
      variables: { name: string; desc?: string }[]
    }[]
    bounties?: { syndicate: string; expiry: string; list: { node: string; challenge: string }[] }[]
    fetchedAt: number
  }
  interface WfmStatus {
    linked: boolean
    name?: string
  }
  interface WfmLoginResult {
    ok: boolean
    name?: string
    error?: string
  }
  type ItemMeta = Record<
    string,
    { id: string; name: string; tags: string[]; icon?: string; ducats: number }
  >
  interface MyOrder {
    id: string
    type: string
    platinum: number
    quantity: number
    visible: boolean
    itemId: string
    rank?: number
  }
  interface OrderActionResult {
    ok: boolean
    error?: string
  }
  interface ContractAttr {
    name: string
    value: number
    positive: boolean
    unit?: string
  }
  interface Contract {
    id: string
    directSale: boolean
    price: number
    visible: boolean
    weapon: string
    weaponSlug: string
    weaponRef?: string
    weaponIcon?: string
    rivenType: string
    name: string
    rerolls?: number
    mastery?: number
    rank?: number
    polarity?: string
    attributes: ContractAttr[]
    updated?: string
    startingPrice?: number
    buyoutPrice?: number
    topBid?: number
    minRep?: number
    note?: string
  }
  interface ContractsResult {
    ok: boolean
    contracts: Contract[]
    error?: string
    savedAt?: number
  }
  interface MyOrdersResult {
    savedAt?: number
    ok: boolean
    orders: MyOrder[]
    error?: string
  }
  interface TopOrder {
    id: string
    platinum: number
    quantity: number
    user: string
    status: string
  }
  interface ItemOrder {
    id: string
    type: string
    platinum: number
    quantity: number
    user: string
    status: string
    rank?: number
    platform?: string
  }
  interface ItemOrders {
    sell: ItemOrder[]
    buy: ItemOrder[]
  }
  interface TopOrders {
    sell: TopOrder[]
    buy: TopOrder[]
  }
  interface InventoryData {
    fetchedAt: number
    masteryRank: number | null
    // relic id (Intact unique name) -> refinement -> count
    relics: Record<string, Record<string, number>>
    raw: Record<string, unknown>
  }
  interface InventoryStatus {
    state: 'none' | 'loading' | 'ok' | 'error'
    error?: string
    data?: InventoryData
    fromCache?: boolean
    accountName?: string
    lastLoadAt?: number
  }
  type MasteryGroup = 'frame' | 'weapon' | 'companion'
  interface RivenListing {
    id: string
    price: number
    rerolls: number
    mr: number
    rank: number
    polarity?: string
    name: string
    seller: string
    status: string
    url: string
    attrs: { slug: string; name: string; unit?: string; value: number; positive: boolean }[]
  }
  // one saved look at a weapon's cheapest listings: [price, rerolls, attr slugs ('-' prefix = negative)]
  interface RivenSnap {
    t: number
    l: [number, number, string[]][]
  }
  interface SniperAlert {
    id: string
    name: string
    slug: string
    filter: import('../renderer/src/rivenFilter').Filter
    minDeal?: number
    paused: boolean // Snipe is off
    use?: boolean // Use for rolling (missing in an older build's data)
    negs?: string[]
    minRoll?: number
    lastPoll?: number
    lastHit?: { at: number; text: string }
    error?: string
  }
  interface MasteryItem {
    uniqueName: string
    name: string
    group: MasteryGroup
    productCategory: string
    maxRank: number
    pointsPerRank: number
    imageName?: string
    imageFallback?: string
    isPrime: boolean
    tradable: boolean
    vaulted: boolean
  }
  interface MasteryCatalog {
    items: MasteryItem[]
    totals: { frame: number; weapon: number; companion: number }
    nodes: { normal: number; steelPath: number }
  }
  type InvKind = 'mod' | 'arcane' | 'part' | 'misc'
  interface InvMeta {
    kind: InvKind
    name: string
    image?: string
    rarity?: string
    modType?: string
    maxRank?: number
    slug?: string
    tradable: boolean
    isPrime: boolean
    ducats?: number
    parent?: string
    need?: number
  }
  type InventoryMeta = Record<string, InvMeta>
  interface ShardEffect {
    name: string
    regular: string
    tauforged: string
  }
  interface ArchonShard {
    color: string
    hex: string
    effects: ShardEffect[]
    regular: { uniqueName: string; image?: string }
    tauforged: { uniqueName: string; image?: string }
  }
  type CompKind = 'resource' | 'blueprint' | 'component'
  interface CraftComponent {
    uniqueName: string
    name: string
    itemCount: number
    kind: CompKind
    image?: string
    imageFallback?: string
  }
  interface ResourceMeta {
    uniqueName: string
    name: string
    image?: string
    imageFallback?: string
    type?: string
    description?: string
    drops: { location: string; chance: number; amount?: string }[]
  }
  interface CraftItem {
    uniqueName: string
    name: string
    type: string
    masteryReq: number
    productCategory?: string
    image?: string
    buildPrice: number
    components: CraftComponent[]
  }
  interface ModDetail {
    name: string
    image?: string
    kind: 'mod' | 'arcane'
    modType?: string
    rarity?: string
    drainMin?: number
    drainMax?: number
    polarity?: string
    maxRank: number
    slug?: string
    wikiUrl?: string
    levelStats: string[][]
    drops: { location: string; chance: number; note?: string; ducats?: number; credits?: number }[]
  }
  interface AttackMode {
    name: string
    crit?: number
    critMult?: number
    status?: number
    fireRate?: number
    damage: Record<string, number>
  }
  interface ItemDetail extends WarframeDetail {
    weapon?: {
      type?: string
      mr?: number
      disposition?: number
      exilus?: string
      magazine?: number
      reload?: number
      trigger?: string
      noise?: string
      accuracy?: number
      multishot?: number
      buildPrice?: number
      buildTime?: number
      modes: AttackMode[]
    }
  }
  interface WarframeDetail {
    uniqueName: string
    name: string
    description?: string
    image?: string
    wikiUrl?: string
    setSlug?: string
    stats: { health?: number; shield?: number; armor?: number; power?: number; sprint?: number }
    polarities: string[]
    aura?: string
    passive?: string
    abilities: { name: string; description: string; image?: string }[]
    components: {
      uniqueName: string
      name: string
      image?: string
      itemCount: number
      tradable: boolean
      ducats?: number
      slug?: string
      drops: { location: string; chance: number }[]
    }[]
  }
  interface DayStat {
    platinum: number
    credits: number
    ducats: number
    endo: number
    aya: number
    vitus: number
    relicsOpened: number
    mr?: number
    completion?: number
  }
  interface StarchartData {
    nodes: Record<string, { xp: number; junction: boolean }>
    normalCount: number
    normalXpTotal: number
    junctionCount: number
    junctionXpEach: number
  }
  interface Window {
    electron: ElectronAPI
    api: {
      getRelics: () => Promise<RelicSummary[]>
      getPrice: (slug: string, force?: boolean, rank?: number) => Promise<PriceResult>
      getCachedPrices: () => Promise<PriceResult[]>
      getWorldState: () => Promise<WorldState | null>
      getArbitrations: () => Promise<ArbitrationInfo>
      getArbitrationForecast: () => Promise<ArbitrationSlot[]>
      getPlanetIcons: () => Promise<Record<string, string>>
      getMyOrders: () => Promise<MyOrdersResult>
      getSavedOrders: () => Promise<MyOrdersResult | null>
      getTrades: () => Promise<import('../renderer/src/tradeStats').Trade[]>
      undoLastImport: () => Promise<{ days: number; trades: number } | null>
      importAlecaFrame: (
        text: string
      ) => Promise<{ ok: boolean; days?: number; trades?: number; error?: string }>
      getMyContracts: () => Promise<ContractsResult>
      getSavedContracts: () => Promise<ContractsResult | null>
      updateContract: (
        id: string,
        change: {
          visible?: boolean
          starting_price?: number
          buyout_price?: number | null
          minimal_reputation?: number
          note?: string
        }
      ) => Promise<{ ok: boolean; error?: string }>
      removeContract: (id: string) => Promise<{ ok: boolean; error?: string }>
      setAllContractsVisible: (visible: boolean) => Promise<{ ok: boolean; error?: string }>
      createContract: (body: unknown) => Promise<{ ok: boolean; error?: string }>
      updateOrder: (
        id: string,
        edit: { platinum?: number; quantity?: number; visible?: boolean }
      ) => Promise<OrderActionResult>
      closeOrder: (id: string, quantity: number) => Promise<OrderActionResult>
      deleteOrder: (id: string) => Promise<OrderActionResult>
      getItemOrders: (slug: string) => Promise<ItemOrders | null>
      getTopOrders: (slug: string) => Promise<TopOrders | null>
      createOrder: (o: {
        itemId: string
        type: 'sell' | 'buy'
        platinum: number
        quantity: number
        rank?: number
      }) => Promise<OrderActionResult>
      getWfmStatus: () => Promise<WfmStatus>
      wfmLogin: (email: string, password: string) => Promise<WfmLoginResult>
      wfmLogout: () => Promise<void>
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
      }) => void
      getNotifyConfig: () => Promise<NotifyConfigView>
      setNotifyConfig: (patch: {
        webhook?: string
        routes?: Partial<Record<NotifyKind, Partial<{ windows: boolean; discord: boolean }>>>
        templates?: Partial<{ chat: string }>
        chatOnlyBackground?: boolean
      }) => Promise<void>
      testNotify: () => Promise<{ ok: boolean; error?: string }>
      notify: (n: {
        kind: 'arbitration' | 'reward' | 'cycle'
        title: string
        body: string
        discord?: string
      }) => void
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      isMaximized: () => Promise<boolean>
      onMaximize: (cb: (maximized: boolean) => void) => () => void
      getItemMeta: () => Promise<ItemMeta>
      getSyndicateShop: () => Promise<
        Record<
          string,
          {
            name: string
            image?: string
            slug?: string
            kind: ShopKind
            card?: {
              rarity?: string
              polarity?: string
              drain?: number
              maxRank?: number
              type?: string
            }
            cost?: number
            rank?: number
          }[]
        >
      >
      getVoidTraceIcon: () => Promise<string | null>
      getRelicDrops: (id: string) => Promise<{ location: string; chance: number; note?: string }[]>
      getMasteryCatalog: () => Promise<MasteryCatalog>
      getStarchartData: () => Promise<StarchartData | null>
      getMasteryIcons: () => Promise<Record<number, string>>
      getInventoryMeta: () => Promise<InventoryMeta>
      getModDetail: (uniqueName: string) => Promise<ModDetail | null>
      getResourceCatalog: () => Promise<ResourceMeta[]>
      getCraftables: () => Promise<CraftItem[]>
      getRecipeMap: () => Promise<Record<string, [string, number][]>>
      getAcrithisWares: () => Promise<{ observed: string; items: string[] } | null>
      getArchonShards: () => Promise<ArchonShard[]>
      getStatsHistory: () => Promise<{ days: Record<string, DayStat> }>
      getMarketStats: () => Promise<MarketStats>
      getLiveDeals: () => Promise<Record<string, LiveDeal>>
      onLiveDeals: (cb: (d: Record<string, LiveDeal>) => void) => () => void
      onNavigate: (cb: (page: string) => void) => () => void
      getOverlayState: () => Promise<OverlayState>
      closeOverlay: () => void
      getOverlayHotkeys: () => Promise<{ toggle: string; interact: string; riven: string }>
      setOverlayHotkey: (
        which: 'toggle' | 'interact' | 'riven',
        accel: string
      ) => Promise<{ ok: true } | { ok: false; error: string }>
      previewOverlay: (kind: 'recommend' | 'rewards' | null) => void
      simulateGameEvent: (ev: { type: string; item?: string; file?: string }) => void
      getArbiState: () => Promise<ArbiState>
      getArbiRuns: () => Promise<ArbiRun[]>
      onArbiShow: (cb: () => void) => () => void
      onArbiState: (cb: (s: ArbiState) => void) => () => void
      onArbiRuns: (cb: () => void) => () => void
      onOverlayState: (cb: (s: OverlayState) => void) => () => void
      startMarketScan: () => Promise<void>
      onMarketProgress: (cb: (p: MarketProgress) => void) => () => void
      getHour12: () => Promise<boolean | null>
      getRivenGrades: () => Promise<
        Record<string, { core: string[]; good: string[]; neg: string[] }>
      >
      getRivenCatalog: () => Promise<{
        weapons: Record<
          string,
          { name: string; gameRef?: string; rivenType: string; icon?: string }
        >
        attrs: Record<string, { name: string; unit?: string }>
      }>
      searchRivenAuctions: (slug: string) => Promise<RivenListing[]>
      findSimilarRiven: (f: { slug: string; pos: string[]; neg?: string }) => void
      onFinderPrefill: (cb: (d: { slug: string; filter: unknown }) => void) => () => void
      getRivenHistory: (slug: string) => Promise<RivenSnap[]>
      sniperList: () => Promise<{ alerts: SniperAlert[] }>
      sniperAdd: (a: {
        name: string
        slug: string
        filter: import('../renderer/src/rivenFilter').Filter
        minDeal?: number
        negs?: string[]
        minRoll?: number
        use?: boolean
      }) => Promise<boolean>
      sniperUpdate: (
        id: string,
        p: {
          paused?: boolean
          minDeal?: number
          use?: boolean
          negs?: string[]
          minRoll?: number
          filter?: import('../renderer/src/rivenFilter').Filter
        }
      ) => Promise<void>
      sniperDelete: (id: string) => Promise<void>
      getWikiAcquisition: (item: string) => Promise<string | null>
      getRivenData: () => Promise<{
        values: Record<string, Record<string, number>>
        affix: Record<string, [string, string]>
      }>
      getItemDetail?: (uniqueName: string) => Promise<ItemDetail | null>
      getWarframeDetail: (uniqueName: string) => Promise<WarframeDetail | null>
      getInventory: () => Promise<InventoryStatus>
      refreshInventory: () => Promise<InventoryStatus>
      getWfmPresence: () => Promise<WfmPresence | null>
      getWfmPublicStatus: () => Promise<WfmPresence | 'offline' | null>
      setWfmPresence: (s: WfmPresence) => Promise<void>
      setWfmPresenceAuto: (on: boolean, base: WfmPresence) => Promise<void>
      onWfmPresence: (cb: (s: WfmPresence | null) => void) => () => void
      onInventory: (cb: (status: InventoryStatus) => void) => () => void
    }
  }
}
