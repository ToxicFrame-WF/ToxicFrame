import Dropdown from './Dropdown'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useItemMeta } from '../hooks/useItemMeta'
import { useSettings } from '../settings'
import PlatIcon from './PlatIcon'
import Pic from './Pic'

type Tab = 'sell' | 'buy'

const STATUS: Record<string, { label: string; cls: string }> = {
  ingame: { label: 'In game', cls: 'border-violet-400/60 bg-violet-600/25 text-violet-100' },
  online: { label: 'Online', cls: 'border-sky-400/60 bg-sky-600/25 text-sky-100' },
  offline: { label: 'Offline', cls: 'border-slate-500/60 bg-slate-600/25 text-slate-300' }
}

const SearchIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 20 20"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="M13 13l4.5 4.5" />
  </svg>
)
const RefreshIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 20 20"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16.5 8A6.5 6.5 0 0 0 4.7 6M3.5 12a6.5 6.5 0 0 0 11.8 2" />
    <path d="M16.5 3.5V8H12M3.5 16.5V12H8" />
  </svg>
)
const CopyIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 20 20"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinejoin="round"
  >
    <rect x="7" y="7" width="9" height="9" rx="1.5" />
    <path d="M13 4.5V4a1 1 0 0 0-1-1H4.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1H5" />
  </svg>
)

// Right-panel "Buy / Sell" tab: every live order for an item, with a Whisper button that
// copies the usual in-game message to the clipboard.
// The seller's platform, as warframe.market reports it (crossplay lists every platform).
// Console logos are the simple-icons paths (CC0; Xbox from v10, later versions dropped it).
const LOGO: Record<string, { d: string; fill: boolean }> = {
  pc: {
    d: 'M3 4.5h18a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1zM9 21h6M12 17v4',
    fill: false
  },
  xbox: {
    fill: true,
    d: 'M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.002 17.48 24 14.861 24 12.004c0-3.34-1.365-6.362-3.57-8.536 0 0-.027-.022-.082-.042-.063-.022-.152-.045-.281-.045-.592 0-1.985.434-4.805 3.246zM3.654 3.426c-.057.02-.082.041-.086.042C1.365 5.642 0 8.664 0 12.004c0 2.854.998 5.473 2.661 7.533-1.401-2.605 3.579-9.951 6.08-12.91-2.82-2.813-4.216-3.245-4.806-3.245-.131 0-.223.021-.281.046v-.002zM12 3.551S9.055 1.828 6.755 1.746c-.903-.033-1.454.295-1.521.339C7.379.646 9.659 0 11.984 0H12c2.334 0 4.605.646 6.766 2.085-.068-.046-.615-.372-1.52-.339C14.946 1.828 12 3.545 12 3.545v.006z'
  },
  ps4: {
    fill: true,
    d: 'M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z'
  },
  switch: {
    fill: true,
    d: 'M14.176 24h3.674c3.376 0 6.15-2.774 6.15-6.15V6.15C24 2.775 21.226 0 17.85 0H14.1c-.074 0-.15.074-.15.15v23.7c-.001.076.075.15.226.15zm4.574-13.199c1.351 0 2.399 1.125 2.399 2.398 0 1.352-1.125 2.4-2.399 2.4-1.35 0-2.4-1.049-2.4-2.4-.075-1.349 1.05-2.398 2.4-2.398zM11.4 0H6.15C2.775 0 0 2.775 0 6.15v11.7C0 21.226 2.775 24 6.15 24h5.25c.074 0 .15-.074.15-.149V.15c.001-.076-.075-.15-.15-.15zM9.676 22.051H6.15c-2.326 0-4.201-1.875-4.201-4.201V6.15c0-2.326 1.875-4.201 4.201-4.201H9.6l.076 20.102zM3.75 7.199c0 1.275.975 2.25 2.25 2.25s2.25-.975 2.25-2.25c0-1.273-.975-2.25-2.25-2.25s-2.25.977-2.25 2.25z'
  },
  mobile: {
    d: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
    fill: false
  }
}
const PLATFORMS: Record<string, { label: string; cls: string }> = {
  pc: { label: 'PC', cls: 'border-teal-500/50 bg-teal-700/20 text-teal-200' },
  xbox: { label: 'XB', cls: 'border-green-500/50 bg-green-700/20 text-green-200' },
  ps4: { label: 'PS', cls: 'border-blue-500/50 bg-blue-700/20 text-blue-200' },
  switch: { label: 'NS', cls: 'border-red-500/50 bg-red-700/20 text-red-200' },
  mobile: { label: 'Mobile', cls: 'border-slate-500/50 bg-slate-700/30 text-slate-200' }
}
function PlatformBadge({ platform = 'pc' }: { platform?: string }): React.JSX.Element {
  const p = PLATFORMS[platform] ?? { label: platform, cls: PLATFORMS.mobile.cls }
  const logo = LOGO[platform]
  return (
    <span className={`flex items-center gap-1 rounded border px-1.5 text-[10px] ${p.cls}`}>
      {logo && (
        <svg
          viewBox="0 0 24 24"
          width={11}
          height={11}
          aria-hidden
          fill={logo.fill ? 'currentColor' : 'none'}
          stroke={logo.fill ? 'none' : 'currentColor'}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={logo.d} />
        </svg>
      )}
      {p.label}
    </span>
  )
}

