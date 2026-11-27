import { useInventory } from '../hooks/useInventory'
import SyndicateScreen from './SyndicateScreen'

// Night City "Street Cred": how many syndicates you have maxed, and on click every syndicate with
// its rank and standing (inventory Affiliations). Names follow wiki.warframe.com/w/Syndicate.
const NAMES: Record<string, string> = {
  SteelMeridianSyndicate: 'Steel Meridian',
  ArbitersSyndicate: 'Arbiters of Hexis',
  CephalonSudaSyndicate: 'Cephalon Suda',
  PerrinSyndicate: 'The Perrin Sequence',
  RedVeilSyndicate: 'Red Veil',
  NewLokaSyndicate: 'New Loka',
  CetusSyndicate: 'Ostrons',
  QuillsSyndicate: 'The Quills',
  SolarisSyndicate: 'Solaris United',
  VoxSyndicate: 'Vox Solaris',
  VentKidsSyndicate: 'Ventkids',
  EntratiSyndicate: 'Entrati',
  NecraloidSyndicate: 'Necraloid',
  ZarimanSyndicate: 'The Holdfasts',
  EntratiLabSyndicate: 'Cavia',
  KahlSyndicate: "Kahl's Garrison",
  HexSyndicate: 'The Hex',
  LibrarySyndicate: 'Cephalon Simaris',
  ConclaveSyndicate: 'Conclave',
  EventSyndicate: 'Operational Supply',
  NightcapJournalSyndicate: 'Nightcap'
}
const MAX_RANK = 5 // faction and open-world syndicates top out at rank 5

interface Affiliation {
  Tag?: string
  Standing?: number
  Title?: number
}

function useStreetCred(): Parameters<typeof SyndicateScreen>[0] {
  const inv = useInventory()
  const raw = inv.data?.raw?.Affiliations
  const all = (Array.isArray(raw) ? raw : []) as Affiliation[]
  // Nightwave keeps one entry per season ("RadioLegion…Syndicate"); show only the newest one
  const nightwave = all
    .filter((a) => /^RadioLegion/.test(a.Tag ?? ''))
    .sort(
      (a, b) =>
        Number(/\d+/.exec(b.Tag ?? '')?.[0] ?? 0) - Number(/\d+/.exec(a.Tag ?? '')?.[0] ?? 0)
    )[0]
  const rows = [
    ...all
      .filter((a) => a.Tag && NAMES[a.Tag])
      .map((a) => ({
        tag: a.Tag!,
        name: NAMES[a.Tag!],
        rank: a.Title ?? 0,
        standing: a.Standing ?? 0,
        max: MAX_RANK
      })),
    ...(nightwave
      ? [
          {
            tag: 'Nightwave',
            name: 'Nightwave',
            rank: nightwave.Title ?? 0,
            standing: nightwave.Standing ?? 0,
            max: 0
          }
        ]
      : [])
  ].sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name))
  const maxed = rows.filter((r) => r.max && r.rank >= r.max).length
  const today = gainedToday(rows, !inv.fromCache) // an old saved inventory must not set today's start
  const misc = (Array.isArray(inv.data?.raw?.MiscItems) ? inv.data.raw.MiscItems : []) as {
    ItemType?: string
    ItemCount?: number
  }[]

  return { rows, maxed, misc, today, mr: inv.data?.masteryRank ?? 0 }
}

// Top-bar tab: opens the Syndicates page (page id 'syndicates', not in the menu groups).
export default function StreetCred({
  active,
  onSelect
}: {
  active: boolean
  onSelect: () => void
}): React.JSX.Element {
  const { maxed } = useStreetCred()
  return (
    <button
      onClick={onSelect}
      title="Syndicates"
      role="tab"
      aria-selected={active}
      className={`flex cursor-pointer items-baseline gap-2 border-b-2 pb-1 pt-1.5 ${active ? 'border-[#4ade80]' : 'border-transparent opacity-90 hover:opacity-100'}`}
    >
      <b className="text-3xl font-bold leading-none text-[#4ade80]">{maxed}</b>
      <span className="whitespace-nowrap text-[11px] uppercase tracking-widest text-[#4ade80] max-[1500px]:hidden">
        Street Cred
      </span>
    </button>
  )
}

export function SyndicatesPage(): React.JSX.Element {
  const d = useStreetCred()
  return <SyndicateScreen {...d} />
}

// Standing gained today (UTC day, when the cap resets): the first standing seen each day is kept
// in localStorage and compared with the current one.
// shortcut: only counts from the first time the app saw the inventory today; the inventory has no
// "earned today" field.
function gainedToday(
  rows: { tag: string; standing: number }[],
  fresh: boolean
): Record<string, number> {
  const day = new Date().toISOString().slice(0, 10)
  const now = Object.fromEntries(rows.map((r) => [r.tag, r.standing]))
  let base: Record<string, number> = now
  try {
    const saved = JSON.parse(localStorage.getItem('ui.syndicateDay') ?? 'null')
    if (saved?.day === day) base = { ...now, ...saved.standing }
    // write only when something new is stored (a new day or a syndicate not seen yet today),
    // not on every redraw of the top-bar tab
    const known = saved?.day === day && rows.every((r) => r.tag in saved.standing)
    if (rows.length && fresh && !known)
      localStorage.setItem('ui.syndicateDay', JSON.stringify({ day, standing: base }))
  } catch {
    // storage blocked: no daily numbers
  }
  return Object.fromEntries(rows.map((r) => [r.tag, r.standing - (base[r.tag] ?? r.standing)]))
}
