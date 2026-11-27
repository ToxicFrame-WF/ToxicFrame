import { useEffect, useMemo, useState } from 'react'
import * as cache from '../../apiCache'
import { partCounter, relicCounts, useInventory } from '../../hooks/useInventory'
import { requestPrices, seedFromCache, usePriceStore } from '../../hooks/priceStore'
import { useItemMeta } from '../../hooks/useItemMeta'
import {
  DEFAULT_OVERLAY_FILTERS,
  OVERLAY_FILTERS_KEY,
  recommend,
  type OverlayFilters
} from '../../relicValue'
import PlatIcon from '../PlatIcon'
import DucatIcon from '../DucatIcon'
import VoidTraceIcon from '../VoidTraceIcon'
import NcCard from '../NcCard'
import { useSettings } from '../../settings'
import { useInteractKey } from '../../hooks/useInteractKey'

const STATE_COLOR: Record<string, string> = {
  Intact: '#b8b8b8',
  Exceptional: '#c9925a',
  Flawless: '#d8dde6',
  Radiant: '#e8c25a'
}
const ROW_H = 72 // px, one relic card
const GAP = 8

// usePersisted keeps values under "ui.<key>"; read them again on every storage event
const readFilters = (): OverlayFilters => {
  try {
    const saved = localStorage.getItem(`ui.${OVERLAY_FILTERS_KEY}`)
    return { ...DEFAULT_OVERLAY_FILTERS, ...(saved ? JSON.parse(saved) : {}) }
  } catch {
    return DEFAULT_OVERLAY_FILTERS
  }
}

const VOID_TRACES = '/Lotus/Types/Items/MiscItems/VoidTearDrop'

// era: the tab open on the in-game relic picker (read off the screen); it overrides the saved era
export default function RecommendPanel({
  era,
  visible
}: {
  era: string | null
  visible: boolean
}): React.JSX.Element {
  const [filters, setFilters] = useState(readFilters)
  const [relics, setRelics] = useState<RelicSummary[]>([])
  const [invMeta, setInvMeta] = useState<Awaited<ReturnType<typeof window.api.getInventoryMeta>>>(
    {}
  )
  const inventory = useInventory()
  const { recommendSize, recommendOpacity, recommendRows: rows } = useSettings()
  const meta = useItemMeta()
  const { get, version } = usePriceStore()

  useEffect(() => {
    const onStorage = (): void => setFilters(readFilters())
    window.addEventListener('storage', onStorage)
    cache.relics().then(setRelics)
    cache.inventoryMeta().then(setInvMeta)
    seedFromCache()
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // owned relics only; prices for their rewards
  const owned = useMemo(
    () =>
      relics.filter((r) => Object.values(relicCounts(inventory, r.id) ?? {}).some((n) => n > 0)),
    [relics, inventory]
  )
  // the panel stays loaded while hidden: refresh prices older than 10 minutes each time it opens
  useEffect(() => {
    if (!visible) return
    requestPrices(
      owned.flatMap((r) => r.rewards.map((rw) => rw.slug).filter((s): s is string => !!s))
    )
  }, [owned, visible])

  const top = useMemo(() => {
    const held = partCounter(inventory.data?.raw ?? {})
    const heldBySlug = new Map<string, number>()
    for (const [u, m] of Object.entries(invMeta))
      if (m.kind === 'part' && m.slug)
        heldBySlug.set(m.slug, (heldBySlug.get(m.slug) ?? 0) + held(u))
    return recommend(
      owned,
      (id) => relicCounts(inventory, id),
      era ? { ...filters, tier: era } : filters,
      get,
      meta,
      heldBySlug,
      40 // the list scrolls (the interact hotkey scrolls it)
    )
    // version: re-rank as prices arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned, inventory, invMeta, filters, meta, version, era])

  const misc = inventory.data?.raw?.MiscItems
  const traces = Array.isArray(misc)
    ? ((misc as { ItemType?: string; ItemCount?: number }[]).find((m) => m.ItemType === VOID_TRACES)
        ?.ItemCount ?? 0)
    : undefined

  // sized like the game's UI, which scales with the window width (1 at 2560 px)
  const key = useInteractKey(visible)
  const zoom = Math.max(0.75, window.innerWidth / 2560) * (recommendSize / 100)

  return (
    <div
      style={{ zoom, '--tf-bg-alpha': recommendOpacity / 100 } as React.CSSProperties}
      className="w-[380px]"
    >
      <NcCard title={`Recommended relics${era ? ` · ${era}` : ''}`}>
        <div className="nc-screen p-2 text-white">
          <div className="mb-2 flex items-center justify-end text-xs text-slate-300">
            <span />
            {traces !== undefined && (
              <span
                title="Your Void Traces"
                className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-white"
              >
                {traces.toLocaleString()}
                <VoidTraceIcon small />
              </span>
            )}
          </div>
          {top.length === 0 ? (
            <div className="py-3 text-center text-sm text-slate-300">
              {inventory.data ? 'No owned relics match the filters' : 'Waiting for your inventory'}
            </div>
          ) : (
            <div
              style={{
                height: rows * ROW_H + (rows - 1) * GAP,
                gap: GAP,
                ...(top.length > rows * 2 && {
                  maskImage: 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)'
                })
              }}
              className="grid grid-cols-2 content-start overflow-y-auto pr-1"
            >
              {top.map((t, n) => (
                <div
                  key={`${t.relic.id}|${t.state}`}
                  style={{ height: ROW_H }}
                  className={`border-l-2 bg-white/5 px-2 py-1.5 ${n === 0 ? 'border-[#3fa9b0]' : 'border-[#5ef6ff25]'}`}
                >
                  <div className="truncate text-sm font-bold">
                    {t.relic.tier} {t.relic.name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <span style={{ color: STATE_COLOR[t.state] }}>{t.state}</span> · ×{t.count}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm font-semibold tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {t.plat.toFixed(1)}
                      <PlatIcon size={15} />
                    </span>
                    {t.ducats > 0 && ( // Requiem relics have no ducat rewards
                      <span className="inline-flex items-center gap-1">
                        {t.ducats.toFixed(1)}
                        <DucatIcon size={15} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {top.length > rows * 2 && (
            <div className="mt-1 text-right text-[11px] text-slate-400">
              +{top.length - rows * 2} more{key && ` · ${key} to scroll`}
            </div>
          )}
        </div>
      </NcCard>
    </div>
  )
}
