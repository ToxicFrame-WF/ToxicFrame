import { useEffect, useMemo, useState } from 'react'
import * as cache from '../apiCache'
import Icon from './Icon'
import { createPortal } from 'react-dom'
import { useInventory } from '../hooks/useInventory'
import { toggleMasteryFavorite, togglePartFavorite, useSettings } from '../settings'
import Pic from './Pic'
import NcCard from './NcCard'
import PlatIcon from './PlatIcon'
import { WeaponStats, WeaponRivens } from './WeaponSection'

// Warframe details window: lore, components with owned counts and relic sources, stats and
// abilities. Opened from the Archon shards inspect window.

type Comp = WarframeDetail['components'][number]

const POLARITY: Record<string, string> = {
  madurai: 'V',
  vazarin: 'D',
  naramon: '—',
  zenurik: '≡',
  unairu: 'Ʊ',
  penjaga: 'P',
  umbra: 'U',
  aura: 'A'
}

export default function WarframeDetail({
  uniqueName,
  onClose
}: {
  uniqueName: string
  onClose: () => void
}): React.JSX.Element {
  const inv = useInventory()
  const { masteryFavorites, partFavorites } = useSettings()
  const [detail, setDetail] = useState<ItemDetail | null | undefined>(undefined)
  const [relics, setRelics] = useState<RelicSummary[]>([])
  const [sel, setSel] = useState<string>('set')
  const [statsOpen, setStatsOpen] = useState(true)
  const [prices, setPrices] = useState<Record<string, number | null>>({})

  useEffect(() => {
    // an old main process has no getItemDetail: fall back to the Warframe lookup
    ;(window.api.getItemDetail?.(uniqueName) ?? Promise.reject())
      .catch(() => window.api.getWarframeDetail(uniqueName))
      .then((d: ItemDetail | null) => {
        setDetail(d)
        const first = d?.components.find((c) => c.tradable) ?? d?.components[0]
        if (first) setSel(first.uniqueName)
      })
    cache.relics().then(setRelics)
  }, [uniqueName])

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  // market prices for the set and each tradable part
  useEffect(() => {
    if (!detail) return
    const slugs = [detail.setSlug, ...detail.components.map((c) => c.slug)].filter(
      (s): s is string => !!s
    )
    for (const s of slugs)
      window.api
        .getPrice(s)
        .then((r) => setPrices((p) => ({ ...p, [s]: r.price })))
        .catch(() => {})
  }, [detail])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    const raw = inv.data?.raw ?? {}
    for (const key of ['MiscItems', 'Recipes']) {
      const list = raw[key]
      if (!Array.isArray(list)) continue
      for (const e of list as { ItemType?: string; ItemCount?: number }[])
        if (e.ItemType) {
          const id = e.ItemType.replace('/Lotus/StoreItems/', '/Lotus/')
          m.set(id, (m.get(id) ?? 0) + (e.ItemCount ?? 0))
        }
    }
    return m
  }, [inv.data])

  const ownsFrame = useMemo(() => {
    const suits = inv.data?.raw?.Suits
    return (
      Array.isArray(suits) &&
      (suits as { ItemType?: string }[]).some((s) => s.ItemType === uniqueName)
    )
  }, [inv.data, uniqueName])

  const owned = (c: Comp): number => {
    const direct = counts.get(c.uniqueName) ?? 0
    // a built component (…Component) and its blueprint (…Blueprint) both count
    const bp = c.uniqueName.endsWith('Component')
      ? (counts.get(c.uniqueName.replace(/Component$/, 'Blueprint')) ?? 0)
      : 0
    return direct + bp
  }

  // relic location "Axi A16 Relic" -> summary, for owned counts and vaulted badges
  const relicByName = useMemo(() => {
    const m = new Map<string, RelicSummary>()
    for (const r of relics) m.set(`${r.tier} ${r.name}`.toLowerCase(), r)
    return m
  }, [relics])
  // the relic's own picture, else any picture of the same tier (Lith/Meso/Neo/Axi/Requiem)
  const relicIcon = (r: RelicSummary | undefined, location: string): string | undefined => {
    const tier = r?.tier ?? location.split(' ')[0]
    const img = r?.imageName ?? relics.find((x) => x.tier === tier && x.imageName)?.imageName
    return img
  }
  const relicOwned = (r: RelicSummary): number =>
    Object.values(inv.data?.relics?.[r.id] ?? {}).reduce((a, b) => a + b, 0)

  const favorite = masteryFavorites.includes(uniqueName)
  const selected = detail?.components.find((c) => c.uniqueName === sel)

  // rendered on <body> so the backdrop covers the whole window (sidebar, title bar, right panel)
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="nc-dialog-card flex max-h-full w-full max-w-5xl flex-col rounded-lg bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <NcCard title={detail ? detail.name : 'Loading'} className="min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {detail === undefined ? (
              <div className="p-10 text-center text-slate-400">Loading…</div>
            ) : detail === null ? (
              <div className="p-10 text-center text-slate-400">No details for this item.</div>
            ) : (
              <>
                {/* header */}
                <div className="flex items-start gap-4 border-b border-slate-700 bg-slate-900/40 px-5 py-4">
                  <Pic src={detail.image} size={56} letter={detail.name[0]} />
                  <div className="flex-1">
                    <div className="text-3xl font-semibold">{detail.name}</div>
                    <span className="mt-1 inline-block rounded border border-slate-600 px-1.5 py-0.5 text-xs text-slate-300">
                      {ownsFrame ? 'Owned' : 'Equipment'}
                    </span>
                    {detail.weapon && (
                      <span className="ml-2 text-sm text-slate-300">
                        {detail.weapon.type}
                        {detail.weapon.mr != null && ` · MR ${detail.weapon.mr}`}
                      </span>
                    )}
                  </div>
                  {detail.wikiUrl && (
                    <a
                      href={detail.wikiUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-700"
                    >
                      ↗ Wiki
                    </a>
                  )}
                  <button
                    onClick={() => toggleMasteryFavorite(uniqueName)}
                    title={favorite ? 'Remove from favorites' : 'Add to favorites'}
                    className={`rounded-lg border border-slate-600 px-2.5 py-1 text-xl leading-none ${favorite ? 'text-amber-300' : 'text-slate-300 hover:text-white'}`}
                  >
                    {favorite ? '★' : '☆'}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-1 text-xl text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                  {detail.description && (
                    <p className="text-sm text-slate-200">{detail.description}</p>
                  )}

                  {/* components + where to find */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-3">
                      <div className="mb-2 flex justify-between font-semibold">
                        Components
                        <span className="text-sm font-normal text-slate-400">
                          {detail.components.length + (detail.setSlug ? 1 : 0)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {detail.setSlug && (
                          <button
                            onClick={() => setSel('set')}
                            className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left ${sel === 'set' ? 'border-violet-400/70 bg-violet-500/15' : 'border-slate-700 bg-slate-800/50 hover:bg-slate-700/50'}`}
                          >
                            <Pic src={detail.image} size={36} letter="S" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">
                                {detail.name} Set
                              </div>
                              <span className="rounded border border-slate-600 px-1 text-[10px] text-slate-300">
                                Set
                              </span>
                            </div>
                          </button>
                        )}
                        {detail.components.map((c) => {
                          const have = owned(c)
                          const done = have >= c.itemCount
                          const fav = (partFavorites ?? []).includes(c.uniqueName)
                          return (
                            <div
                              key={c.uniqueName}
                              onClick={() => setSel(c.uniqueName)}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 ${sel === c.uniqueName ? 'border-violet-400/70 bg-violet-500/15' : 'border-slate-700 bg-slate-800/50 hover:bg-slate-700/50'}`}
                            >
                              <Pic
                                src={c.image}

                                size={36}
                                letter={c.name[0]}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold">{c.name}</div>
                                <div
                                  className={`text-xs ${done ? 'text-emerald-300' : 'text-slate-400'}`}
                                >
                                  {have} / {c.itemCount} owned {done && '✓'}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  togglePartFavorite(c.uniqueName)
                                }}
                                title={fav ? 'Remove from favorites' : 'Add to favorites'}
                                className={`text-lg ${fav ? 'text-amber-300' : 'text-slate-400 hover:text-white'}`}
                              >
                                {fav ? '★' : '☆'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-col rounded-xl border border-slate-700 bg-slate-900/30 p-4">
                      {sel === 'set' || !selected ? (
                        <>
                          <div className="flex items-center gap-3">
                            <Pic src={detail.image} size={40} letter="S" />
                            <div className="flex-1 font-semibold">{detail.name} Set</div>
                            <PriceBox
                              slug={detail.setSlug}
                              plat={detail.setSlug ? prices[detail.setSlug] : undefined}
                            />
                          </div>
                          <p className="mt-4 text-sm text-slate-400">
                            Select a component to see where it drops.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start gap-3">
                            <Pic src={selected.image} size={40} letter={selected.name[0]} />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold">{selected.name}</div>
                              <div className="text-xs text-slate-400">
                                {selected.tradable ? `Part of ${detail.name}` : 'Resource'}
                              </div>
                            </div>
                            <PriceBox
                              slug={selected.slug}
                              plat={selected.slug ? prices[selected.slug] : undefined}
                            />
                          </div>
                          <div className="my-3 border-t border-slate-700" />
                          <div className="mb-2 font-semibold">Where to find it</div>
                          {selected.drops.length === 0 ? (
                            <p className="text-sm text-slate-400">No drop sources listed.</p>
                          ) : (
                            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                              {selected.drops.map((d) => {
                                const key = d.location.replace(/\s+Relic$/, '').toLowerCase()
                                const r = relicByName.get(key)
                                const n = r ? relicOwned(r) : 0
                                return (
                                  <div
                                    key={d.location}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${n ? 'bg-emerald-900/20' : 'bg-slate-800/60'}`}
                                  >
                                    <Pic
                                      src={relicIcon(r, d.location)}
                                      size={28}
                                      letter={d.location[0]}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm">{d.location}</div>
                                      <div className="flex items-center gap-2 text-xs">
                                        {n > 0 && (
                                          <span className="text-emerald-300">Owned ×{n}</span>
                                        )}
                                        {r?.vaulted && (
                                          <span className="rounded border border-amber-500/60 px-1 text-amber-300">
                                            <Icon name="lock" /> Vaulted
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-sm font-semibold">
                                      {Math.round(d.chance * 100) / 100}%
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {detail.weapon && <WeaponStats detail={detail} />}
                  {detail.weapon && <WeaponRivens name={detail.name} />}

                  {/* stats & abilities */}
                  {!detail.weapon && (
                    <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-4">
                      <button
                        onClick={() => setStatsOpen(!statsOpen)}
                        className="flex w-full items-center justify-between font-semibold"
                      >
                        <Icon name="chart" /> Stats &amp; abilities
                        <span
                          className={`text-slate-400 transition ${statsOpen ? '' : '-rotate-90'}`}
                        >
                          ⌄
                        </span>
                      </button>
                      {statsOpen && (
                        <div className="mt-3 space-y-4">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                            <Stat label="♡ Base health" value={detail.stats.health} />
                            <Stat label="⛉ Base shields" value={detail.stats.shield} />
                            <Stat label="▣ Base armor" value={detail.stats.armor} />
                            <Stat label="ϟ Base energy" value={detail.stats.power} />
                            <Stat label="➶ Sprint speed" value={detail.stats.sprint} />
                            <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2">
                              <div className="text-xs text-slate-300">Polarities</div>
                              <div
                                className="mt-1 flex gap-2 font-semibold"
                                title={detail.polarities.join(', ')}
                              >
                                {detail.aura && (
                                  <span title={`Aura: ${detail.aura}`} className="text-violet-300">
                                    {POLARITY[detail.aura] ?? '?'}
                                  </span>
                                )}
                                {detail.polarities.map((p, i) => (
                                  <span key={i} title={p}>
                                    {POLARITY[p] ?? p[0]?.toUpperCase()}
                                  </span>
                                ))}
                                {!detail.polarities.length && !detail.aura && '—'}
                              </div>
                            </div>
                          </div>
                          {detail.passive && (
                            <div>
                              <div className="mb-1 text-sm font-semibold">✧ Passive</div>
                              <p className="whitespace-pre-line text-sm text-slate-200">
                                {detail.passive}
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {detail.abilities.map((a, i) => (
                              <div
                                key={a.name}
                                className="flex gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3"
                              >
                                <span className="relative shrink-0">
                                  <Pic src={a.image} size={40} letter={a.name[0]} />
                                  <span className="absolute -bottom-1 -right-1 rounded bg-slate-900 px-1 text-[10px] text-slate-200">
                                    {i + 1}
                                  </span>
                                </span>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold">{a.name}</div>
                                  <p className="whitespace-pre-line text-sm text-slate-300">
                                    {a.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </NcCard>
      </div>
    </div>,
    document.body
  )
}

function Stat({ label, value }: { label: string; value?: number }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2">
      <div className="text-xs text-slate-300">{label}</div>
      <div className="text-lg font-semibold">{value ?? '—'}</div>
    </div>
  )
}

function PriceBox({
  slug,
  plat
}: {
  slug?: string
  plat?: number | null
}): React.JSX.Element | null {
  if (!slug) return null
  return (
    <button
      onClick={() =>
        window.dispatchEvent(new CustomEvent('toxicframe:compare', { detail: { slug } }))
      }
      title="Show in Buy / Sell"
      className="flex shrink-0 items-center gap-3 rounded-lg border border-rose-500/40 bg-rose-900/30 px-3 py-1.5 text-sm hover:bg-rose-900/50"
    >
      <span className="text-slate-200">Trade</span>
      <span className="flex items-center gap-1 font-semibold text-sky-300">
        {plat != null ? plat : '—'} <PlatIcon size={14} />
      </span>
    </button>
  )
}
