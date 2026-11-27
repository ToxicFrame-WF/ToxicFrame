import Dropdown from './Dropdown'
import { useEffect, useMemo, useState } from 'react'
import * as cache from '../apiCache'
import Icon from './Icon'
import { usePriceStore, requestPrices } from '../hooks/priceStore'
import { useItemMeta } from '../hooks/useItemMeta'
import { usePlanetIcons } from '../hooks/usePlanetIcons'
import { setRelicOwned, toggleRelicFavorite, useSettings } from '../settings'
import { relicCounts, useInventory } from '../hooks/useInventory'
import { FORMA, REFINEMENTS, expectedBest } from '../relicValue'
import PlatIcon from './PlatIcon'
import DucatIcon from './DucatIcon'
import Pic from './Pic'
import NcCard from './NcCard'

// The one relic detail popup: the relic planner, Inventory and part details all open this.

const TRACE_COST: Record<string, number> = {
  Intact: 0,
  Exceptional: 25,
  Flawless: 50,
  Radiant: 100
}
const RARITY_ORDER = ['Common', 'Uncommon', 'Rare']
const RARITY_TEXT: Record<string, string> = {
  Common: 'text-amber-500',
  Uncommon: 'text-slate-300',
  Rare: 'text-yellow-400'
}
const RARITY_STYLE: Record<string, string> = {
  Common: 'border-amber-700/40 bg-amber-900/10',
  Uncommon: 'border-white/15 bg-white/5', // not slate-500: Night City turns that red
  Rare: 'border-yellow-400/60 bg-yellow-400/10'
}
const RARITY_BAR: Record<string, string> = {
  Common: 'bg-amber-600',
  Uncommon: 'bg-slate-300',
  Rare: 'bg-yellow-400'
}

