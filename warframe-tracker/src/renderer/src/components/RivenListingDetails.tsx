import { dealKind } from '../rivenFair'
import { useEffect } from 'react'
import type { Grade } from '../rivens'
import DrainPolarity from './DrainPolarity'
import NcCard from './NcCard'
import PlatIcon from './PlatIcon'

// Details modal for a Market listing, laid out like the in-game riven panel: the answer on top
// (price, verdict, why), the stats with ✓/✗ and a grade, quiet facts, then what to aim for and
// similar listings. Same dialog frame as RivenDetail, but fed with a listing (no raw rolls).
type L = RivenListing
const fmt = (a: L['attrs'][number]): string =>
  a.unit === 'multiply'
    ? `x${a.value.toFixed(2)}`
    : `${a.value > 0 ? '+' : ''}${a.value}${a.unit === 'percent' ? '%' : a.unit === 'seconds' ? 's' : ''}`
const VERDICT: Record<Grade, string> = {
  Perfect: 'bg-amber-300 text-black',
  Good: 'bg-emerald-500 text-black',
  OK: 'bg-amber-400 text-black',
  Bad: 'bg-rose-500 text-white'
}
// grade letter -> colour: S/A green, B cyan, C amber, D red
const gradeColor = (g?: string): string =>
  !g
    ? 'text-white/35'
    : g[0] === 'S' || g[0] === 'A'
      ? 'text-emerald-300'
      : g[0] === 'B'
        ? 'text-cyan-300'
        : g[0] === 'C'
          ? 'text-amber-300'
          : 'text-rose-400'
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '')
const LABEL = 'text-xs uppercase tracking-wider text-white/60'

