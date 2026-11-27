import Dropdown from './Dropdown'
import NcCard from './NcCard'
import { useEffect, useMemo, useState } from 'react'
import { useInventory } from '../hooks/useInventory'
import { usePersisted } from '../hooks/usePersisted'
import PlatIcon from './PlatIcon'
import Pic from './Pic'

// Riven contracts (warframe.market auctions). Read-only for now: Hide/Show, delete, bulk actions,
// List a Riven and Details & edit are shown but disabled until the write routes are tested.
const TABS = [
  { id: 'all', label: 'All', icon: '∞' },
  { id: 'rifle', label: 'Rifle', icon: '⌐' },
  { id: 'shotgun', label: 'Shotgun', icon: '⌐' },
  { id: 'pistol', label: 'Pistol', icon: '⌐' },
  { id: 'melee', label: 'Melee', icon: '⚔' },
  { id: 'kitgun', label: 'Kitgun', icon: '⚙' },
  { id: 'zaw', label: 'Zaw', icon: '⚔' },
  { id: 'archgun', label: 'Arch', icon: '⌐' }
] as const
type Tab = (typeof TABS)[number]['id']
type Sort = 'name' | 'price-high' | 'price-low' | 'weapon'
const OFF = 'Not available yet: changing contracts is read-only until it has been tested'
const btn =
  'rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-sm font-medium text-slate-200'
const off = 'cursor-not-allowed opacity-50'

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

  const load = (): void => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }
  useEffect(() => {
    let alive = true
    window.api
      .getMyContracts()
      .then((r) => alive && setResult(r))
      .catch(
        () =>
          alive &&
          setResult({ ok: false, contracts: [], error: 'Something went wrong loading contracts.' })
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
          <button onClick={load} title="Reload" className={`${btn} hover:bg-slate-800`}>
            ↻
          </button>
          <button
            onClick={() => setBulkOpen(!bulkOpen)}
            className={`${btn} hover:bg-slate-800 ${bulkOpen ? 'border-violet-400' : ''}`}
          >
            ☰ Bulk actions
          </button>
          <button disabled title={OFF} className={`${btn} ${off} border-violet-400/50`}>
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
              {[
                ['◉ Show all contracts', ''],
                ['◌ Hide all contracts', ''],
                ['⚠ Remove missing Rivens', ''],
                ['⌫ Remove all contracts', 'text-red-400']
              ].map(([label, cls]) => (
                <button
                  key={label}
                  disabled
                  title={OFF}
                  className={`flex w-full cursor-not-allowed items-center justify-between py-2 text-sm opacity-50 ${cls}`}
                >
                  <span>{label}</span>
                  <span>›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
          </div>
        </NcCard>
      </div>

      {/* tabs + tools */}
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-700/60 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === t.id ? 'border border-violet-400/60 bg-violet-500/20 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <span className="mr-1 text-slate-400">{t.icon}</span>
            {t.label}
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
                  <div className="flex overflow-hidden rounded-lg border border-slate-600 text-xs">
                    <span
                      className={`px-2.5 py-1.5 ${!c.visible ? 'bg-rose-500/25 text-rose-100' : 'text-slate-400'}`}
                    >
                      Hidden
                    </span>
                    <span
                      className={`px-2.5 py-1.5 ${c.visible ? 'bg-emerald-500/25 text-emerald-100' : 'text-slate-400'}`}
                    >
                      Shown
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-y border-slate-700 bg-slate-900/40 px-3 py-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-xs ${c.directSale ? 'border-violet-400/40 bg-violet-500/15 text-violet-200' : 'border-amber-400/40 bg-amber-500/15 text-amber-200'}`}
                  >
                    {c.directSale ? 'Direct sale' : 'Auction'}
                  </span>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Price</div>
                    <b className="flex items-center gap-1 text-lg">
                      {c.price} <PlatIcon />
                    </b>
                  </div>
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
                <div className="flex items-center gap-2 border-t border-slate-700 p-3">
                  <button disabled title={OFF} className={`${btn} ${off}`}>
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
                    disabled
                    title={OFF}
                    className={`${btn} ${off} ml-auto border-rose-500/50 text-rose-300`}
                  >
                    ⌫
                  </button>
                </div>
              </div>
            </NcCard>
          ))}
        </div>
      )}
    </div>
  )
}
