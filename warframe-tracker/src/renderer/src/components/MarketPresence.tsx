import { useEffect, useRef, useState } from 'react'
import { usePersisted } from '../hooks/usePersisted'
import { useSettings } from '../settings'

// Top-bar warframe.market status: a small diamond in the status colour that opens a panel with
// the status (Invisible / Online / In game), Auto and your chats. Without a linked account it
// offers to link one. The last pick is re-sent when the app starts.
const OPTIONS: [WfmPresence, string, string][] = [
  ['invisible', 'Invisible', '#94a3b8'],
  ['online', 'Online', '#4ade80'],
  ['ingame', 'In game', '#5ef6ff']
]
const MESSAGES_URL = 'https://warframe.market/im/chats' // your chats on warframe.market

export default function MarketPresence({
  onLink
}: {
  onLink: () => void // opens Settings, where the account is linked
}): React.JSX.Element {
  const [linked, setLinked] = useState(false)
  const [picked, setPicked] = usePersisted<WfmPresence | null>('wfm.presence', null)
  const [live, setLive] = useState<WfmPresence | null>(null)
  // Auto: "in game" while Warframe runs, your pick otherwise (checked in the main process)
  const [savedAuto, setAuto] = usePersisted('wfm.presenceAuto', false)
  // Settings: not remembered across restarts -> Auto starts off until you pick it this session
  const { rememberWfmAuto } = useSettings()
  const [pickedThisSession, setPickedThisSession] = useState(false)
  const auto = savedAuto && (rememberWfmAuto || pickedThisSession)

  // re-check the link every few seconds while unlinked, so the picker appears right after
  // you link the account in Settings (a local call, no network once restored)
  useEffect(() => {
    if (linked) return
    const check = (): void => void window.api.getWfmStatus().then((s) => setLinked(s.linked))
    check()
    const t = setInterval(check, 3000)
    return () => clearInterval(t)
  }, [linked])
  useEffect(() => {
    window.api.getWfmPresence().then(setLive)
    return window.api.onWfmPresence(setLive)
  }, [])
  // after a restart, set the status you last picked again (the socket only opens on a pick),
  // or hand over to Auto, which sets it from whether the game runs
  useEffect(() => {
    if (!linked) return
    if (auto) void window.api.setWfmPresenceAuto(true, picked ?? 'online')
    else {
      void window.api.setWfmPresenceAuto(false, picked ?? 'online')
      if (picked) void window.api.setWfmPresence(picked)
    }
  }, [linked, auto]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!linked)
    return (
      <button
        onClick={onLink}
        title="Link your warframe.market account to set your status"
        className="rounded-lg border border-slate-600 px-2 py-1 text-xs [-webkit-app-region:no-drag] hover:bg-slate-800"
      >
        Link warframe.market
      </button>
    )
  const shown = live ?? picked ?? 'invisible'
  const opt = OPTIONS.find((o) => o[0] === shown) ?? OPTIONS[0]
  const pick = (v: WfmPresence): void => {
    setPicked(v)
    setAuto(false) // a status picked by hand wins over Auto
    void window.api.setWfmPresence(v)
  }
  return (
    <MarketMenu color={opt[2]} label={opt[1]} auto={auto}>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        warframe.market status
      </div>
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="warframe.market status">
        {OPTIONS.map(([v, label, c]) => (
          <button
            key={v}
            role="radio"
            aria-checked={shown === v}
            onClick={() => pick(v)}
            className="flex items-center gap-2.5 border px-3 py-2 text-left text-sm font-semibold uppercase tracking-wider"
            style={{
              borderColor: shown === v ? c : 'rgb(255 77 90 / 0.25)',
              background: shown === v ? `${c}1f` : 'transparent',
              color: shown === v ? c : '#c9d6d7'
            }}
          >
            <span
              className="h-2 w-2 rotate-45"
              style={{ background: c, boxShadow: `0 0 6px ${c}` }}
            />
            {label}
          </button>
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs text-slate-300">
        <input
          type="checkbox"
          role="switch"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked)
            setPickedThisSession(true)
          }}
          className="peer sr-only"
        />
        <span className="relative mt-0.5 h-3.5 w-6 shrink-0 border border-current text-slate-400 transition-colors peer-checked:bg-[#50d8e0]/25 peer-checked:text-[#5ef6ff] peer-focus-visible:outline peer-focus-visible:outline-1 after:absolute after:left-0.5 after:top-0.5 after:h-2 after:w-2 after:bg-current after:transition-transform peer-checked:after:translate-x-2.5" />
        <span>
          <b
            className="block uppercase tracking-widest"
            style={{ color: auto ? '#5ef6ff' : undefined }}
          >
            Auto
          </b>
          In game while Warframe runs, your pick otherwise
        </span>
      </label>
      <button
        onClick={() => window.open(MESSAGES_URL, '_blank')}
        className="mt-3 flex w-full items-center justify-center gap-2 border border-[#ff4d5a]/50 px-3 py-2 text-xs font-bold uppercase tracking-widest text-[#ff6b5a] hover:border-[#50d8e0] hover:text-[#50d8e0]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <path d="m3.5 6 8.5 7 8.5-7" />
        </svg>
        Open chats
      </button>
    </MarketMenu>
  )
}

// The top-bar button (status diamond + arrow) and the small panel it opens under it.
function MarketMenu({
  color,
  label,
  auto,
  children
}: {
  color: string
  label: string
  auto: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <span ref={ref} className="relative [-webkit-app-region:no-drag]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={`warframe.market: ${label}${auto ? ' (Auto)' : ''}`}
        aria-label={`warframe.market status: ${label}`}
        className="flex cursor-pointer items-center gap-1.5 border border-[#ff4d5a]/40 px-2 py-1.5 hover:border-[#50d8e0]/70"
      >
        <span
          className="h-2.5 w-2.5 rotate-45"
          style={{ background: color, boxShadow: `0 0 7px ${color}` }}
        />
        {auto && <span className="text-[9px] font-bold tracking-widest text-[#5ef6ff]">A</span>}
        <span className="text-[10px] text-slate-400" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className="nc-pop absolute right-0 top-full z-50 mt-2 w-64 border border-[#ff4d5a]/50 bg-slate-900 p-3 shadow-2xl">
          {children}
        </div>
      )}
    </span>
  )
}
