import { useEffect, useState } from 'react'
import * as cache from '../apiCache'
import Icon from './Icon'
import PlatIcon from './PlatIcon'
import { variantMap } from '../rivenVariants'
import { openFinder } from '../rivenFind'

// Weapon half of the item details window: stats per attack mode and the riven market.

const POLARITY: Record<string, string> = {
  madurai: 'V',
  vazarin: 'D',
  naramon: '—',
  zenurik: '≡',
  unairu: 'Ʊ',
  penjaga: 'P',
  umbra: 'U'
}
const round = (n: number): number => Math.round(n * 100) / 100
const duration = (s: number): string =>
  s >= 86400 ? `${round(s / 86400)} day` : `${Math.round(s / 3600)} h`
const hue = (k: string): number => [...k].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360

function Cell({
  label,
  value,
  unit = ''
}: {
  label: string
  value?: number | string
  unit?: string
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2">
      <div className="text-xs text-slate-300">{label}</div>
      <div className="text-lg font-semibold !normal-case">
        {value == null ? '—' : `${typeof value === 'number' ? round(value) : value}${unit}`}
      </div>
    </div>
  )
}

export function WeaponStats({ detail }: { detail: ItemDetail }): React.JSX.Element {
  const w = detail.weapon!
  const [mode, setMode] = useState(0)
  const m = w.modes[Math.min(mode, w.modes.length - 1)]
  const total = Object.values(m.damage).reduce((a, b) => a + b, 0)
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 font-semibold">
        <Icon name="chart" /> Stats
        {w.modes.length > 1 &&
          w.modes.map((x, i) => (
            <button
              key={i}
              onClick={() => setMode(i)}
              className={`rounded border px-2 py-0.5 text-xs font-normal !normal-case ${i === mode ? 'border-violet-400/70 bg-violet-500/15' : 'border-slate-600 text-slate-300'}`}
            >
              {x.name}
            </button>
          ))}
        {w.buildPrice != null && (
          <span className="ml-auto text-xs font-normal !normal-case text-slate-300">
            Build: {w.buildPrice.toLocaleString('en-US')} credits
            {w.buildTime ? ` · ${duration(w.buildTime)}` : ''}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        <Cell label="Crit chance" value={m.crit} unit="%" />
        <Cell label="Crit multiplier" value={m.critMult} unit="x" />
        <Cell label="Status chance" value={m.status} unit="%" />
        <Cell label="Fire rate" value={m.fireRate} />
        <Cell label="Total damage" value={total || undefined} />
        <Cell label="Magazine" value={w.magazine} />
        <Cell label="Reload" value={w.reload} unit="s" />
        <Cell label="Multishot" value={w.multishot} />
        <Cell label="Disposition" value={w.disposition} />
        <Cell label="Trigger · Noise" value={`${w.trigger ?? '—'} · ${w.noise ?? '—'}`} />
      </div>
      {total > 0 && (
        <>
          <div className="mt-3 flex h-2 overflow-hidden rounded bg-white/10">
            {Object.entries(m.damage).map(([k, v]) => (
              <span
                key={k}
                title={`${k} ${round(v)}`}
                style={{ width: `${(v / total) * 100}%`, background: `hsl(${hue(k)} 70% 55%)` }}
              />
            ))}
          </div>
          <div className="mt-1 text-xs !normal-case text-slate-300">
            {Object.entries(m.damage)
              .map(([k, v]) => `${k} ${round(v)}`)
              .join(' · ')}
          </div>
        </>
      )}
      <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-xs font-normal text-slate-300">Polarities</span>
        {detail.polarities.map((p, i) => (
          <span key={i} title={p}>
            {POLARITY[p] ?? p[0]?.toUpperCase()}
          </span>
        ))}
        {!detail.polarities.length && '—'}
      </div>
    </div>
  )
}

// cheapest riven listing for this weapon (a variant uses its base weapon), with a jump to the Fixer
export function WeaponRivens({ name }: { name: string }): React.JSX.Element | null {
  const [info, setInfo] = useState<{ slug: string; base: string; n: number; min?: number } | null>(
    null
  )
  useEffect(() => {
    let live = true
    ;(async () => {
      const all = Object.entries((await window.api.getRivenCatalog()).weapons)
      const m = await cache.masteryCatalog()
      const v = variantMap(
        m.items.filter((i) => i.group === 'weapon').map((i) => i.name),
        all.map(([, w]) => w.name)
      )
      const base = v[name] ?? name
      const slug = all.find(([, w]) => w.name === base)?.[0]
      if (!slug) return
      const list = await window.api.searchRivenAuctions(slug)
      if (live)
        setInfo({
          slug,
          base,
          n: list.length,
          min: list.length ? Math.min(...list.map((l) => l.price)) : undefined
        })
    })().catch(() => {})
    return () => {
      live = false
    }
  }, [name])
  if (!info) return null
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/30 p-4">
      <div className="font-semibold">Rivens</div>
      <div className="flex-1 text-sm !normal-case text-slate-300">
        {info.base}: {info.n} listings
        {info.min != null && (
          <>
            , cheapest <span className="font-semibold text-sky-300">{info.min}</span>{' '}
            <PlatIcon size={14} />
          </>
        )}
      </div>
      <button
        onClick={() => openFinder(info.slug, { pos: [], minMatch: 0, mustNeg: false })}
        className="rounded-lg border border-rose-500/40 bg-rose-900/30 px-3 py-1.5 text-sm hover:bg-rose-900/50"
      >
        Open in Fixer ▸
      </button>
    </div>
  )
}
