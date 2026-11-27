import { GROUPS, type NavItem } from '../nav'
import { useInventory } from '../hooks/useInventory'
import Icon from './Icon'
import PlatIcon from './PlatIcon'
import StreetCred from './StreetCred'
import ProfileWidget from './ProfileWidget'
import MarketPresence from './MarketPresence'
import { useEffect } from 'react'
import { usePersisted } from '../hooks/usePersisted'

// Night City navigation: the sidebar becomes two tab rows across the top, like a game menu.
// Row 1 = groups, row 2 = the pages of the active group. Active entries are cyan and underlined.
const flat = (items: NavItem[]): NavItem[] => items.flatMap((i) => (i.children ? i.children : [i]))

export default function TopNav({
  active,
  onSelect,
  onOpenSettings,
  controls
}: {
  active: string
  onSelect: (id: string) => void
  onOpenSettings: () => void
  controls?: React.ReactNode // window buttons; the bar doubles as the title bar
}): React.JSX.Element {
  const inv = useInventory()
  const cred = active === 'syndicates' // the Street Cred page is open: no group is active
  const raw = inv.data?.raw ?? {}
  const group = GROUPS.find((g) => flat(g.items).some((i) => i.id === active)) ?? GROUPS[0]
  const plat = typeof raw.PremiumCredits === 'number' ? raw.PremiumCredits : 0
  // each group remembers the sub-tab you last had open; clicking the group goes back to it
  const [lastSub, setLastSub] = usePersisted<Record<string, string>>('TopNav.lastSub', {})
  useEffect(() => {
    if (!cred && lastSub[group.title] !== active)
      setLastSub((l) => ({ ...l, [group.title]: active }))
  }, [active, cred, group.title, lastSub, setLastSub])
  const openGroup = (g: (typeof GROUPS)[number]): string => {
    const items = flat(g.items)
    const last = items.find((i) => i.id === lastSub[g.title] && i.ready)
    return last?.id ?? items.find((i) => i.ready)?.id ?? active
  }

  return (
    // three columns: stats on the left and buttons on the right sit in the vertical middle of
    // both tab rows in the centre
    <nav
      className="nc-topnav grid shrink-0 grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-3 border-b pl-4 [-webkit-app-region:drag]"
      aria-label="Main"
    >
      <div className="flex items-center gap-6">
        <ProfileWidget
          trigger={
            <span
              className="flex items-baseline gap-2 border-b-2 border-transparent pb-1 pt-1.5"
              title="Mastery rank"
            >
              <b className="text-3xl font-bold leading-none text-[#50d8e0]">
                {inv.data?.masteryRank ?? '–'}
              </b>
              <span className="whitespace-nowrap text-[11px] uppercase tracking-widest text-[#50d8e0] max-[1500px]:hidden">
                Mastery Rank
              </span>
            </span>
          }
        />
        <StreetCred active={cred} onSelect={() => onSelect('syndicates')} />
      </div>
      <div className="flex flex-col items-center pt-1">
        {/* no sub-tabs: move the group row down half the sub-row (~26px) so it sits in the middle */}
        <div
          className={`flex gap-1 transition-transform duration-150 ${cred || flat(group.items).length < 2 ? 'translate-y-[13px]' : ''}`}
          role="tablist"
        >
          {GROUPS.map((g) => {
            const on = !cred && g === group
            return (
              <button
                key={g.title}
                role="tab"
                aria-selected={on}
                onClick={() => onSelect(openGroup(g))}
                className={`nc-navtab cursor-pointer whitespace-nowrap px-4 py-1.5 text-sm font-bold uppercase tracking-[0.18em] max-[1500px]:px-2.5 max-[1500px]:tracking-[0.1em] max-[1400px]:px-2 max-[1400px]:text-xs max-[1400px]:tracking-[0.06em] transition-colors duration-150 ${
                  on ? 'text-[#50d8e0]' : 'text-[#ff6b5a]/80 hover:text-[#50d8e0]'
                }`}
                data-on={on || undefined}
              >
                {g.title}
              </button>
            )
          })}
        </div>
        {/* pages of the active group */}
        <div
          className={`flex justify-center gap-5 whitespace-nowrap pb-1.5 pt-1 ${cred || flat(group.items).length < 2 ? 'invisible' : ''}`}
          role="tablist"
        >
          {flat(group.items).map((i) => {
            const on = i.id === active
            return (
              <button
                key={i.id}
                role="tab"
                aria-selected={on}
                disabled={!i.ready}
                onClick={() => onSelect(i.id)}
                className={`cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                  on
                    ? 'text-[#50d8e0] underline decoration-2 underline-offset-[6px]'
                    : 'text-slate-400 hover:text-[#50d8e0]'
                }`}
              >
                {i.label}
              </button>
            )
          })}
        </div>
      </div>
      {/* right side: market | platinum | settings + window buttons, split by fine red dividers */}
      <div className="flex items-center justify-end gap-4">
        <MarketPresence onLink={onOpenSettings} />
        <span className="contents max-[1400px]:hidden">
          <Divider />
        </span>
        <span className="flex items-center gap-1.5 text-sm max-[1400px]:hidden" title="Platinum">
          <b className="text-lg leading-none text-[#f3e600]">{plat.toLocaleString()}</b>
          <span className="-translate-y-0.5">
            <PlatIcon size={18} />
          </span>
        </span>
        <Divider />
        {/* settings joins the window buttons as one strip at the right edge */}
        <span className="flex items-center">
          <button
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Settings"
            className="nc-winbtn flex h-11 w-12 cursor-pointer items-center justify-center text-[#ff6b5a] hover:text-[#50d8e0]"
          >
            <Icon name="gear" size={18} />
          </button>
          {controls}
        </span>
      </div>
    </nav>
  )
}

const Divider = (): React.JSX.Element => (
  <span className="h-6 w-px shrink-0 bg-[#ff4d5a]/35" aria-hidden />
)

// Night City page header, shown above every page: group in red, page in cyan, a fine red rule.
// The pages' own titles are hidden in this mode (main.css), so each screen reads like the
// inventory terminal.
export function ScreenHeader({
  page,
  right
}: {
  page: string
  right?: React.ReactNode // page actions shown at the right end of the header
}): React.JSX.Element {
  const group =
    page === 'syndicates'
      ? { title: 'Street Cred', items: [{ id: page, label: 'Syndicates', ready: true }] }
      : GROUPS.find((g) => flat(g.items).some((i) => i.id === page))
  const item = group && flat(group.items).find((i) => i.id === page)
  return (
    <div className="nc-screen-head mx-4 mt-4 flex items-baseline gap-6 border-b pb-2">
      <span className="text-2xl font-bold uppercase tracking-[0.2em] text-[#ff6b5a]">
        {group?.title ?? ''}
      </span>
      {/* "Inventory Inventory": a page named like its group shows the name once */}
      {item?.label !== group?.title && (
        <span className="nc-page-name text-lg uppercase tracking-[0.3em] text-[#50d8e0]">
          {item?.label ?? ''}
        </span>
      )}
      {right && <span className="ml-auto self-center">{right}</span>}
    </div>
  )
}
