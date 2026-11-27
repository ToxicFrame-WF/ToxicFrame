import { useEffect, useState } from 'react'
import TopNav, { ScreenHeader } from './components/TopNav'
import DataExport from './components/DataExport'
import RelicList from './components/RelicList'
import MasteryPage from './components/MasteryPage'
import InventoryPage from './components/InventoryPage'
import ResourcePage from './components/ResourcePage'
import CraftingHelper from './components/CraftingHelper'
import ArchonShards from './components/ArchonShards'
import FoundryPage from './components/FoundryPage'
import RivensPage from './components/RivensPage'
import RivenFinder from './components/RivenFinder'
import { openFinder } from './rivenFind'
import SniperPage from './components/SniperPage'
import MyOrders from './components/MyOrders'
import MyContracts from './components/MyContracts'
import ArbitrationSchedule from './components/ArbitrationSchedule'
import ArbiLive from './components/ArbiLive'
import ArbitrationPreferences from './components/ArbitrationPreferences'
import ArbitrationHistory from './components/ArbitrationHistory'
import StatsPage from './components/StatsPage'
import WeeklyTracker from './components/WeeklyTracker'
import { MarketActivity } from './components/MarketActivity'
import { PeriodSelect, YourTrading, type Period } from './components/TradingAnalytics'
import { useArbitrationAlerts } from './hooks/useArbitrationAlerts'
import { useCycleAlerts } from './hooks/useCycleAlerts'
import { SyndicatesPage } from './components/StreetCred'
import NewItems from './components/NewItems'
import RightPanel from './components/RightPanel'
import SettingsDialog, { type Tab as SettingsTab } from './components/SettingsDialog'
import SetupScreen from './components/SetupScreen'
import { useSettings } from './settings'
import { usePersisted } from './hooks/usePersisted'

