import { useEffect, useState } from 'react'
import Pic from './Pic'
import NcCard from './NcCard'

// Resource pop-up: what it is, how many you have, and where it drops (wiki text when the game
// data lists no drops).
export default function ResourceDetail({
  res,
  count,
  onClose
}: {
  res: ResourceMeta
  count: number
  onClose: () => void
}): React.JSX.Element {
  const [dropQuery, setDropQuery] = useState('')
  const [dropSearch, setDropSearch] = useState(false)
  const [howTo, setHowTo] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (res.drops.length === 0) window.api.getWikiAcquisition(res.name).then(setHowTo)
  }, [res])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown = res.drops.filter((d) => d.location.toLowerCase().includes(dropQuery.toLowerCase()))
  const wiki = `https://wiki.warframe.com/w/${encodeURIComponent(res.name.replace(/ /g, '_'))}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="nc-dialog-card flex max-h-full w-full max-w-2xl flex-col rounded-lg bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <NcCard title={res.type ?? 'Resource'} className="min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center">
                <Pic src={res.image} fallback={res.imageFallback} size={52} letter={res.name[0]} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-bold">{res.name}</div>
                <div className="text-sm text-slate-400">
                  <b className="text-lg text-slate-100">{count.toLocaleString('en-US')}</b> in
                  inventory
                </div>
              </div>
              <button
                onClick={() => window.open(wiki, '_blank')}
                className="rounded-lg border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
              >
                ↗ Wiki
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {res.description && (
              <p className="mb-4 text-sm leading-relaxed text-slate-300">{res.description}</p>
            )}

            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 flex items-center justify-between font-semibold text-slate-200">
                Where to find it
                {res.drops.length > 0 && (
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {res.drops.length}
                    <button
                      onClick={() => {
                        setDropSearch((o) => !o)
                        setDropQuery('')
                      }}
                      title="Search locations"
                      aria-pressed={dropSearch}
                      className="text-base leading-none text-slate-400 hover:text-white"
                    >
                      ⌕
                    </button>
                  </span>
                )}
              </div>
              {dropSearch && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-2 py-1.5 text-sm">
                  <input
                    autoFocus
                    className="w-full bg-transparent outline-none placeholder:text-slate-400"
                    placeholder="Search"
                    value={dropQuery}
                    onChange={(e) => setDropQuery(e.target.value)}
                  />
                </div>
              )}
              {res.drops.length === 0 &&
                (howTo === undefined ? (
                  <p className="text-sm text-slate-400">Loading from the wiki…</p>
                ) : howTo ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
                    {howTo}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">
                    No drop source in the game data or on the wiki.
                  </p>
                ))}
              <div className="max-h-80 overflow-y-auto">
                {shown.map((d) => (
                  <div
                    key={d.location}
                    className="flex items-center justify-between gap-2 border-t border-slate-800 py-1.5 text-sm first:border-t-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-slate-300" title={d.location}>
                        {d.location}
                      </span>
                      {d.amount && (
                        <span className="text-xs text-slate-400">
                          {d.amount}× {res.name}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-200">
                      {d.chance.toFixed(d.chance < 10 ? 2 : 1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </NcCard>
      </div>
    </div>
  )
}
