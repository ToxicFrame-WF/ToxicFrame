import { useState } from 'react'
import WikiIcon from './WikiIcon'
import PlatIcon from './PlatIcon'

// A mod or arcane as its in-game card: the wiki's card picture, or (when the wiki has none) a
// card drawn in the same layout with our own CSS frame:
// mods: rarity frame, drain + polarity top right, art, name, rank pips, type;
// arcanes: the icon on a dark diamond in a rarity frame, name, max rank.
export interface CardData {
  rarity?: string
  polarity?: string
  drain?: number
  maxRank?: number
  type?: string
}

// frame colours per rarity: bronze, silver, gold, platinum
const RARITY: Record<string, { line: string; glow: string }> = {
  Common: { line: '#c08a5a', glow: 'rgb(192 138 90 / 0.25)' },
  Uncommon: { line: '#c9d3dc', glow: 'rgb(201 211 220 / 0.22)' },
  Rare: { line: '#e9c46a', glow: 'rgb(233 196 106 / 0.28)' },
  Legendary: { line: '#eef0ff', glow: 'rgb(238 240 255 / 0.3)' }
}
const POLARITY: Record<string, string> = {
  madurai: 'Madurai',
  vazarin: 'Vazarin',
  naramon: 'Naramon',
  zenurik: 'Zenurik',
  unairu: 'Unairu',
  penjaga: 'Penjaga',
  umbra: 'Umbra'
}

export default function ModCard({
  name,
  image,
  card,
  arcane,
  plat,
  priced,
  note
}: {
  name: string
  image?: string
  card: CardData
  arcane?: boolean
  plat?: number | null
  priced: boolean // has a market slug (else "—")
  note?: string // rank and standing cost
}): React.JSX.Element {
  // the wiki's picture of the whole in-game card ("Necramech Fury" -> NecramechFuryMod.png,
  // arcanes without "Mod"); the drawn card below is only the fallback when the wiki has none
  const [noWiki, setNoWiki] = useState(false)
  // the wiki keeps apostrophes and writes "of" / "and" small, "Mod" only once: "Mesa's Waltz" ->
  // Mesa'sWaltzMod.png, "Path Of Statues" -> PathofStatuesMod.png, "Lock And Load" -> LockandLoadMod.png
  const base = name
    .replace(/\s/g, '')
    .replace(/(?<=[a-z])(Of|And)(?=[A-Z])/g, (w) => w.toLowerCase())
  const file = `${base}${arcane || base.endsWith('Mod') ? '' : 'Mod'}.png`
  const price = (
    <span
      className="flex shrink-0 items-center gap-1 text-sm font-semibold"
      style={{ color: plat != null ? '#f5d742' : undefined }}
    >
      {plat != null ? Math.round(plat) : priced ? '…' : '—'}
      {plat != null && <PlatIcon size={12} />}
    </span>
  )
  if (!noWiki)
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <img
          loading="lazy"
          src={`https://wiki.warframe.com/images/${encodeURIComponent(file)}`}
          alt={name}
          title={name}
          onError={() => setNoWiki(true)}
          className="h-60 w-full object-contain"
        />
        {note && <span className="text-[10px] text-slate-400">{note}</span>}
        {price}
      </div>
    )
  const r = RARITY[card.rarity ?? ''] ?? RARITY.Common
  const pol = card.polarity ? POLARITY[card.polarity] : undefined
  return (
    <div
      className="relative flex h-64 flex-col items-center overflow-hidden rounded-md border-2 px-2 pb-2 pt-2 text-center"
      style={{
        borderColor: r.line,
        background: `radial-gradient(ellipse at 50% 0%, ${r.glow}, transparent 70%), linear-gradient(180deg, #1c1a22, #0f0e14)`,
        boxShadow: `inset 0 0 0 1px #00000088, 0 0 10px ${r.glow}`
      }}
      title={card.rarity ? `${card.rarity} ${arcane ? 'arcane' : 'mod'}` : undefined}
    >
      {!arcane && (card.drain != null || pol) && (
        // drain + polarity, top right
        <span
          className="absolute right-1.5 top-1.5 flex items-center gap-0.5 text-sm font-bold"
          style={{ color: r.line }}
        >
          {card.drain}
          {pol && <WikiIcon file={`${pol}_Pol(xWhite).png`} title={pol} color={r.line} size={14} />}
        </span>
      )}
      {arcane ? (
        <span
          className="mt-3 flex h-24 w-24 rotate-45 items-center justify-center border-2"
          style={{ borderColor: r.line, background: '#0b0a10' }}
        >
          {image && (
            <img
              loading="lazy"
              src={image}
              alt=""
              className="h-24 w-24 -rotate-45 object-contain"
            />
          )}
        </span>
      ) : (
        <span className="mt-4 flex h-28 w-full items-center justify-center">
          {image && (
            <img loading="lazy" src={image} alt="" className="max-h-28 max-w-full object-contain" />
          )}
        </span>
      )}
      <span
        className="mt-3 line-clamp-2 text-sm font-semibold leading-tight"
        style={{ color: r.line }}
      >
        {name}
      </span>
      {card.maxRank != null &&
        card.maxRank > 0 &&
        // rank pips (shop items come unranked) or the arcane's max rank
        (arcane ? (
          <span className="mt-1 text-[11px] text-slate-400">Max rank {card.maxRank}</span>
        ) : (
          <span className="mt-1.5 flex gap-0.5" aria-label={`${card.maxRank} ranks`}>
            {Array.from({ length: card.maxRank }, (_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rotate-45 border"
                style={{ borderColor: r.line }}
              />
            ))}
          </span>
        ))}
      {note && <span className="mt-1 text-[10px] text-slate-400">{note}</span>}
      <span className="mt-auto flex w-full items-center justify-between text-[11px] text-slate-400">
        <span className="truncate">{card.type}</span>
        {price}
      </span>
    </div>
  )
}
