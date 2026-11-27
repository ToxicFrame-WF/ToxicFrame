import Dropdown from './Dropdown'
import NcCard from './NcCard'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useInventory } from '../hooks/useInventory'
import { usePersisted } from '../hooks/usePersisted'
import PlatIcon from './PlatIcon'
import Pic from './Pic'
import Icon from './Icon'
import { confirmBox } from './confirmBox'
import WikiIcon from './WikiIcon'
import { parseRivens, rivenName, rivenStats, formatStat, type Riven } from '../rivens'
import { matchContractRiven, staleStats, toContractItem, type ContractItem } from '../contractMap'
import * as cache from '../apiCache'
import RivenDetail from './RivenDetail'
import { ownedWeapons, rivenView, weaponLookup } from '../rivenView'
import { matchListing, tagOf, type Filter } from '../rivenFilter'
import { fairPrice } from '../rivenFair'

// Riven contracts (warframe.market auctions): show, hide, edit, remove and list them from here.
// tab icons: official wiki files (names verified 2026-11-27); the wiki has none for zaw or arch-gun
const TABS = [
  { id: 'all', label: 'All', icon: 'IconInfinity(xWhite).png' },
  { id: 'rifle', label: 'Rifle', icon: 'IconCategoryRifle(xWhite).png' },
  { id: 'shotgun', label: 'Shotgun', icon: 'IconCategoryShotgun(xWhite).png' },
  { id: 'pistol', label: 'Pistol', icon: 'IconCategoryPistol(xWhite).png' },
  { id: 'melee', label: 'Melee', icon: 'IconCategoryMelee(xWhite).png' },
  { id: 'kitgun', label: 'Kitgun', icon: 'IconCraftingKitgunChamber(xWhite).png' },
  { id: 'zaw', label: 'Zaw', icon: 'IconCategoryModular(xWhite).png' },
  { id: 'archgun', label: 'Arch', icon: 'IconArchwing(xWhite).png' }
] as const
type Tab = (typeof TABS)[number]['id']
type Sort = 'name' | 'price-high' | 'price-low' | 'weapon'
const btn =
  'rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-sm font-medium text-slate-200'

// Inventory rivens: Upgrades entries under /Randomized/ whose fingerprint names the weapon
// ("compat"). Veiled rivens have no compat. Format from community tools; unverified live.
function inventoryRivenCounts(upgrades: unknown): Map<string, number> {
  const m = new Map<string, number>()
  if (!Array.isArray(upgrades)) return m
  for (const u of upgrades as { ItemType?: string; UpgradeFingerprint?: string }[]) {
    if (!u.ItemType?.includes('/Randomized/') || !u.UpgradeFingerprint) continue
    try {
      const fp = JSON.parse(u.UpgradeFingerprint) as { compat?: string }
      if (fp.compat) m.set(fp.compat, (m.get(fp.compat) ?? 0) + 1)
    } catch {
      // not a riven fingerprint
    }
  }
  return m
}

const fmt = (a: ContractAttr): string => {
  const sign = a.value > 0 ? '+' : ''
  const unit =
    a.unit === 'percent' ? '%' : a.unit === 'multiply' ? 'x' : a.unit === 'seconds' ? 's' : ''
  return `${sign}${a.value}${unit} ${a.name}`
}

let lastContracts: ContractsResult | null = null // see the result state below

