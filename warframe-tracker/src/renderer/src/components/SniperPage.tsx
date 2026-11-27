import { useCallback, useEffect, useState } from 'react'
import { openFinder } from '../rivenFind'
import { oddsText, planOdds, slugTag } from '../rivenPlan'
import { rivenType } from '../rivens'
import NcCard from './NcCard'
import PlatIcon from './PlatIcon'
import { Toggle } from './SettingsDialog'

// Trading > Rivens > Sniper: saved alerts from the Finder ("Save as sniper alert"). The main process
// checks each weapon about once a minute and notifies once per new listing from an online seller.
type Info = Awaited<ReturnType<typeof window.api.sniperList>>
type Plan = Info['alerts'][number]
type Cat = Awaited<ReturnType<typeof window.api.getRivenCatalog>>
type Data = Awaited<ReturnType<typeof window.api.getRivenData>>
const input =
  'rounded-lg border border-slate-600 bg-slate-900/60 px-2 py-1.5 text-sm outline-none placeholder:text-white/40'
const btn =
  'cursor-pointer rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1 text-sm font-medium text-slate-200 hover:bg-slate-800'
const chip = 'rounded border border-cyan-400/40 bg-cyan-500/10 px-1.5 py-0.5 text-cyan-100'
const muted = 'text-xs text-white/55'

export default function SniperPage({
  onOpenSettings
}: {
  onOpenSettings: () => void
}): React.JSX.Element {
  const [info, setInfo] = useState<Info>({ alerts: [] })
  const [cat, setCat] = useState<Cat | null>(null)
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    void window.api.getRivenCatalog().then(setCat)
    void window.api.getRivenData().then(setData)
  }, [])
  const nameOf = (slug: string): string => cat?.attrs[slug]?.name ?? slug
  const odds = (a: Plan): string => {
    const w = cat?.weapons[a.slug]
    if (!cat || !data || !w) return ''
    const melee = /^(melee|zaw)$/.test(w.rivenType)
    const key = Object.keys(data.values).find(
      (k) => rivenType(k).toLowerCase().replace(/\W/g, '') === w.rivenType
    )
    const tag = (s: string): string[] => slugTag(cat.attrs, s, melee)
    return oddsText(
      planOdds(Object.keys(data.values[key ?? ''] ?? {}), {
        pos: a.filter.pos.flatMap((x) =>
          tag(x.slug).map((t) => ({ tag: t, required: x.required }))
        ),
        negs: (a.negs ?? []).flatMap(tag)
      })
    )
  }
  const patchFilter = (a: Plan, pos: Plan['filter']['pos']): Promise<void> =>
    window.api.sniperUpdate(a.id, { filter: { ...a.filter, pos } })
  const refresh = useCallback(() => window.api.sniperList().then(setInfo), [])
  useEffect(() => {
    void refresh()
    const t = setInterval(refresh, 15_000)
    return () => clearInterval(t)
  }, [refresh])
  const act = (p: Promise<unknown>): void => void p.then(refresh)

  return (
    <div className="space-y-4 p-4 text-slate-100">
      <div className="flex items-start gap-4">
        <p className={`${muted} flex-1`}>
          A plan is what you want a riven to be. Create one in the Fixer (set the stats, then Save
          as plan). Snipe: the weapon is checked about once a minute while ToxicFrame is open and
          you are told once per matching listing from an online seller. Use for rolling: the riven
          overlay judges cards against this plan (one per weapon).
        </p>
        {/* alerts use the app's notification routes and Discord webhook (the Sniper row) */}
        <button onClick={onOpenSettings} className={`${btn} shrink-0`}>
          Notifications &amp; Discord
        </button>
      </div>
      {info.alerts.length === 0 && <p className="text-sm text-white/55">No plans yet.</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {info.alerts.map((a) => (
          <NcCard key={a.id} title={a.name}>
            <div className="space-y-2 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {a.filter.priceMax !== undefined && (
                  <span className={`${chip} inline-flex items-center gap-1`}>
                    max {a.filter.priceMax}
                    <PlatIcon size={12} />
                  </span>
                )}
                {a.filter.pos.map((x) => (
                  <span key={x.slug} className={chip}>
                    <button
                      onClick={() =>
                        act(
                          patchFilter(
                            a,
                            a.filter.pos.map((y) =>
                              y.slug === x.slug ? { ...y, required: !y.required } : y
                            )
                          )
                        )
                      }
                      title="Click: required / nice to have"
                      className="cursor-pointer"
                    >
                      {x.required ? '★ ' : ''}
                      {nameOf(x.slug)}
                    </button>
                    <button
                      onClick={() =>
                        act(
                          patchFilter(
                            a,
                            a.filter.pos.filter((y) => y.slug !== x.slug)
                          )
                        )
                      }
                      aria-label={`Remove ${nameOf(x.slug)}`}
                      className="ml-1 cursor-pointer text-white/55"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {(a.negs ?? []).map((n) => (
                  <span key={n} className="rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-200">
                    OK: {nameOf(n)}
                    <button
                      onClick={() =>
                        act(
                          window.api.sniperUpdate(a.id, {
                            negs: (a.negs ?? []).filter((x) => x !== n)
                          })
                        )
                      }
                      aria-label={`Remove ${nameOf(n)}`}
                      className="ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <span className="text-white/55">★ required</span>
              </div>
              {odds(a) && <div className="text-xs text-cyan-200">{odds(a)}</div>}
              <div className={`truncate ${muted}`}>
                {a.paused
                  ? 'Paused'
                  : a.error
                    ? `Error: ${a.error}`
                    : a.lastPoll
                      ? `Checked ${new Date(a.lastPoll).toLocaleTimeString()}`
                      : 'Waiting for the first check'}
                {a.lastHit && ` · last: ${a.lastHit.text}`}
              </div>
              <div>
                <Toggle
                  on={!a.paused}
                  onChange={() => act(window.api.sniperUpdate(a.id, { paused: !a.paused }))}
                  label="Snipe"
                />
                <Toggle
                  on={!!a.use}
                  onChange={() => act(window.api.sniperUpdate(a.id, { use: !a.use }))}
                  label="Use for rolling"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-700/70 pt-2">
                <label className="flex items-center gap-1 text-xs text-white/70">
                  Min roll
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={a.minRoll ?? ''}
                    placeholder="0"
                    aria-label="Minimum average roll strength percent"
                    onBlur={(e) =>
                      act(window.api.sniperUpdate(a.id, { minRoll: Number(e.target.value) }))
                    }
                    className={`${input} w-16`}
                  />
                  %
                </label>
                <label className="flex items-center gap-1 text-xs text-white/70">
                  Only if at least
                  <input
                    type="number"
                    min={0}
                    max={99}
                    defaultValue={a.minDeal ?? ''}
                    placeholder="0"
                    aria-label="Minimum percent under fair price"
                    onBlur={(e) =>
                      act(window.api.sniperUpdate(a.id, { minDeal: Number(e.target.value) }))
                    }
                    className={`${input} w-16`}
                  />
                  % under fair
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openFinder(a.slug, a.filter)} className={btn}>
                  Open in Fixer
                </button>
                <button onClick={() => act(window.api.sniperDelete(a.id))} className={btn}>
                  Delete
                </button>
              </div>
            </div>
          </NcCard>
        ))}
      </div>
    </div>
  )
}
