import type { InvRow } from '../hooks/useInventoryItems'
import Pic from './Pic'
import PlatIcon from './PlatIcon'
import DucatIcon from './DucatIcon'
import { missingCost } from '../sets'

// "Enter Night City" inventory: the classic card grid, each card drawn as a terminal readout
// (cyan name tab, red frame, picture + details, market value, Inspect / Trade).

const RED = '#ff4d5a'
const GREEN = '#3fd28a'
const CYAN_REST = '#3fa9b0' // the card tab's resting cyan

const partsDone = (r: InvRow): number => (r.setParts ?? []).filter((p) => p.have >= p.need).length
const isComplete = (r: InvRow): boolean => !!r.setParts && partsDone(r) === r.setParts.length
const GOLD = '#f3e600'

export default function NightCityInventory({
  rows,
  total,
  tabs,
  tab,
  platOf,
  ducatsOf,
  priceOfSlug,
  onOpen,
  showCount = true
}: {
  rows: InvRow[]
  total: number
  tabs: { key: string; label: string }[]
  tab: string
  platOf: (r: InvRow) => number
  ducatsOf: (r: InvRow) => number
  priceOfSlug: (slug?: string) => number
  onOpen: (r: InvRow) => void
  showCount?: boolean // false when the page shows the count in its own control row
}): React.JSX.Element {
  const tabLabel = tabs.find((t) => t.key === tab)?.label ?? ''
  const trade = (r: InvRow): void => {
    if (r.slug)
      window.dispatchEvent(
        new CustomEvent('toxicframe:compare', { detail: { slug: r.slug, rank: r.rank } })
      )
  }

  return (
    <div>
      {showCount && (
        <div className="mb-3 text-sm text-slate-400">
          {total} {tabLabel.replace(/^All /, '').toLowerCase()}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-x-3 gap-y-4">
        {rows.map((r) => (
          <article key={r.key} className="nc-inv-card min-w-0">
            <div
              className="nc-tab truncate px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-black"
              style={{ maxWidth: '85%', ...(isComplete(r) ? { background: GREEN } : {}) }}
              title={r.mastered ? `${r.name} (already mastered)` : r.name}
            >
              {/* the body names the item; the tab says what kind of thing it is */}
              {r.setParts
                ? // green means complete; the tick means the item is already mastered
                  `${isComplete(r) ? 'Complete set' : 'Set'}${r.mastered ? ' ✓' : ''}`
                : r.kind === 'part'
                  ? r.isPrime
                    ? 'Prime part'
                    : 'Part'
                  : r.kind === 'mod' && r.modType
                    ? `${r.modType} mod`
                    : r.kind}
              {r.vaulted ? ' · vaulted' : ''}
            </div>
            <div
              className="nc-card-frame border p-3"
              style={{
                background: '#00000040',
                ...(isComplete(r) ? { borderColor: `${GREEN}99` } : {})
              }}
            >
              <div className="mb-2 flex items-center gap-3">
                {/* picture with the owned count as a quantity badge */}
                <span
                  className="relative flex h-16 w-16 shrink-0 items-center justify-center border"
                  style={{ borderColor: `${RED}88` }}
                >
                  <Pic src={r.image} size={56} letter={r.name[0]} />
                  {r.count > 1 && (
                    <span className="absolute bottom-0.5 right-0.5 border border-white/30 bg-black/85 px-1 text-xs font-bold leading-tight text-white">
                      ×{r.count}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-sm font-semibold leading-tight text-slate-100"
                    title={r.name}
                  >
                    {splitName(r.name)[0]}
                  </div>
                  {r.setParts && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      {/* how many parts you have enough of */}
                      <span className="h-1.5 flex-1 bg-white/10">
                        <span
                          className="block h-full"
                          style={{
                            width: `${(100 * partsDone(r)) / r.setParts.length}%`,
                            background: isComplete(r) ? GREEN : CYAN_REST
                          }}
                        />
                      </span>
                      {partsDone(r)}/{r.setParts.length}
                    </div>
                  )}
                  {splitName(r.name)[1] && (
                    <div className="truncate text-xs leading-tight text-slate-400">
                      {splitName(r.name)[1]}
                    </div>
                  )}
                  {/* mods/arcanes: one line, rarity in its in-game colour, maxed copies marked */}
                  {(r.rarity || (r.maxRank != null && r.kind !== 'part' && r.kind !== 'relic')) && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                      {r.rarity && (
                        <span style={{ color: RARITY_COLOR[r.rarity] ?? '#cbd5e1' }}>
                          {r.rarity}
                        </span>
                      )}
                      {r.maxRank != null &&
                        r.maxRank > 0 &&
                        r.kind !== 'part' &&
                        r.kind !== 'relic' && (
                          <>
                            {r.rarity && <span className="text-slate-500">·</span>}
                            <span className="text-slate-300">
                              Rank {r.rank ?? 0}/{r.maxRank}
                            </span>
                            {(r.rank ?? 0) >= r.maxRank && (
                              <span className="border border-[#5ef6ff88] px-1 text-[10px] font-bold leading-tight text-[#5ef6ff]">
                                MAX
                              </span>
                            )}
                          </>
                        )}
                    </div>
                  )}
                </div>
              </div>
              {/* sets: each part with how many you have / need, lit when there are enough */}
              {r.setParts && (
                <div
                  className="mb-2 grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${r.setParts.length}, minmax(0, 1fr))` }}
                >
                  {r.setParts.map((p) => (
                    <div
                      key={p.name}
                      title={`${p.name}: you have ${p.have}, the set needs ${p.need}`}
                      className="flex min-w-0 flex-col items-center border px-0.5 py-1"
                      style={
                        p.have >= p.need
                          ? { borderColor: '#3fa9b088', background: '#3fa9b014' }
                          : { borderColor: `${RED}55` }
                      }
                    >
                      <b
                        className={`text-sm leading-tight ${p.have >= p.need ? 'text-[#50c8d0]' : 'text-slate-400'}`}
                      >
                        ×{p.have}
                      </b>
                      <span className="w-full truncate text-center text-[10px] leading-tight text-slate-300">
                        {p.name}
                      </span>
                      {/* always there, so every card is the same height */}
                      <span className="text-[9px] leading-tight text-slate-500">
                        {p.need > 1 ? `need ${p.need}` : ' '}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div
                className="mb-2 flex items-center gap-4 border-t pt-2 text-base font-bold tabular-nums"
                style={{ borderColor: `${RED}55` }}
                title="Market value"
              >
                {/* sets: what the missing parts cost; otherwise the whole stack's worth */}
                <span className="mr-auto text-xs font-normal text-slate-400">
                  {(() => {
                    // 0 for a complete set, null when a lacking part has no price: no line then
                    const miss = r.setParts ? missingCost(r.setParts, priceOfSlug) : null
                    return (
                      !!miss && (
                        <span
                          className="inline-flex items-center gap-1"
                          title="Cheapest sell orders for the parts you lack"
                        >
                          missing ≈ {Math.round(miss)} <PlatIcon size={11} />
                          {/* parts cost as much as the whole set: buying the set is the better deal */}
                          {platOf(r) > 0 && miss >= platOf(r) && (
                            <span
                              className="ml-1 text-amber-300"
                              title="The missing parts cost at least as much as a full set"
                            >
                              · buy the set
                            </span>
                          )}
                        </span>
                      )
                    )
                  })()}
                  {r.count > 1 && platOf(r) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      ×{r.count} = {r.count * platOf(r)} <PlatIcon size={11} />
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  {platOf(r) || '–'} <PlatIcon size={15} />
                </span>
                {ducatsOf(r) > 0 && (
                  <span className="flex items-center gap-1" style={{ color: GOLD }}>
                    {ducatsOf(r)} <DucatIcon size={15} />
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {/* only these kinds have a pop-up (InventoryPage's onOpen); sets show theirs in the part tiles */}
                {!r.setParts && ['mod', 'arcane', 'relic', 'part'].includes(r.kind) && (
                  <button
                    onClick={() => onOpen(r)}
                    className="nc-inv-inspect flex-1 cursor-pointer border py-1 text-[11px] font-bold uppercase tracking-widest transition-colors duration-150 hover:bg-white/5"
                  >
                    Inspect
                  </button>
                )}
                <button
                  onClick={() => trade(r)}
                  disabled={!r.slug}
                  className="nc-inv-trade flex-1 cursor-pointer py-1 text-[11px] font-bold uppercase tracking-widest text-black transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trade
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

// "Sybaris Prime Barrel" -> ["Sybaris Prime", "Barrel"]; other names stay whole
const splitName = (name: string): [string, string] => {
  if (name.endsWith(' Set')) return [name.slice(0, -4), '']
  const m =
    /^(.* (?:Prime|Vandal|Wraith)) (.+)$/.exec(name) ??
    /^(.+) (Intact|Exceptional|Flawless|Radiant)$/.exec(name) // relics: "Requiem I" + "Intact"
  return m ? [m[1], m[2]] : [name, '']
}

// in-game rarity colours
const RARITY_COLOR: Record<string, string> = {
  Common: '#c98a52',
  Uncommon: '#d4dae3',
  Rare: '#f5c542',
  Legendary: '#efe9ff'
}