export default function MyContracts({
  onOpenSettings
}: {
  onOpenSettings: () => void
}): React.JSX.Element {
  const inv = useInventory()
  // the last result of this session shows at once when you come back; the live one replaces it
  const [result, setResult] = useState<ContractsResult | null>(lastContracts)
  useEffect(() => {
    if (result) lastContracts = result
  }, [result])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [tab, setTab] = usePersisted<Tab>('MyContracts.tab', 'all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = usePersisted<Sort>('MyContracts.sort', 'name')
  const [showFilters, setShowFilters] = useState(false)
  const [kind, setKind] = useState<'all' | 'direct' | 'auction'>('all')
  const [vis, setVis] = useState<'all' | 'visible' | 'hidden'>('all')
  const [onlyMissing, setOnlyMissing] = useState(false)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)
  const [listing, setListing] = useState(false)
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState<string | null>(null) // progress text while a bulk run goes
  const [notice, setNotice] = useState<string | null>(null)
  // synchronous twin of busyIds: state is stale inside a double-click, a ref is not
  const busyRef = useRef(new Set<string>())
  const bulkRef = useRef(false)
  const setBusy = (id: string, on: boolean): void => {
    if (on) busyRef.current.add(id)
    else busyRef.current.delete(id)
    setBusyIds(new Set(busyRef.current))
  }

  const load = (): void => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  // Runs one contract action; on success applies the change to the local list. Returns ok.
  const act = async (
    id: string,
    call: () => Promise<{ ok: boolean; error?: string }>,
    apply: (list: Contract[]) => Contract[]
  ): Promise<boolean> => {
    if (busyRef.current.has(id)) return false
    setBusy(id, true)
    setNotice(null)
    const r = await call().catch(() => ({ ok: false, error: 'Something went wrong.' }))
    setBusy(id, false)
    if (!r.ok) {
      setNotice(r.error ?? 'That did not work.')
      return false
    }
    setResult((p) => (p ? { ...p, contracts: apply(p.contracts) } : p))
    return true
  }
  const remove = (c: Contract): Promise<boolean> =>
    act(
      c.id,
      () => window.api.removeContract(c.id),
      (l) => l.filter((x) => x.id !== c.id)
    )
  const askRemove = async (c: Contract): Promise<void> => {
    if (
      await confirmBox({
        title: 'Delete contract',
        message: `Remove ${c.weapon} ${c.name} from warframe.market? This deletes the contract there.`,
        confirm: 'Delete',
        danger: true
      })
    )
      void remove(c)
  }

  const bulkShow = async (visible: boolean): Promise<void> => {
    setBulkOpen(false)
    if (bulkRef.current || busyRef.current.size) return
    bulkRef.current = true
    setBulkBusy(visible ? 'Showing all contracts…' : 'Hiding all contracts…')
    setNotice(null)
    const r = await window.api.setAllContractsVisible(visible).catch(() => null)
    bulkRef.current = false
    setBulkBusy(null)
    if (!r?.ok) return setNotice(r?.error ?? 'Something went wrong.')
    setResult((p) => (p ? { ...p, contracts: p.contracts.map((c) => ({ ...c, visible })) } : p))
  }
  const bulkRemove = async (list: Contract[], what: string): Promise<void> => {
    setBulkOpen(false)
    if (!list.length) return setNotice(`No ${what} to remove.`)
    if (bulkRef.current) return
    if (
      !(await confirmBox({
        title: `Remove ${what}`,
        message: `Remove ${list.length} ${what} from warframe.market? This deletes them there and cannot be undone.`,
        confirm: `Remove ${list.length}`,
        danger: true
      }))
    )
      return
    if (bulkRef.current) return // another bulk run started while the box was open
    bulkRef.current = true
    setNotice(null)
    let done = 0
    for (const c of list) {
      if (busyRef.current.has(c.id)) continue // a single action is on it
      setBulkBusy(`Removing ${++done} of ${list.length}…`)
      busyRef.current.add(c.id)
      const r = await window.api.removeContract(c.id).catch(() => null)
      busyRef.current.delete(c.id)
      if (!r?.ok) {
        setNotice(
          `Stopped after ${done - 1} of ${list.length}: ${r?.error ?? 'Something went wrong.'}`
        )
        break
      }
      setResult((p) => (p ? { ...p, contracts: p.contracts.filter((x) => x.id !== c.id) } : p))
    }
    bulkRef.current = false
    setBulkBusy(null)
  }
  useEffect(() => {
    let alive = true
    let fresh = false
    // the saved copy shows at once; the download replaces it when it arrives
    void window.api
      .getSavedContracts()
      .then((saved) => {
        if (alive && !fresh && saved) setResult((cur) => cur ?? saved)
      })
      .catch(() => {})
    window.api
      .getMyContracts()
      .then((r) => {
        fresh = true
        // a failed download keeps showing the saved list
        if (alive) setResult((cur) => (r.ok || !cur?.contracts.length ? r : cur))
      })
      .catch(
        () =>
          alive &&
          // keep a shown saved list rather than an empty error screen
          setResult((cur) =>
            cur?.contracts.length
              ? cur
              : { ok: false, contracts: [], error: 'Something went wrong loading contracts.' }
          )
      )
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const contracts = useMemo(() => result?.contracts ?? [], [result])
  const haveInventory = Boolean(inv.data)

  // A contract is "not found" when you list more rivens for a weapon than your inventory holds.
  const missingIds = useMemo(() => {
    const out = new Set<string>()
    if (!haveInventory) return out
    const owned = inventoryRivenCounts(inv.data?.raw?.Upgrades)
    const used = new Map<string, number>()
    for (const c of contracts) {
      if (!c.weaponRef) continue
      const n = (used.get(c.weaponRef) ?? 0) + 1
      used.set(c.weaponRef, n)
      if (n > (owned.get(c.weaponRef) ?? 0)) out.add(c.id)
    }
    return out
  }, [contracts, inv.data, haveInventory])

  // riven catalog / values / grade sheet / weapons: loaded once here, shared by the dialogs
  const [shared, setShared] = useState<Shared | null>(null)
  useEffect(() => {
    let live = true
    Promise.all([
      window.api.getRivenCatalog(),
      window.api.getRivenData(),
      window.api.getRivenGrades(),
      cache.masteryCatalog()
    ])
      .then(
        ([cat, data, rules, m]) =>
          live && setShared({ cat, data, rules, weapons: weaponLookup(m.items) })
      )
      .catch(
        () =>
          live &&
          setShared({
            cat: { weapons: {}, attrs: {} },
            data: { values: {}, affix: {} },
            rules: {},
            weapons: new Map()
          })
      )
    return () => {
      live = false
    }
  }, [])
  const rivens = useMemo(() => parseRivens(inv.data?.raw ?? {}).unveiled, [inv.data])
  const owned = useMemo(() => ownedWeapons(inv.data?.raw ?? {}), [inv.data])
  // each contract's inventory riven, and whether its listed stats are out of date
  const matches = useMemo(() => {
    const m = new Map<string, { riven: Riven; stale: ReturnType<typeof staleStats> }>()
    if (!shared) return m
    for (const c of contracts) {
      const riven = matchContractRiven(c, rivens)
      if (riven) m.set(c.id, { riven, stale: staleStats(c, riven, shared.cat, shared.data) })
    }
    return m
  }, [contracts, rivens, shared])

  // Relist: wfm cannot change a listing's riven. Create the new listing first; only then remove
  // the old one. Returns an error text for the popup, 'cancelled', or undefined when done.
  const relist = async (c: Contract, item: ContractItem): Promise<string | undefined> => {
    if (busyRef.current.has(c.id)) return 'cancelled'
    setBusy(c.id, true) // before the box opens, so a second relist cannot pass the guard
    if (
      !(await confirmBox({
        title: 'Relist with current stats',
        message: (
          <>
            A new listing for{' '}
            <b>
              {c.weapon} {c.name}
            </b>{' '}
            is created with the riven&apos;s current stats, keeping your price, minimal reputation,
            note and visibility. Then the old listing is removed.
          </>
        ),
        confirm: 'Relist'
      }))
    ) {
      setBusy(c.id, false)
      return 'cancelled'
    }
    const free = (): void => setBusy(c.id, false)
    setNotice(null)
    const start = c.startingPrice ?? c.price
    const create = await window.api
      .createContract({
        item,
        starting_price: start,
        buyout_price: c.directSale ? (c.buyoutPrice ?? start) : (c.buyoutPrice ?? null),
        minimal_reputation: c.minRep ?? 0,
        note: c.note ?? '',
        visible: c.visible
      })
      .catch(() => ({ ok: false, error: 'Something went wrong.' }))
    if (!create.ok) {
      free()
      return create.error ?? 'That did not work.'
    }
    const del = await window.api.removeContract(c.id).catch(() => ({ ok: false }))
    free()
    if (!del.ok)
      setNotice('New listing created, but the old one could not be removed. Remove it manually.')
    setEditing(null)
    load()
    return undefined
  }

  const direct = contracts.filter((c) => c.directSale).length
  const visibleCount = contracts.filter((c) => c.visible).length

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return contracts
      .filter((c) => tab === 'all' || c.rivenType === tab)
      .filter(
        (c) =>
          !q ||
          c.weapon.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.attributes.some((a) => a.name.toLowerCase().includes(q))
      )
      .filter((c) => kind === 'all' || (kind === 'direct') === c.directSale)
      .filter((c) => vis === 'all' || (vis === 'visible') === c.visible)
      .filter((c) => !onlyMissing || missingIds.has(c.id))
      .sort((a, b) =>
        sort === 'price-high'
          ? b.price - a.price
          : sort === 'price-low'
            ? a.price - b.price
            : sort === 'weapon'
              ? a.weapon.localeCompare(b.weapon)
              : `${a.weapon} ${a.name}`.localeCompare(`${b.weapon} ${b.name}`)
      )
  }, [contracts, tab, query, kind, vis, onlyMissing, missingIds, sort])

  if (result && !result.ok) {
    const needsLink =
      result.error?.startsWith('Link your') || result.error?.includes('profile name')
    return (
      <div className="p-6 text-slate-100">
        <h1 className="mb-3 text-2xl font-bold">My contracts</h1>
        <div className="rounded-xl border border-dashed border-slate-600 p-6 text-sm text-slate-300">
          <p className="mb-3">{result.error}</p>
          <button
            onClick={needsLink ? onOpenSettings : load}
            className="rounded-lg border border-slate-600 px-3 py-1.5 hover:bg-slate-700"
          >
            {needsLink ? 'Open settings' : 'Try again'}
          </button>
        </div>
      </div>
    )
  }

  const filterCount = (kind !== 'all' ? 1 : 0) + (vis !== 'all' ? 1 : 0) + (onlyMissing ? 1 : 0)
  const chip = (active: boolean): string =>
    `rounded-lg px-3 py-1 text-xs ${active ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`

  return (
    <div className="p-5 text-slate-100">
      {/* header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My contracts</h1>
        <div className="relative flex gap-2">
          <button
            onClick={() => setBulkOpen(!bulkOpen)}
            disabled={!!bulkBusy}
            className={`${btn} hover:bg-slate-800 disabled:opacity-50 ${bulkOpen ? 'border-violet-400' : ''}`}
          >
            ☰ Bulk actions
          </button>
          <button
            onClick={() => setListing(true)}
            className={`${btn} border-violet-400/50 hover:bg-slate-800`}
          >
            + List a Riven
          </button>
          {bulkOpen && (
            <div className="absolute top-11 right-28 z-20 w-80 rounded-xl border border-slate-600 bg-slate-900 p-4 shadow-xl">
              <div className="mb-1 flex items-center justify-between">
                <b>All contracts</b>
                <button
                  onClick={() => setBulkOpen(false)}
                  className="rounded-lg border border-slate-600 px-2 py-0.5 hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>
              <p className="mb-3 text-xs text-slate-400">
                Includes listings outside your current filters
              </p>
              {/* the refs are only read when a button is clicked, not while rendering */}
              {/* eslint-disable react-hooks/refs */}
              {(
                [
                  ['◉ Show all contracts', '', () => bulkShow(true)],
                  ['◌ Hide all contracts', '', () => bulkShow(false)],
                  [
                    '⚠ Remove missing Rivens',
                    '',
                    () =>
                      bulkRemove(
                        contracts.filter((c) => missingIds.has(c.id)),
                        'missing contracts'
                      )
                  ],
                  [
                    '⌫ Remove all contracts',
                    'text-red-400',
                    () => bulkRemove(contracts, 'contracts')
                  ]
                ] as [string, string, () => Promise<void>][]
              )
                /* eslint-enable react-hooks/refs */
                .map(([label, cls, run]) => (
                  <button
                    key={label}
                    onClick={() => void run()}
                    className={`flex w-full items-center justify-between py-2 text-sm hover:bg-slate-800 ${cls}`}
                  >
                    <span>{label}</span>
                    <span>›</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
      {bulkBusy && <div className="mb-2 text-sm text-violet-300">{bulkBusy}</div>}
      {notice && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-rose-300 hover:text-rose-100">
            ✕
          </button>
        </div>
      )}

      {/* summary */}
      <div className="mb-3">
        <NcCard title={'All contracts'}>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-2.5 text-sm">
            <div>
              <div className="nc-name font-semibold">All contracts</div>
              <div className="text-xs text-slate-400">Summary of results below</div>
            </div>
            <span>
              <span className="rounded border border-violet-400/40 bg-violet-500/15 px-1.5 py-0.5 text-xs text-violet-200">
                Direct sales
              </span>{' '}
              <b className="ml-1 text-lg">{direct}</b>
            </span>
            <span>
              <span className="rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-200">
                Auctions
              </span>{' '}
              <b className="ml-1 text-lg">{contracts.length - direct}</b>
            </span>
            <span className="ml-auto text-slate-300">
              ◉ <b>{visibleCount}</b> visible, <b>{contracts.length - visibleCount}</b> hidden
            </span>
            {missingIds.size > 0 && (
              <button
                onClick={() => setOnlyMissing(!onlyMissing)}
                className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200"
              >
                ⚠ {missingIds.size} Riven{missingIds.size > 1 ? 's' : ''} not found
              </button>
            )}
            <button onClick={load} title="Reload" className={`${btn} hover:bg-slate-800`}>
              ↻
            </button>
          </div>
        </NcCard>
      </div>

      {/* tabs + tools */}
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-700/60 pb-2">
        {/* only weapon types you have contracts for (and the open tab), each with its count */}
        {TABS.map((t) => ({
          ...t,
          n:
            t.id === 'all' ? contracts.length : contracts.filter((c) => c.rivenType === t.id).length
        }))
          .filter((t) => t.id === 'all' || t.n > 0 || tab === t.id)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${tab === t.id ? 'border border-violet-400/60 bg-violet-500/20 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <WikiIcon file={t.icon} title={t.label} color="currentColor" size={18} />
              {t.label}
              <span className="text-xs text-slate-400">{t.n}</span>
            </button>
          ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-sm">
            <span className="text-slate-400">⌕</span>
            <input
              className="w-32 bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-400 hover:text-white">
                ✕
              </button>
            )}
          </div>
          <Dropdown
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={[
              { value: 'name', label: 'Name' },
              { value: 'weapon', label: 'Weapon' },
              { value: 'price-high', label: 'Price: high to low' },
              { value: 'price-low', label: 'Price: low to high' }
            ]}
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`${btn} hover:bg-slate-800 ${showFilters ? 'border-violet-400/60' : ''}`}
          >
            ⧩ Filters{filterCount ? ` (${filterCount})` : ''}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-3 flex flex-wrap gap-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-sm">
          <div>
            <div className="mb-1 text-slate-400">Type</div>
            <div className="flex gap-1">
              {(['all', 'direct', 'auction'] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)} className={chip(kind === k)}>
                  {k === 'all' ? 'All' : k === 'direct' ? 'Direct sale' : 'Auction'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-slate-400">Visibility</div>
            <div className="flex gap-1">
              {(['all', 'visible', 'hidden'] as const).map((k) => (
                <button key={k} onClick={() => setVis(k)} className={chip(vis === k)}>
                  {k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-slate-400">Inventory</div>
            <button onClick={() => setOnlyMissing(!onlyMissing)} className={chip(onlyMissing)}>
              Not found only
            </button>
          </div>
        </div>
      )}

      {loading && !result ? (
        <div className="py-20 text-center text-slate-400">Loading contracts…</div>
      ) : shown.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          {contracts.length ? 'No contracts match your filters.' : 'You have no Riven contracts.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <NcCard key={c.id} title={c.weapon}>
              <div className="flex flex-col rounded-xl border border-slate-700 bg-slate-800/50">
                <div className="flex items-start gap-3 p-3">
                  <Pic src={c.weaponIcon} size={48} letter={c.weapon[0]} />
                  <div className="min-w-0 flex-1">
                    <div className="nc-name text-xs text-slate-300">{c.weapon}</div>
                    <div className="truncate text-lg font-semibold">{c.name}</div>
                  </div>
                  <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-600 text-xs">
                    {([false, true] as const).map((v) => (
                      <button
                        key={String(v)}
                        disabled={busyIds.has(c.id) || !!bulkBusy}
                        onClick={() =>
                          c.visible !== v &&
                          void act(
                            c.id,
                            () => window.api.updateContract(c.id, { visible: v }),
                            (l) => l.map((x) => (x.id === c.id ? { ...x, visible: v } : x))
                          )
                        }
                        className={`px-2.5 py-1.5 disabled:opacity-50 ${
                          c.visible === v
                            ? v
                              ? 'bg-emerald-500/25 text-emerald-100'
                              : 'bg-rose-500/25 text-rose-100'
                            : 'text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {v ? 'Shown' : 'Hidden'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border-y border-slate-700 bg-slate-900/40 px-3 py-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-xs ${c.directSale ? 'border-violet-400/40 bg-violet-500/15 text-violet-200' : 'border-amber-400/40 bg-amber-500/15 text-amber-200'}`}
                  >
                    {c.directSale ? 'Direct sale' : 'Auction'}
                  </span>
                  {c.directSale ? (
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Price</div>
                      <b className="flex items-center justify-end gap-1 text-lg">
                        {c.price} <PlatIcon />
                      </b>
                    </div>
                  ) : (
                    // auctions: what bidding started at, the buyout if any, and the best bid so far
                    <div className="text-right text-xs text-slate-400">
                      <div>
                        Start <b className="text-slate-100">{c.startingPrice ?? c.price}</b>
                        {c.buyoutPrice != null && (
                          <>
                            {' · '}Buyout <b className="text-slate-100">{c.buyoutPrice}</b>
                          </>
                        )}
                      </div>
                      <b className="flex items-center justify-end gap-1 text-lg text-slate-100">
                        {c.topBid != null ? (
                          <>
                            Top bid {c.topBid} <PlatIcon />
                          </>
                        ) : (
                          <span className="text-sm font-normal text-slate-400">No bids yet</span>
                        )}
                      </b>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1 px-3 py-3 text-sm">
                  {c.attributes.map((a) => (
                    <div key={a.name} className={a.positive ? 'text-slate-100' : 'text-rose-300'}>
                      {fmt(a)}
                    </div>
                  ))}
                  <div className="pt-1 text-xs text-slate-400">
                    {[
                      c.mastery != null && `MR ${c.mastery}`,
                      c.rank != null && `Rank ${c.rank}`,
                      c.rerolls != null && `${c.rerolls} rolls`,
                      c.polarity
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {missingIds.has(c.id) && (
                  <div className="border-t border-slate-700 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                    ⚠ Not found in your inventory
                  </div>
                )}
                {matches.get(c.id)?.stale.stale && (
                  <div
                    title="The riven's stats changed after it was listed (a disposition change). warframe.market cannot edit a listing's riven; open Details to relist it."
                    className="border-t border-slate-700 bg-amber-500/5 px-3 py-2 text-xs text-amber-200"
                  >
                    ⚠ Listed stats are out of date
                  </div>
                )}
                <div className="flex items-center gap-2 border-t border-slate-700 p-3">
                  <button
                    onClick={() => setEditing(c)}
                    disabled={busyIds.has(c.id) || !!bulkBusy}
                    className={`${btn} hover:bg-slate-800 disabled:opacity-50`}
                  >
                    ✎ Details & edit
                  </button>
                  <a
                    href={`https://warframe.market/auction/${encodeURIComponent(c.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`${btn} hover:bg-slate-800`}
                  >
                    ↗ Website
                  </a>
                  <button
                    onClick={() => askRemove(c)}
                    disabled={busyIds.has(c.id) || !!bulkBusy}
                    title="Remove from warframe.market"
                    className={`${btn} ml-auto flex items-center gap-1.5 text-red-400 hover:bg-slate-800 disabled:opacity-50`}
                  >
                    <Icon name="trash" /> Delete
                  </button>
                </div>
              </div>
            </NcCard>
          ))}
        </div>
      )}
      {editing && (
        <ContractDetail
          c={editing}
          shared={shared}
          owned={owned}
          match={matches.get(editing.id)}
          onRelist={relist}
          onClose={() => setEditing(null)}
          onSave={async (change) => {
            const ok = await act(
              editing.id,
              () => window.api.updateContract(editing.id, change),
              (l) =>
                l.map((x) => {
                  if (x.id !== editing.id) return x
                  const startingPrice = change.starting_price ?? x.startingPrice
                  const buyoutPrice =
                    change.buyout_price === undefined
                      ? x.buyoutPrice
                      : (change.buyout_price ?? undefined)
                  return {
                    ...x,
                    visible: change.visible ?? x.visible,
                    startingPrice,
                    buyoutPrice,
                    price: buyoutPrice ?? startingPrice ?? x.price,
                    minRep: change.minimal_reputation ?? x.minRep,
                    note: change.note ?? x.note
                  }
                })
            )
            if (ok) setEditing(null)
          }}
        />
      )}
      {listing && (
        <ListDialog
          cat={shared?.cat ?? null}
          data={shared?.data ?? null}
          onClose={() => setListing(false)}
          onCreated={() => {
            setListing(false)
            load()
          }}
        />
      )}
    </div>
  )
}

type Catalog = Awaited<ReturnType<typeof window.api.getRivenCatalog>>
type RivenData = Awaited<ReturnType<typeof window.api.getRivenData>>
type Shared = {
  cat: Catalog
  data: RivenData
  rules: Awaited<ReturnType<typeof window.api.getRivenGrades>>
  weapons: Map<string, MasteryItem>
}
const input = 'rounded-md bg-slate-900 px-2 py-1 ring-1 ring-slate-600'
const whole = (s: string): number | null =>
  /^\d+$/.test(s.trim()) && Number(s) > 0 ? Number(s) : null

function Dialog({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  useEffect(() => {
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        className="nc-dialog-card flex max-h-full w-full max-w-xl flex-col rounded-lg bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* the title lives in the card's tab only; × sits in the corner */}
        <NcCard title={title} className="min-h-0 flex-1">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-5 text-sm">
            <button
              onClick={onClose}
              aria-label="Close"
              className="nc-quiet absolute top-2 right-3 text-xl text-slate-400 hover:text-white"
            >
              ×
            </button>
            {children}
          </div>
        </NcCard>
      </div>
    </div>
  )
}

// Price fields used by the list dialog. Direct sale: one price for both.
function PriceFields({
  direct,
  start,
  setStart,
  buyout,
  setBuyout,
  noBuyout,
  setNoBuyout,
  rep,
  setRep,
  note,
  setNote
}: {
  direct: boolean
  start: string
  setStart: (v: string) => void
  buyout: string
  setBuyout: (v: string) => void
  noBuyout: boolean
  setNoBuyout: (v: boolean) => void
  rep: string
  setRep: (v: string) => void
  note: string
  setNote: (v: string) => void
}): React.JSX.Element {
  // labels above the fields, prices side by side; the note is optional and secondary
  const label = 'mb-1 block text-xs text-slate-400'
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label>
          <span className={label}>{direct ? 'Price' : 'Starting price'}</span>
          <span className="flex items-center gap-2">
            <input
              value={start}
              inputMode="numeric"
              autoFocus
              onChange={(e) => setStart(e.target.value)}
              className={`${input} w-full text-base font-semibold`}
            />
            <PlatIcon size={16} />
          </span>
        </label>
        {direct ? (
          <label>
            <span className={label}>Minimal reputation</span>
            <input
              value={rep}
              inputMode="numeric"
              onChange={(e) => setRep(e.target.value)}
              className={`${input} w-full`}
            />
          </label>
        ) : (
          <div>
            <span className={label}>Buyout price</span>
            <span className="flex items-center gap-2">
              <input
                value={buyout}
                inputMode="numeric"
                disabled={noBuyout}
                onChange={(e) => setBuyout(e.target.value)}
                className={`${input} w-full disabled:opacity-40`}
              />
              <PlatIcon size={16} />
            </span>
            <label className="mt-1 flex items-center gap-1 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={noBuyout}
                onChange={(e) => setNoBuyout(e.target.checked)}
              />
              No buyout
            </label>
          </div>
        )}
      </div>
      {!direct && (
        <label className="block w-1/2 pr-2">
          <span className={label}>Minimal reputation</span>
          <input
            value={rep}
            inputMode="numeric"
            onChange={(e) => setRep(e.target.value)}
            className={`${input} w-full`}
          />
        </label>
      )}
      <label className="block">
        <span className={label}>
          Note <span className="text-slate-400">(optional, {note.length}/500)</span>
        </span>
        <textarea
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-md bg-slate-900 px-2 py-1 ring-1 ring-slate-600"
        />
      </label>
    </div>
  )
}

// Validates the price fields; returns the request fields or an error text.
function readPrices(p: {
  direct: boolean
  start: string
  buyout: string
  noBuyout: boolean
  rep: string
}): { starting_price: number; buyout_price: number | null; minimal_reputation: number } | string {
  const s = whole(p.start)
  if (s == null) return 'Enter a whole number above 0 for the price.'
  const rep = p.rep.trim() === '' ? 0 : /^\d+$/.test(p.rep.trim()) ? Number(p.rep) : null
  if (rep == null) return 'Minimal reputation must be a whole number (0 or more).'
  if (p.direct) return { starting_price: s, buyout_price: s, minimal_reputation: rep }
  if (p.noBuyout) return { starting_price: s, buyout_price: null, minimal_reputation: rep }
  const b = whole(p.buyout)
  if (b == null) return 'Enter a whole number above 0 for the buyout, or tick "no buyout".'
  if (b < s) return 'The buyout cannot be lower than the starting price.'
  return { starting_price: s, buyout_price: b, minimal_reputation: rep }
}

type Change = Parameters<typeof window.api.updateContract>[1]
const sect = 'rounded-xl border border-slate-700 bg-slate-800/50 p-4'
const flabel = 'mb-1 block text-xs text-slate-400'

// "Details & edit": the Rivens tab's detail popup for the riven behind this contract, with the
// listing form and similar listings below. No inventory match (sold, traded, inventory not loaded):
// the same popup built from the contract data alone (header and stats, no roll bars).
function ContractDetail({
  c,
  shared,
  owned,
  match,
  onRelist,
  onClose,
  onSave
}: {
  c: Contract
  shared: Shared | null
  owned: Set<string>
  match?: { riven: Riven; stale: ReturnType<typeof staleStats> }
  onRelist: (c: Contract, item: ContractItem) => Promise<string | undefined>
  onClose: () => void
  onSave: (change: Change) => Promise<void>
}): React.JSX.Element | null {
  if (!shared) return null
  const { data, rules, weapons } = shared
  const view = rivenView(weapons, owned, rules)
  const found = match?.riven
  // without roll data the matched riven cannot show its bars either: reduced form
  const exact = found && Object.keys(data.values).length > 0 ? found : undefined
  // game tags where the stat name maps (so grade and recommended chips work without an inventory riven)
  const melee = /^(melee|zaw)$/.test(c.rivenType)
  const tags = (positive: boolean): string[] =>
    c.attributes.filter((a) => a.positive === positive).map((a) => tagOf(a.name, melee) ?? a.name)
  const names = (positive: boolean): string[] =>
    c.attributes.filter((a) => a.positive === positive).map((a) => a.name)
  const riven: Riven = exact ?? {
    id: c.id,
    type: c.rivenType.charAt(0).toUpperCase() + c.rivenType.slice(1),
    weapon: c.weaponRef ?? '',
    rank: c.rank ?? 0,
    mr: c.mastery ?? 0,
    rerolls: c.rerolls ?? 0,
    polarity: c.polarity,
    buffs: names(true),
    curses: names(false),
    buffTags: tags(true),
    curseTags: tags(false),
    buffRolls: [],
    curseRolls: [],
    itemType: ''
  }
  // stat text per row, buffs then curses (RivenDetail's order)
  const flat = exact
    ? undefined
    : [...c.attributes.filter((a) => a.positive), ...c.attributes.filter((a) => !a.positive)].map(
        (a) => fmt(a).split(' ')[0]
      )
  return (
    <RivenDetail
      riven={riven}
      weapon={c.weapon}
      image={c.weaponIcon ?? (exact ? view.shownOf(exact)?.imageName : undefined)}
      name={c.name}
      grade={view.gradeOf(riven)}
      rule={view.ruleOf(riven) ?? rules[c.weapon.toLowerCase()]}
      data={data}
      flat={flat}
      onClose={onClose}
    >
      {exact && match?.stale.stale && match.stale.item && (
        <RelistNotice c={c} stale={match.stale} onRelist={onRelist} />
      )}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ListingForm c={c} onClose={onClose} onSave={onSave} />
        <SimilarListings c={c} />
      </div>
    </RivenDetail>
  )
}

function RelistNotice({
  c,
  stale,
  onRelist
}: {
  c: Contract
  stale: ReturnType<typeof staleStats>
  onRelist: (c: Contract, item: ContractItem) => Promise<string | undefined>
}): React.JSX.Element {
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const d = stale.diffs.find((x) => x.listed !== undefined && x.now !== undefined)
  const show = (v: number, unit?: string): string =>
    unit === 'multiply' ? `x${v}` : `${v > 0 ? '+' : ''}${v}${unit === 'percent' ? '%' : ''}`
  return (
    <div className="mt-4 rounded-xl border border-amber-400/50 bg-amber-500/10 p-4 text-sm text-amber-100">
      <p>
        Your listing shows older stats
        {d && ` (e.g. ${show(d.listed!, d.unit)} ${d.name}, now ${show(d.now!, d.unit)})`}.
        warframe.market can&apos;t change a listing&apos;s riven, so it has to be listed again.
      </p>
      {err && <p className="mt-2 text-rose-300">{err}</p>}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const e = await onRelist(c, stale.item!)
          setBusy(false)
          if (e && e !== 'cancelled') setErr(e)
        }}
        className="mt-3 rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Relisting…' : 'Relist with current stats'}
      </button>
    </div>
  )
}

function ListingForm({
  c,
  onClose,
  onSave
}: {
  c: Contract
  onClose: () => void
  onSave: (change: Change) => Promise<void>
}): React.JSX.Element {
  const [visible, setVisible] = useState(c.visible)
  const [start, setStart] = useState(String(c.startingPrice ?? c.price))
  const [buyout, setBuyout] = useState(String(c.buyoutPrice ?? ''))
  const [noBuyout, setNoBuyout] = useState(!c.directSale && c.buyoutPrice == null)
  const [rep, setRep] = useState(String(c.minRep ?? 0))
  const [note, setNote] = useState(c.note ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const save = async (): Promise<void> => {
    const p = readPrices({ direct: c.directSale, start, buyout, noBuyout, rep })
    if (typeof p === 'string') return setErr(p)
    setErr(null)
    const change: Change = {}
    if (visible !== c.visible) change.visible = visible
    // the two prices go together (a direct sale keeps them equal)
    if (
      p.starting_price !== (c.startingPrice ?? c.price) ||
      p.buyout_price !== (c.buyoutPrice ?? null)
    ) {
      change.starting_price = p.starting_price
      change.buyout_price = p.buyout_price
    }
    if (p.minimal_reputation !== (c.minRep ?? 0)) change.minimal_reputation = p.minimal_reputation
    if (note !== (c.note ?? '')) change.note = note
    if (!Object.keys(change).length) return onClose()
    setSaving(true)
    await onSave(change)
    setSaving(false)
  }
  return (
    <div className={sect}>
      <div className="mb-3 font-semibold">warframe.market listing</div>
      {/* Enter saves from any field but the note (where it adds a line); Escape closes the popup */}
      <div
        className="space-y-4 text-sm"
        onKeyDown={(e) =>
          e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && void save()
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className={flabel}>Listing type</span>
            <span
              title="The type cannot be changed on warframe.market"
              className={`rounded border px-1.5 py-0.5 text-xs ${c.directSale ? 'border-violet-400/40 bg-violet-500/15 text-violet-200' : 'border-amber-400/40 bg-amber-500/15 text-amber-200'}`}
            >
              {c.directSale ? 'Direct sale' : 'Auction'}
            </span>
          </div>
          <div className="text-right">
            <span className={flabel}>Visibility</span>
            <button
              role="switch"
              aria-checked={visible}
              onClick={() => setVisible(!visible)}
              className={`nc-quiet rounded-full border px-3 py-0.5 text-xs ${visible ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100' : 'border-slate-600 bg-slate-900 text-slate-300'}`}
            >
              {visible ? 'Visible' : 'Hidden'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label>
            <span className={flabel}>{c.directSale ? 'Price' : 'Starting price'}</span>
            <span className="flex items-center gap-2">
              <input
                value={start}
                inputMode="numeric"
                onChange={(e) => setStart(e.target.value)}
                className={`${input} w-full text-base font-semibold`}
              />
              <PlatIcon size={16} />
            </span>
          </label>
          {!c.directSale && (
            <div>
              <span className={flabel}>Buyout price</span>
              <span className="flex items-center gap-2">
                <input
                  value={buyout}
                  inputMode="numeric"
                  disabled={noBuyout}
                  onChange={(e) => setBuyout(e.target.value)}
                  className={`${input} w-full disabled:opacity-40`}
                />
                <PlatIcon size={16} />
              </span>
              <label className="mt-1 flex items-center gap-1 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={noBuyout}
                  onChange={(e) => setNoBuyout(e.target.checked)}
                />
                No buyout
              </label>
            </div>
          )}
        </div>
        <label className="block w-1/2 pr-2">
          <span className={flabel}>Minimal reputation</span>
          <input
            value={rep}
            inputMode="numeric"
            onChange={(e) => setRep(e.target.value)}
            className={`${input} w-full`}
          />
        </label>
        <label className="block">
          <span className={flabel}>
            Note <span className="text-slate-400">(optional, {note.length}/500)</span>
          </span>
          <textarea
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md bg-slate-900 px-2 py-1 ring-1 ring-slate-600"
          />
        </label>
      </div>
      {err && <p className="mt-3 text-sm text-rose-300">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        {/* nc-quiet: Cancel must not look like the dangerous button */}
        <button onClick={onClose} className={`${btn} nc-quiet hover:bg-slate-700`}>
          Cancel
        </button>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save listing'}
        </button>
      </div>
    </div>
  )
}

// Other listings of this weapon, ranked with the Finder's own match % (this riven's stats as the
// wanted ones) and priced with the Finder's fair price. Loads when the popup opens.
// shortcut: no core-stat narrowing for the typical price (fairPrice's optional core set), add if needed.
function SimilarListings({ c }: { c: Contract }): React.JSX.Element {
  const [st, setSt] = useState<{ list: RivenListing[]; cat: Catalog } | 'err' | null>(null)
  useEffect(() => {
    let live = true
    Promise.all([window.api.searchRivenAuctions(c.weaponSlug), window.api.getRivenCatalog()])
      .then(([list, cat]) => live && setSt({ list, cat }))
      .catch(() => live && setSt('err'))
    return () => {
      live = false
    }
  }, [c.weaponSlug])
  const res = useMemo(() => {
    if (!st || st === 'err') return null
    const slugOf = (n: string): string | undefined =>
      Object.keys(st.cat.attrs).find((s) => st.cat.attrs[s].name === n)
    const mine = c.attributes.map((a) => ({ slug: slugOf(a.name), positive: a.positive }))
    if (mine.some((a) => !a.slug)) return { unknown: true as const }
    const attrs = mine as { slug: string; positive: boolean }[]
    const neg = attrs.find((a) => !a.positive)
    const filter: Filter = {
      pos: attrs.filter((a) => a.positive).map((a) => ({ slug: a.slug, required: false })),
      neg: neg && { slug: neg.slug, required: false },
      minMatch: 60,
      mustNeg: false
    }
    const ranked = st.list
      .filter((l) => l.id !== c.id)
      .flatMap((l) => {
        const m = matchListing(l, filter)
        return m ? [{ l, pct: m.pct }] : []
      })
      .sort((a, b) => b.pct - a.pct || a.l.price - b.l.price)
    return { ranked, typical: fairPrice({ id: c.id, price: c.price, attrs }, st.list) }
  }, [st, c])
  return (
    <div className={sect}>
      <div className="mb-3 font-semibold">Similar on warframe.market</div>
      {st === null ? (
        <p className="text-sm text-slate-400">Loading listings…</p>
      ) : st === 'err' ? (
        <p className="text-sm text-rose-300">Could not load listings from warframe.market.</p>
      ) : res && 'unknown' in res ? (
        <p className="text-sm text-slate-400">Some stats could not be matched for comparison.</p>
      ) : (
        res && (
          <>
            <p className="mb-3 text-sm text-slate-300">
              {res.ranked.length} similar ·{' '}
              {res.typical !== undefined
                ? `typical ${res.typical}p`
                : 'too few similar listings for a typical price'}{' '}
              · yours {c.price}p
            </p>
            <div className="grid grid-cols-2 gap-2">
              {res.ranked.slice(0, 8).map(({ l, pct }) => (
                <div
                  key={l.id}
                  className="rounded-lg border border-slate-700 bg-slate-900/50 p-2 text-xs"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <b className="flex items-center gap-1 text-sm">
                      {l.price} <PlatIcon size={14} />
                    </b>
                    <span className="text-slate-400">{pct}%</span>
                    <a
                      href={`https://warframe.market/auction/${encodeURIComponent(l.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Open on warframe.market"
                      className="nc-quiet text-slate-300 hover:text-white"
                    >
                      ↗
                    </a>
                  </div>
                  {l.attrs.map((a) => (
                    <div key={a.slug} className={a.positive ? 'text-amber-300' : 'text-red-500'}>
                      {fmt(a)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )
      )}
    </div>
  )
}

function ListDialog({
  cat,
  data,
  onClose,
  onCreated
}: {
  cat: Catalog | null
  data: RivenData | null
  onClose: () => void
  onCreated: () => void
}): React.JSX.Element {
  const inv = useInventory()
  const rivens = useMemo(() => parseRivens(inv.data?.raw ?? {}).unveiled, [inv.data])
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [direct, setDirect] = useState(true)
  const [start, setStart] = useState('')
  const [buyout, setBuyout] = useState('')
  const [noBuyout, setNoBuyout] = useState(false)
  const [rep, setRep] = useState('0')
  const [note, setNote] = useState('')
  const [visible, setVisible] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const picked: Riven | undefined = rivens.find((r) => r.id === pickedId)
  const mapped = useMemo(
    () => (picked && cat && data ? toContractItem(picked, cat, data) : null),
    [picked, cat, data]
  )
  const weaponName = (r: Riven): string =>
    Object.values(cat?.weapons ?? {}).find((w) => w.gameRef === r.weapon)?.name ??
    r.weapon.split('/').pop() ??
    '?'

  const create = async (): Promise<void> => {
    if (!mapped?.item) return
    const p = readPrices({ direct, start, buyout, noBuyout, rep })
    if (typeof p === 'string') return setErr(p)
    setErr(null)
    setSaving(true)
    const r = await window.api
      .createContract({ item: mapped.item, ...p, note, visible })
      .catch(() => ({ ok: false, error: 'Something went wrong.' }))
    setSaving(false)
    if (r.ok) onCreated()
    else setErr(r.error ?? 'That did not work.')
  }

  return (
    <Dialog title="List a Riven" onClose={onClose}>
      {!cat || !data || !inv.data ? (
        <p className="text-slate-400">Loading…</p>
      ) : rivens.length === 0 ? (
        <p className="text-slate-400">No unveiled Rivens found in your inventory.</p>
      ) : (
        <>
          <div className="mb-3 max-h-56 space-y-1 overflow-y-auto pr-1">
            {rivens.map((r) => {
              const v = rivenStats(r, data)
              return (
                <button
                  key={r.id}
                  onClick={() => setPickedId(r.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left ${pickedId === r.id ? 'bg-violet-500/25 ring-1 ring-violet-400/60' : 'bg-slate-900/50 hover:bg-slate-700'}`}
                >
                  <b>{weaponName(r)}</b> {rivenName(r, data.affix) ?? `${r.type} riven`}
                  <div className="text-xs text-slate-400">
                    {[...r.buffTags, ...r.curseTags]
                      .map((t, i) => {
                        const n =
                          i < r.buffTags.length ? v.buffs[i] : v.curses[i - r.buffTags.length]
                        return n === undefined ? t : formatStat(t, n)
                      })
                      .join(' · ')}
                  </div>
                </button>
              )
            })}
          </div>
          {picked && mapped && mapped.problems.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-400/50 bg-amber-500/10 p-3 text-amber-200">
              This Riven cannot be listed from here (nothing is guessed):
              <ul className="ml-4 list-disc">
                {mapped.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {picked && mapped?.item && (
            <>
              <div className="mb-3 flex gap-1">
                {[true, false].map((d) => (
                  <button
                    key={String(d)}
                    onClick={() => setDirect(d)}
                    className={`rounded-lg px-3 py-1 text-xs ${direct === d ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {d ? 'Direct sale' : 'Auction'}
                  </button>
                ))}
              </div>
              <PriceFields
                {...{ direct, start, setStart, buyout, setBuyout, noBuyout, setNoBuyout }}
                {...{ rep, setRep, note, setNote }}
              />
              <label className="mt-3 flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                />
                Visible to buyers
              </label>
            </>
          )}
        </>
      )}
      {err && <p className="mt-3 text-rose-300">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className={`${btn} hover:bg-slate-700`}>
          Cancel
        </button>
        <button
          onClick={() => void create()}
          disabled={saving || !mapped?.item}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Listing…' : 'List it'}
        </button>
      </div>
    </Dialog>
  )
}