function App(): React.JSX.Element {
  const [page, setPage] = usePersisted('App.page', 'relics')
  const [weeklyEditing, setWeeklyEditing] = useState(false)
  const [hideTrades, setHideTrades] = usePersisted('stats.hideTrades', false)
  const [tradePeriod, setTradePeriod] = usePersisted<Period>('Trading.period', 'all')
  // false = closed, else the tab to open on
  const [settingsOpen, setSettingsOpen] = useState<false | SettingsTab>(false)
  const settings = useSettings()
  useArbitrationAlerts()
  useCycleAlerts()
  // keep the main-process loading-screen auto-refresh in sync with the setting
  useEffect(() => {
    window.api.setInventoryAutoRefresh(settings.autoRefreshInventory)
  }, [settings.autoRefreshInventory])
  // a clicked notification (live market deal) opens its page
  useEffect(() => window.api.onNavigate(setPage), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () =>
      window.api.onFinderPrefill((d) => {
        openFinder(d.slug, d.filter as Parameters<typeof openFinder>[1])
      }),
    []
  )
  // other parts of the app (the right panel) can ask to open a page
  useEffect(() => {
    const go = (e: Event): void => setPage(String((e as CustomEvent).detail))
    window.addEventListener('toxicframe:navigate', go)
    return () => window.removeEventListener('toxicframe:navigate', go)
  }, [setPage])
  // an Arbitration run started: show the Live tab (when that setting is on)
  useEffect(() => window.api.onArbiShow(() => setPage('arbitrations-live')), [setPage])
  // "Compare" on My orders: show the item in the right panel's Buy / Sell tab
  const [compare, setCompare] = useState<{ slug: string; rank?: number; id: number } | null>(null)
  const onCompare = (slug: string, rank?: number): void => {
    const panelVisible = settings.showRightPanel && window.matchMedia('(min-width: 1250px)').matches
    if (panelVisible) setCompare((c) => ({ slug, rank, id: (c?.id ?? 0) + 1 }))
    else window.open(`https://warframe.market/items/${slug}`, '_blank') // no right panel to show it in
  }
  // any page can ask to show an item in Buy / Sell: dispatch 'toxicframe:compare' with { slug }
  useEffect(() => {
    const go = (e: Event): void => {
      const d = (e as CustomEvent<{ slug: string; rank?: number }>).detail
      if (d?.slug) onCompare(d.slug, d.rank)
    }
    window.addEventListener('toxicframe:compare', go)
    return () => window.removeEventListener('toxicframe:compare', go)
  })

  if (!settings.setupDone) return <SetupScreen controls={<WindowControls />} />
  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* top bar (custom title bar; the native frame is disabled) */}
      {/* the menu bar is also the title bar (drag to move, window buttons on the right) */}
      <TopNav
        active={page}
        onSelect={setPage}
        onOpenSettings={() => setSettingsOpen('general')}
        controls={<WindowControls />}
      />
      <div className="flex min-h-0 flex-1">
        {/* main panel */}
        <main className="min-w-0 flex-1 p-3">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900">
            <ScreenHeader
              page={page}
              right={
                page === 'stats' ? (
                  <span className="flex gap-2">
                    <button
                      onClick={() => setHideTrades((h) => !h)}
                      className="rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                    >
                      ◔ {hideTrades ? 'Show trades' : 'Hide trades'}
                    </button>
                    <DataExport />
                  </span>
                ) : page === 'arbitrations-history' ? (
                  <button
                    disabled
                    title="Importing game logs is not built yet"
                    // -my-2: the button must not make this header taller than the other tabs'
                    className="-my-2 cursor-not-allowed rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold opacity-50"
                  >
                    ⤓ Import logs
                  </button>
                ) : page === 'weekly' ? (
                  <button
                    onClick={() => setWeeklyEditing((e) => !e)}
                    aria-pressed={weeklyEditing}
                    className="rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                  >
                    {weeklyEditing ? '✓ Done customizing' : '⚙ Customize'}
                  </button>
                ) : page === 'analytics-trading' ? (
                  <PeriodSelect value={tradePeriod} onChange={setTradePeriod} />
                ) : undefined
              }
            />
            {/* the page fills what is left; it scrolls itself, so the header never pushes it out */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {page === 'relics' && <RelicList />}
              {page === 'syndicates' && <SyndicatesPage />}
              {page === 'foundry' && <FoundryPage />}
              {page === 'rivens-unveiled' && <RivensPage view="unveiled" />}
              {page === 'rivens-finder' && <RivenFinder />}
              {page === 'rivens-sniper' && (
                <SniperPage onOpenSettings={() => setSettingsOpen('notifications')} />
              )}
              {page === 'rivens-veiled' && <RivensPage view="veiled" />}
              {page === 'mastery' && <MasteryPage />}
              {page === 'inventory' && <InventoryPage />}
              {page === 'resource-inventory' && <ResourcePage />}
              {page === 'crafting-helper' && <CraftingHelper />}
              {page === 'archon-shards' && <ArchonShards />}
              {page === 'arbitrations-live' && <ArbiLive />}
              {page === 'arbitrations-schedule' && <ArbitrationSchedule />}
              {page === 'stats' && <StatsPage hideTrades={hideTrades} />}
              {page === 'weekly' && (
                <WeeklyTracker editing={weeklyEditing} setEditing={setWeeklyEditing} headerButton />
              )}
              {page === 'analytics-trading' && <YourTrading period={tradePeriod} />}
              {page === 'analytics-market' && <MarketActivity />}
              {page === 'arbitrations-alerts' && <ArbitrationPreferences />}
              {page === 'arbitrations-history' && <ArbitrationHistory />}
              {page === 'market-contracts' && (
                <MyContracts onOpenSettings={() => setSettingsOpen('general')} />
              )}
              {page === 'market-orders' && (
                <MyOrders onOpenSettings={() => setSettingsOpen('general')} onCompare={onCompare} />
              )}
            </div>
          </div>
        </main>
        {settings.showRightPanel && (
          <RightPanel compare={compare} hideArbitrations={page === 'arbitrations-schedule'} />
        )}
      </div>
      {settingsOpen && (
        <SettingsDialog initialTab={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}
      <NewItems />
    </div>
  )
}

// Minimize / maximize / close, drawn as simple monochrome glyphs (no coloured icons).
function WindowControls(): React.JSX.Element {
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    window.api.isMaximized().then(setMaximized)
    return window.api.onMaximize(setMaximized)
  }, [])

  const btn =
    'nc-winbtn flex h-11 w-12 items-center justify-center text-slate-300 [-webkit-app-region:no-drag]'
  return (
    <div className="ml-auto flex items-center">
      <button
        onClick={() => window.api.minimizeWindow()}
        title="Minimize"
        className={`${btn} hover:bg-slate-800`}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
          <rect x="1" y="5" width="9" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={() => window.api.maximizeWindow()}
        title={maximized ? 'Restore' : 'Maximize'}
        className={`${btn} hover:bg-slate-800`}
      >
        {maximized ? (
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
            <rect x="2.5" y="0.5" width="7" height="7" fill="none" stroke="currentColor" />
            <rect x="0.5" y="2.5" width="7" height="7" fill="#0f1420" stroke="currentColor" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
          </svg>
        )}
      </button>
      <button
        onClick={() => window.api.closeWindow()}
        title="Close"
        className={`${btn} nc-winclose hover:bg-red-600 hover:text-white`}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
          <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  )
}

export default App
