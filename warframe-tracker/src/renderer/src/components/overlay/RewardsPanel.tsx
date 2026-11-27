import { useEffect, useMemo } from 'react'
import { requestPrices, seedFromCache, usePriceStore } from '../../hooks/priceStore'
import { useItemMeta } from '../../hooks/useItemMeta'
import PlatIcon from '../PlatIcon'
import DucatIcon from '../DucatIcon'
import NcCard from '../NcCard'
import { useSettings } from '../../settings'

interface Item {
  name: string | null
  quantity: number
  slug?: string
  vaulted?: boolean
}
export interface RewardsData {
  reading?: boolean
  error?: string
  items?: Item[]
  layout?: { boxes: { x: number; w: number }[]; top: number; scale: number }
}

// the tab is narrow and in capitals: "Kompressa Prime Blueprint" -> "Kompressa BP"
const short = (name: string | null): string =>
  name ? name.replace(/ Prime\b/, '').replace(/ Blueprint$/, ' BP') : 'Unknown'

// One column per reward card, in the same order as the cards, just below them.
export default function RewardsPanel({ data }: { data: RewardsData }): React.JSX.Element {
  const meta = useItemMeta()
  const { rewardsSize, rewardsOpacity } = useSettings()
  const { get, version } = usePriceStore()
  const items = useMemo(() => data.items ?? [], [data.items])
  useEffect(() => {
    seedFromCache()
    requestPrices(items.flatMap((i) => (i.slug ? [i.slug] : [])))
  }, [items])

  const layout = data.layout
  if (!data.items || !layout)
    return (
      <div className="fixed left-1/2 top-[52%] -translate-x-1/2 nc-screen border border-[#5ef6ff55] px-4 py-2 text-sm">
        {data.error ? `Could not read the rewards: ${data.error}` : 'Reading rewards…'}
      </div>
    )

  const plat = (i: Item): number => {
    const p = i.slug ? get(i.slug) : undefined
    return p && p !== 'error' ? (p.price ?? 0) : 0
  }
  const ducats = (i: Item): number => (i.slug ? (meta[i.slug]?.ducats ?? 0) : 0)
  void version // re-render as prices arrive
  // the best pick: most plat, ducats break a tie; a full tie (or nothing of value) marks none
  const rank = (i: Item): number => plat(i) * 1000 + ducats(i)
  const top = Math.max(0, ...items.map(rank))
  const best = top > 0 && items.filter((i) => rank(i) === top).length === 1 ? top : -1
  // the cards are drawn at a 270 px reference width and zoomed to the game's card width
  const z = layout.scale * (rewardsSize / 100)

  return (
    <>
      {items.map((i, n) => {
        const box = layout.boxes[n]
        if (!box) return null
        return (
          <div
            key={n}
            className="fixed"
            style={
              {
                left: box.x,
                top: layout.top,
                width: box.w,
                '--tf-bg-alpha': rewardsOpacity / 100
              } as React.CSSProperties
            }
          >
            <div style={{ zoom: z * 1.35, width: box.w / (z * 1.35) }}>
              <NcCard
                title={`${i.quantity > 1 ? `${i.quantity}× ` : ''}${short(i.name)}`}
                active={rank(i) === best}
              >
                <div className="nc-screen flex items-center gap-3 px-2 py-1.5 text-sm font-semibold tabular-nums text-white">
                  {/* every card gets a line, so none collapses to an empty strip (Forma) */}
                  {i.slug ? (
                    <span className="inline-flex items-center gap-1">
                      {plat(i) || '–'}
                      <PlatIcon size={16} />
                    </span>
                  ) : (
                    <span className="font-normal text-slate-400">
                      {i.name ? 'Not tradable' : 'Unknown item'}
                    </span>
                  )}
                  {ducats(i) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      {ducats(i)}
                      <DucatIcon size={16} />
                    </span>
                  )}
                  {i.vaulted && (
                    <span className="ml-auto text-[11px] font-normal uppercase tracking-wider text-amber-300">
                      Vaulted
                    </span>
                  )}
                </div>
              </NcCard>
            </div>
          </div>
        )
      })}
    </>
  )
}