export default function RelicDetail({
  relicId,
  initial,
  traces,
  onClose
}: {
  relicId: string
  initial?: string
  traces?: number // Void Traces held; colours the refinements you can afford
  onClose: () => void
}): React.JSX.Element {
  const [relic, setRelic] = useState<RelicSummary | null>(null)
  const [drops, setDrops] = useState<{ location: string; chance: number; note?: string }[]>([])
  const [state, setState] = useState(initial ?? 'Intact')
  const [players, setPlayers] = useState(1)
  const [dropQuery, setDropQuery] = useState('')
  const [dropSearch, setDropSearch] = useState(false)
  const meta = useItemMeta()
  const icons = usePlanetIcons()
  const { get, version } = usePriceStore()
  const { relicFavorites, relicOwned } = useSettings()
  const counts = relicCounts(useInventory(), relicId)
  const owned = relicOwned[relicId] ?? 0

  useEffect(() => {
    cache.relics().then((list) => setRelic(list.find((r) => r.id === relicId) ?? null))
    window.api.getRelicDrops(relicId).then(setDrops)
  }, [relicId])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    if (relic) requestPrices(relic.rewards.map((r) => r.slug).filter((s): s is string => !!s))
  }, [relic])

  const platOf = (rw: RelicReward): number => {
    const p = rw.slug ? get(rw.slug) : undefined
    return p && p !== 'error' ? (p.price ?? 0) : 0
  }
  const ducatOf = (rw: RelicReward): number => (rw.slug ? (meta[rw.slug]?.ducats ?? 0) : 0)

  const favorite = relic ? relicFavorites.includes(relic.id) : false

  // Group by the in-game drop tier from the Intact chance (25.33% Common, 11% Uncommon, 2% Rare);
  // @wfcd's own rarity labels on relic rewards are unreliable.
  const grouped = useMemo(() => {
    if (!relic) return []
    const tier = (rw: RelicReward): string => {
      const c = rw.chances.Intact ?? 0
      return c >= 20 ? 'Common' : c >= 5 ? 'Uncommon' : 'Rare'
    }
    return RARITY_ORDER.map((rarity) => ({
      rarity,
      rewards: relic.rewards.filter((rw) => tier(rw) === rarity)
    })).filter((g) => g.rewards.length)
  }, [relic])

  const shownDrops = drops.filter((d) => d.location.toLowerCase().includes(dropQuery.toLowerCase()))

  if (!relic) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        <div className="rounded-xl bg-slate-900 px-6 py-4 text-slate-300">Loading relic…</div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="nc-dialog-card flex max-h-full w-full max-w-5xl flex-col rounded-lg bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <NcCard title={`${relic.tier} ${relic.name} relic`} className="min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {/* header */}
            <div className="mb-4 flex items-center gap-3">
              {relic.imageName && (
                <img
                  loading="lazy"
                  src={relic.imageName}
                  className="h-12 w-12 rounded-lg bg-slate-800 object-contain p-1"
                />
              )}
              <div className="flex-1">
                <div className="text-2xl font-bold">
                  {relic.tier} {relic.name}
                </div>
                <span className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300">
                  {relic.vaulted ? (
                    <>
                      <Icon name="lock" size={12} /> Vaulted
                    </>
                  ) : (
                    'Unvaulted'
                  )}
                </span>
              </div>
              {counts ? (
                <div
                  title="From your game inventory"
                  className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm"
                >
                  <span className="text-slate-300">You own</span>
                  {REFINEMENTS.map((s) => (
                    <span
                      key={s}
                      className={(counts[s] ?? 0) > 0 ? 'text-slate-100' : 'text-slate-500'}
                    >
                      {s} <b>{counts[s] ?? 0}</b>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-sm">
                  <span className="mr-1 text-slate-300">I own</span>
                  <button
                    onClick={() => setRelicOwned(relic.id, owned - 1)}
                    disabled={owned <= 0}
                    className="rounded px-2 py-0.5 hover:bg-slate-700 disabled:opacity-30"
                  >
                    −
                  </button>
                  <b className="w-8 text-center">{owned}</b>
                  <button
                    onClick={() => setRelicOwned(relic.id, owned + 1)}
                    className="rounded px-2 py-0.5 hover:bg-slate-700"
                  >
                    +
                  </button>
                </div>
              )}
              <a
                href={`https://warframe.market/items/${relic.tier.toLowerCase()}_${relic.name.toLowerCase()}_relic`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-700"
              >
                ↗ Sell orders
              </a>
              <button
                onClick={() => toggleRelicFavorite(relic.id)}
                className={`rounded-lg px-2 py-1 text-2xl leading-none ${favorite ? 'text-amber-300' : 'text-slate-500 hover:text-slate-200'}`}
              >
                {favorite ? '★' : '☆'}
              </button>
              <button
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* compare refinements */}
            <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/50">
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200">Compare refinements</span>
                    <span className="ml-2 text-xs text-slate-400">
                      Trace cost from Intact, average platinum &amp; ducats per run
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-400">
                    Players opening this relic
                    <Dropdown
                      size="sm"
                      value={String(players)}
                      onChange={(v) => setPlayers(Number(v))}
                      options={[1, 2, 3, 4].map((n) => ({
                        value: String(n),
                        label: `${n} player${n > 1 ? 's' : ''}`
                      }))}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {REFINEMENTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setState(s)}
                      className={`rounded-lg border p-3 text-left ${
                        state === s
                          ? 'border-violet-400/60 bg-violet-500/15'
                          : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold">{s}</span>
                        <span
                          className={`text-xs ${TRACE_COST[s] > 0 && (traces ?? 0) >= TRACE_COST[s] ? 'text-emerald-400' : 'text-slate-400'}`}
                        >
                          {TRACE_COST[s]} traces
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-lg font-bold">
                        <span className="flex items-center gap-1 text-sky-300">
                          <PlatIcon size={14} />
                          {expectedBest(relic, s, platOf, players).toFixed(1)}
                        </span>
                        <span className="flex items-center gap-1 text-amber-300">
                          <DucatIcon size={14} />
                          {expectedBest(relic, s, ducatOf, players).toFixed(1)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
              {/* possible rewards */}
              <div className="rounded-xl border border-slate-700 bg-slate-800/50">
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Possible rewards</span>
                    <span className="text-xs text-slate-400">
                      Chance to get this reward ({state})
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-1 text-xs text-slate-500">
                    <span>Reward</span>
                    <span className="text-right">Value per item</span>
                    <span className="text-right">Chance</span>
                  </div>
                  {grouped.map((g) => (
                    <div key={g.rarity}>
                      <div className={`mt-2 text-sm font-semibold ${RARITY_TEXT[g.rarity] ?? ''}`}>
                        {g.rarity}
                      </div>
                      {g.rewards.map((rw, i) => {
                        const chance = rw.chances[state] ?? 0
                        const isForma = FORMA.test(rw.item)
                        const marketIcon = rw.slug ? meta[rw.slug]?.icon : undefined
                        return (
                          <div
                            key={i}
                            className={`mb-1.5 grid grid-cols-[1fr_auto_auto] items-center gap-x-4 rounded-lg border px-3 py-2 ${RARITY_STYLE[g.rarity] ?? ''}`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-900">
                                <Pic
                                  src={
                                    isForma ? (icons.forma ?? rw.image) : (rw.image ?? marketIcon)
                                  }
                                  fallback={isForma ? rw.image : marketIcon}
                                  size={32}
                                  letter={rw.item[0]}
                                />
                              </span>
                              <span className="truncate text-sm">{rw.item}</span>
                            </span>
                            <span className="flex items-center justify-end gap-3 text-sm">
                              <span className="flex items-center gap-1 text-sky-300">
                                <PlatIcon size={12} />
                                {rw.slug ? platOf(rw) : 0}
                              </span>
                              <span className="flex items-center gap-1 text-amber-300">
                                <DucatIcon size={12} />
                                {ducatOf(rw)}
                              </span>
                            </span>
                            <span className="flex items-center justify-end gap-2">
                              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700">
                                <span
                                  className={`block h-full ${RARITY_BAR[g.rarity] ?? 'bg-slate-400'}`}
                                  style={{ width: `${Math.min(100, chance)}%` }}
                                />
                              </span>
                              <span className="w-12 text-right text-sm font-semibold">
                                {chance.toFixed(chance < 10 ? 1 : 0)}%
                              </span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* side column: where to find */}
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-800/50">
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between font-semibold text-slate-200">
                      Where to find it
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        {drops.length}
                        {drops.length > 0 && (
                          <button
                            onClick={() => {
                              setDropSearch((o) => !o)
                              setDropQuery('')
                            }}
                            title="Search locations"
                            aria-pressed={dropSearch}
                            className="text-base leading-none text-slate-400 hover:text-white"
                          >
                            ⌕
                          </button>
                        )}
                      </span>
                    </div>
                    {dropSearch && (
                      <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-2 py-1.5 text-sm">
                        <input
                          autoFocus
                          className="w-full bg-transparent outline-none placeholder:text-slate-400"
                          placeholder="Search"
                          value={dropQuery}
                          onChange={(e) => setDropQuery(e.target.value)}
                        />
                      </div>
                    )}
                    {/* said in words too, not only by the badge in the header */}
                    {relic.vaulted && (
                      <p className="mb-2 flex items-center gap-1.5 text-sm text-amber-300">
                        <Icon name="lock" /> Vaulted: no longer drops in missions
                        {drops.length > 0 ? '; still available from:' : '.'}
                      </p>
                    )}
                    <div className="max-h-72 overflow-y-auto">
                      {shownDrops.map((d) => (
                        <div
                          key={d.location}
                          className="border-t border-slate-800 py-1.5 text-sm first:border-t-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2 text-slate-300">
                              <span className="text-slate-500">◍</span>
                              <span className="truncate" title={d.location}>
                                {d.location}
                              </span>
                            </span>
                            {!d.note && (
                              <span className="shrink-0 font-semibold text-slate-200">
                                {d.chance.toFixed(d.chance < 10 ? 1 : 0)}%
                              </span>
                            )}
                          </div>
                          {d.note && <div className="pl-6 text-xs text-slate-400">{d.note}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* version keeps the component re-rendering as prices arrive */}
            <span className="hidden">{version}</span>
          </div>
        </NcCard>
      </div>
    </div>
  )
}
