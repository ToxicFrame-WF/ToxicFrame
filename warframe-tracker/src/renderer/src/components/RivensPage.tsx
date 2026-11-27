import Dropdown from './Dropdown'
import { useEffect, useMemo, useState } from 'react'
import * as cache from '../apiCache'
import { useInventory } from '../hooks/useInventory'
import {
  formatStat,
  gradeRiven,
  parseRivens,
  rivenName,
  rivenStats,
  type Grade,
  type Riven
} from '../rivens'
import RivenDetail from './RivenDetail'
import { usePersisted } from '../hooks/usePersisted'
import Pic from './Pic'
import GradeBadge from './GradeBadge'
import NcCard from './NcCard'
import DrainPolarity from './DrainPolarity'

// Trading > Rivens: your unveiled rivens (weapon, rank, MR, rerolls, stats) and veiled stacks.
let gradesPromise: ReturnType<typeof window.api.getRivenGrades> | null = null
let dataPromise: ReturnType<typeof window.api.getRivenData> | null = null

const GRADES: Grade[] = ['Perfect', 'Good', 'OK', 'Bad']

export default function RivensPage({ view }: { view: 'unveiled' | 'veiled' }): React.JSX.Element {
  const inv = useInventory()
  const [weapons, setWeapons] = useState<Map<string, MasteryItem>>(new Map())
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Riven | null>(null)
  // picked weapon variant per riven (id -> weapon unique name)
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [data, setData] = useState<Awaited<ReturnType<typeof window.api.getRivenData>>>({
    values: {},
    affix: {}
  })
  const [rules, setRules] = useState<Record<string, { good: string[]; neg: string[] }>>({})
  const [gradeFilter, setGradeFilter] = usePersisted<Grade | null>('RivensPage.grade', null)
  const [sort, setSort] = usePersisted<'name' | 'grade'>('RivensPage.sort', 'grade')
  useEffect(() => {
    cache.masteryCatalog().then((c) =>
      // some rivens name the weapon's internal base class ("…/QuadShotgunBase" = Hek), so each
      // weapon is also found under its unique name + "Base"
      setWeapons(
        new Map(
          c.items.flatMap((i): [string, MasteryItem][] => [
            [i.uniqueName, i],
            [`${i.uniqueName}Base`, i]
          ])
        )
      )
    )
    ;(gradesPromise ??= window.api.getRivenGrades()).then(setRules)
    ;(dataPromise ??= window.api.getRivenData()).then(setData)
  }, [])
  const { unveiled, veiled } = useMemo(() => parseRivens(inv.data?.raw ?? {}), [inv.data])
  // weapon name, or a readable guess from the path for kitgun/zaw parts the catalog lacks
  const nameOf = (u: string): string =>
    weapons.get(u)?.name ??
    (u.split('/').pop() ?? '').replace(/Weapon$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')

  // Weapons you own (all gear sections), to show the variant you actually use.
  const owned = useMemo(() => {
    const raw = inv.data?.raw ?? {}
    const set = new Set<string>()
    for (const k of ['LongGuns', 'Pistols', 'Melee', 'SpaceGuns', 'SpaceMelee', 'SentinelWeapons'])
      for (const g of (Array.isArray(raw[k]) ? raw[k] : []) as { ItemType?: string }[])
        if (g.ItemType) set.add(g.ItemType)
    return set
  }, [inv.data])
  // A riven fits its base weapon and every variant ("Tenet Arca Plasmor", "Hek" -> "Vaykor Hek",
  // "Lato Prime"): catalog weapons whose name contains the base name as whole words.
  const variantsOf = (base: string): MasteryItem[] => {
    const b = weapons.get(base)
    if (!b) return []
    const re = new RegExp(`(^|\\s)${b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i')
    const all = [...new Set(weapons.values())].filter(
      (w) => w.group === 'weapon' && re.test(w.name)
    )
    // owned first, then the base weapon, then by name
    return all.sort(
      (x, y) =>
        Number(owned.has(y.uniqueName)) - Number(owned.has(x.uniqueName)) ||
        Number(y.uniqueName === base) - Number(x.uniqueName === base) ||
        x.name.localeCompare(y.name)
    )
  }
  const shownOf = (r: Riven): MasteryItem | undefined =>
    weapons.get(picked[r.id] ?? '') ?? variantsOf(r.weapon)[0] ?? weapons.get(r.weapon)
  const shownName = (r: Riven): string => shownOf(r)?.name ?? nameOf(r.weapon)
  // the sheet may list a variant on its own row; otherwise the base weapon's row applies
  const ruleOf = (r: Riven): (typeof rules)[string] | undefined =>
    rules[shownName(r).toLowerCase()] ?? rules[nameOf(r.weapon).toLowerCase()]

  // grade from the community sheet
  const gradeOf = (r: (typeof unveiled)[number]): Grade | undefined => gradeRiven(r, ruleOf(r))
  const q = query.trim().toLowerCase()
  const list = unveiled
    .filter((r) => !gradeFilter || gradeOf(r) === gradeFilter)
    .filter(
      (r) =>
        !q ||
        nameOf(r.weapon).toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        [...r.buffs, ...r.curses].some((s) => s.toLowerCase().includes(q))
    )
    .sort(
      (a, b) =>
        (sort === 'grade'
          ? GRADES.indexOf(gradeOf(a) ?? 'Bad') - GRADES.indexOf(gradeOf(b) ?? 'Bad')
          : 0) || nameOf(a.weapon).localeCompare(nameOf(b.weapon))
    )

  return (
    <div className="p-4 text-slate-100">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {view === 'unveiled' ? 'Unveiled stash' : 'Veiled stash'}
        </h1>
        <span className={`text-sm text-slate-400 ${view === 'unveiled' ? 'hidden' : ''}`}>
          {view === 'unveiled'
            ? `${unveiled.length} rivens`
            : `${veiled.reduce((n, v) => n + v.count, 0)} veiled rivens`}
        </span>
      </div>

      {!inv.data ? (
        <p className="text-sm text-slate-400">Load your inventory to see your rivens.</p>
      ) : view === 'veiled' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
          {veiled.map((v) => (
            <NcCard key={v.type} title={`${v.type} riven`}>
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
                <span className="nc-name font-semibold">{v.type} riven</span>
                <span className="text-lg font-bold text-violet-300">×{v.count}</span>
              </div>
            </NcCard>
          ))}
          {veiled.length === 0 && <p className="text-sm text-slate-400">No veiled rivens.</p>}
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search weapon, type or stat"
              className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm outline-none placeholder:text-slate-400"
            />
            <div className="flex gap-1 text-sm" role="group" aria-label="Grade">
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(gradeFilter === g ? null : g)}
                  aria-pressed={gradeFilter === g}
                  className={`rounded-md border px-2.5 py-1 ${gradeFilter === g ? 'border-violet-400/70 bg-violet-500/20 font-semibold text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700/50'} ${gradeFilter && gradeFilter !== g ? 'opacity-40 hover:opacity-80' : ''} cursor-pointer`}
                  title={gradeFilter === g ? 'Show all grades' : `Only ${g} rivens`}
                >
                  <GradeBadge grade={g} />
                </button>
              ))}
            </div>
            <span className="ml-auto text-sm text-slate-400">{unveiled.length} rivens</span>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              Sort
              <Dropdown
                value={sort}
                onChange={(v) => setSort(v as 'name' | 'grade')}
                options={[
                  { value: 'grade', label: 'Riven grade' },
                  { value: 'name', label: 'Weapon name' }
                ]}
              />
            </label>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-3">
            {list.map((r) => (
              <NcCard key={r.id} title={shownName(r)}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpen(r)}
                  onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}
                  className="cursor-pointer rounded-xl border border-slate-700 bg-slate-800/60 p-3 hover:border-slate-500"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg [filter:brightness(1.3)]">
                      <Pic src={shownOf(r)?.imageName} size={60} letter={shownName(r)[0]} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="nc-name truncate font-semibold">{shownName(r)}</div>
                      <div className="truncate text-lg font-bold tracking-wide text-white">
                        {rivenName(r, data.affix) ?? `${r.type} riven`}
                      </div>
                      <div className="mt-1">
                        {gradeOf(r) ? (
                          <GradeBadge grade={gradeOf(r)!} />
                        ) : (
                          <span className="text-xs text-slate-400">No grade for this weapon</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const v = rivenStats(r, data)
                    const line = (
                      tag: string,
                      name: string,
                      n: number | undefined,
                      neg: boolean
                    ): React.JSX.Element => (
                      <li key={tag} className={neg ? 'text-red-500' : 'text-amber-300'}>
                        <b className="tabular-nums">
                          {n !== undefined ? formatStat(tag, n) : neg ? '−' : '+'}
                        </b>{' '}
                        {name}
                      </li>
                    )
                    return (
                      <ul className="min-h-[5.5rem] space-y-0.5 text-sm">
                        {r.buffTags.map((t, i) => line(t, r.buffs[i], v.buffs[i], false))}
                        {r.curseTags.map((t, i) => line(t, r.curses[i], v.curses[i], true))}
                      </ul>
                    )
                  })()}
                  {/* MR, rerolls, rank, polarity, like the in-game riven footer */}
                  <div className="mt-2 grid grid-cols-[1fr_1fr_1fr_auto] items-center border-t border-slate-700 pt-2 text-xs text-slate-300">
                    <span title="Mastery rank required">MR {r.mr}</span>
                    <span title="Times rerolled">⟳ {r.rerolls}</span>
                    <span>Rank {r.rank}/8</span>
                    <DrainPolarity drain={10 + r.rank} polarity={r.polarity} size={18} />
                  </div>
                </div>
              </NcCard>
            ))}
          </div>
        </>
      )}
      {open && (
        <RivenDetail
          riven={open}
          weapon={shownName(open)}
          image={shownOf(open)?.imageName}
          name={rivenName(open, data.affix)}
          grade={gradeOf(open)}
          rule={ruleOf(open)}
          variants={variantsOf(open.weapon).map((w) => ({
            id: w.uniqueName,
            name: w.name,
            owned: owned.has(w.uniqueName)
          }))}
          variant={shownOf(open)?.uniqueName}
          onVariant={(id) => setPicked((p) => ({ ...p, [open.id]: id }))}
          data={data}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
