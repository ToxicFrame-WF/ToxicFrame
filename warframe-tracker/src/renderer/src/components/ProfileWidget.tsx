import { useEffect, useRef, useState } from 'react'
import * as cache from '../apiCache'
import { useInventory, refreshInventory } from '../hooks/useInventory'
import { useMastery } from '../hooks/useMastery'
import { useSettings } from '../settings'
import { usePlanetIcons } from '../hooks/usePlanetIcons'
import PlatIcon from './PlatIcon'
import DucatIcon from './DucatIcon'

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0
}
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

// Currency tile (Platinum / Credits / Ducats / Endo).
function Tile({
  icon,
  label,
  value
}: {
  icon: React.ReactNode
  label: string
  value: string
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2.5">
      <span className="flex h-7 w-7 items-center justify-center">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className="truncate font-bold leading-tight">{value}</div>
      </div>
    </div>
  )
}

// trigger: custom content for the opening button (Night City's top-bar mastery rank); the card
// then opens below it instead of to the right.
export default function ProfileWidget({
  trigger
}: { trigger?: React.ReactNode } = {}): React.JSX.Element {
  const inv = useInventory()
  const { summary, rows } = useMastery()
  const settings = useSettings()
  const icons = usePlanetIcons()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [badges, setBadges] = useState<Record<number, string>>({})
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const toggle = (): void => {
    const rect = btnRef.current?.getBoundingClientRect()
    // pop out to the right of the sidebar widget
    if (rect)
      setPos(
        trigger
          ? { left: rect.left, top: rect.bottom + 6 }
          : { left: rect.right + 6, top: rect.top }
      )
    setOpen((o) => !o)
  }

  useEffect(() => {
    cache.masteryIcons().then(setBadges)
  }, [])
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const raw = inv.data?.raw ?? {}
  const rank = summary.rank
  const badge = rank != null ? badges[rank] : undefined
  const apiName = typeof raw.DisplayName === 'string' ? raw.DisplayName : ''
  const name = inv.accountName || apiName || 'Tenno'

  const primes = rows.filter((r) => r.item.isPrime)
  const primePct = primes.length
    ? Math.round((primes.filter((r) => r.mastered).length / primes.length) * 100)
    : 0

  // re-check the time limit every minute
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Why the data may be out of date (first match wins), or null when it is current.
  const fetchedAt = inv.data?.fetchedAt ?? 0
  const limit = (settings.staleAfterMinutes ?? 60) * 60_000
  const staleReason = !inv.data
    ? null
    : inv.state === 'error'
      ? `Last update failed: ${inv.error ?? 'unknown error'}`
      : inv.lastLoadAt && inv.lastLoadAt > fetchedAt
        ? 'A loading screen finished since the last update'
        : inv.fromCache
          ? 'Loaded from the last session, not updated yet'
          : limit > 0 && now - fetchedAt > limit
            ? `Not updated for over ${Math.round(limit / 60_000)} minutes`
            : null

  const status: { text: string; tone: 'ok' | 'warn' | 'idle'; hint?: string } =
    inv.state === 'loading'
      ? { text: 'Updating…', tone: 'idle' }
      : !inv.data
        ? inv.state === 'error'
          ? { text: inv.error ?? 'Update failed', tone: 'warn' }
          : { text: 'No data yet', tone: 'idle' }
        : staleReason
          ? { text: 'Using old data', tone: 'warn', hint: staleReason }
          : { text: 'Data up to date', tone: 'ok' }

  const updated = inv.data
    ? new Date(inv.data.fetchedAt).toLocaleString([], {
        dateStyle: 'short',
        timeStyle: 'short'
      })
    : '—'

  const renderBadge = (): React.JSX.Element => (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/40 bg-slate-900">
      {badge ? (
        <img loading="lazy" src={badge} alt="" className="h-8 w-8 object-contain" />
      ) : (
        <span className="text-sm font-bold text-violet-200">{rank ?? '–'}</span>
      )}
      {badge && rank != null && (
        <span className="absolute -bottom-1 -right-1 rounded bg-slate-950 px-1 text-[9px] font-bold text-violet-200">
          {rank}
        </span>
      )}
    </span>
  )

  const renderStatus = (): React.JSX.Element => (
    <span
      title={status.hint}
      className={`flex items-center gap-1 text-xs ${status.tone === 'ok' ? 'text-emerald-400' : status.tone === 'warn' ? 'text-amber-300' : 'text-slate-400'}`}
    >
      {status.tone === 'ok' ? '⦿' : status.tone === 'warn' ? '⚠' : '○'} {status.text}
    </span>
  )

  return (
    <div ref={ref} className={trigger ? 'relative [-webkit-app-region:no-drag]' : 'relative mb-2'}>
      {trigger ? (
        <button
          ref={btnRef}
          onClick={toggle}
          className="cursor-pointer"
          // undo the Night City button look (frame, capitals) so it matches Street Cred beside it
          style={{
            border: 0,
            background: 'none',
            padding: 0,
            textTransform: 'none',
            letterSpacing: 'normal',
            boxShadow: 'none',
            clipPath: 'none'
          }}
          title="Profile"
        >
          {trigger}
        </button>
      ) : (
        <button
          ref={btnRef}
          onClick={toggle}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2 text-left hover:bg-slate-800"
        >
          {renderBadge()}
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-slate-100">{name}</div>
            {renderStatus()}
          </div>
          <span className="text-xs text-slate-500">{open ? '▴' : '▾'}</span>
        </button>
      )}

      {/* expanded panel (fixed so the scrolling sidebar can't clip it) */}
      {open && (
        <div
          style={{ left: pos.left, top: pos.top }}
          className="nc-pop fixed z-50 w-80 rounded-xl border border-slate-600 bg-slate-900 p-4 shadow-2xl"
        >
          <div className="mb-3 flex items-center gap-3">
            {renderBadge()}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-lg font-bold">{name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                Prime collection
                <span className="font-semibold text-violet-300">{primePct}%</span>
              </div>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <Tile
              icon={<PlatIcon size={22} />}
              label="Platinum"
              value={compact(num(raw.PremiumCredits))}
            />
            <Tile
              icon={
                icons.credits ? (
                  <img loading="lazy" src={icons.credits} className="h-5 w-5" />
                ) : (
                  <span>¢</span>
                )
              }
              label="Credits"
              value={compact(num(raw.RegularCredits))}
            />
            <Tile
              icon={<DucatIcon size={18} />}
              label="Ducats"
              value={compact(
                (Array.isArray(raw.MiscItems)
                  ? (raw.MiscItems as { ItemType?: string; ItemCount?: number }[])
                  : []
                ).find((m) => m.ItemType === '/Lotus/Types/Items/MiscItems/PrimeBucks')
                  ?.ItemCount ?? 0
              )}
            />
            <Tile
              icon={
                icons.endo ? (
                  <img loading="lazy" src={icons.endo} className="h-5 w-5" />
                ) : (
                  <span>E</span>
                )
              }
              label="Endo"
              value={compact(num(raw.FusionPoints))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <div>
              {renderStatus()}
              <div className="mt-0.5 text-xs text-slate-400">Last update: {updated}</div>
              {status.hint && <div className="mt-0.5 text-xs text-amber-200/80">{status.hint}</div>}
            </div>
            <button
              onClick={() => refreshInventory()}
              disabled={inv.state === 'loading'}
              title="Refresh inventory"
              className="rounded-lg border border-slate-600 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              ↻
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
