import Dropdown from './Dropdown'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { clock } from '../clock'
import { usePersisted } from '../hooks/usePersisted'
import Countdown from './Countdown'
import { ModifierHover } from './HoverCard'
import Icon from './Icon'
import { createPortal } from 'react-dom'
import TierBadge from './TierBadge'
import { timeLeft, useArbitrations, useNow, useWorldState } from '../hooks/useWorldState'
import { usePlanetIcons } from '../hooks/usePlanetIcons'
import { useItemMeta } from '../hooks/useItemMeta'
import { AlertSettings, updateSettings, useSettings } from '../settings'
import Pic from './Pic'
import DucatIcon from './DucatIcon'
import wfmLogo from '../assets/wfm-logo.png'
import BuySell from './BuySell'

type Tab = 'timers' | 'fissures' | 'trade'
const TABS: { id: Tab; label: string }[] = [
  { id: 'timers', label: 'Timers' },
  { id: 'fissures', label: 'Fissures' },
  { id: 'trade', label: 'Buy / Sell' }
]

// The Void symbol in white (the wiki's picture turned white; a drawn mark if it can't load).
function VoidMark({ size = 16 }: { size?: number }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (failed)
    return (
      <svg viewBox="0 0 20 20" width={size} height={size} className="shrink-0" aria-hidden>
        <path
          d="M10 2c3 3 5 5 5 8a5 5 0 0 1-10 0c0-3 2-5 5-8z"
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="11" r="1.8" fill="#fff" />
      </svg>
    )
  return (
    <span style={{ filter: 'brightness(0) invert(1)' }} className="inline-flex">
      <Pic src={VOID_ICON} fallback={VOID_ICON_SMALL} size={size} onFail={() => setFailed(true)} />
    </span>
  )
}

function TabIcon({ id }: { id: Tab }): React.JSX.Element {
  if (id === 'fissures') return <VoidMark />
  return id === 'timers' ? (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      className="shrink-0"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="7.5" />
      <ellipse cx="10" cy="10" rx="3.2" ry="7.5" />
      <path d="M2.5 10h15" />
    </svg>
  ) : (
    // warframe.market's own logo icon, turned white
    <img
      loading="lazy"
      src={wfmLogo}
      alt=""
      width={18}
      height={18}
      className="shrink-0 object-contain"
      style={{ filter: 'brightness(0) invert(1)' }}
    />
  )
}

const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s)
const STATE_COLOR: Record<string, string> = {
  day: 'text-amber-300',
  night: 'text-sky-300',
  warm: 'text-orange-300',
  cold: 'text-sky-300',
  fass: 'text-orange-300',
  vome: 'text-violet-300',
  corpus: 'text-sky-300',
  grineer: 'text-red-300'
}
// Duviri's mood cycle, in order
const DUVIRI = ['sorrow', 'fear', 'joy', 'anger', 'envy']
const card = 'rounded-xl border border-slate-700 bg-slate-800 p-3'
const compact = 'rounded-xl border border-slate-700 bg-slate-800 px-3 py-2'

type Planet = 'earth' | 'venus' | 'deimos' | 'zariman'

