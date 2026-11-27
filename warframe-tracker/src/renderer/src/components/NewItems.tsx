import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInventory } from '../hooks/useInventory'
import { useInventoryItems, type InvRow } from '../hooks/useInventoryItems'
import { requestPrices, usePriceStore } from '../hooks/priceStore'
import { usePersisted } from '../hooks/usePersisted'
import { lowerBaseline, newCopies, type Counts } from '../newItems'
import NcCard from './NcCard'
import Pic from './Pic'
import WikiIcon from './WikiIcon'
import PlatIcon from './PlatIcon'
import DucatIcon from './DucatIcon'

// After a mission (each fresh inventory load), tradable items that gained copies show up in a
// small "N new items found" toast (bottom left, stays until "Mark as seen"); "Review items"
// opens the list with their value.
export default function NewItems(): React.JSX.Element | null {
  const inv = useInventory()
  const items = useInventoryItems()
  const { get } = usePriceStore()
  const [baseline, setBaseline] = usePersisted<Counts | null>('newItems.baseline', null)
  const [open, setOpen] = useState(false)

  const rows = useMemo(() => {
    const all = [...items.relics, ...items.mods, ...items.arcanes, ...items.parts, ...items.misc]
    return all.filter((r) => r.tradable && r.count > 0)
  }, [items])
  const current = useMemo(() => Object.fromEntries(rows.map((r) => [r.key, r.count])), [rows])
  const fresh = items.ready && !!inv.data && !inv.fromCache
  const loadedAt = inv.data?.fetchedAt ?? 0

  // first fresh load: everything owned is the starting point, nothing is "new"; later loads only
  // lower the baseline for copies that are gone (sold, traded, used)
  useEffect(() => {
    if (!fresh) return
    setBaseline((b) => (b ? lowerBaseline(b, current) : current))
  }, [fresh, loadedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // the cached inventory is the last fresh load, so unseen items survive an app restart
  const added = baseline && items.ready && inv.data ? newCopies(baseline, current) : {}
  const list: (InvRow & { extra: number })[] = rows
    .filter((r) => added[r.key])
    .map((r) => ({ ...r, extra: added[r.key] }))
  const plat = (r: InvRow): number | null => {
    const p = r.slug ? get(r.slug) : undefined
    return p && p !== 'error' ? p.price : null
  }
  useEffect(() => {
    if (open) requestPrices(list.flatMap((r) => (r.slug ? [r.slug] : [])))
  }, [open, list.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!list.length) return null
  const copies = list.reduce((n, r) => n + r.extra, 0)
  const markSeen = (): void => {
    setBaseline(current)
    setOpen(false)
  }

  return (
    <>
      {!open && (
        <div className="nc-pop fixed bottom-4 left-4 z-[55] flex items-center gap-3 rounded-lg border border-violet-400/50 bg-slate-900 px-4 py-3 shadow-2xl">
          {/* the game's own "new item" marker */}
          <span className="text-violet-300">
            <WikiIcon
              file="IconIOSNewItem(xWhite).png"
              title="New items"
              color="currentColor"
              size={26}
            />
          </span>
          <div>
            <div className="font-semibold">
              {copies} new item{copies === 1 ? '' : 's'} found
            </div>
            <button
              onClick={() => setOpen(true)}
              className="text-sm text-violet-300 hover:text-violet-200"
            >
              Review items →
            </button>
          </div>
        </div>
      )}
      {open && (
        <ReviewDialog
          list={list}
          copies={copies}
          plat={plat}
          onLater={() => setOpen(false)}
          onSeen={markSeen}
        />
      )}
    </>
  )
}

function ReviewDialog({
  list,
  copies,
  plat,
  onLater,
  onSeen
}: {
  list: (InvRow & { extra: number })[]
  copies: number
  plat: (r: InvRow) => number | null
  onLater: () => void
  onSeen: () => void
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onLater()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onLater])
  // value of the new copies only
  const value = list.reduce((n, r) => n + (plat(r) ?? 0) * r.extra, 0)
  const ducats = list.reduce((n, r) => n + (r.ducats ?? 0) * r.extra, 0)
  const btn = 'rounded-lg border px-4 py-2 text-sm font-semibold'
  return createPortal(
    <section
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
      onClick={onLater}
    >
      <div
        role="dialog"
        aria-label="New items found"
        onClick={(e) => e.stopPropagation()}
        className="nc-dialog-card flex max-h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-[#1b1e2b] text-slate-100"
      >
        <NcCard title="New items found" className="min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-6 border-b border-slate-700 p-5">
              <div className="mr-auto">
                <div className="text-lg font-bold">
                  {copies} new cop{copies === 1 ? 'y' : 'ies'}
                </div>
                <div className="text-sm text-slate-400">
                  {list.length} item{list.length === 1 ? '' : 's'}
                </div>
              </div>
              <Total
                icon={<PlatIcon size={26} />}
                label="Estimated value"
                value={Math.round(value)}
              />
              <Total icon={<DucatIcon size={26} />} label="Ducats" value={ducats} />
            </div>
            <div className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] content-start gap-3 overflow-y-auto p-5">
              {list.map((r) => {
                const p = plat(r)
                return (
                  <div
                    key={r.key}
                    className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3"
                  >
                    <span className="relative shrink-0">
                      <Pic src={r.image} size={48} letter={r.name[0]} />
                      <span className="absolute -bottom-1 -right-1 rounded bg-slate-950 px-1 text-[10px] font-bold">
                        x{r.count}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                        <span className="rounded border border-emerald-400/50 px-1.5 text-emerald-300">
                          +{r.extra} new
                        </span>
                        {r.isPrime && (
                          <span className="rounded border border-slate-600 px-1.5 text-slate-300">
                            {r.vaulted ? 'Vaulted' : 'Unvaulted'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {p != null && (
                          <span className="flex items-center gap-1">
                            {Math.round(p)}
                            <PlatIcon size={13} />
                          </span>
                        )}
                        {r.ducats ? (
                          <span className="flex items-center gap-1 text-amber-300">
                            {r.ducats}
                            <DucatIcon size={13} />
                          </span>
                        ) : null}
                      </span>
                      {r.slug && (
                        <button
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent('toxicframe:compare', {
                                detail: { slug: r.slug, rank: r.rank }
                              })
                            )
                          }
                          className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs hover:bg-slate-800"
                        >
                          Trade →
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-700 p-4">
              <button onClick={onLater} className={`${btn} border-slate-600 hover:bg-slate-800`}>
                Continue later
              </button>
              <button
                autoFocus
                onClick={onSeen}
                className={`${btn} border-violet-400/70 bg-violet-600 text-white hover:bg-violet-500`}
              >
                ✓ Mark as seen
              </button>
            </div>
          </div>
        </NcCard>
      </div>
    </section>,
    document.querySelector('main') ?? document.body
  )
}

function Total({
  icon,
  label,
  value
}: {
  icon: React.ReactNode
  label: string
  value: number
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-xl font-bold">{value.toLocaleString()}</div>
      </div>
    </div>
  )
}