export default function BuySell({
  initialSlug,
  initialRank
}: {
  initialSlug?: string
  initialRank?: number
}): React.JSX.Element {
  const meta = useItemMeta()
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [slug, setSlug] = useState<string | null>(initialSlug ?? null)
  const [searching, setSearching] = useState(false)
  const [loaded, setLoaded] = useState<{
    slug: string
    key: string
    orders: ItemOrders | null
  } | null>(null)
  const [reload, setReload] = useState(0)
  // chosen rank for mods and arcanes; only counts for the item it was chosen on
  const [rankSel, setRankSel] = useState<{ slug: string | null; rank: number | 'all' }>({
    slug: initialSlug ?? null,
    rank: initialRank ?? 'all'
  })
  const [tab, setTab] = useState<Tab>('sell')
  const [copied, setCopied] = useState('')
  const searchBox = useRef<HTMLInputElement>(null)
  // "post order" bar; empty fields fall back to the current best price / rank
  const [postQty, setPostQty] = useState('1')
  const [postPrice, setPostPrice] = useState('')
  const [postRank, setPostRank] = useState('')
  const [posting, setPosting] = useState(false)
  const [postMsg, setPostMsg] = useState<string | null>(null)

  const [listOpen, setListOpen] = useState(false)
  // every item A to Z while nothing is typed, so the list can be browsed like a menu
  const results = useMemo((): [string, ItemMeta[string]][] => {
    const q = query.trim().toLowerCase()
    return Object.entries(meta)
      .filter(([, e]) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .slice(0, 150)
  }, [meta, query])

  const requestKey = `${slug}|${reload}`
  useEffect(() => {
    if (!slug) return
    let alive = true
    window.api
      .getItemOrders(slug)
      .then((o) => alive && setLoaded({ slug, key: requestKey, orders: o }))
      .catch(() => alive && setLoaded({ slug, key: requestKey, orders: null }))
    return () => {
      alive = false
    }
  }, [slug, reload, requestKey])

  // old orders stay visible while a reload runs; another item's orders never do
  const orders = loaded && loaded.slug === slug ? loaded.orders : null
  const loading = slug !== null && loaded?.key !== requestKey

  useEffect(() => {
    if (searching) searchBox.current?.focus()
  }, [searching])

  const item = slug ? meta[slug] : undefined
  const showSearch = !item || searching

  const list = useMemo(() => {
    const keep = (o: ItemOrder): boolean =>
      settings.inGameOnly ? o.status === 'ingame' : o.status !== 'invisible'
    const rank = rankSel.slug === slug ? rankSel.rank : 'all'
    const fits = (o: ItemOrder): boolean => rank === 'all' || o.rank === rank
    const sell = (orders?.sell ?? [])
      .filter(keep)
      .filter(fits)
      .sort((a, b) => a.platinum - b.platinum)
    const buy = (orders?.buy ?? [])
      .filter(keep)
      .filter(fits)
      .sort((a, b) => b.platinum - a.platinum)
    return { sell, buy }
  }, [orders, settings.inGameOnly, rankSel, slug])

  // ranks that exist among this item's orders (mods and arcanes), so you can pick one
  const ranks = useMemo(() => {
    const set = new Set<number>()
    for (const o of [...(orders?.sell ?? []), ...(orders?.buy ?? [])])
      if (typeof o.rank === 'number') set.add(o.rank)
    return [...set].sort((a, b) => a - b)
  }, [orders])
  const activeRank = rankSel.slug === slug ? rankSel.rank : 'all'

  const shown = tab === 'sell' ? list.sell : list.buy

  const whisper = (o: ItemOrder): void => {
    if (!item) return
    const name = o.rank != null ? `${item.name} (rank ${o.rank})` : item.name
    const verb = tab === 'sell' ? 'buy' : 'sell'
    navigator.clipboard
      .writeText(
        `/w ${o.user} Hi! I want to ${verb}: "${name}" for ${o.platinum} platinum. (warframe.market via ToxicFrame)`
      )
      .then(() => {
        setCopied(o.id)
        setTimeout(() => setCopied(''), 1500)
      })
      .catch(() => {})
  }

  const tabClass = (active: boolean): string =>
    `flex min-w-0 items-center justify-between gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border px-2 py-1 text-xs ${
      active
        ? 'border-[#4a5f9a] bg-[#2a3a66]'
        : 'border-transparent text-slate-300 hover:bg-slate-800'
    }`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showSearch && (
        <div className="relative mb-3">
          <input
            ref={searchBox}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setListOpen(true)
            }}
            onFocus={() => setListOpen(true)}
            onBlur={() => setListOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setListOpen(false)
                if (item) setSearching(false)
              }
            }}
            placeholder="Search items"
            className="w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-600 focus:ring-violet-500"
          />
          {/* pop-out list over the panel; mouse-down picks before the input's blur closes it */}
          {listOpen && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-lg border border-slate-600 bg-slate-900 py-1 shadow-2xl">
              <div className="px-3 py-1 text-xs text-slate-400">
                {results.length ? 'Choose an item' : 'No items match'}
              </div>
              {results.map(([s, e]) => (
                <button
                  key={s}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    setSlug(s)
                    setQuery('')
                    setSearching(false)
                    setListOpen(false)
                    searchBox.current?.blur()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm !normal-case !tracking-normal hover:bg-slate-700"
                >
                  <Pic src={e.icon} size={24} letter={e.name[0]} />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <span className="text-slate-500">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!item && (
        <div className="mt-16 text-center text-sm text-slate-400">
          <div className="mb-2 text-4xl text-violet-300">⇄</div>
          <div className="mb-1 text-base font-semibold text-slate-100">No item selected</div>
          Search for an item to see who is selling and buying it right now.
        </div>
      )}

      {item && slug && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 pb-2">
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1">
              <Pic src={item.icon} size={26} letter={item.name[0]} />
              <div className="min-w-0 flex-1 truncate font-semibold">{item.name}</div>
              <button
                onClick={() => setSearching((v) => !v)}
                title="Search another item"
                className="rounded p-1 text-slate-200 hover:bg-slate-700"
              >
                <SearchIcon />
              </button>
              <button
                onClick={() => setReload((n) => n + 1)}
                disabled={loading}
                title="Reload orders"
                className="rounded p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                <RefreshIcon />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1">
              <button onClick={() => setTab('sell')} className={tabClass(tab === 'sell')}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <b>Sell orders</b>
                  <span className="rounded border border-slate-500 px-1 text-[10px]">
                    {list.sell.length}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-300">
                  {list.sell.length > 0 && (
                    <>
                      Min <b className="text-sm text-slate-100">{list.sell[0].platinum}</b>
                      <PlatIcon size={14} />
                    </>
                  )}
                </span>
              </button>
              <button onClick={() => setTab('buy')} className={tabClass(tab === 'buy')}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <b>Buy orders</b>
                  <span className="rounded border border-slate-500 px-1 text-[10px]">
                    {list.buy.length}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-300">
                  {list.buy.length > 0 && (
                    <>
                      Max <b className="text-sm text-slate-100">{list.buy[0].platinum}</b>
                      <PlatIcon size={14} />
                    </>
                  )}
                </span>
              </button>
            </div>

            {ranks.length > 0 && (
              <div className="mt-2 flex justify-end">
                <Dropdown
                  size="sm"
                  value={String(activeRank)}
                  onChange={(v) =>
                    setRankSel({
                      slug,
                      rank: v === 'all' ? 'all' : Number(v)
                    })
                  }
                  title="Only show orders of one mod or arcane rank"
                  options={[
                    { value: 'all', label: 'Any rank' },
                    ...ranks.map((r) => ({ value: String(r), label: `Rank ${r}` }))
                  ]}
                />
              </div>
            )}
          </div>

          {loading && !orders && <p className="text-sm text-slate-400">Loading orders…</p>}
          {!loading && !orders && (
            <p className="text-sm text-slate-400">Could not load orders for this item.</p>
          )}
          {orders && shown.length === 0 && (
            <p className="text-sm text-slate-400">
              No {settings.inGameOnly ? 'in-game ' : ''}traders right now.
            </p>
          )}

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {shown.map((o) => {
              const st = STATUS[o.status] ?? STATUS.offline
              return (
                <div
                  key={o.id}
                  className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{o.user}</span>
                      <PlatformBadge platform={o.platform} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
                      <span className={`rounded-md border px-2 py-0.5 ${st.cls}`}>
                        ● {st.label}
                      </span>
                      <span>{o.quantity} avail.</span>
                      {o.rank != null && <span className="text-slate-400">rank {o.rank}</span>}
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-xl font-bold">
                    {o.platinum}
                    <PlatIcon />
                  </span>
                  <button
                    onClick={() => whisper(o)}
                    title="Copy the in-game whisper message"
                    className="flex w-14 flex-col items-center rounded-lg py-1 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    {copied === o.id ? '✓' : <CopyIcon />}
                    <span>{copied === o.id ? 'Copied' : 'Whisper'}</span>
                  </button>
                </div>
              )
            })}
          </div>

          {/* post your own order for this item */}
          <div className="shrink-0 border-t border-slate-700 pt-2">
            {ranks.length > 0 && (
              <label className="mb-1.5 block text-xs text-slate-300">
                Rank
                <input
                  type="number"
                  min={0}
                  value={postRank || (activeRank === 'all' ? '0' : String(activeRank))}
                  onChange={(e) => setPostRank(e.target.value)}
                  className="mt-0.5 block w-full rounded-lg bg-slate-800 px-2 py-1.5 text-sm ring-1 ring-slate-600"
                />
              </label>
            )}
            <div className="flex items-end gap-2">
              <label className="w-20 text-xs text-slate-300">
                Quantity
                <input
                  type="number"
                  min={1}
                  value={postQty}
                  onChange={(e) => setPostQty(e.target.value)}
                  className="mt-0.5 block w-full rounded-lg bg-slate-800 px-2 py-1.5 text-sm ring-1 ring-slate-600"
                />
              </label>
              <label className="w-24 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  Price / item <PlatIcon size={12} />
                </span>
                <input
                  type="number"
                  min={1}
                  value={postPrice || String(shown[0]?.platinum ?? '')}
                  onChange={(e) => setPostPrice(e.target.value)}
                  className="mt-0.5 block w-full rounded-lg bg-slate-800 px-2 py-1.5 text-sm ring-1 ring-slate-600"
                />
              </label>
              <button
                disabled={posting}
                onClick={async () => {
                  setPosting(true)
                  setPostMsg(null)
                  const rank =
                    ranks.length > 0
                      ? Number(postRank || (activeRank === 'all' ? 0 : activeRank))
                      : undefined
                  const r = await window.api.createOrder({
                    itemId: item.id,
                    type: tab,
                    platinum: Number(postPrice || shown[0]?.platinum || 0),
                    quantity: Number(postQty),
                    rank
                  })
                  setPosting(false)
                  setPostMsg(r.ok ? 'Order posted.' : (r.error ?? 'That did not work.'))
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${tab === 'sell' ? 'bg-rose-900/60 hover:bg-rose-800/70' : 'bg-emerald-900/60 hover:bg-emerald-800/70'}`}
              >
                {posting ? 'Posting…' : tab === 'sell' ? 'Post sell' : 'Post buy'}
              </button>
            </div>
            {postMsg && <p className="mt-1 text-xs text-slate-300">{postMsg}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
