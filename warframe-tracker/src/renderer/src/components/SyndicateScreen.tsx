import { useEffect, useState } from 'react'
import { dailyCap, medallions, rankProgress, title } from '../syndicates'
import NcCard from './NcCard'
import SyndicateDetail, { Bar, Line } from './SyndicateDetail'

// Street Cred screen: your syndicate standing, laid out like a game attribute screen.
// The six faction syndicates (wiki.warframe.com/w/Syndicate) sit on a hexagon so allies are
// neighbours and enemies face each other across the middle: Steel Meridian + Red Veil, New Loka +
// Perrin Sequence, Arbiters of Hexis + Cephalon Suda are allied; opposite tiles are enemies.
// Everything else (open worlds, Nightwave, …) is listed beside it.

export interface SyndicateRow {
  tag: string
  name: string
  rank: number
  standing: number
  max: number // 0 = no cap shown (Nightwave)
}

const RING = [
  'SteelMeridianSyndicate',
  'RedVeilSyndicate',
  'NewLokaSyndicate',
  'PerrinSyndicate',
  'ArbitersSyndicate',
  'CephalonSudaSyndicate'
]
const OPEN_WORLD = new Set([
  'CetusSyndicate',
  'QuillsSyndicate',
  'SolarisSyndicate',
  'VoxSyndicate',
  'VentKidsSyndicate',
  'EntratiSyndicate',
  'NecraloidSyndicate',
  'ZarimanSyndicate',
  'EntratiLabSyndicate',
  'HexSyndicate',
  'KahlSyndicate'
])
// syndicate sigils on the wiki (white, tinted here)
const SIGIL: Record<string, string> = {
  SteelMeridianSyndicate: 'SteelMeridianSigil(SxWhite).png',
  RedVeilSyndicate: 'RedVeilSigil(SxWhite).png',
  NewLokaSyndicate: 'NewLokaSigil(SxWhite).png',
  PerrinSyndicate: 'PerrinSequenceSigil(SxWhite).png',
  ArbitersSyndicate: 'ArbitersofHexisSigil(SxWhite).png',
  CephalonSudaSyndicate: 'CephalonSudaSigil(SxWhite).png'
}
function Sigil({ file, color }: { file: string; color: string }): React.JSX.Element {
  const url = `url("https://wiki.warframe.com/images/${encodeURIComponent(file)}")`
  return (
    <span
      aria-hidden
      className="inline-block h-7 w-7 shrink-0"
      style={{
        background: color,
        maskImage: url,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center'
      }}
    />
  )
}
const RED = '#ff4d5a'
const CYAN = '#50d8e0'
const YELLOW = '#f5d742' // maxed, like the game's perk points
// attribute tile: flat top and bottom, pointed sides
// flat top, long sides out to the widest point low down, a short steep cut to the base
const TILE = 'polygon(21% 0, 79% 0, 100% 56%, 81% 100%, 19% 100%, 0 56%)'
// the upper tiles are flipped: every tile's wide side faces the centre and its cable
const TILE_UP = 'polygon(19% 0, 81% 0, 100% 44%, 79% 100%, 21% 100%, 0 44%)'

const tone = (r: SyndicateRow): string =>
  r.rank < 0 ? RED : r.max && r.rank >= r.max ? YELLOW : CYAN

