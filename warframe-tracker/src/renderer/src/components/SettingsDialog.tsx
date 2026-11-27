import Dropdown from './Dropdown'
import { useEffect, useState } from 'react'
import WfmLogin from './WfmLogin'
import OverlayHotkeys from './overlay/OverlayHotkeys'
import { CYCLES, cap } from '../cycleAlerts'
import {
  Refinement,
  exportSettings,
  importSettings,
  resetSettings,
  updateSettings,
  useSettings
} from '../settings'

export type Tab = 'general' | 'overlays' | 'notifications' | 'other'
const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'other', label: 'Other' }
]

function Section({
  title,
  action,
  children
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

// A switch row. `soon` rows belong to features that are not built yet: they are shown but disabled.
export function Toggle({
  on,
  onChange,
  label,
  hint,
  soon
}: {
  on?: boolean
  onChange?: (v: boolean) => void
  label: string
  hint?: string
  soon?: boolean
}): React.JSX.Element {
  return (
    <div
      onClick={() => !soon && onChange?.(!on)}
      className={`flex items-center gap-3 border-t border-slate-700/70 py-2.5 first:border-t-0 ${soon ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
    >
      <span
        role="switch"
        aria-checked={Boolean(on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on && !soon ? 'bg-cyan-600' : 'bg-slate-700'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on && !soon ? 'translate-x-5' : ''}`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      {soon && <span className="text-[10px] uppercase text-slate-500">soon</span>}
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-3 py-1.5 text-sm">
      <span className="w-40">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="w-12 text-right tabular-nums">{value}</span>
    </label>
  )
}

// shows the real overlay on the desktop while open; closing the dialog hides it
function OverlayPreview(): React.JSX.Element {
  const [kind, setKind] = useState<'recommend' | 'rewards' | null>(null)
  useEffect(() => {
    window.api.previewOverlay(kind)
  }, [kind])
  useEffect(() => () => window.api.previewOverlay(null), [])
  return (
    <div className="flex gap-2">
      {(
        [
          ['recommend', 'Preview recommended relics'],
          ['rewards', 'Preview reward cards']
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          onClick={() => setKind(kind === k ? null : k)}
          className={`rounded-lg px-3 py-2 text-sm ring-1 ring-slate-600 ${kind === k ? 'bg-cyan-600' : 'bg-slate-900'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-dashed border-slate-600 p-6 text-sm text-slate-300">
      {children}
    </div>
  )
}

const ROUTE_ROWS: [NotifyKind, string][] = [
  ['arbitration', 'Arbitrations'],
  ['marketDeal', 'Market deals'],
  ['trade', 'Trades'],
  ['reward', 'Rewards'],
  ['chat', 'In-game messages'],
  ['cycle', 'World cycles'],
  ['sniper', 'Riven sniper']
]
const ROUTE_COLS = ['windows', 'discord'] as const
const inputCls = 'w-full rounded-lg bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-600'

function NotificationsTab({ btn }: { btn: string }): React.JSX.Element {
  const [cfg, setCfg] = useState<NotifyConfigView | null>(null)
  const [hook, setHook] = useState('')
  const [result, setResult] = useState('')
  const [tpl, setTpl] = useState({ chat: '' })
  const cyc = useSettings().cycleAlerts

  const load = (): void => {
    window.api.getNotifyConfig().then((c) => {
      setCfg(c)
      setTpl(c.templates)
    })
  }
  useEffect(load, [])

  const save = async (patch: Parameters<typeof window.api.setNotifyConfig>[0]): Promise<void> => {
    await window.api.setNotifyConfig(patch)
    load()
  }
  if (!cfg) return <></>

  const templates: ['chat', string, string, string][] = [
    ['chat', 'In-game message', '<PLAYER_NAME>', 'Zephyr']
  ]

  return (
    <>
      <Section title="Discord">
        <div className="flex gap-2">
          <input
            type="password"
            value={hook}
            onChange={(e) => setHook(e.target.value)}
            placeholder={
              cfg.webhookSet
                ? `Webhook saved (ends in ${cfg.webhookTail})`
                : 'https://discord.com/api/webhooks/...'
            }
            className={inputCls}
          />
          <button
            disabled={!hook.trim()}
            onClick={() => {
              const h = hook.trim()
              void save({ webhook: h })
                .then(() => window.api.getNotifyConfig())
                .then((c) =>
                  setResult(
                    c.webhookSet && c.webhookTail === h.slice(-4)
                      ? 'Saved.'
                      : 'Not saved: that is not a Discord webhook link.'
                  )
                )
              setHook('')
            }}
            className={btn}
          >
            Save
          </button>
          <button
            disabled={!cfg.webhookSet}
            onClick={() => {
              void save({ webhook: '' })
              setResult('')
            }}
            className={btn}
          >
            Clear
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            disabled={!cfg.webhookSet}
            onClick={() => {
              setResult('Sending...')
              window.api
                .testNotify()
                .then((r) => setResult(r.ok ? 'Sent.' : `Failed: ${r.error}`))
                .catch(() => setResult('Failed.'))
            }}
            className={btn}
          >
            Send test
          </button>
          {result && <span className="text-sm text-sky-300">{result}</span>}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Treat the webhook like a password: anyone with it can post in your channel.
        </p>
      </Section>

      <Section title="Where notifications go">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="py-1 font-normal" />
              {ROUTE_COLS.map((c) => (
                <th key={c} className="w-20 py-1 text-center font-normal capitalize">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROUTE_ROWS.map(([kind, label]) => (
              <tr key={kind} className="border-t border-slate-700/70">
                <td className="py-2">{label}</td>
                {ROUTE_COLS.map((c) => (
                  <td key={c} className="text-center">
                    <input
                      type="checkbox"
                      checked={cfg.routes[kind][c]}
                      disabled={c === 'discord' && !cfg.webhookSet}
                      onChange={(e) => void save({ routes: { [kind]: { [c]: e.target.checked } } })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-400">
          Arbitration alert rules are set under Arbitrations &gt; Alerts &amp; favorites.
        </p>
      </Section>

      <Section title="World cycle reminders">
        <label className="mb-2 flex items-center gap-2 text-sm">
          Notify
          <input
            type="number"
            min={1}
            max={30}
            value={cyc.minutes}
            onChange={(e) =>
              updateSettings({
                cycleAlerts: {
                  ...cyc,
                  minutes: Math.min(30, Math.max(1, Math.round(Number(e.target.value)) || 1))
                }
              })
            }
            className="w-16 rounded-lg bg-slate-900 px-2 py-1 text-sm ring-1 ring-slate-600"
          />
          minutes before
        </label>
        {CYCLES.map((c) => (
          <div key={c.key} className="flex flex-wrap items-center gap-1.5 py-1 text-sm">
            <span className="w-28 text-slate-300">{c.label}</span>
            {c.states.map((st) => {
              const pick = `${c.key}:${st}`
              const on = cyc.picks.includes(pick)
              return (
                <button
                  key={pick}
                  onClick={() =>
                    updateSettings({
                      cycleAlerts: {
                        ...cyc,
                        picks: on ? cyc.picks.filter((p) => p !== pick) : [...cyc.picks, pick]
                      }
                    })
                  }
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-cyan-500 bg-cyan-600/80 text-white' : 'nc-quiet border-slate-600 bg-slate-800 text-slate-300'}`}
                >
                  {cap(st)}
                </button>
              )
            })}
          </div>
        ))}
        <p className="mt-2 text-xs text-slate-400">
          Notifies before the chosen state starts. Where it goes is set in the table above.
        </p>
      </Section>

      <Section title="Message templates">
        <Toggle
          on={cfg.chatOnlyBackground}
          onChange={(v) => void save({ chatOnlyBackground: v })}
          label="Only notify about in-game messages while Warframe is in the background"
          hint="Off: you also get them while you're playing"
        />
        {templates.map(([key, label, tag, sample]) => (
          <div key={key} className="mb-3 last:mb-0">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>
                {label} <span className="text-slate-400">({tag})</span>
              </span>
              <button onClick={() => void save({ templates: { [key]: '' } })} className={btn}>
                Reset
              </button>
            </div>
            <input
              value={tpl[key]}
              onChange={(e) => setTpl({ ...tpl, [key]: e.target.value })}
              onBlur={() => void save({ templates: { [key]: tpl[key] } })}
              className={inputCls}
            />
            <div className="mt-1 text-xs text-slate-400">
              Preview: {tpl[key].split(tag).join(sample)}
            </div>
          </div>
        ))}
      </Section>
    </>
  )
}