export default function RivenListingDetails({
  l,
  grades,
  sheet,
  deal,
  odds,
  nameOf,
  rec,
  similar,
  onPick,
  onFindSimilar,
  onSavePlan,
  onClose
}: {
  l: L
  grades: ({ q: number; grade: string } | undefined)[]
  sheet?: Grade
  deal?: number
  odds?: string
  nameOf: (slug: string) => string
  rec: { label: string; names: string[]; on: (n: string) => boolean }[]
  similar: { l: L; pct: number }[]
  onPick: (l: L) => void
  onFindSimilar: () => void
  onSavePlan: () => void
  onClose: () => void
}): React.JSX.Element {
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const web = (
    <a
      href={l.url}
      target="_blank"
      rel="noreferrer"
      className="cursor-pointer rounded-md border border-violet-400/70 bg-violet-500/20 px-3 py-1 text-sm font-semibold hover:bg-violet-500/30"
    >
      Website
    </a>
  )
  // wanted = a stat the sheet lists (core or other) that this riven has; negatives are wanted when
  // they are on the sheet's OK-negatives list. No sheet for the weapon -> undefined (no tick).
  const sheetRows = rec.filter((r) => r.names.length)
  const wantedOf = (name: string, positive: boolean): boolean | undefined => {
    if (!sheetRows.length) return undefined
    const n = norm(name)
    const hit = (r: (typeof rec)[number]): boolean =>
      r.names.some((x) => norm(x) === n || norm(x).endsWith(n) || n.endsWith(norm(x)))
    return positive
      ? rec.filter((r) => r.label !== 'Negatives').some(hit)
      : !rec.some((r) => r.label === 'Negatives' && r.names.length) ||
          rec.some((r) => r.label === 'Negatives' && hit(r))
  }
  const rows = l.attrs.map((a, i) => ({
    a,
    g: grades[i],
    ok: wantedOf(nameOf(a.slug), a.positive)
  }))
  const posRows = rows.filter((r) => r.a.positive)
  const want = posRows.filter((r) => r.ok).length
  const qs = posRows.flatMap((r) => (r.g ? [r.g.q] : []))
  const avg = qs.length ? qs.reduce((x, y) => x + y, 0) / qs.length : undefined
  const reason = [
    sheetRows.length ? `${want} of ${posRows.length} wanted stats` : '',
    avg === undefined ? '' : `${avg >= 0.66 ? 'strong' : avg >= 0.33 ? 'average' : 'weak'} rolls`
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${l.name} listing`}
        onClick={(e) => e.stopPropagation()}
        className="nc-dialog-card flex max-h-full w-full max-w-xl flex-col rounded-lg bg-slate-900 text-white shadow-2xl"
      >
        <NcCard title={l.name} className="min-h-0 flex-1">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 normal-case">
            <div className="flex items-stretch gap-3">
              <div className="flex items-center gap-1.5 text-3xl font-bold tabular-nums">
                {l.price}
                <PlatIcon size={24} />
              </div>
              {(sheet || reason) && (
                <div
                  className={`flex-1 rounded px-3 py-1 text-center ${sheet ? VERDICT[sheet] : 'bg-white/10'}`}
                >
                  {sheet && <div className="text-lg font-bold leading-tight">{sheet} roll</div>}
                  <div className="text-xs font-semibold !normal-case opacity-80">{reason}</div>
                </div>
              )}
              {dealKind(deal) && (
                <div
                  title="Fair = the going ask of at least 6 similar listings (asking prices, not sales)"
                  className={`flex items-center rounded px-2 text-sm font-semibold ${dealKind(deal) === 'deal' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-400/20 text-amber-200'}`}
                >
                  {dealKind(deal) === 'deal'
                    ? `${Math.round(deal! * 100)}% under fair`
                    : 'Unusually cheap: check it'}
                </div>
              )}
            </div>
            <div>
              {rows.map(({ a, g, ok }) => (
                <div key={a.slug} className="flex items-center gap-2 py-1">
                  <span
                    className={`w-4 text-center font-bold ${ok === undefined ? 'text-white/35' : ok ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {ok === undefined ? '·' : ok ? '✓' : '✗'}
                  </span>
                  <span
                    className={`w-9 shrink-0 text-left text-lg font-bold tabular-nums ${ok === false ? 'text-white/35' : gradeColor(g?.grade)}`}
                  >
                    {g?.grade ?? '?'}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${a.positive ? '' : 'text-rose-300'}`}>
                    <b className="tabular-nums">{fmt(a)}</b> {nameOf(a.slug)}
                  </span>
                  {g && (
                    <span
                      className="h-1 w-24 shrink-0 rounded bg-white/10"
                      title="Between the lowest and highest possible roll"
                    >
                      <span
                        className={`block h-full rounded ${ok === false ? 'bg-white/30' : a.positive ? 'bg-fuchsia-400' : 'bg-rose-400'}`}
                        style={{ width: `${Math.round((a.positive ? g.q : 1 - g.q) * 100)}%` }}
                      />
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/15 pt-2 text-sm text-white/60">
              <span>
                {l.seller} · {l.status}
              </span>
              <span>MR {l.mr}</span>
              <span>⟳ {l.rerolls}</span>
              <span>Rank {l.rank}/8</span>
              <DrainPolarity drain={10 + l.rank} polarity={l.polarity} />
            </div>
            {sheetRows.length > 0 && (
              <div className="space-y-1">
                <div className={LABEL}>
                  Aim for <span className="normal-case">(green: on this riven · ★ core stat)</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {sheetRows
                    .filter((r) => r.label !== 'Negatives')
                    .flatMap((r) =>
                      r.names.map((n) => ({ n, core: r.label === 'Core', on: r.on(n) }))
                    )
                    .map((w) => (
                      <span
                        key={w.n}
                        className={`rounded px-1.5 py-0.5 text-xs !normal-case ${w.on ? 'bg-emerald-500 text-black' : w.core ? 'bg-amber-300/25 text-amber-200' : 'bg-white/10'}`}
                      >
                        {w.core ? '★ ' : ''}
                        {w.n}
                      </span>
                    ))}
                </div>
                {sheetRows.some((r) => r.label === 'Negatives') && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs !normal-case text-white/60">OK negatives:</span>
                    {sheetRows
                      .filter((r) => r.label === 'Negatives')
                      .flatMap((r) => r.names)
                      .map((n) => (
                        <span
                          key={n}
                          className="rounded bg-rose-500/20 px-1.5 py-0.5 text-xs !normal-case text-rose-200"
                        >
                          {n}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}
            {odds && <div className="text-sm text-violet-300">Rolling it yourself: {odds}</div>}
            {similar.length > 0 && (
              <div>
                <div className={`mb-1 ${LABEL}`}>Similar rivens</div>
                {similar.map(({ l: o, pct }) => (
                  <button
                    key={o.id}
                    onClick={() => onPick(o)}
                    title={`${pct}% of this riven's stats`}
                    className="flex w-full cursor-pointer items-center gap-3 rounded px-2 py-1 text-left text-sm !normal-case hover:bg-white/10"
                  >
                    <b className="inline-flex w-16 items-center gap-1 tabular-nums">
                      {o.price}
                      <PlatIcon size={14} />
                    </b>
                    <span className="min-w-0 flex-1 truncate">
                      {o.attrs.map((a, i) => {
                        const same = l.attrs.some(
                          (b) => b.slug === a.slug && b.positive === a.positive
                        )
                        return (
                          <span
                            key={a.slug}
                            className={
                              same
                                ? 'text-emerald-300'
                                : a.positive
                                  ? 'text-white/45'
                                  : 'text-rose-300/60'
                            }
                          >
                            {i > 0 && <span className="text-white/35">, </span>}
                            {a.positive ? '' : '-'}
                            {nameOf(a.slug)}
                          </span>
                        )
                      })}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 border-t border-white/15 pt-3">
              {web}
              <button
                onClick={onFindSimilar}
                className="cursor-pointer rounded-md border border-white/20 px-3 py-1 text-sm hover:bg-white/10"
              >
                Find similar
              </button>
              <button
                onClick={onSavePlan}
                className="cursor-pointer rounded-md border border-white/20 px-3 py-1 text-sm hover:bg-white/10"
              >
                Save as plan
              </button>
              <button
                onClick={onClose}
                className="ml-auto cursor-pointer rounded-md border border-white/20 px-3 py-1 text-sm hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </NcCard>
      </div>
    </div>
  )
}
