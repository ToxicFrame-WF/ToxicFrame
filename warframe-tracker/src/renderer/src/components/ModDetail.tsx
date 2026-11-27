import { useEffect, useState } from 'react'
import type { InvRow } from '../hooks/useInventoryItems'
import { usePlanetIcons } from '../hooks/usePlanetIcons'
import PlatIcon from './PlatIcon'
import DucatIcon from './DucatIcon'
import Pic from './Pic'
import NcCard from './NcCard'

// Mod upgrade costs. Endo per rank step = base × 2^(rank-1), base by rarity; credits = endo × 48.3.
// Verified exactly against the in-game values (rare 5-rank mod: 620/320 endo, 29,946/15,456 credits).
const ENDO_BASE: Record<string, number> = { Common: 10, Uncommon: 15, Rare: 20, Legendary: 40 }
const CREDITS_PER_ENDO = 48.3

function costs(rarity: string | undefined, rank: number): { last: Cost; total: Cost } {
  const base = ENDO_BASE[rarity ?? ''] ?? 0
  if (!base || rank <= 0) return { last: { endo: 0, credits: 0 }, total: { endo: 0, credits: 0 } }
  const lastEndo = base * 2 ** (rank - 1)
  const totalEndo = base * (2 ** rank - 1)
  return {
    last: { endo: lastEndo, credits: Math.round(lastEndo * CREDITS_PER_ENDO) },
    total: { endo: totalEndo, credits: Math.round(totalEndo * CREDITS_PER_ENDO) }
  }
}
interface Cost {
  endo: number
  credits: number
}

// Rarity is shown with the in-game tier names.
const RARITY_LABEL: Record<string, string> = {
  Common: 'bronze',
  Uncommon: 'silver',
  Rare: 'gold',
  Legendary: 'legendary'
}
const RARITY_TEXT: Record<string, string> = {
  Common: 'text-amber-500',
  Uncommon: 'text-slate-300',
  Rare: 'text-yellow-400',
  Legendary: 'text-sky-300'
}

function CostRow({
  label,
  cost,
  icons
}: {
  label: string
  cost: Cost
  icons: Record<string, string>
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-end gap-3">
      <span>{label}</span>
      <span className="flex w-16 items-center justify-end gap-1 font-semibold text-slate-200">
        {icons.credits ? <img loading="lazy" src={icons.credits} className="h-3.5 w-3.5" /> : '¢'}
        {cost.credits.toLocaleString()}
      </span>
      <span className="flex w-16 items-center justify-end gap-1 font-semibold text-slate-200">
        {icons.endo ? <img loading="lazy" src={icons.endo} className="h-3.5 w-3.5" /> : 'E'}
        {cost.endo.toLocaleString()}
      </span>
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-semibold">{children}</div>
    </div>
  )
}