export default function SettingsDialog({
  onClose,
  initialTab = 'general'
}: {
  onClose: () => void
  initialTab?: Tab
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [message, setMessage] = useState('')
  const [wfm, setWfm] = useState<WfmStatus>({ linked: false })
  const [loginOpen, setLoginOpen] = useState(false)
  const settings = useSettings()

  useEffect(() => {
    window.api
      .getWfmStatus()
      .then(setWfm)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const downloadSettings = (): void => {
    const url = URL.createObjectURL(new Blob([exportSettings()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'toxicframe-settings.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage(
      importSettings(await file.text())
        ? 'Settings imported.'
        : 'That file is not a valid settings file.'
    )
    e.target.value = ''
  }

  const btn =
    'rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-700'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-600 bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold">Settings</span>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-xl text-slate-400 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        <div className="flex gap-5 border-b border-slate-700 px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-b-2 pb-3 text-sm ${tab === t.id ? 'border-violet-400 font-semibold text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === 'general' && (
            <>
              <Section title="App & startup">
                <Toggle
                  on={settings.closeWarning}
                  onChange={(v) => updateSettings({ closeWarning: v })}
                  label="Show warning when trying to close the main app window"
                />
                <Toggle
                  on={settings.autoTrackTrades}
                  onChange={(v) => updateSettings({ autoTrackTrades: v })}
                  label="Auto-track trades: mark warframe.market orders as sold when an in-game trade finishes"
                />
                <Toggle
                  on={settings.moveToSecondary}
                  onChange={(v) => updateSettings({ moveToSecondary: v })}
                  label="Automatically move ToxicFrame to a secondary monitor on startup"
                  hint="Takes effect the next time the app starts; does nothing with a single monitor"
                />
                <Toggle
                  on={settings.autoOpenArbi}
                  onChange={(v) => updateSettings({ autoOpenArbi: v })}
                  label="Switch to the Arbitrations Live tab when a run starts"
                />
                <Toggle
                  on={settings.enableStats}
                  onChange={(v) => updateSettings({ enableStats: v })}
                  label="Enable 'Stats' tab"
                  hint="Shows or hides the Stats entry in the sidebar"
                />
                <Toggle
                  on={settings.showRightPanel}
                  onChange={(v) => updateSettings({ showRightPanel: v })}
                  label="Show the timers & events panel"
                />
                <Toggle
                  on={settings.preloadPrices}
                  onChange={(v) => updateSettings({ preloadPrices: v })}
                  label="Load all prices when the app starts"
                  hint="Needed to sort relics by platinum value from the start. Turn off to load prices only as you scroll."
                />
              </Section>

              <Section title="Inventory & mastery">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm">Mark inventory as old after</div>
                    <div className="text-xs text-slate-400">
                      Shows &ldquo;Using old data&rdquo; when it has not updated for this long
                    </div>
                  </div>
                  <Dropdown
                    value={String(settings.staleAfterMinutes ?? 60)}
                    onChange={(v) => updateSettings({ staleAfterMinutes: Number(v) })}
                    options={[
                      ['15', '15 minutes'],
                      ['30', '30 minutes'],
                      ['60', '1 hour'],
                      ['180', '3 hours'],
                      ['720', '12 hours'],
                      ['1440', '24 hours'],
                      ['0', 'Never']
                    ].map(([value, label]) => ({ value, label }))}
                  />
                </div>
                <Toggle
                  on={settings.manualInventory}
                  onChange={(v) => updateSettings({ manualInventory: v })}
                  label="Manual inventory updates"
                  hint="The inventory helper only runs when you press Refresh."
                />
                <Toggle
                  on={settings.loadAllItems}
                  onChange={(v) => updateSettings({ loadAllItems: v })}
                  label="Load all items at once on the Foundry, Inventory and Relic pages (no 'Show more')"
                  hint="Can be slower on big lists"
                />
                <Toggle
                  on={settings.hideFounders}
                  onChange={(v) => updateSettings({ hideFounders: v })}
                  label="Hide Founders Program items (Excalibur Prime, Skana Prime and Lato Prime)"
                  hint="Items you own or have levelled still show"
                />
                <Toggle
                  on={settings.formaLevels}
                  onChange={(v) => updateSettings({ formaLevels: v })}
                  label="Include levels that need formas in the Mastery Helper"
                  hint="Off: rank 40 items count as done at 30, and the mastery progress bar drops to match"
                />
              </Section>

              <Section title="Relic planner">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm">Refinement shown on relic cards</div>
                    <div className="text-xs text-slate-400">Also used when sorting by value</div>
                  </div>
                  <Dropdown
                    value={settings.cardRefinement}
                    onChange={(v) => updateSettings({ cardRefinement: v as Refinement })}
                    options={['Intact', 'Exceptional', 'Flawless', 'Radiant'].map((r) => ({
                      value: r,
                      label: r
                    }))}
                  />
                </div>
              </Section>

              <Section
                title="Warframe.market"
                action={
                  wfm.linked ? (
                    <button
                      onClick={() => {
                        window.api.wfmLogout()
                        setWfm({ linked: false })
                      }}
                      className={btn}
                    >
                      Log out
                    </button>
                  ) : (
                    <button onClick={() => setLoginOpen(true)} className={btn}>
                      Link account
                    </button>
                  )
                }
              >
                <p className="mb-2 text-xs text-slate-400">
                  {wfm.linked
                    ? `Linked as ${wfm.name}. Your own orders and trading tools will use this account.`
                    : 'Not linked. Prices already load without an account; linking will add your own orders and trading tools.'}
                </p>
                <Toggle
                  on={settings.rankAware}
                  onChange={(v) => updateSettings({ rankAware: v })}
                  label="Take mod and arcane rank into account on My orders and Compare"
                  hint="Lowest sell prices and Compare use only orders of the same rank as yours"
                />
                <Toggle
                  on={settings.inGameOnly}
                  onChange={(v) => updateSettings({ inGameOnly: v })}
                  label="In-game traders only in Buy / Sell"
                  hint="Turn off to also show Online and Offline traders"
                />
                <Toggle
                  on={settings.rememberWfmAuto}
                  onChange={(v) => updateSettings({ rememberWfmAuto: v })}
                  label="Remember warframe.market 'Auto' status when ToxicFrame restarts"
                  hint="Off: Auto starts switched off each time, and your last picked status is used"
                />
              </Section>
            </>
          )}

          {tab === 'overlays' && (
            <>
              <Notice>
                Overlays only show when Warframe runs in borderless windowed mode. They open by
                themselves on the relic and reward screens; the hotkeys below open Recommended
                relics at any time and let you click on an open overlay (scroll, close).
              </Notice>
              <Section title="Relics">
                <Toggle
                  on={settings.overlayRewards}
                  onChange={(v) => updateSettings({ overlayRewards: v })}
                  label="Relic rewards overlay"
                  hint="Plat, ducats and how many you own for each reward card"
                />
                <Toggle
                  on={settings.overlayRecommend}
                  onChange={(v) => updateSettings({ overlayRecommend: v })}
                  label="Recommended relics overlay"
                  hint="Uses the filters saved with Apply filters to overlay on the Relic planner"
                />
              </Section>
              <Section title="Rivens">
                <Toggle
                  on={settings.overlayRiven}
                  onChange={(v) => updateSettings({ overlayRiven: v })}
                  label="Riven overlay"
                  hint="Grades, similar listings and suggested rolls beside the riven card on the riven cycle screen"
                />
              </Section>
              <Section title="Behaviour">
                <Toggle
                  on={settings.overlayKeepTabbed}
                  onChange={(v) => updateSettings({ overlayKeepTabbed: v })}
                  label="Keep overlays when tabbed out"
                  hint="Open panels stay on top of other apps after you alt-tab out of Warframe (they are not re-read until you return)"
                />
              </Section>
              <Section title="Preview">
                <OverlayPreview />
              </Section>
              <Section title="Appearance">
                <Slider
                  label="Relics size (%)"
                  min={75}
                  max={175}
                  value={settings.recommendSize}
                  onChange={(v) => updateSettings({ recommendSize: v })}
                />
                <Slider
                  label="Relics opacity (%)"
                  min={40}
                  max={100}
                  value={settings.recommendOpacity}
                  onChange={(v) => updateSettings({ recommendOpacity: v })}
                />
                <Slider
                  label="Relics rows shown"
                  min={1}
                  max={4}
                  value={settings.recommendRows}
                  onChange={(v) => updateSettings({ recommendRows: v })}
                />
                <label className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="w-40">Relics corner</span>
                  <Dropdown
                    size="sm"
                    value={settings.recommendCorner}
                    onChange={(v) =>
                      updateSettings({ recommendCorner: v as typeof settings.recommendCorner })
                    }
                    options={[
                      { value: 'top-right', label: 'Top right' },
                      { value: 'bottom-right', label: 'Bottom right' },
                      { value: 'bottom-left', label: 'Bottom left' }
                    ]}
                  />
                </label>
                <Slider
                  label="Reward cards size (%)"
                  min={75}
                  max={150}
                  value={settings.rewardsSize}
                  onChange={(v) => updateSettings({ rewardsSize: v })}
                />
                <Slider
                  label="Reward cards opacity (%)"
                  min={40}
                  max={100}
                  value={settings.rewardsOpacity}
                  onChange={(v) => updateSettings({ rewardsOpacity: v })}
                />
              </Section>
              <Section title="Hotkeys">
                <OverlayHotkeys />
              </Section>
              <Section title="Warframe menu scale">
                <label className="flex items-center justify-between gap-3 text-sm">
                  Match the Menu Scale setting in Warframe (Options, Interface)
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={settings.menuScale}
                    onChange={(e) => updateSettings({ menuScale: Number(e.target.value) || 0 })}
                    onBlur={() =>
                      updateSettings({
                        menuScale: Math.min(
                          100,
                          Math.max(50, Math.round(settings.menuScale) || 100)
                        )
                      })
                    }
                    className="w-20 border border-white/15 bg-slate-900 px-2 py-1 text-right outline-none"
                  />
                </label>
              </Section>
            </>
          )}

          {tab === 'notifications' && <NotificationsTab btn={btn} />}

          {tab === 'other' && (
            <>
              <Section title="Your settings">
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={downloadSettings} className={btn}>
                    Export settings
                  </button>
                  <label className={`${btn} cursor-pointer`}>
                    Import settings
                    <input
                      type="file"
                      accept="application/json"
                      onChange={onImport}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => {
                      resetSettings()
                      setMessage('Settings reset to the defaults.')
                    }}
                    className={btn}
                  >
                    Reset all settings
                  </button>
                </div>
                {message && <p className="mt-3 text-sm text-sky-300">{message}</p>}
              </Section>
              <Section title="Credits">
                <ul className="space-y-1 text-sm text-slate-300">
                  <li>Prices and item icons: warframe.market</li>
                  <li>Game data and images: browse.wf (browse.wf/about)</li>
                  <li>Arbitration schedule and Zariman faction: browse.wf</li>
                  <li>Arbitration tier list: the Arbitration Goons (via browse.wf)</li>
                  <li>World state: Digital Extremes&apos; public world-state feed</li>
                  <li>Item and relic data: WFCD (warframe-items), until it moves to browse.wf</li>
                  <li>Currency, shard and syndicate pictures: the Warframe Wiki</li>
                </ul>
              </Section>
            </>
          )}
        </div>
      </div>
      {loginOpen && (
        <WfmLogin
          onClose={() => setLoginOpen(false)}
          onLinked={(name) => {
            setWfm({ linked: true, name })
            setLoginOpen(false)
          }}
        />
      )}
    </div>
  )
}
