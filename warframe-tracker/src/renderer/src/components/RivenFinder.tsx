import Dropdown from './Dropdown'
import { useEffect, useMemo, useState } from 'react'
import { oddsText, planOdds, slugTag } from '../rivenPlan'
import RivenListingDetails from './RivenListingDetails'
import { usePersisted } from '../hooks/usePersisted'
import { listingGrades, matchListing, tagOf, type Filter, type Want } from '../rivenFilter'
import { dealKind, dealScore, fairPrice } from '../rivenFair'
import { trends } from '../rivenTrends'
import { masteryCatalog } from '../apiCache'
import { variantMap } from '../rivenVariants'
import { takeFinderPrefill } from '../rivenFind'
import { abbr, abbrName, gradeRiven, rivenType, type Grade } from '../rivens'
import GradeBadge from './GradeBadge'
import Pic from './Pic'
import NcCard from './NcCard'
import PlatIcon from './PlatIcon'

// Trading > Rivens > Finder: warframe.market riven listings for one weapon, filtered by the stats
// you want, with a match % and a roll grade per stat. Recommended stats (grade sheet) click into
// the filter.
type Catalog = Awaited<ReturnType<typeof window.api.getRivenCatalog>>
type Rules = Awaited<ReturnType<typeof window.api.getRivenGrades>>
type Data = Awaited<ReturnType<typeof window.api.getRivenData>>
let catalogP: Promise<Catalog> | null = null
let rulesP: Promise<Rules> | null = null
let dataP: Promise<Data> | null = null

const EMPTY: Filter = { pos: [], minMatch: 0, mustNeg: false }
const input =
  'border border-white/20 bg-black/30 px-2 py-1.5 text-sm outline-none placeholder:text-white/50'
const btn =
  'cursor-pointer rounded-md border !border-white/20 px-2.5 py-1 text-sm font-semibold !text-white hover:bg-white/10'
// grade letter -> colour, as in the overlay panel: S/A green, B cyan, C amber, D red
const gradeColor = (g?: string): string =>
  g === 'S' || g === 'A'
    ? 'text-emerald-300'
    : g === 'B'
      ? 'text-cyan-300'
      : g === 'C'
        ? 'text-amber-300'
        : 'text-rose-400'
const num = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v))
const STATUS: Record<string, string> = {
  ingame: 'bg-emerald-400',
  online: 'bg-amber-400',
  offline: 'bg-white/40'
}

function WantRow({
  want,
  attrs,
  label,
  onChange
}: {
  want?: Want
  attrs: [string, string][]
  label: string
  onChange: (w?: Want) => void
}): React.JSX.Element {
  return (
    <div className="flex gap-1">
      <Dropdown
        ariaLabel={label}
        className="flex-1"
        value={want?.slug ?? ''}
        onChange={(v) => onChange(v ? { slug: v, required: want?.required ?? false } : undefined)}
        options={[
          { value: '', label },
          ...attrs.map(([slug, name]) => ({ value: slug, label: name }))
        ]}
      />
      {want && (
        <button
          onClick={() => onChange({ ...want, required: !want.required })}
          title="Required: listings without it are hidden. Preferred: it only raises the match %."
          className={`nc-quiet shrink-0 cursor-pointer border px-1.5 text-[10px] font-semibold hover:bg-white/10 ${want.required ? 'border-amber-300/70 text-amber-200' : 'border-white/25 text-white/60'}`}
        >
          {want.required ? 'Required' : 'Preferred'}
        </button>
      )}
    </div>
  )
}

const PERIODS: [string, number | null][] = [
  ['30 days', 30],
  ['90 days', 90],
  ['1 year', 365],
  ['All', null]
]