// Small drawn planet icons (stand-ins for the real renders).
function DrawnPlanet({ planet }: { planet: Planet }): React.JSX.Element {
  const id = `planet-${planet}`
  const stops: Record<Planet, [string, string]> = {
    earth: ['#7cc4ff', '#1a4a8a'],
    venus: ['#f7cf8a', '#b5601c'],
    deimos: ['#c7704f', '#43201a'],
    zariman: ['#16363d', '#08181c']
  }
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor={stops[planet][0]} />
          <stop offset="1" stopColor={stops[planet][1]} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill={`url(#${id})`} />
      {planet === 'earth' && (
        <>
          <path
            d="M9 15c3-4 8-3 9 1s-2 5-5 5-6-2-4-6zM22 23c3-1 8 1 6 5s-5 5-7 3-2-7 1-8z"
            fill="#4caf6a"
          />
          <path
            d="M8 25c4 2 8 1 12 3"
            stroke="#fff"
            strokeOpacity=".55"
            strokeWidth="1.5"
            fill="none"
          />
        </>
      )}
      {planet === 'venus' && (
        <>
          <path
            d="M5 15c8-4 22-4 30 0M4 22c9 4 23 4 32 0M7 29c8 3 18 3 26 0"
            stroke="#fff"
            strokeOpacity=".35"
            strokeWidth="1.6"
            fill="none"
          />
        </>
      )}
      {planet === 'deimos' && (
        <>
          <circle cx="14" cy="15" r="4" fill="#2a120e" opacity=".7" />
          <circle cx="26" cy="24" r="5" fill="#2a120e" opacity=".7" />
          <circle cx="16" cy="28" r="2.5" fill="#2a120e" opacity=".7" />
        </>
      )}
      {planet === 'zariman' && (
        <path
          d="M20 10c7 0 11 5 9 11s-9 8-14 4-3-10 3-10 8 5 4 8"
          stroke="#2fd3c0"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

// Zariman uses the Void damage icon from the wiki (full size first, the 32px version as backup).
const VOID_ICON = 'https://wiki.warframe.com/images/DmgVoidSmall64.png'
const VOID_ICON_SMALL =
  'https://wiki.warframe.com/images/thumb/DmgVoidSmall64.png/32px-DmgVoidSmall64.png?e62bb'

// The real picture when we have one; the drawn planet is the fallback.
function PlanetIcon({ planet }: { planet: Planet }): React.JSX.Element {
  const icons = usePlanetIcons()
  const [failed, setFailed] = useState(false)
  if (planet === 'zariman') {
    return failed ? (
      <DrawnPlanet planet={planet} />
    ) : (
      <Pic src={VOID_ICON} fallback={VOID_ICON_SMALL} size={36} onFail={() => setFailed(true)} />
    )
  }
  const src = icons[planet]
  if (src && !failed) return <Pic src={src} size={40} round onFail={() => setFailed(true)} />
  return <DrawnPlanet planet={planet} />
}

function CycleCard({
  title,
  sub,
  planet,
  data,
  now
}: {
  title: string
  sub: string
  planet: Planet
  data?: WorldCycle
  now: number
}): React.JSX.Element {
  const state = data?.state.toLowerCase() ?? ''
  const left = data ? new Date(data.expiry).getTime() - now : 0
  const soon = left > 0 && left < 5 * 60 * 1000
  return (
    <div className={`${card} flex flex-col justify-center`}>
      <div className="flex items-center gap-2">
        <PlanetIcon planet={planet} />
        <div>
          <div className="font-semibold leading-tight">{title}</div>
          <div className="text-xs text-slate-400">{sub}</div>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className={`text-sm font-semibold ${STATE_COLOR[state] ?? 'text-slate-300'}`}>
          {data ? cap(state) : '—'}
        </span>
        <span className={`flex items-center text-sm font-bold ${soon ? 'text-amber-200' : ''}`}>
          {soon && <Icon name="clock" size={12} className="mr-1" />}
          {data ? timeLeft(data.expiry, now) : '—'}
        </span>
      </div>
    </div>
  )
}

function ArbitrationCard({ now }: { now: number }): React.JSX.Element | null {
  const info = useArbitrations()
  const showInTimers = useSettings().arbPrefs.showInTimers
  const [forecast, setForecast] = useState(false)
  const left = (sec: number): string => timeLeft(new Date(sec * 1000).toISOString(), now)
  const next = info?.upcoming[0]
  const later = info?.upcoming.slice(1) ?? []

  const slot = (
    icon: string,
    label: string,
    accent: string,
    s: ArbitrationSlot | undefined,
    time: string,
    note: string
  ): React.JSX.Element => (
    <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <div className={`flex items-center gap-1.5 text-sm font-semibold ${accent}`}>
        <span className="text-base leading-none">{icon}</span>
        {label}
        {s && (
          <span className="ml-auto">
            <TierBadge tier={s.tier} />
          </span>
        )}
      </div>
      {s ? (
        <>
          <div className="mt-2.5 truncate font-semibold text-slate-100">{s.type || s.name}</div>
          {s.type && <div className="truncate text-sm text-slate-300">{s.name}</div>}
          <div className="mt-3 text-lg font-bold leading-tight text-slate-100">{time}</div>
          <div className="text-sm text-slate-300">{note}</div>
        </>
      ) : (
        <div className="mt-2.5 text-slate-400">—</div>
      )}
    </div>
  )

  if (!showInTimers) return null
  return (
    <div className={card}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg leading-none text-violet-300">⬡</span>
        <span className="font-semibold">Arbitrations</span>
        <button
          onClick={() => setForecast((f) => !f)}
          disabled={later.length === 0}
          title="Show the next few arbitrations"
          className={`ml-auto text-sm !normal-case !tracking-normal ${
            forecast ? 'text-violet-300' : 'text-slate-300 hover:text-white'
          } disabled:opacity-40`}
        >
          Forecast
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('toxicframe:navigate', { detail: 'arbitrations-alerts' })
            )
          }
          title="Set up arbitration alerts"
          className="text-slate-300 hover:text-white"
        >
          <Icon name="bell" />
        </button>
      </div>
      {!info || (!info.current && !next) ? (
        <div className="text-sm text-slate-400">No arbitration data right now.</div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {slot(
              '⬡',
              'Current',
              'text-violet-300',
              info.current,
              info.current ? left(info.current.end) : '',
              'left to enter'
            )}
            <span className="text-slate-500">→</span>
            {slot(
              '◷',
              'Next',
              'text-slate-200',
              next,
              next ? clock(next.start) : '',
              'when it starts'
            )}
          </div>
          {forecast && later.length > 0 && (
            <div className="mt-3 space-y-1 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <div className="mb-1 text-xs text-slate-400">Forecast</div>
              {later.map((s) => (
                <div key={s.start} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 whitespace-nowrap text-slate-400">
                    {clock(s.start)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {s.type ? `${s.type} · ${s.name}` : s.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="mt-2 text-xs text-slate-300">Schedule: browse.wf</div>
    </div>
  )
}

// ---------- hover popups ----------

// Shows `popup` to the left of the element while the mouse is over it. It is drawn on top of
// the page (a portal) so the side panel's scrolling can't cut it off. (Row hover cards with
// keyboard focus are components/HoverCard.tsx; these are the timer tiles' bigger popups.)
function PanelPopup({
  children,
  popup,
  className
}: {
  children: React.ReactNode
  popup: React.ReactNode
  className?: string
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const show = (): void => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.top, right: window.innerWidth - r.left + 8 })
  }
  // once drawn, move it up just enough to stay on screen (it was a fixed 440px guess)
  const pop = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = pop.current
    if (!pos || !el) return
    const top = Math.max(8, Math.min(pos.top, window.innerHeight - el.offsetHeight - 8))
    if (top !== pos.top) setPos({ ...pos, top })
  }, [pos])
  return (
    <div ref={ref} className={className} onMouseEnter={show} onMouseLeave={() => setPos(null)}>
      {children}
      {pos &&
        createPortal(
          <div
            ref={pop}
            style={{
              position: 'fixed',
              top: pos.top,
              right: pos.right,
              maxHeight: '85vh'
            }}
            className="nc-pop pointer-events-none z-[60] w-[26rem] max-w-[60vw] overflow-hidden rounded-xl border border-slate-600 bg-slate-900 p-3 text-slate-100 shadow-2xl"
          >
            {popup}
          </div>,
          document.body
        )}
    </div>
  )
}

function PopupTitle({ title, right }: { title: string; right?: string }): React.JSX.Element {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="font-semibold">{title}</span>
      {right && <span className="text-xs text-slate-400">{right}</span>}
    </div>
  )
}

function ItemGrid({ items }: { items: StockItem[] }): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it, i) => (
        <div
          key={i}
          className="flex flex-col items-center rounded-lg border border-slate-700 bg-slate-800 p-2 text-center"
        >
          <Pic src={it.image} size={56} letter={it.name[0]} />
          <div className="mt-1 text-xs font-semibold leading-tight">{it.name}</div>
        </div>
      ))}
    </div>
  )
}

