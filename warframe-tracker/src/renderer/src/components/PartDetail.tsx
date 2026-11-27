import { useEffect, useMemo, useState } from 'react'
import * as cache from '../apiCache'
import type { InvRow } from '../hooks/useInventoryItems'
import { relicCounts, useInventory } from '../hooks/useInventory'
import PlatIcon from './PlatIcon'
import DucatIcon from './DucatIcon'
import Pic from './Pic'
import NcCard from './NcCard'
import RelicDetail from './RelicDetail'

// Part detail popup (Inventory > Inspect on a part), laid out like the relic popup: the part and
// its value, what it builds, and every relic that drops it with the chance per refinement.

const REFINEMENTS = ['Intact', 'Exceptional', 'Flawless', 'Radiant'] as const

export default function PartDetail({
  row,
  plat,
  ducats,
  onClose
}: {
  row: InvRow
  plat: number
  ducats: number
  onClose: () => void
}): React.JSX.Element {
  const inv = useInventory()
  const [relics, setRelics] = useState<RelicSummary[]>([])
  const [builds, setBuilds] = useState<MasteryItem | undefined>()
  const [showVaulted, setShowVaulted] = useState(false)
  const [openRelic, setOpenRelic] = useState<string | null>(null)
  const [howTo, setHowTo] = useState<string | null | undefined>(undefined)
  // the item this part builds, for its wiki page (falls back to the part name minus the part)
  const itemName = builds?.name ?? row.name.split(' ').slice(0, -1).join(' ')
  useEffect(() => {
    if (itemName) window.api.getWikiAcquisition(itemName).then(setHowTo)
  }, [itemName])

  useEffect(() => {
    cache.relics().then(setRelics)
    if (row.parent)
      cache
        .masteryCatalog()
        .then((c) => setBuilds(c.items.find((i) => i.uniqueName === row.parent)))
  }, [row.parent])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !openRelic) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, openRelic])

  // relics whose reward list names this part; unvaulted first, then best Radiant chance
  const sources = useMemo(() => {
    const name = row.name.toLowerCase()
    return (
      relics
        // Warframe parts drop as "<part> Blueprint" ("Lavos Prime Chassis Blueprint")
        .map((r) => ({
          r,
          rw: r.rewards.find((x) => [name, `${name} blueprint`].includes(x.item.toLowerCase()))
        }))
        .filter((x): x is { r: RelicSummary; rw: RelicReward } => !!x.rw)
        .sort(
          (a, b) =>
            Number(a.r.vaulted) - Number(b.r.vaulted) ||
            (b.rw.chances.Radiant ?? 0) - (a.rw.chances.Radiant ?? 0)
        )
    )
  }, [relics, row.name])
  // vaulted relics fold away behind a button, but only when the part still drops from unvaulted ones
  const foldVaulted = sources.some((s) => !s.r.vaulted) && sources.some((s) => s.r.vaulted)
  const nVaulted = sources.filter((s) => s.r.vaulted).length

  const trade = (): void => {
    if (!row.slug) return
    window.dispatchEvent(new CustomEvent('toxicframe:compare', { detail: { slug: row.slug } }))
    onClose()
  }
  const pct = (n?: number): string => (n ? `${Math.round(n * 10) / 10}%` : '–')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={row.name}
        onClick={(e) => e.stopPropagation()}
        className="nc-dialog-card flex max-h-full w-full max-w-4xl flex-col rounded-lg bg-slate-900 text-slate-100 shadow-2xl"
      >
        <NcCard title={row.name} className="min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
            {/* header */}
            <div className="mb-4 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-800">
                <Pic src={row.image} size={52} letter={row.name[0]} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-2xl font-bold">{row.name}</div>
                <div className="text-sm text-slate-400">
                  You own ×{row.count}
                  {row.need ? ` · ${row.need} needed per build` : ''}
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="px-2 text-2xl leading-none text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
              {/* where to find it */}
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <div className="font-semibold">Where to find it</div>
                  <span className="text-xs text-slate-400">Chance per refinement</span>
                </div>
                {sources.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">
                    No relic drops this part. It may come from a market, a quest or a boss instead.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,4.5rem)] gap-2 px-3 py-1 text-[11px] text-slate-400">
                      <span>Relic</span>
                      {REFINEMENTS.map((f) => (
                        <span key={f} className="text-center">
                          {f}
                        </span>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {sources
                        .filter((s) => !foldVaulted || showVaulted || !s.r.vaulted)
                        .map(({ r, rw }) => {
                          const counts = relicCounts(inv, r.id)
                          const owned = counts
                            ? Object.values(counts).reduce((a, b) => a + b, 0)
                            : 0
                          return (
                            <button
                              key={r.id}
                              onClick={() => setOpenRelic(r.id)}
                              title="Open this relic"
                              className="nc-quiet grid w-full grid-cols-[minmax(0,1fr)_repeat(4,4.5rem)] items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-left text-sm hover:border-slate-500"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                {r.imageName && <Pic src={r.imageName} size={28} letter="R" />}
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold">
                                    {r.tier} {r.name} relic
                                  </span>
                                  <span className="flex flex-wrap gap-x-2 whitespace-nowrap text-[11px]">
                                    <span
                                      className={r.vaulted ? 'text-amber-300' : 'text-emerald-300'}
                                    >
                                      {r.vaulted ? 'Vaulted' : 'Drops in fissures'}
                                    </span>
                                    {owned > 0 && (
                                      <span className="text-sky-300">You own ×{owned}</span>
                                    )}
                                    <span className="text-slate-400">{rw.rarity}</span>
                                  </span>
                                </span>
                              </span>
                              {REFINEMENTS.map((f) => (
                                <span key={f} className="text-center tabular-nums">
                                  {pct(rw.chances[f])}
                                </span>
                              ))}
                            </button>
                          )
                        })}
                    </div>
                    {foldVaulted && (
                      <button
                        onClick={() => setShowVaulted((v) => !v)}
                        aria-expanded={showVaulted}
                        className="mt-2 w-full rounded-lg border border-dashed border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                      >
                        {showVaulted ? '▾ Hide vaulted relics' : `▸ Vaulted relics (${nVaulted})`}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* how to obtain, from the wiki: only shown when the wiki has notes */}
              {howTo && (
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 md:col-span-2 md:row-start-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold">How to obtain</div>
                    <a
                      href={`https://wiki.warframe.com/w/${encodeURIComponent(itemName.replace(/ /g, '_'))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-300 hover:underline"
                    >
                      wiki.warframe.com ↗
                    </a>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
                    {howTo}
                  </p>
                </div>
              )}

              {/* value + builds */}
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                  <div className="mb-2 font-semibold">Value</div>
                  <div className="mb-3 flex items-center gap-4 text-lg font-bold">
                    <span className="flex items-center gap-1 text-sky-300">
                      {plat || '–'} <PlatIcon size={16} />
                    </span>
                    {ducats > 0 && (
                      <span className="flex items-center gap-1 text-amber-300">
                        {ducats} <DucatIcon size={16} />
                      </span>
                    )}
                  </div>
                  <button
                    onClick={trade}
                    disabled={!row.slug}
                    className="w-full rounded-lg border border-slate-600 py-2 text-sm hover:bg-slate-700 disabled:opacity-40"
                  >
                    View sell orders
                  </button>
                </div>
                {builds && (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                    <div className="mb-2 font-semibold">Part of</div>
                    <div className="flex items-center gap-3">
                      <Pic src={builds.imageName} size={40} letter={builds.name[0]} />
                      <div>
                        <div className="font-semibold">{builds.name}</div>
                        <div className="text-xs text-slate-400">
                          {row.need ?? 1} needed · {builds.vaulted ? 'vaulted' : 'not vaulted'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </NcCard>
      </div>
      {openRelic && (
        <div onClick={(e) => e.stopPropagation()}>
          <RelicDetail relicId={openRelic} onClose={() => setOpenRelic(null)} />
        </div>
      )}
    </div>
  )
}