export default function SyndicateScreen({
  rows,
  maxed,
  mr,
  misc,
  today
}: {
  rows: SyndicateRow[]
  maxed: number
  mr: number
  misc: { ItemType?: string; ItemCount?: number }[]
  today: Record<string, number> // standing gained since the first look today (UTC)
}): React.JSX.Element {
  const [picked, setPicked] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  // the board scales with the window height, so follow resizes (maximize / restore)
  const [winH, setWinH] = useState(window.innerHeight)
  useEffect(() => {
    const on = (): void => setWinH(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const byTag = new Map(rows.map((r) => [r.tag, r]))
  const ring = RING.map((t) => byTag.get(t))
  const open = rows.filter((r) => OPEN_WORLD.has(r.tag))
  const other = rows.filter((r) => !RING.includes(r.tag) && !OPEN_WORLD.has(r.tag))
  const negative = rows.filter((r) => r.rank < 0).length
  const meds = medallions(misc)
  const medStanding = Object.values(meds.byTag).reduce((n, m) => n + m.standing, 0)
  // shortcut: faction gains also move allies and enemies, so the biggest gain is the best guess
  // at what counted toward the shared cap; exact needs solving the relation matrix.
  const factionToday = Math.max(0, ...RING.map((t) => today[t] ?? 0))
  const cap = dailyCap(mr)
  const sel = picked ? byTag.get(picked) : undefined

  return (
    // a normal page: fills the page area under the header, like the other screens
    <div className="grid h-full grid-cols-[16rem_minmax(0,1fr)_20rem] gap-6 overflow-hidden p-4 text-slate-100">
      {/* summary, like "attribute points available" */}
      {sel ? (
        <SyndicateDetail
          row={sel}
          rows={rows}
          today={today[sel.tag] ?? 0}
          cap={cap}
          medals={meds.byTag[sel.tag]}
          universal={meds.universal}
          onBack={() => setPicked(null)}
        />
      ) : (
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pt-1">
          <Stat value={maxed} color={YELLOW} label="Syndicates at max rank" />
          <Stat value={rows.length} color={CYAN} label="Syndicates joined" />
          <Stat value={negative} color={RED} label="Syndicates against you" />
          <div className="space-y-2 border-t pt-4 text-xs" style={{ borderColor: `${RED}55` }}>
            <Line
              label="Faction standing today"
              value={`${factionToday.toLocaleString()} / ${cap.toLocaleString()}`}
            />
            <Bar pct={factionToday / cap} color={factionToday >= cap ? YELLOW : CYAN} />
            <Line label="Faction medallions" value={`${medStanding.toLocaleString()} standing`} />
            <Line label="Universal medallions" value={`${meds.universal} × 1,000`} />
          </div>
          <p
            className="border-t pt-4 text-[11px] leading-relaxed text-slate-400"
            style={{ borderColor: `${RED}55` }}
          >
            Faction syndicates: neighbours are allies, tiles facing each other across the middle are
            enemies. Gaining standing with one lowers it with its enemies. Click a syndicate for
            details. Today’s standing counts from the first time this screen saw your inventory
            today.
          </p>
        </div>
      )}

      {/* faction board: six tiles around the street cred plate, joined by circuit bundles */}
      {/* shrinks to fit under the top bar and page header (~230px) */}
      <div
        className="relative z-20 mx-auto h-[36rem] w-[38rem] max-w-full self-center"
        style={{ scale: String(Math.min(1, (winH - 230) / 576)) }}
      >
        {/* screen backdrop: faint grid and scan lines, fading out toward the edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-8"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, #ffffff08 0 1px, transparent 1px 3px), linear-gradient(${RED}14 1px, transparent 1px), linear-gradient(90deg, ${RED}14 1px, transparent 1px)`,
            backgroundSize: 'auto, 32px 32px, 32px 32px',
            maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)'
          }}
        />
        {/* circuit bundles from under the plate to each tile, with a socket block where they land */}
        <svg viewBox="0 0 608 576" className="absolute inset-0 h-full w-full" aria-hidden>
          {ring.map((r, i) => {
            const a = (-90 + i * 60) * (Math.PI / 180)
            const nx = -Math.sin(a)
            const ny = Math.cos(a)
            const lit = r && (r.tag === picked || r.tag === hover)
            const c = lit ? CYAN : RED
            // the wire meets every tile's edge ~142px out (side tiles sit at x 235, see below);
            // the socket's centre sits 5px inside that, so it touches the tile
            const reach = 137
            const ex = 304 + Math.cos(a) * reach
            const ey = 288 + Math.sin(a) * reach
            return (
              <g key={i} style={lit ? { filter: `drop-shadow(0 0 3px ${CYAN})` } : undefined}>
                {[-12, -8, -4, 0, 4, 8, 12].map((o) => (
                  <line
                    key={o}
                    x1={304 + Math.cos(a) * 40 + nx * o}
                    y1={288 + Math.sin(a) * 40 + ny * o}
                    x2={ex + nx * o}
                    y2={ey + ny * o}
                    stroke={c}
                    strokeOpacity={lit ? 0.85 : Math.abs(o) > 6 ? 0.35 : 0.65}
                    strokeWidth={o === 0 ? 2 : 1.25}
                  />
                ))}
                {/* socket block */}
                <rect
                  x={ex - 16}
                  y={ey - 5}
                  width={32}
                  height={10}
                  transform={`rotate(${(a * 180) / Math.PI + 90} ${ex} ${ey})`}
                  fill={lit ? `${CYAN}44` : '#1a0a0e'}
                  stroke={c}
                  strokeOpacity={lit ? 1 : 0.85}
                />
              </g>
            )
          })}
        </svg>
        {/* centre: street cred on a layered plate */}
        <div className="absolute left-1/2 top-1/2 z-10 h-28 w-28 -translate-x-1/2 -translate-y-1/2">
          <div
            className="absolute inset-0 rotate-45 border"
            style={{
              background: 'linear-gradient(135deg, #1d2232, #151925)',
              borderColor: '#2c3448'
            }}
          />
          <div className="relative flex h-full flex-col items-center justify-center">
            <span className="text-4xl" style={{ color: YELLOW }}>
              {maxed}
            </span>
            <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: CYAN }}>
              Street Cred
            </span>
          </div>
        </div>
        {ring.map((r, i) => {
          const a = (-90 + i * 60) * (Math.PI / 180)
          const color = r ? tone(r) : '#64748b'
          const prog = r && r.rank < 5 ? rankProgress(r.rank, r.standing) : undefined
          const on = r && r.tag === picked
          const shape = Math.sin(a) > 0.1 ? TILE : TILE_UP
          const hovered = r && r.tag === hover
          const left = `calc(50% + ${Math.cos(a) * 235}px)`
          const top = `calc(50% + ${Math.sin(a) * 205}px)`
          const outLeft = Math.cos(a) < -0.1 // the panel opens away from the centre
          return [
            // hover panel: the key numbers slide out beside the tile
            r && (
              <div
                key={`${RING[i]}-info`}
                aria-hidden
                className="pointer-events-none absolute z-20 w-44 -translate-y-1/2 border px-3 py-2 text-[11px] transition-all duration-150"
                style={{
                  top,
                  left: outLeft ? `calc(${left} - 17.5rem)` : `calc(${left} + 6.5rem)`,
                  opacity: hovered ? 1 : 0,
                  translate: hovered ? '0 0' : `${outLeft ? 8 : -8}px 0`,
                  borderColor: `${CYAN}aa`,
                  background: 'rgb(10 18 24 / 0.94)'
                }}
              >
                <div className="mb-1 font-bold uppercase tracking-wider" style={{ color: CYAN }}>
                  {r.name}
                </div>
                <Line label="Title" value={title(r.tag, r.rank) || '—'} />
                <Line label="Standing" value={r.standing.toLocaleString()} />
                <Line label="Today" value={`+${(today[r.tag] ?? 0).toLocaleString()}`} />
                {prog && r.rank >= 0 && (
                  <Line label="Next rank" value={`${Math.round(prog.pct * 100)}%`} />
                )}
              </div>
            ),
            <div
              key={RING[i]}
              role="button"
              tabIndex={0}
              onClick={() => r && setPicked(r.tag)}
              onKeyDown={(e) => e.key === 'Enter' && r && setPicked(r.tag)}
              onMouseEnter={() => setHover(RING[i])}
              onMouseLeave={() => setHover(null)}
              className="absolute z-10 h-32 w-52 -translate-x-1/2 -translate-y-1/2 cursor-pointer p-px transition-[filter] duration-150 hover:brightness-125"
              style={{
                left,
                top,
                clipPath: shape,
                // thin frame; the selected or hovered syndicate gets a cyan one
                background: on || hovered ? CYAN : '#c4453fcc'
              }}
            >
              <div
                className="flex h-full flex-col items-center justify-center text-center"
                style={{
                  clipPath: shape,
                  background: on
                    ? 'linear-gradient(180deg, rgb(28 52 60 / 0.92), rgb(22 30 38 / 0.95))'
                    : 'linear-gradient(180deg, rgb(64 20 26 / 0.92), rgb(44 14 20 / 0.95))'
                }}
              >
                <span className="px-8 text-sm uppercase tracking-wider" style={{ color: CYAN }}>
                  {r?.name ?? RING[i].replace('Syndicate', '')}
                </span>
                {/* emblem + rank, like an icon next to a value */}
                <span className="mt-1.5 flex items-center gap-2">
                  <Sigil file={SIGIL[RING[i]]} color={CYAN} />
                  <span className="text-3xl leading-none" style={{ color }}>
                    {r?.rank ?? '–'}
                  </span>
                  <span className="self-end text-[9px] uppercase" style={{ color }}>
                    Rank
                  </span>
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-widest" style={{ color }}>
                  {r ? title(r.tag, r.rank) : ''}
                </span>
                {prog && r && r.rank >= 0 && (
                  <span className="mt-1 w-24">
                    <Bar pct={prog.pct} color={color} />
                  </span>
                )}
              </div>
            </div>
          ]
        })}
      </div>

      {/* everything that is not a faction */}
      <div
        className="min-h-0 space-y-4 overflow-y-auto pb-6 pr-1 pt-1"
        // fades out at the bottom so it is clear the list goes on
        style={{ maskImage: 'linear-gradient(to bottom, black calc(100% - 3rem), transparent)' }}
      >
        <Group title="Open worlds & hubs" rows={open} picked={picked} onPick={setPicked} />
        <Group title="Other" rows={other} picked={picked} onPick={setPicked} />
      </div>
    </div>
  )
}

function Stat({
  value,
  color,
  label
}: {
  value: number
  color: string
  label: string
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-right text-4xl font-bold" style={{ color }}>
        {value}
      </span>
      <span className="text-sm uppercase leading-tight tracking-wider" style={{ color }}>
        {label}
      </span>
    </div>
  )
}

function Group({
  title: heading,
  rows,
  picked,
  onPick
}: {
  title: string
  rows: SyndicateRow[]
  picked: string | null
  onPick: (tag: string) => void
}): React.JSX.Element | null {
  if (!rows.length) return null
  return (
    <NcCard title={heading}>
      <ul className="space-y-1.5 p-2">
        {rows.map((r) => (
          <li
            key={r.tag}
            role="button"
            tabIndex={0}
            onClick={() => onPick(r.tag)}
            onKeyDown={(e) => e.key === 'Enter' && onPick(r.tag)}
            className="flex cursor-pointer items-center gap-3 border px-3 py-2 hover:brightness-125"
            // the open syndicate is lit cyan, like its tile on the board
            style={
              r.tag === picked
                ? { borderColor: CYAN, background: 'rgb(24 60 68 / 0.55)' }
                : { borderColor: `${RED}55`, background: '#00000040' }
            }
            aria-current={r.tag === picked || undefined}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold uppercase tracking-wide">
                {r.name}
              </span>
              <span
                className="block truncate text-[11px] text-slate-400"
                // inline, to beat the Night City rule that capitalises small text in cards
                style={{ textTransform: 'none', letterSpacing: 'normal' }}
              >
                {title(r.tag, r.rank) ? `${title(r.tag, r.rank)} · ` : ''}
                {/* Kahl's Garrison, Nightcap and similar keep no real standing (0-5) */}
                {r.standing >= 100 ? `${r.standing.toLocaleString()} standing` : ' '}
              </span>
            </span>
            {r.max > 0 && (
              // one pip per rank up to the cap, like the game's rank bars
              <span className="flex gap-0.5" aria-label={`Rank ${r.rank} of ${r.max}`}>
                {Array.from({ length: r.max }, (_, i) => (
                  <span
                    key={i}
                    className="h-3 w-1.5"
                    style={{ background: i < r.rank ? tone(r) : '#ffffff22' }}
                  />
                ))}
              </span>
            )}
            <span className="w-8 text-right text-lg font-bold" style={{ color: tone(r) }}>
              {r.rank}
            </span>
          </li>
        ))}
      </ul>
    </NcCard>
  )
}