const nextUtcMidnight = (now: number): number => {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
}
const nextUtcMonday = (now: number): number => {
  const d = new Date(now)
  const days = (8 - d.getUTCDay()) % 7 || 7
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days)
}
const iso = (ms: number): string => new Date(ms).toISOString()

// Real picture (Aya, Ducats) when we have one; the drawn icon is the fallback.
function TopIcon({
  src,
  fallback
}: {
  src?: string
  fallback: React.ReactNode
}): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (src && !failed) return <Pic src={src} size={24} onFail={() => setFailed(true)} />
  return <>{fallback}</>
}

function TopCards({ ws, now }: { ws: WorldState; now: number }): React.JSX.Element {
  const { prime, baro, circuit } = ws
  const icons = usePlanetIcons()
  const baroHere = Boolean(baro?.active && new Date(baro.expiry).getTime() > now)

  const primePopup = (
    <>
      <PopupTitle
        title="Prime Resurgence"
        right={prime ? `Rotation in ${timeLeft(prime.expiry, now)}` : undefined}
      />
      {prime?.items.length ? (
        <ItemGrid items={prime.items.slice(0, 12)} />
      ) : (
        <p className="text-sm text-slate-400">No stock data available right now.</p>
      )}
    </>
  )

  const baroPopup = (
    <>
      <PopupTitle
        title="Baro Ki'Teer"
        right={
          baro
            ? baroHere
              ? `Leaves in ${timeLeft(baro.expiry, now)}`
              : `Arrives in ${timeLeft(baro.activation, now)}`
            : undefined
        }
      />
      {baroHere && baro?.inventory.length ? (
        <div className="space-y-1">
          {baro.inventory.map((it, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-2 py-1 text-xs"
            >
              <Pic src={it.image} size={28} letter={it.name[0]} />
              <span className="min-w-0 flex-1 truncate font-semibold">{it.name}</span>
              <span className="flex items-center gap-1 text-amber-300">
                {it.ducats ?? '—'}
                <DucatIcon size={12} />
              </span>
              <span className="flex w-20 items-center justify-end gap-1 text-slate-300">
                {it.credits?.toLocaleString() ?? '—'}
                {icons.credits ? (
                  <img
                    loading="lazy"
                    src={icons.credits}
                    className="h-3 w-3 shrink-0"
                    alt="credits"
                  />
                ) : (
                  'cr'
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-300">
          {baroHere
            ? 'No stock data available right now.'
            : 'Check back when Baro arrives to see his stock'}
        </p>
      )}
    </>
  )

  const resetsPopup = (
    <>
      <PopupTitle title="Resets & Sortie" />
      {[
        ['Daily reset', iso(nextUtcMidnight(now))],
        ['Sortie', ws.sortieExpiry],
        ['Weekly reset', iso(nextUtcMonday(now))]
      ].map(([label, when]) => (
        <div key={label} className="flex items-center justify-between py-1 text-sm">
          <span className="text-slate-300">{label}</span>
          <span className="font-bold">{when ? timeLeft(when, now) : '—'}</span>
        </div>
      ))}
    </>
  )

  const circuitPopup = (
    <>
      <PopupTitle title="The Circuit" right="This week's rewards" />
      <div className="mb-1 text-xs font-semibold text-slate-300">Warframes</div>
      {circuit?.warframes.length ? (
        <ItemGrid items={circuit.warframes} />
      ) : (
        <p className="text-sm text-slate-400">No data right now.</p>
      )}
      <div className="mb-1 mt-3 text-xs font-semibold text-slate-300">Steel Path, Incarnons</div>
      {circuit?.weapons.length ? (
        <ItemGrid items={circuit.weapons} />
      ) : (
        <p className="text-sm text-slate-400">No data right now.</p>
      )}
    </>
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <PanelPopup popup={primePopup} className="h-full">
          <div className={`${compact} flex h-full items-center gap-2`}>
            <TopIcon
              src={icons.aya}
              fallback={
                <svg viewBox="0 0 32 32" className="h-6 w-6 shrink-0" aria-hidden>
                  <path d="M16 3c4 6 9 10 9 16a9 9 0 0 1-18 0c0-6 5-10 9-16z" fill="#3b82f6" />
                  <path
                    d="M12 20a5 5 0 0 0 4 4"
                    stroke="#bfdbfe"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              }
            />
            <div>
              <div className="whitespace-nowrap text-sm font-semibold leading-tight">
                Prime Resurgence
              </div>
              <div className="mt-0.5 whitespace-nowrap text-sm leading-tight text-slate-300">
                {prime ? `Rotation, ${timeLeft(prime.expiry, now)}` : 'No data'}
              </div>
            </div>
          </div>
        </PanelPopup>
        <PanelPopup popup={baroPopup} className="h-full">
          <div className={`${compact} flex h-full items-center gap-2`}>
            <TopIcon
              src={icons.ducats}
              fallback={
                <svg viewBox="0 0 32 32" className="h-6 w-6 shrink-0" aria-hidden>
                  <circle cx="16" cy="16" r="12" fill="none" stroke="#d4a64a" strokeWidth="2.5" />
                  <path
                    d="M10 22V12l6 6 6-6v10"
                    stroke="#d4a64a"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
            <div>
              <div className="whitespace-nowrap text-sm font-semibold leading-tight">
                Baro Ki&apos;Teer
              </div>
              <div className="mt-0.5 whitespace-nowrap text-sm leading-tight text-slate-300">
                {baro
                  ? baroHere
                    ? `Here, leaves in ${timeLeft(baro.expiry, now)}`
                    : `Arrives in ${timeLeft(baro.activation, now)}`
                  : 'No data'}
              </div>
            </div>
          </div>
        </PanelPopup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PanelPopup popup={resetsPopup}>
          <div className={`${compact} flex items-center gap-2 text-sm font-semibold`}>
            <span aria-hidden>
              <Icon name="clock" />
            </span>{' '}
            Resets
            <span className="ml-auto text-xs font-normal text-slate-300">
              {/* daily reset is at 00:00 UTC */}
              {timeLeft(
                new Date(Math.ceil((now + 1) / 86_400_000) * 86_400_000).toISOString(),
                now
              )}
            </span>
          </div>
        </PanelPopup>
        <PanelPopup popup={circuitPopup}>
          <div className={`${compact} flex items-center justify-between text-sm font-semibold`}>
            The Circuit
            <span className="flex gap-1">
              {(circuit?.warframes ?? []).slice(0, 3).map((w, i) => (
                <Pic key={i} src={w.image} size={22} round />
              ))}
            </span>
          </div>
        </PanelPopup>
      </div>
    </>
  )
}

// ---------- Alerts, Invasions & events ----------

const escapeRegex = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function patternsFor(cfg: AlertSettings): RegExp[] {
  const out: RegExp[] = []
  if (cfg.catalysts) out.push(/orokin catalyst/i)
  if (cfg.reactors) out.push(/orokin reactor/i)
  if (cfg.exilus) out.push(/exilus (\w+ )?adapter/i) // Exilus Adapter, Exilus Warframe/Weapon Adapter
  for (const p of cfg.parts) out.push(new RegExp(escapeRegex(p), 'i'))
  return out
}

const KIND_LABEL: Record<string, string> = { alert: 'Alert', invasion: 'Invasion', event: 'Event' }

function AlertsBox({ ws }: { ws: WorldState }): React.JSX.Element {
  const settings = useSettings()
  const meta = useItemMeta()
  const cfg = settings.alerts
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AlertSettings>(cfg)
  const [partQuery, setPartQuery] = useState('')
  const known = useRef<Set<string> | null>(null)

  const matches = useMemo(() => {
    const patterns = patternsFor(cfg)
    if (!patterns.length) return []
    return (ws.rewardEntries ?? [])
      .map((e) => ({ entry: e, hits: e.rewards.filter((r) => patterns.some((p) => p.test(r))) }))
      .filter((m) => m.hits.length > 0)
  }, [ws, cfg])

  // Desktop notification for rewards that show up after the app has loaded.
  useEffect(() => {
    const ids = new Set(matches.map((m) => m.entry.id))
    if (known.current === null) {
      known.current = ids
      return
    }
    if (cfg.notify) {
      for (const m of matches) {
        if (!known.current.has(m.entry.id)) {
          window.api.notify({
            kind: 'reward',
            title: 'Warframe reward',
            body: `${m.hits.join(', ')} · ${m.entry.title}`
          })
        }
      }
    }
    known.current = ids
  }, [matches, cfg.notify])

  const partOptions = useMemo(() => {
    const q = partQuery.trim().toLowerCase()
    if (q.length < 2) return []
    return Object.values(meta)
      .filter(
        (e) =>
          e.tags.includes('component') &&
          e.name.toLowerCase().includes(q) &&
          !draft.parts.includes(e.name)
      )
      .slice(0, 6)
  }, [meta, partQuery, draft.parts])

  const check = (key: 'catalysts' | 'reactors' | 'exilus', label: string): React.JSX.Element => (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
        className="h-4 w-4 accent-violet-500"
      />
      {label}
    </label>
  )

  const info = matches.length
    ? 'These alerts, invasions or events offer your selected rewards.'
    : 'No active Alerts, Invasions or events offer your selected rewards'

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          Alerts, Invasions &amp; events
          <span className="rounded border border-slate-600 bg-slate-900 px-1.5 text-xs">
            {matches.length}
          </span>
          <PanelPopup
            popup={
              <>
                <PopupTitle title="Alerts, Invasions & events" />
                <p className="text-sm text-slate-300">{info}</p>
              </>
            }
          >
            <span className="cursor-default text-slate-400">ⓘ</span>
          </PanelPopup>
        </div>
        <button
          onClick={() => {
            setDraft(cfg)
            setEditing((v) => !v)
          }}
          title="Choose rewards"
          className="rounded-lg border border-slate-600 px-2 py-1 text-sm hover:bg-slate-700"
        >
          <Icon name="bell" />
        </button>
      </div>

      {editing && (
        <div className="mt-3 rounded-xl border border-slate-600 bg-slate-900 p-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Reward notifications</span>
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.notify}
              onChange={(e) => setDraft({ ...draft, notify: e.target.checked })}
              className="h-4 w-4 accent-violet-500"
            />
            Notify me about selected rewards
          </label>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
            {check('catalysts', 'Catalysts')}
            {check('reactors', 'Reactors')}
            {check('exilus', 'Exilus adapters')}
          </div>
          <div className="mb-1 text-xs text-slate-300">Weapon parts</div>
          <input
            value={partQuery}
            onChange={(e) => setPartQuery(e.target.value)}
            placeholder="Add a weapon part…"
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none ring-1 ring-slate-600 focus:ring-violet-400"
          />
          {partOptions.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setDraft({ ...draft, parts: [...draft.parts, o.name] })
                setPartQuery('')
              }}
              className="mt-1 block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-700"
            >
              {o.name}
            </button>
          ))}
          <div className="mt-2 flex flex-wrap gap-1">
            {draft.parts.map((p) => (
              <span key={p} className="rounded-full bg-slate-700 px-2 py-0.5 text-xs">
                {p}{' '}
                <button
                  onClick={() => setDraft({ ...draft, parts: draft.parts.filter((x) => x !== p) })}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={() => {
              updateSettings({ alerts: draft })
              setEditing(false)
            }}
            className="mt-3 w-full rounded-lg border border-slate-600 py-2 text-sm hover:bg-slate-700"
          >
            Save alerts
          </button>
        </div>
      )}

      {!editing && matches.length === 0 && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <Icon name="gift" size={28} className="text-slate-200" />
          <div>
            <div>No matching rewards right now.</div>
            <div className="text-xs text-slate-300">Choose rewards with the bell</div>
          </div>
        </div>
      )}

      {!editing &&
        matches.length > 0 &&
        (() => {
          // one picture and one name per distinct reward across all matching missions
          const icons = new Map<string, string | undefined>()
          for (const { entry, hits } of matches)
            for (const h of hits) {
              const name = h.replace(/^\d+x\s+/, '')
              if (!icons.get(name)) icons.set(name, entry.icons?.[h])
            }
          return (
            <PanelPopup
              popup={
                <>
                  <PopupTitle title="Matching missions" />
                  {matches.map(({ entry, hits }) => (
                    <div
                      key={entry.id}
                      className="mt-2 rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-violet-300">
                          {KIND_LABEL[entry.kind]}
                        </span>
                        {entry.expiry && (
                          <span className="text-xs font-bold">
                            <Countdown to={entry.expiry} />
                          </span>
                        )}
                      </div>
                      <div className="truncate">{entry.title}</div>
                      <div className="text-xs text-amber-300">{hits.join(', ')}</div>
                    </div>
                  ))}
                </>
              }
            >
              <div className="mt-3 flex cursor-default items-center gap-3 text-sm">
                <span className="flex shrink-0 -space-x-2">
                  {[...icons.values()].slice(0, 3).map((src, k) => (
                    <span key={k} className="rounded-full bg-slate-900 p-0.5 ring-1 ring-slate-700">
                      <Pic src={src} size={32} letter="?" />
                    </span>
                  ))}
                </span>
                <div className="min-w-0">
                  <div>
                    {matches.length} mission{matches.length > 1 ? 's' : ''} match your rewards.
                  </div>
                  <div className="text-xs text-slate-300">{[...icons.keys()].join(', ')}</div>
                </div>
              </div>
            </PanelPopup>
          )
        })()}
    </div>
  )
}

function TimersTab({
  ws,
  hideArbitrations
}: {
  ws: WorldState
  hideArbitrations: boolean
}): React.JSX.Element {
  const now = useNow()
  // bounty groups start closed; the ones you open stay open across restarts
  const [openBounties, setOpenBounties] = usePersisted<string[]>('Bounties.open', [])
  const mood = ws.duviri?.state.toLowerCase() ?? ''
  const next = DUVIRI[(DUVIRI.indexOf(mood) + 1) % DUVIRI.length]
  return (
    <div className="space-y-3">
      <TopCards ws={ws} now={now} />

      <div className={`${card} space-y-3`}>
        <div className="font-semibold">World cycles</div>
        <div className="grid grid-cols-2 gap-3">
          <CycleCard title="Earth" sub="Cetus cycle" planet="earth" data={ws.cetus} now={now} />
          <CycleCard title="Orb Vallis" sub="Venus" planet="venus" data={ws.vallis} now={now} />
          <CycleCard title="Cambion" sub="Deimos" planet="deimos" data={ws.cambion} now={now} />
          <CycleCard
            title="Zariman"
            sub="Faction control"
            planet="zariman"
            data={ws.zariman}
            now={now}
          />
        </div>

        <div className={`${card} flex items-center justify-between`}>
          <div>
            <div className="font-semibold">Duviri</div>
            <div className="text-sm text-slate-300">
              {ws.duviri ? `${cap(mood)}, next ${cap(next)}` : '—'}
            </div>
          </div>
          <span className="font-bold">{ws.duviri ? timeLeft(ws.duviri.expiry, now) : '—'}</span>
        </div>
      </div>

      {!hideArbitrations && <ArbitrationCard now={now} />}

      {ws.incursions && (
        <div className={card}>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">Steel Path incursions</span>
            <span className="text-sm font-bold">{timeLeft(ws.incursions.expiry, now)}</span>
          </div>
          <ul className="space-y-0.5 text-sm text-slate-300">
            {ws.incursions.nodes.map((n, i) => (
              <li key={n} className="flex justify-between gap-2">
                <span>{n}</span>
                <span className="text-slate-400">{ws.incursions?.types?.[i]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ws.archimedea?.map((a) => (
        <div key={a.kind} className={card}>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">{a.kind}</span>
            <span className="text-sm font-bold">{timeLeft(a.expiry, now)}</span>
          </div>
          {/* one line per mission; its modifiers and what they do on hover (or keyboard focus) */}
          <ul className="space-y-0.5 text-sm">
            {a.missions.map((m, i) => (
              <ModifierHover
                key={i}
                title={`${m.mission}${m.faction ? ` · ${m.faction}` : ''}`}
                deviation={m.deviation}
                mods={m.risks}
                label="Risks"
              >
                <span className="text-slate-100">{m.mission}</span>
                {m.faction && <span className="text-slate-400"> · {m.faction}</span>}
              </ModifierHover>
            ))}
          </ul>
          {a.variables.length > 0 && (
            <ul className="mt-1.5 border-t border-slate-700/60 pt-1.5 text-sm">
              <ModifierHover
                title={`${a.kind}: personal modifiers`}
                mods={a.variables}
                label="Apply to every mission"
              >
                <span className="text-slate-300">Personal modifiers ({a.variables.length})</span>
              </ModifierHover>
            </ul>
          )}
        </div>
      ))}

      {ws.bounties && ws.bounties.length > 0 && (
        <div className={card}>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">Bounties</span>
            <span className="text-sm font-bold">{timeLeft(ws.bounties[0].expiry, now)}</span>
          </div>
          {ws.bounties.map((b) => {
            // every stage is on the same planet: name it once in the header, not on each row
            const planets = new Set(b.list.map((x) => /\(([^)]+)\)$/.exec(x.node)?.[1]))
            const planet = planets.size === 1 ? [...planets][0] : undefined
            return (
              <details
                key={b.syndicate}
                open={openBounties.includes(b.syndicate)}
                onToggle={(e) => {
                  const open = e.currentTarget.open
                  setOpenBounties((o) =>
                    open ? [...new Set([...o, b.syndicate])] : o.filter((x) => x !== b.syndicate)
                  )
                }}
                className="border-t border-slate-700/60 py-1.5 text-sm"
              >
                <summary className="cursor-pointer text-slate-200">
                  {b.syndicate}
                  <span className="text-slate-400">
                    {planet && ` · ${planet}`} · {b.list.length} stages
                  </span>
                  {/* only when this group resets at a different time than the header says */}
                  {b.expiry !== ws.bounties?.[0].expiry && (
                    <span className="float-right font-bold">{timeLeft(b.expiry, now)}</span>
                  )}
                </summary>
                <ol className="mt-1.5 space-y-1 text-xs">
                  {b.list.map((x, i) => {
                    const node = planet ? x.node.replace(/\s*\([^)]+\)$/, '') : x.node
                    return (
                      <li
                        key={i}
                        title={`${x.challenge} · ${x.node}`}
                        className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-2"
                      >
                        <span className="text-white/35">{i + 1}</span>
                        <span className="text-slate-100">{x.challenge}</span>
                        <span className="max-w-[9rem] truncate text-right text-slate-400">
                          {node}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </details>
            )
          })}
        </div>
      )}

      <AlertsBox ws={ws} />
    </div>
  )
}

// quick missions people pick to crack relics
const FAST = new Set(['Capture', 'Exterminate', 'Rescue', 'Sabotage', 'Spy'])
const TIER_ORDER = ['Lith', 'Meso', 'Neo', 'Axi', 'Requiem', 'Omnia']
// relic pictures per tier (from the item data); Omnia has none and keeps its glyph
const TIER_IMG: Record<string, string> = {
  Lith: 'RelicLithA.png',
  Meso: 'RelicMesoA.png',
  Neo: 'RelicNeoA.png',
  Axi: 'RelicAxiA.png',
  Requiem: 'RelicImmortalC.png' // browse.wf: /Lotus/Interface/Icons/Relics/<name>
}
const TIER_GLYPH: Record<string, string> = {
  Lith: 'text-amber-300',
  Meso: 'text-sky-300',
  Neo: 'text-violet-300',
  Axi: 'text-emerald-300',
  Requiem: 'text-rose-300',
  Omnia: 'text-teal-300'
}

type FissureMode = 'both' | 'normal' | 'hard' | 'storm'
const MODE_LABEL: Record<FissureMode, string> = {
  both: 'All',
  normal: 'Normal',
  hard: 'Steel Path',
  storm: 'Void Storms'
}

function FissuresTab({ ws }: { ws: WorldState }): React.JSX.Element {
  const now = useNow()
  const [mode, setMode] = useState<FissureMode>('both')
  const [tier, setTier] = useState('')
  const [fastOnly, setFastOnly] = usePersisted('Fissures.fastOnly', false)

  const list = ws.fissures
    .filter((f) =>
      mode === 'storm'
        ? f.isStorm
        : f.isStorm
          ? false
          : mode === 'hard'
            ? f.isHard
            : mode === 'normal'
              ? !f.isHard
              : true
    )
    .filter((f) => !tier || f.tier === tier)
    .filter((f) => !fastOnly || FAST.has(f.missionType))
    .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime())

  const tiers = [...new Set(ws.fissures.map((f) => f.tier))].sort(
    (a, b) => TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b)
  )
  const groups = TIER_ORDER.concat(tiers.filter((t) => !TIER_ORDER.includes(t)))
    .map((t) => ({ tier: t, items: list.filter((f) => f.tier === t) }))
    .filter((g) => g.items.length)

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Dropdown
          size="sm"
          className="flex-1"
          value={mode}
          onChange={(v) => setMode(v as FissureMode)}
          options={(Object.keys(MODE_LABEL) as FissureMode[]).map((m) => ({
            value: m,
            label: MODE_LABEL[m]
          }))}
        />
        <Dropdown
          size="sm"
          className="flex-1"
          value={tier}
          onChange={setTier}
          options={[
            { value: '', label: 'All relics' },
            ...tiers.map((t) => ({ value: t, label: t }))
          ]}
        />
        <button
          onClick={() => setFastOnly((f) => !f)}
          aria-pressed={fastOnly}
          title="Only the quick missions for cracking relics: Capture, Exterminate, Rescue, Sabotage, Spy"
          className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs ${
            fastOnly ? 'border-cyan-400 text-cyan-300' : 'border-slate-600 text-slate-300'
          }`}
        >
          Fast
        </button>
      </div>

      <div className="space-y-1.5">
        {groups.map((g) => (
          <div
            key={g.tier}
            className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-800/60"
          >
            <div className="flex w-11 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-slate-700 py-1">
              {TIER_IMG[g.tier] ? (
                <Pic
                  src={`https://browse.wf/Lotus/Interface/Icons/Relics/${TIER_IMG[g.tier]}`}
                  size={24}
                  letter="◈"
                />
              ) : (
                <span
                  className={`text-base leading-none ${TIER_GLYPH[g.tier] ?? 'text-slate-300'}`}
                >
                  ◈
                </span>
              )}
              <span className="text-[10px] font-semibold text-slate-200">{g.tier}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              {g.items.map((f, i) => {
                const left = new Date(f.expiry).getTime() - now
                const urgent = left > 0 && left < 5 * 60 * 1000
                return (
                  <div
                    key={f.id}
                    className={`flex items-center gap-1.5 px-2 py-1 text-[13px] leading-tight ${
                      i > 0 ? 'border-t border-slate-700/70' : ''
                    }`}
                  >
                    <span
                      className="min-w-0 flex-1 truncate"
                      title={`${f.missionType} · ${f.node}`}
                    >
                      <b>{f.missionType}</b>{' '}
                      <span className="text-slate-300">
                        {f.node
                          .replace(/\s*\((.+)\)\s*$/, ', $1')
                          .replace('Kuva Fortress', 'Kuva Fort.')}
                      </span>
                    </span>
                    {f.isHard && mode !== 'hard' && (
                      <span
                        title="Steel Path"
                        className="shrink-0 rounded border border-slate-500 px-1 text-[10px] font-bold text-slate-200"
                      >
                        SP
                      </span>
                    )}
                    <span
                      className={`w-[5.5rem] shrink-0 text-right font-bold ${urgent ? 'text-amber-200' : ''}`}
                    >
                      {urgent && <Icon name="clock" size={12} className="mr-1" />}
                      {timeLeft(f.expiry, now)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {!list.length && <div className="text-sm text-slate-400">No fissures match.</div>}
      </div>
    </div>
  )
}

export default function RightPanel({
  compare,
  hideArbitrations
}: {
  compare: { slug: string; rank?: number; id: number } | null
  hideArbitrations: boolean
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('timers')
  // a new Compare request from My orders switches to the Buy / Sell tab
  const [seenCompare, setSeenCompare] = useState(0)
  if (compare && compare.id !== seenCompare) {
    setSeenCompare(compare.id)
    setTab('trade')
  }
  const ws = useWorldState()

  return (
    <aside className="right-panel hidden w-[27rem] shrink-0 flex-col p-3 pl-0 min-[1250px]:flex">
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-700/60 bg-slate-900">
        <div className="flex gap-1 p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-on={tab === t.id || undefined}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-1.5 py-2 text-xs font-semibold ${tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <TabIcon id={t.id} />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
        <div
          className={`min-h-0 flex-1 p-3 pt-1 ${tab === 'trade' ? 'flex flex-col' : 'overflow-y-auto'}`}
        >
          {tab === 'trade' ? (
            <BuySell
              key={compare?.id ?? 0}
              initialSlug={compare?.slug}
              initialRank={compare?.rank}
            />
          ) : !ws ? (
            <div className="mt-16 text-center text-sm text-slate-400">Loading world state…</div>
          ) : tab === 'timers' ? (
            <TimersTab ws={ws} hideArbitrations={hideArbitrations} />
          ) : (
            <FissuresTab ws={ws} />
          )}
        </div>
      </div>
    </aside>
  )
}