const DAY_MS = 86_400_000
const dayLabel = (t: number): string =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// Price history: one point per saved snapshot (average and filtered average), plus the price and
// popularity of each positive stat. The maths is rivenTrends.trends, run per snapshot.
function TrendsPanel({
  snaps,
  filter,
  period,
  onPeriod,
  nameOf
}: {
  snaps: RivenSnap[]
  filter: Filter
  period: number | null
  onPeriod: (p: number | null) => void
  nameOf: (slug: string) => string
}): React.JSX.Element {
  const [now] = useState(() => Date.now())
  const [zero, setZero] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const t = useMemo(() => trends(snaps, filter, period, now), [snaps, filter, period, now])
  const pts = useMemo(
    () =>
      snaps
        .filter((s) => period === null || now - s.t <= period * DAY_MS)
        .sort((a, b) => a.t - b.t)
        .map((s) => ({ t: s.t, ...trends([s], filter, null, now) })),
    [snaps, filter, period, now]
  )
  const price = (v?: number): React.JSX.Element =>
    v === undefined ? (
      <>-</>
    ) : (
      <span className="inline-flex items-center gap-1">
        {v} <PlatIcon />
      </span>
    )
  const periodBar = (
    <div className="flex gap-1">
      {PERIODS.map(([label, d]) => (
        <button
          key={label}
          onClick={() => onPeriod(d)}
          className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm ${period === d ? 'border-violet-400/70 bg-violet-500/20 font-semibold' : 'border-white/20 text-white/75 hover:bg-white/10'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
  if (pts.length < 2)
    return (
      <div className="space-y-3">
        {periodBar}
        <p className="text-sm text-white/60">
          History starts when you search a weapon: ToxicFrame saves the cheapest listings (at most
          every 6 hours). {pts.length} snapshot{pts.length === 1 ? '' : 's'} in this period, a chart
          needs at least 2.
        </p>
      </div>
    )
  const W = 640
  const H = 240
  const L = 44
  const R = 12
  const T = 12
  const B = 26
  const vals = pts
    .flatMap((x) => [x.avg, x.filteredAvg])
    .filter((v): v is number => v !== undefined)
  const hi = Math.max(1, ...vals)
  const lo = zero ? 0 : Math.min(...vals, hi)
  const span = Math.max(1, hi - lo)
  const t0 = pts[0].t
  const tw = Math.max(1, pts[pts.length - 1].t - t0)
  const X = (v: number): number => L + ((v - t0) / tw) * (W - L - R)
  const Y = (v: number): number => T + (1 - (v - lo) / span) * (H - T - B)
  const line = (k: 'avg' | 'filteredAvg'): string =>
    pts
      .filter((x) => x[k] !== undefined)
      .map((x, i) => `${i ? 'L' : 'M'}${X(x.t).toFixed(1)} ${Y(x[k]!).toFixed(1)}`)
      .join(' ')
  const shown = hover !== null ? pts[hover] : pts[pts.length - 1]
  const ticks = [0, 0.5, 1].map((f) => Math.round(lo + span * f))
  const axis = { fontSize: 11, fill: 'white', fillOpacity: 0.6 }
  return (
    <div className="grid grid-cols-1 gap-4 text-sm xl:grid-cols-[1fr_20rem]">
      <NcCard title="Price history">
        <div className="space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-3">
            {periodBar}
            <label className="flex cursor-pointer items-center gap-1.5 text-white/75">
              <input type="checkbox" checked={zero} onChange={(e) => setZero(e.target.checked)} />
              Start at 0
            </label>
            <span className="ml-auto flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-md border border-white/20 px-2 py-1">
                <span className="h-0.5 w-4 bg-white" /> Average {price(shown.avg)}
              </span>
              <span className="flex items-center gap-1.5 rounded-md border border-white/20 px-2 py-1">
                <span className="w-4 border-t-2 border-dashed border-[#6fd0d6]" /> Filtered{' '}
                {price(shown.filteredAvg)}
              </span>
            </span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label="Average and filtered average price per snapshot"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              const x = ((e.clientX - r.left) / r.width) * W
              let best = 0
              pts.forEach((q, i) => {
                if (Math.abs(X(q.t) - x) < Math.abs(X(pts[best].t) - x)) best = i
              })
              setHover(best)
            }}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="white" strokeOpacity={0.12} />
                <text x={L - 6} y={Y(v) + 4} textAnchor="end" {...axis}>
                  {v}
                </text>
              </g>
            ))}
            <text x={L} y={H - 6} {...axis}>
              {dayLabel(t0)}
            </text>
            <text x={W - R} y={H - 6} textAnchor="end" {...axis}>
              {dayLabel(t0 + tw)}
            </text>
            <path d={line('avg')} fill="none" stroke="white" strokeWidth={2} />
            <path
              d={line('filteredAvg')}
              fill="none"
              stroke="#6fd0d6"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            {hover !== null && (
              <g>
                <line
                  x1={X(shown.t)}
                  x2={X(shown.t)}
                  y1={T}
                  y2={H - B}
                  stroke="white"
                  strokeOpacity={0.4}
                />
                {shown.avg !== undefined && (
                  <circle cx={X(shown.t)} cy={Y(shown.avg)} r={4} fill="white" />
                )}
                {shown.filteredAvg !== undefined && (
                  <circle cx={X(shown.t)} cy={Y(shown.filteredAvg)} r={4} fill="#6fd0d6" />
                )}
                <text
                  x={X(shown.t) + (X(shown.t) > W / 2 ? -6 : 6)}
                  y={T + 10}
                  textAnchor={X(shown.t) > W / 2 ? 'end' : 'start'}
                  fontSize={11}
                  fill="white"
                >
                  {dayLabel(shown.t)}
                </text>
              </g>
            )}
          </svg>
          <p className="text-xs text-white/60">
            {t.snaps} snapshots, {t.listings} listings; {t.filtered} match your filters. Saved on
            this PC: the 150 cheapest listings each time, so this is the cheap end.
          </p>
        </div>
      </NcCard>
      <NcCard title="Attribute price & popularity">
        <ul className="max-h-[22rem] space-y-2 overflow-y-auto p-3">
          {t.attrs.map((a) => (
            <li key={a.slug}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{nameOf(a.slug)}</span>
                <span className="shrink-0 font-semibold text-[#6fd0d6]">{price(a.avg)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 bg-white/10">
                  <div
                    className="h-full bg-[#6fd0d6]"
                    style={{ width: `${Math.round(a.share * 100)}%` }}
                  />
                </div>
                <span className="w-9 text-right text-xs tabular-nums text-white/60">
                  {Math.round(a.share * 100)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </NcCard>
    </div>
  )
}

export default function RivenFinder(): React.JSX.Element {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [rules, setRules] = useState<Rules>({})
  const [data, setData] = useState<Data>({ values: {}, affix: {} })
  const [prefill] = useState(takeFinderPrefill)
  // no weapon on open: the page starts at the weapon search
  const [slug, setSlug] = useState<string | null>(() => prefill?.slug ?? null)
  const [picking, setPicking] = useState(false) // the weapon list only unfolds while searching
  const [query, setQuery] = useState('')
  // filters reset when you leave the page; only Find similar / Open in Fixer hand some over
  const [filter, setFilter] = useState<Filter>(() => prefill?.filter ?? EMPTY)
  useEffect(() => {
    const on = (): void => {
      const p = takeFinderPrefill()
      if (!p) return
      setSlug(p.slug)
      setFilter(p.filter)
    }
    window.addEventListener('toxicframe:finder-prefill', on)
    return () => window.removeEventListener('toxicframe:finder-prefill', on)
  }, [])
  const [sort, setSort] = usePersisted<'match' | 'price' | 'deal'>('RivenFinder.sort', 'match')
  const [tab, setTab] = useState<'listings' | 'trends'>('listings')
  const [period, setPeriod] = useState<number | null>(90)
  const [snaps, setSnaps] = useState<{ slug: string; list: RivenSnap[] }>({ slug: '', list: [] })
  const [saved, setSaved] = useState(false)
  const [found, setFound] = useState<{ slug: string; list: RivenListing[] | null }>({
    slug: '',
    list: null
  })
  useEffect(() => {
    ;(catalogP ??= window.api.getRivenCatalog()).then(setCatalog)
    ;(rulesP ??= window.api.getRivenGrades()).then(setRules)
    ;(dataP ??= window.api.getRivenData()).then(setData)
  }, [])
  useEffect(() => {
    if (!slug) return
    let live = true
    window.api
      .searchRivenAuctions(slug)
      .then((list) => live && setFound({ slug, list }))
      .catch(() => live && setFound({ slug, list: null }))
    return () => {
      live = false
    }
  }, [slug])

  useEffect(() => {
    if (slug && tab === 'trends')
      window.api.getRivenHistory(slug).then((list) => setSnaps({ slug, list }))
  }, [slug, tab, found])

  const weapon = slug ? catalog?.weapons[slug] : undefined
  const melee = weapon?.rivenType === 'melee' || weapon?.rivenType === 'zaw'
  const attrs = useMemo(
    () =>
      Object.entries(catalog?.attrs ?? {})
        .map(([s, a]): [string, string] => [s, a.name])
        .sort((a, b) => a[1].localeCompare(b[1])),
    [catalog]
  )
  const typeKey = Object.keys(data.values).find(
    (k) => rivenType(k).toLowerCase().replace(/\W/g, '') === weapon?.rivenType
  )
  const rule = weapon ? rules[weapon.name.toLowerCase()] : undefined
  const [variants, setVariants] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!catalog) return
    masteryCatalog()
      .then((m) =>
        setVariants(
          variantMap(
            m.items.filter((i) => i.group === 'weapon').map((i) => i.name),
            Object.values(catalog.weapons).map((w) => w.name)
          )
        )
      )
      .catch(() => {})
  }, [catalog])
  const picks = useMemo(() => {
    const q = query.trim().toLowerCase()
    // one row per riven weapon; its variants (Prime, Kuva…) are listed on the row and searchable
    const also = new Map<string, string[]>()
    for (const [v, base] of Object.entries(variants)) also.set(base, [...(also.get(base) ?? []), v])
    return Object.entries(catalog?.weapons ?? {})
      .map(([s, w]) => {
        const vs = (also.get(w.name) ?? []).sort()
        const own = new Set(w.name.toLowerCase().split(' '))
        return {
          key: s,
          slug: s,
          name: w.name,
          icon: w.icon,
          // "Acceltra Prime" -> "Prime": the row already says Acceltra
          tags: vs.map(
            (v) =>
              v
                .split(' ')
                .filter((x) => !own.has(x.toLowerCase()))
                .join(' ') || v
          ),
          hay: [w.name, ...vs].join('|').toLowerCase()
        }
      })
      .filter((w) => !q || w.hay.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40)
  }, [catalog, query, variants])

  const slugForAbbr = (a: string): string | undefined =>
    attrs.find(([, name]) => {
      const t = tagOf(name, melee)
      return t && abbr(t, melee) === a
    })?.[0]

  const rows = useMemo(() => {
    const list = found.slug === slug ? (found.list ?? []) : []
    const core = new Set(
      (rule?.core ?? []).flatMap((a) => {
        const s = slugForAbbr(a)
        return s ? [s] : []
      })
    )
    return list
      .map((l) => ({
        l,
        m: matchListing(l, filter),
        deal: dealScore(l.price, fairPrice(l, list, core))
      }))
      .filter(
        (x): x is { l: RivenListing; m: NonNullable<typeof x.m>; deal: number | undefined } => !!x.m
      )
      .sort((a, b) =>
        sort === 'deal'
          ? (b.deal ?? -Infinity) - (a.deal ?? -Infinity) || a.l.price - b.l.price
          : sort === 'match'
            ? b.m.pct - a.m.pct || a.l.price - b.l.price
            : a.l.price - b.l.price
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found, slug, filter, sort, rule, attrs])

  const odds = useMemo(() => {
    if (!weapon || !filter.pos.length) return ''
    const tag = (s: string): string[] => slugTag(catalog?.attrs ?? {}, s, melee)
    return oddsText(
      planOdds(Object.keys(data.values[typeKey ?? ''] ?? {}), {
        pos: filter.pos.flatMap((x) => tag(x.slug).map((t) => ({ tag: t, required: x.required }))),
        negs: filter.neg ? tag(filter.neg.slug) : []
      })
    )
  }, [weapon, filter, catalog, data, typeKey, melee])
  const [open, setOpen] = useState<RivenListing | null>(null)
  const savePlan = (): void => {
    if (!slug || !weapon) return
    void window.api
      .sniperAdd({ name: weapon.name, slug, filter, negs: filter.neg ? [filter.neg.slug] : [] })
      .then(() => setSaved(true))
  }
  const listAll = found.slug === slug ? (found.list ?? []) : []
  type Rec = { label: string; names: string[]; on: (n: string) => boolean }
  const details = (l: RivenListing): React.JSX.Element => {
    const have = new Set(
      l.attrs.flatMap((a) => (a.positive ? [abbr(tagOf(a.name, melee) ?? '', melee)] : []))
    )
    const group = (label: string, raw: string[]): Rec => ({
      label,
      names: raw.map(abbrName),
      on: (n) => raw.some((r) => abbrName(r) === n && have.has(r))
    })
    const recs = rule
      ? [
          group('Core', rule.core),
          group(
            'Other',
            rule.good.filter((a) => !rule.core.includes(a))
          ),
          { ...group('Negatives', rule.neg), on: () => false }
        ]
      : []
    const core = new Set(
      (rule?.core ?? []).flatMap((a) => {
        const sl = slugForAbbr(a)
        return sl ? [sl] : []
      })
    )
    return (
      <RivenListingDetails
        l={l}
        grades={typeKey ? listingGrades(l, typeKey, data) : []}
        sheet={sheetGrade(l)}
        deal={dealScore(l.price, fairPrice(l, listAll, core))}
        odds={odds}
        nameOf={nameOf}
        rec={recs}
        similar={listAll
          .filter((o) => o.id !== l.id)
          .map((o) => ({
            l: o,
            n: o.attrs.filter(
              (a) => a.positive && l.attrs.some((b) => b.positive && b.slug === a.slug)
            ).length
          }))
          .sort((a, b) => b.n - a.n || a.l.price - b.l.price)
          .slice(0, 5)
          .map((x) => ({
            l: x.l,
            pct: Math.round((x.n / Math.max(1, l.attrs.filter((a) => a.positive).length)) * 100)
          }))}
        onPick={setOpen}
        onFindSimilar={() => {
          set({
            pos: l.attrs.filter((a) => a.positive).map((a) => ({ slug: a.slug, required: false })),
            neg: l.attrs.find((a) => !a.positive)
              ? { slug: l.attrs.find((a) => !a.positive)!.slug, required: false }
              : undefined
          })
          setOpen(null)
        }}
        onSavePlan={savePlan}
        onClose={() => setOpen(null)}
      />
    )
  }
  const set = (p: Partial<Filter>): void => setFilter({ ...filter, ...p })
  const setPos = (i: number, w?: Want): void =>
    set({
      pos: w ? filter.pos.map((x, j) => (j === i ? w : x)) : filter.pos.filter((_, j) => j !== i)
    })
  // recommended stat clicked: add it as a required positive (or the negative)
  const addWant = (a: string, negative: boolean): void => {
    const s = slugForAbbr(a)
    if (!s) return
    if (negative) set({ neg: { slug: s, required: false } })
    else if (filter.pos.length < 3 && !filter.pos.some((p) => p.slug === s))
      set({ pos: [...filter.pos, { slug: s, required: false }] })
  }
  const nameOf = (s: string): string => catalog?.attrs[s]?.name ?? s

  const sheetGrade = (l: RivenListing): Grade | undefined => {
    const tags = (pos: boolean): string[] =>
      l.attrs.flatMap((a) => (a.positive === pos ? [tagOf(a.name, melee) ?? ''] : []))
    return gradeRiven(
      { buffTags: tags(true), curseTags: tags(false), type: melee ? 'Melee' : 'Rifle' },
      rule
    )
  }

  return (
    <div className="grid min-h-full grid-cols-[18rem_1fr] gap-4 p-4 text-white">
      <div className="space-y-3">
        <NcCard title="Weapon">
          <div className="p-3">
            {/* the picked weapon stays in the search bar, with its icon; click to search another */}
            {weapon && !picking ? (
              <button
                onClick={() => setPicking(true)}
                title="Search another weapon"
                className={`${input} nc-quiet flex w-full cursor-pointer items-center gap-2 text-left`}
              >
                <Pic src={weapon.icon} size={24} letter={weapon.name[0]} />
                <span className="min-w-0 flex-1 truncate font-semibold text-cyan-200">
                  {weapon.name}
                </span>
                <span className="text-white/50">⌕</span>
              </button>
            ) : (
              <input
                autoFocus={!!weapon}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPicking(true)
                }}
                onFocus={() => setPicking(true)}
                onBlur={() => !query && setTimeout(() => setPicking(false), 150)}
                placeholder="Search weapon"
                className={`${input} w-full`}
              />
            )}
            {picking && (
              <ul className="mt-2 max-h-56 overflow-y-auto">
                {picks.map((w) => (
                  <li key={w.key}>
                    <button
                      onClick={() => {
                        setSlug(w.slug)
                        setQuery('')
                        setPicking(false)
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2 px-2 py-1 text-left text-sm hover:bg-white/10 ${w.slug === slug ? 'bg-violet-500/20' : ''}`}
                    >
                      <Pic src={w.icon} size={28} letter={w.name[0]} />
                      {/* variants share the riven: "Acceltra / Prime" */}
                      <span className="min-w-0 truncate">
                        {w.name}
                        {w.tags.map((t) => (
                          <span key={t} className="text-white/45">
                            {' / '}
                            {t}
                          </span>
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
                {catalog && picks.length === 0 && (
                  <li className="px-2 py-1 text-sm text-white/60">No weapon found.</li>
                )}
              </ul>
            )}
          </div>
        </NcCard>
        <NcCard title="Filter rivens">
          <div className="space-y-2 p-3">
            <div className="text-sm font-semibold">Positive stats</div>
            {[0, 1, 2].map((i) => (
              <WantRow
                key={i}
                label={`Positive ${i + 1}`}
                want={filter.pos[i]}
                attrs={attrs}
                onChange={(w) =>
                  i < filter.pos.length ? setPos(i, w) : w && set({ pos: [...filter.pos, w] })
                }
              />
            ))}
            <div className="text-sm font-semibold">Negative stat</div>
            <WantRow
              label="Negative"
              want={filter.neg}
              attrs={attrs}
              onChange={(w) => set({ neg: w })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filter.mustNeg}
                onChange={(e) => set({ mustNeg: e.target.checked })}
              />
              Must have a negative
            </label>
            {(
              [
                ['Price', 'priceMin', 'priceMax'],
                ['Rerolls', 'rerollMin', 'rerollMax']
              ] as const
            ).map(([label, lo, hi]) => (
              <div key={label} className="flex items-center gap-1 text-sm">
                <span className="w-14 text-white/75">{label}</span>
                {[lo, hi].map((k, n) => (
                  <input
                    key={k}
                    type="number"
                    min={0}
                    aria-label={`${label} ${n ? 'max' : 'min'}`}
                    placeholder={n ? 'max' : 'min'}
                    value={filter[k] ?? ''}
                    onChange={(e) => set({ [k]: num(e.target.value) })}
                    className={`${input} w-0 flex-1`}
                  />
                ))}
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm">
              Min match {filter.minMatch}%
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={filter.minMatch}
                onChange={(e) => set({ minMatch: Number(e.target.value) })}
                className="min-w-0 flex-1 accent-cyan-400"
              />
            </label>
            <button
              onClick={() => setFilter(EMPTY)}
              className="cursor-pointer text-xs text-white/60 hover:text-white"
            >
              Clear filters
            </button>
          </div>
        </NcCard>
        {weapon && (
          <NcCard title="Recommended stats">
            <div className="space-y-2 p-3 text-sm">
              {!rule ? (
                <p className="text-white/60">The grade sheet has no entry for {weapon.name}.</p>
              ) : (
                (
                  [
                    ['Core', rule.core, false],
                    ['Other', rule.good.filter((a) => !rule.core.includes(a)), false],
                    ['OK negatives', rule.neg, true]
                  ] as const
                ).map(([title, list, negative]) => (
                  <div key={title}>
                    <div className="mb-1 text-xs text-white/60">{title}</div>
                    <div className="flex flex-wrap gap-1">
                      {list.map((a) => {
                        const sl = slugForAbbr(a)
                        const on =
                          !!sl &&
                          (negative
                            ? filter.neg?.slug === sl
                            : filter.pos.some((p) => p.slug === sl))
                        return (
                          <button
                            key={a}
                            onClick={() => addWant(a, negative)}
                            disabled={!sl}
                            title="Add to the filter"
                            className={`cursor-pointer rounded-md border px-1.5 py-0.5 text-xs hover:bg-white/10 disabled:opacity-40 ${on ? 'bg-white/20 font-semibold text-white ' : ''}${negative ? '!border-rose-400/50 !text-rose-300' : '!border-white/25 !text-white/85'}`}
                          >
                            {abbrName(a)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </NcCard>
        )}
      </div>

      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{weapon?.name ?? 'Riven Finder'}</h1>
          <div className="flex gap-1 text-sm" role="tablist">
            {(['listings', 'trends'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`cursor-pointer rounded-md border px-2.5 py-1 ${tab === t ? 'border-violet-400/70 bg-violet-500/20 font-semibold' : 'border-white/20 text-white/75 hover:bg-white/10'}`}
              >
                {t === 'listings' ? 'Listings' : 'Price trends'}
              </button>
            ))}
          </div>
          {tab === 'listings' && (
            <span className="ml-auto flex items-center gap-3">
              <button
                onClick={() => {
                  if (!slug || !weapon) return
                  void window.api
                    .sniperAdd({
                      name: weapon.name,
                      slug,
                      filter,
                      negs: filter.neg ? [filter.neg.slug] : []
                    })
                    .then(() => setSaved(true))
                }}
                disabled={!slug || (filter.pos.length === 0 && !filter.neg)}
                title={
                  filter.pos.length === 0 && !filter.neg
                    ? 'Pick at least one stat in the filter first'
                    : 'Keep these stats as a plan: snipe matching listings and judge rolls in the overlay (Rivens > Contracts)'
                }
                className="cursor-pointer border border-cyan-400/70 px-2.5 py-1 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/15 disabled:cursor-default disabled:border-white/20 disabled:font-normal disabled:text-white/40"
              >
                {saved ? 'Plan saved' : 'Save as plan'}
              </button>
              {/* same sort control as the Relic planner */}
              <Dropdown
                label="Sort"
                value={sort}
                onChange={(v) => setSort(v as 'match' | 'price' | 'deal')}
                options={[
                  { value: 'match', label: 'Best match' },
                  { value: 'deal', label: 'Deal (under fair price)' },
                  { value: 'price', label: 'Price' }
                ]}
              />
            </span>
          )}
        </div>

        {!weapon ? (
          <p className="text-sm text-white/60">
            {catalog ? 'Pick a weapon to see its riven listings.' : 'Loading weapons...'}
          </p>
        ) : tab === 'trends' ? (
          <TrendsPanel
            snaps={snaps.slug === slug ? snaps.list : []}
            filter={filter}
            period={period}
            onPeriod={setPeriod}
            nameOf={nameOf}
          />
        ) : found.slug !== slug ? (
          <p className="text-sm text-white/60">Loading listings...</p>
        ) : found.list === null ? (
          <p className="text-sm text-white/60">Could not reach warframe.market.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-white/60">
              {rows.length} of {found.list.length} listings
              {rows.length > 0 && filter.pos.length > 0 && (
                <> · cheapest match {Math.min(...rows.map((r) => r.l.price))}p</>
              )}
              {odds && <> · rolling it yourself: {odds}</>}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-3">
              {rows.map(({ l, m, deal }) => {
                const grades = typeKey ? listingGrades(l, typeKey, data) : []
                const sg = sheetGrade(l)
                const filtered = filter.pos.length > 0 || !!filter.neg || filter.mustNeg
                return (
                  <NcCard key={l.id} title={l.name}>
                    <div className="flex h-full flex-col p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          title={l.status}
                          className="flex min-w-0 items-center gap-1.5 text-xs text-white/75"
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${STATUS[l.status] ?? STATUS.offline}`}
                          />
                          <span className="truncate">{l.seller}</span>
                          <span className="shrink-0">
                            · MR {l.mr} · ⟳ {l.rerolls}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-lg font-bold text-[#6fd0d6]">
                          {l.price} <PlatIcon />
                        </span>
                      </div>
                      <div className="mb-2 flex min-h-[1.5rem] items-center gap-2 text-xs">
                        {filtered && (
                          <span className="rounded-md border border-white/20 px-1.5 py-0.5">
                            {m.pct}% match
                          </span>
                        )}
                        {sg && <GradeBadge grade={sg} />}
                        {dealKind(deal) && (
                          <span
                            title="Fair = the going ask of at least 6 similar listings (asking prices, not sales)"
                            className={`rounded-md px-1.5 py-0.5 font-semibold ${dealKind(deal) === 'deal' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-400/20 text-amber-200'}`}
                          >
                            {dealKind(deal) === 'deal'
                              ? `${Math.round(deal! * 100)}% under fair`
                              : 'Unusually cheap: check it'}
                          </span>
                        )}
                      </div>
                      <ul className="space-y-0.5 text-sm">
                        {l.attrs.map((a, i) => (
                          <li
                            key={a.slug}
                            className={`flex items-baseline gap-2 ${a.positive ? '' : 'text-rose-300'} ${m.hit.size === 0 || m.hit.has(a.slug) ? '' : 'opacity-50'}`}
                          >
                            <span
                              className={`w-5 shrink-0 text-left font-bold tabular-nums ${gradeColor(grades[i]?.grade?.[0])}`}
                            >
                              {grades[i]?.grade ?? ''}
                            </span>
                            <span>
                              <b className="tabular-nums">
                                {a.unit === 'multiply'
                                  ? `x${a.value.toFixed(2)}`
                                  : `${a.value > 0 ? '+' : ''}${a.value}${a.unit === 'percent' ? '%' : a.unit === 'seconds' ? 's' : ''}`}
                              </b>{' '}
                              {nameOf(a.slug)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto flex gap-2 border-t border-white/15 pt-2">
                        <button onClick={() => setOpen(l)} className={`${btn} flex-1`}>
                          Details
                        </button>
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`${btn} flex-1 text-center`}
                        >
                          Website
                        </a>
                      </div>
                    </div>
                  </NcCard>
                )
              })}
            </div>
          </>
        )}
        {open && details(open)}
      </section>
    </div>
  )
}
