import { useEffect, useMemo, useState } from 'react'
import * as cache from '../apiCache'
import { useMastery, type MasteryRow } from '../hooks/useMastery'
import { usePersisted } from '../hooks/usePersisted'
import { partCounter, refreshInventory, useInventory } from '../hooks/useInventory'
import { toggleMasteryFavorite, useSettings } from '../settings'
import Pic from './Pic'
import NcCard from './NcCard'
import { FoundryCard } from './FoundryPage'

type Tab = 'easy' | 'craft' | 'relics' | 'platinum'
const TABS: { key: Tab; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'craft', label: 'Craftable now' },
  { key: 'relics', label: 'From relics' },
  { key: 'platinum', label: 'With platinum' }
]
const PAGE = 24

const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 100) : 0)

// One of the three summary cards (Game content / Star chart / Intrinsics).
function SummaryCard({
  title,
  overall,
  rows
}: {
  title: string
  overall: number
  rows: { label: string; done: number; total: number }[]
}): React.JSX.Element {
  return (
    <NcCard title={title}>
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="nc-name font-semibold text-slate-200">{title}</span>
          <span className="font-semibold text-violet-300">{overall}%</span>
        </div>
        <div className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
              <span className="text-slate-400">{r.label}:</span>
              <span className="text-right text-slate-300">{pct(r.done, r.total)}%</span>
              <span className="w-16 text-right tabular-nums text-slate-400">
                {r.done}/{r.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </NcCard>
  )
}

function ItemCard({
  row,
  favorite,
  onHover
}: {
  row: MasteryRow
  favorite: boolean
  onHover: (r: MasteryRow | null) => void
}): React.JSX.Element {
  const { item, owned, rank, remaining } = row
  return (
    <div
      onMouseEnter={() => onHover(row)}
      onMouseLeave={() => onHover(null)}
      className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-2.5"
    >
      <div className="relative shrink-0">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900">
          <Pic src={item.imageName} fallback={item.imageFallback} size={44} letter={item.name[0]} />
        </span>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-violet-600/90 px-1.5 text-[10px] font-bold text-white">
          +{remaining} XP
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => toggleMasteryFavorite(item.uniqueName)}
            title={favorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`text-base leading-none ${favorite ? 'text-amber-300' : 'text-slate-500 hover:text-slate-200'}`}
          >
            {favorite ? '★' : '☆'}
          </button>
          <span className="nc-name truncate font-semibold text-slate-100">{item.name}</span>
        </div>
        <div className="text-xs text-slate-400">
          Level {rank}/{item.maxRank}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
          owned ? 'border-slate-600 text-slate-300' : 'border-slate-700 text-slate-500'
        }`}
      >
        {owned ? '⦿ Owned' : 'Not owned'}
      </span>
    </div>
  )
}

export default function MasteryPage(): React.JSX.Element {
  const { ready, rows, summary } = useMastery()
  const inv = useInventory()
  const { masteryFavorites } = useSettings()
  const [tab, setTab] = usePersisted<Tab>('MasteryPage.tab', 'easy')
  const [shown, setShown] = useState(PAGE)
  const [hovered, setHovered] = useState<MasteryRow | null>(null)
  const [icons, setIcons] = useState<Record<number, string>>({})

  const [crafts, setCrafts] = useState<CraftItem[]>([])
  useEffect(() => {
    cache.masteryIcons().then(setIcons)
    cache.craftables().then(setCrafts)
  }, [])

  // items you don't own yet but have every part for (blueprint, components, resources)
  // item -> its parts with owned counts, for every item you have all parts for
  const craftable = useMemo(() => {
    const have = partCounter(inv.data?.raw ?? {})
    const m = new Map<string, { c: CraftComponent; have: number }[]>()
    for (const c of crafts) {
      const parts = c.components.map((p) => ({ c: p, have: have(p.uniqueName) }))
      if (parts.every((p) => p.have >= p.c.itemCount)) m.set(c.uniqueName, parts)
    }
    return m
  }, [crafts, inv.data])

  const favSet = useMemo(() => new Set(masteryFavorites), [masteryFavorites])

  const list = useMemo(() => {
    const open = rows.filter((r) => !r.mastered)
    const pick =
      tab === 'easy'
        ? open.filter((r) => r.owned)
        : tab === 'craft'
          ? open.filter((r) => !r.owned && craftable.has(r.item.uniqueName))
          : tab === 'relics'
            ? open.filter((r) => r.item.isPrime)
            : open.filter((r) => r.item.tradable && !r.owned)
    return pick.sort((a, b) => b.remaining - a.remaining)
  }, [rows, tab, craftable])

  // potential bar segments
  const favRemaining = useMemo(
    () =>
      rows
        .filter((r) => favSet.has(r.item.uniqueName) && !r.mastered)
        .reduce((s, r) => s + r.remaining, 0),
    [rows, favSet]
  )
  const { within, toNext } = summary
  const room = Math.max(0, toNext - within)
  const favSeg = Math.min(favRemaining, room)
  const hoverSeg = hovered ? Math.min(hovered.remaining, Math.max(0, room - favSeg)) : 0

  if (inv.state !== 'ok' && !inv.data) {
    return (
      <div className="p-6 text-slate-100">
        <h1 className="mb-2 text-2xl font-bold">Mastery helper</h1>
        <p className="mb-4 max-w-md text-sm text-slate-400">
          This page reads your owned gear from the running game. Start Warframe, log in, then load
          your inventory.
        </p>
        <button
          onClick={refreshInventory}
          disabled={inv.state === 'loading'}
          className="rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {inv.state === 'loading' ? 'Reading inventory…' : '↻ Load inventory'}
        </button>
        {inv.state === 'error' && <p className="mt-3 text-sm text-slate-400">! {inv.error}</p>}
      </div>
    )
  }

  const barPct = (n: number): string => `${toNext > 0 ? (n / toNext) * 100 : 0}%`

  return (
    <div className="p-4 text-slate-100">
      <h1 className="mb-3 text-2xl font-bold">Mastery helper</h1>

      {/* progress to next rank */}
      <div className="mb-3">
        <NcCard title="Progress to next rank">
          <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <div
              title={summary.rank != null ? `Mastery Rank ${summary.rank}` : undefined}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-violet-500/40 bg-slate-900"
            >
              {summary.rank != null && icons[summary.rank] ? (
                <img
                  loading="lazy"
                  src={icons[summary.rank]}
                  alt={`Mastery Rank ${summary.rank}`}
                  className="h-14 w-14 object-contain"
                />
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold leading-none text-violet-200">
                    {summary.rank ?? '—'}
                  </span>
                  <span className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                    Rank
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="nc-name text-sm font-semibold text-slate-200">
                  Progress to next rank
                </span>
                <span className="font-bold text-violet-300">{pct(within, toNext)}%</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-900">
                <div className="bg-violet-500" style={{ width: barPct(within) }} />
                <div className="bg-amber-500/70" style={{ width: barPct(favSeg) }} />
                <div
                  className="bg-sky-400/50"
                  style={{
                    width: barPct(hoverSeg),
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,.25) 3px, rgba(255,255,255,.25) 6px)'
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                <span className="tabular-nums">
                  {within} / {toNext} XP
                </span>
                <span className="flex gap-3">
                  <Legend className="bg-violet-500" text="Earned XP" />
                  <Legend className="bg-amber-500/70" text="Potential XP from favorites" />
                  <Legend className="bg-sky-400/50" text="Potential XP from hovered item" />
                </span>
              </div>
            </div>
          </div>
        </NcCard>
      </div>

      {/* three summary cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard
          title="Game content"
          overall={pct(
            summary.content.frame.mastered +
              summary.content.weapon.mastered +
              summary.content.companion.mastered,
            summary.content.frame.total +
              summary.content.weapon.total +
              summary.content.companion.total
          )}
          rows={[
            {
              label: 'Warframes / Archwings',
              done: summary.content.frame.mastered,
              total: summary.content.frame.total
            },
            {
              label: 'Weapons',
              done: summary.content.weapon.mastered,
              total: summary.content.weapon.total
            },
            {
              label: 'Companions',
              done: summary.content.companion.mastered,
              total: summary.content.companion.total
            }
          ]}
        />
        <SummaryCard
          title="Star chart"
          overall={pct(
            summary.starchart.normalDone +
              summary.starchart.spDone +
              summary.starchart.junctionsDone +
              summary.starchart.spJunctionsDone,
            summary.starchart.normalTotal +
              summary.starchart.spTotal +
              summary.starchart.junctionsTotal +
              summary.starchart.spJunctionsTotal
          )}
          rows={[
            {
              label: 'Normal',
              done: summary.starchart.normalDone,
              total: summary.starchart.normalTotal
            },
            {
              label: 'Junctions',
              done: summary.starchart.junctionsDone,
              total: summary.starchart.junctionsTotal
            },
            {
              label: 'Steel Path',
              done: summary.starchart.spDone,
              total: summary.starchart.spTotal
            },
            {
              label: 'Steel p. junctions',
              done: summary.starchart.spJunctionsDone,
              total: summary.starchart.spJunctionsTotal
            }
          ]}
        />
        <SummaryCard
          title="Intrinsics"
          overall={pct(
            summary.intrinsics.railjack + summary.intrinsics.duviri,
            summary.intrinsics.railjackTotal + summary.intrinsics.duviriTotal
          )}
          rows={[
            {
              label: 'Railjack',
              done: summary.intrinsics.railjack,
              total: summary.intrinsics.railjackTotal
            },
            {
              label: 'Duviri',
              done: summary.intrinsics.duviri,
              total: summary.intrinsics.duviriTotal
            }
          ]}
        />
      </div>

      {/* best ways to gain mastery */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Best ways to gain mastery</h2>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1 text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                setShown(PAGE)
              }}
              className={`rounded-md px-3 py-1.5 ${
                tab === t.key ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!ready ? (
        <p className="text-sm text-slate-400">Loading item data…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nothing left here — every item in this category is mastered.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.slice(0, shown).map((r) =>
              tab === 'craft' ? (
                <div
                  key={r.item.uniqueName}
                  onMouseEnter={() => setHovered(r)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <NcCard title={r.item.name}>
                    <FoundryCard
                      card={{
                        row: r,
                        cat: 'all',
                        parts: craftable.get(r.item.uniqueName) ?? [],
                        ready: true,
                        usedFor: false,
                        helminth: false,
                        shards: [],
                        resurgence: false,
                        enoughMr: true
                      }}
                      favorite={favSet.has(r.item.uniqueName)}
                      shardDefs={[]}
                    />
                  </NcCard>
                </div>
              ) : (
                <NcCard key={r.item.uniqueName} title={r.item.name}>
                  <ItemCard row={r} favorite={favSet.has(r.item.uniqueName)} onHover={setHovered} />
                </NcCard>
              )
            )}
          </div>
          {shown < list.length && (
            <button
              onClick={() => setShown((s) => s + PAGE)}
              className="mx-auto mt-3 block rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm hover:bg-slate-800"
            >
              Show more ({list.length - shown} left)
            </button>
          )}
        </>
      )}
    </div>
  )
}

function Legend({ className, text }: { className: string; text: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} />
      {text}
    </span>
  )
}