export default function ModDetail({
  row,
  plat,
  onClose
}: {
  row: InvRow
  plat: number
  onClose: () => void
}): React.JSX.Element {
  const [detail, setDetail] = useState<ModDetail | null>(null)
  const [rank, setRank] = useState(row.rank ?? 0)
  const icons = usePlanetIcons()

  useEffect(() => {
    window.api.getModDetail(row.key).then(setDetail)
  }, [row.key])
  // the game data lacks sources for ~1 in 7 mods (Nightwave, companions, events): ask the wiki
  const [howTo, setHowTo] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (detail && detail.drops.length === 0)
      window.api.getWikiAcquisition(detail.name).then(setHowTo)
  }, [detail])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const trade = (): void => {
    if (!row.slug) return
    window.dispatchEvent(
      new CustomEvent('toxicframe:compare', { detail: { slug: row.slug, rank: row.rank } })
    )
    onClose() // so the Buy / Sell panel isn't hidden behind this window
  }
  const stats = detail?.levelStats[rank] ?? []
  const cost = costs(detail?.rarity, rank)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="nc-dialog-card flex max-h-full w-full max-w-3xl flex-col rounded-lg bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <NcCard title={row.name} className="min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {/* header */}
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800">
                <Pic src={detail?.image ?? row.image} size={44} letter={row.name[0]} />
              </span>
              <div className="flex-1">
                <div className="text-2xl font-bold">{row.name}</div>
                <span className="inline-block rounded border border-slate-600 px-2 py-0.5 text-xs capitalize text-slate-300">
                  {detail?.kind ?? 'mod'}
                </span>
              </div>
              {detail?.wikiUrl && (
                <button
                  onClick={() => window.open(detail.wikiUrl, '_blank')}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
                >
                  ↗ Wiki
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* stats & ranks */}
            <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-3 font-semibold text-slate-200">Stats &amp; ranks</div>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Mod type">
                  <span className="capitalize">{detail?.modType ?? '—'}</span>
                </Field>
                <Field label="Rarity">
                  <span className={detail?.rarity ? RARITY_TEXT[detail.rarity] : ''}>
                    {detail?.rarity ? (RARITY_LABEL[detail.rarity] ?? detail.rarity) : '—'}
                  </span>
                </Field>
                <Field label="Drain">
                  {detail?.drainMin != null ? `${detail.drainMin} - ${detail.drainMax}` : '—'}
                </Field>
                <Field label="Polarity">
                  <span className="capitalize">{detail?.polarity ?? '—'}</span>
                </Field>
              </div>

              {detail && detail.maxRank > 0 && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm text-slate-400">Rank</span>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: detail.maxRank + 1 }, (_, r) => (
                      <button
                        key={r}
                        onClick={() => setRank(r)}
                        className={`h-9 w-9 rounded-lg border text-sm font-semibold ${
                          rank === r
                            ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                            : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                <div className="text-sm text-slate-200">
                  {stats.length ? stats.join(' · ') : 'No per-rank stats listed.'}
                </div>
                {detail && detail.kind === 'mod' && ENDO_BASE[detail.rarity ?? ''] && rank > 0 && (
                  <div className="shrink-0 space-y-1 text-xs text-slate-400">
                    <CostRow label="Last upgrade" cost={cost.last} icons={icons} />
                    <CostRow label="Total from rank 0" cost={cost.total} icons={icons} />
                  </div>
                )}
              </div>
            </div>

            {/* owned + trade */}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded bg-slate-900">
                <Pic src={detail?.image ?? row.image} size={40} letter={row.name[0]} />
              </span>
              <div className="flex-1">
                <div className="font-semibold">{row.name}</div>
                <div className="text-xs text-slate-400">Owned ×{row.count}</div>
              </div>
              {row.slug && (
                <button
                  onClick={trade}
                  className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
                >
                  Trade
                  <span className="flex items-center gap-1 font-semibold text-sky-300">
                    {plat > 0 ? plat : '—'}
                    <PlatIcon size={12} />
                  </span>
                </button>
              )}
            </div>

            {/* where to find it */}
            {detail && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <div className="mb-2 font-semibold text-slate-200">Where to find it</div>
                {detail.drops.length === 0 &&
                  (howTo === undefined ? (
                    <p className="text-sm text-slate-400">Loading from the wiki…</p>
                  ) : howTo ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
                      {howTo}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">
                      No drop or shop source in the game data or on the wiki.
                    </p>
                  ))}
                <div className="max-h-64 overflow-y-auto">
                  {detail.drops.map((d) => (
                    <div
                      key={d.location}
                      className="flex items-center justify-between border-t border-slate-800 py-1.5 text-sm first:border-t-0"
                    >
                      <span className="flex items-center gap-2 text-slate-300">
                        <span className="text-slate-500">◍</span>
                        {d.location}
                      </span>
                      <span className="font-semibold text-slate-200">
                        {d.ducats != null ? (
                          <span className="flex items-center gap-2">
                            <span className="flex items-center gap-1" title="Ducats">
                              {d.ducats.toLocaleString()} <DucatIcon size={14} />
                            </span>
                            <span className="flex items-center gap-1" title="Credits">
                              {(d.credits ?? 0).toLocaleString()}
                              {icons.credits ? (
                                <img loading="lazy" src={icons.credits} className="h-3.5 w-3.5" />
                              ) : (
                                '¢'
                              )}
                            </span>
                          </span>
                        ) : (
                          (d.note ?? `${d.chance.toFixed(d.chance < 10 ? 2 : 0)}%`)
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </NcCard>
      </div>
    </div>
  )
}
