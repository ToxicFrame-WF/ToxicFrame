import Dropdown from './Dropdown'
import { useEffect, useState } from 'react'
import {
  abbr,
  abbrName,
  formatStat,
  rivenStats,
  rollGrade,
  type Grade,
  type Riven
} from '../rivens'
import GradeBadge from './GradeBadge'
import Pic from './Pic'
import { findSimilar } from '../rivenFind'
import DrainPolarity from './DrainPolarity'
import NcCard from './NcCard'

// Riven detail popup (click a riven card): name, MR / rerolls / rank / polarity, its grade, every
// stat with where its roll sits between the worst and best possible value, a rank picker, and the
// recommended stats for the weapon from the community grade sheet.

type RivenData = Awaited<ReturnType<typeof window.api.getRivenData>>
const ROLL_MAX = 2 ** 30

export default function RivenDetail({
  riven,
  weapon,
  image,
  name,
  grade,
  rule,
  data,
  variants = [],
  variant,
  onVariant,
  onClose
}: {
  riven: Riven
  weapon: string
  image?: string
  name?: string
  grade?: Grade
  rule?: { core?: string[]; good: string[]; neg: string[] }
  data: RivenData
  variants?: { id: string; name: string; owned: boolean }[]
  variant?: string
  onVariant?: (id: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [rank, setRank] = useState(riven.rank)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const melee = /Melee/.test(riven.type)
  const at = (rolls: Pick<Riven, 'buffRolls' | 'curseRolls'>): ReturnType<typeof rivenStats> =>
    rivenStats({ ...riven, ...rolls, rank }, data)
  const now = at(riven)
  const low = at({
    buffRolls: riven.buffRolls.map(() => 0),
    curseRolls: riven.curseRolls.map(() => 0)
  })
  const high = at({
    buffRolls: riven.buffRolls.map(() => ROLL_MAX),
    curseRolls: riven.curseRolls.map(() => ROLL_MAX)
  })

  const rows = [
    ...riven.buffTags.map((tag, i) => ({ tag, name: riven.buffs[i], neg: false, i })),
    ...riven.curseTags.map((tag, i) => ({ tag, name: riven.curses[i], neg: true, i }))
  ]
  const present = new Set([...riven.buffTags, ...riven.curseTags].map((t) => abbr(t, melee)))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${weapon} riven`}
        onClick={(e) => e.stopPropagation()}
        className="nc-dialog-card flex max-h-full w-full max-w-6xl flex-col rounded-lg bg-slate-900 text-slate-100 shadow-2xl"
      >
        <NcCard title={`${weapon} riven`} className="min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {/* header */}
            <div className="mb-4 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-800">
                <Pic src={image} size={52} letter={weapon[0]} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-400">{weapon}</div>
                <div className="truncate text-2xl font-bold">{name ?? `${riven.type} riven`}</div>
              </div>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-0.5 text-sm text-slate-300">
                <dt className="sr-only">Mastery rank</dt>
                <dd>MR {riven.mr}</dd>
                <dt className="sr-only">Rerolls</dt>
                <dd>⟳ {riven.rerolls}</dd>
                <dt className="sr-only">Rank</dt>
                <dd>Rank {riven.rank}/8</dd>
                <dt className="sr-only">Drain and polarity</dt>
                <dd>
                  <DrainPolarity drain={10 + rank} polarity={riven.polarity} />
                </dd>
              </dl>
              {grade && <GradeBadge grade={grade} />}
              <button
                onClick={() => {
                  void findSimilar(weapon, riven.buffTags, riven.curseTags[0])
                  onClose()
                }}
                className="rounded-md border border-slate-600 px-2.5 py-1 text-sm hover:bg-slate-700/50"
              >
                Find similar
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="px-2 text-2xl leading-none text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_22rem]">
              {/* modifiers */}
              <div className="flex flex-1 flex-col rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-semibold">Modifiers</div>
                  {variants.length > 1 && (
                    <label className="ml-auto mr-4 flex items-center gap-2 text-sm text-slate-300">
                      Weapon variant
                      <Dropdown
                        size="sm"
                        value={variant ?? ''}
                        onChange={(v) => onVariant?.(v)}
                        options={variants.map((v) => ({
                          value: v.id,
                          label: `${v.name}${v.owned ? ' (owned)' : ''}`
                        }))}
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    Rank
                    <Dropdown
                      size="sm"
                      value={String(rank)}
                      onChange={(v) => setRank(Number(v))}
                      options={Array.from({ length: 9 }, (_, r) => ({
                        value: String(r),
                        label: `${r}${r === riven.rank ? ' (current)' : ''}`
                      }))}
                    />
                  </label>
                </div>
                {/* few modifiers sit in the middle instead of leaving the bottom empty */}
                <div className="my-auto space-y-3">
                  {rows.map(({ tag, name: label, neg, i }) => {
                    const v = (neg ? now.curses : now.buffs)[i]
                    const lo = (neg ? low.curses : low.buffs)[i]
                    const hi = (neg ? high.curses : high.buffs)[i]
                    const roll = (neg ? riven.curseRolls : riven.buffRolls)[i] / ROLL_MAX
                    // a smaller negative is the better roll
                    const q = neg ? 1 - roll : roll
                    return (
                      <div key={tag} className="border-b border-slate-700/60 pb-2 last:border-0">
                        <div className="mb-1 flex items-center gap-2">
                          <span className={neg ? 'text-red-500' : 'text-amber-300'}>
                            <b className="tabular-nums">
                              {v !== undefined ? formatStat(tag, v) : neg ? '−' : '+'}
                            </b>{' '}
                            {label}
                          </span>
                          <span
                            title="How good this roll is, worst to best"
                            className="rounded border border-slate-600 px-1.5 text-xs font-semibold"
                          >
                            {rollGrade(q)}
                          </span>
                        </div>
                        {lo !== undefined && hi !== undefined && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="w-14 text-right tabular-nums">
                              {formatStat(tag, lo)}
                            </span>
                            <span className="h-1.5 flex-1 rounded bg-slate-700" aria-hidden>
                              <span
                                className={`block h-full rounded ${neg ? 'bg-red-400' : 'bg-amber-300'}`}
                                style={{ width: `${Math.round(roll * 100)}%` }}
                              />
                            </span>
                            <span className="w-14 tabular-nums">{formatStat(tag, hi)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* recommended stats from the sheet */}
              <div className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <div className="mb-3 font-semibold">Recommended attributes</div>
                {!rule ? (
                  <p className="text-sm text-slate-400">
                    The grade sheet has no entry for {weapon}.
                  </p>
                ) : (
                  <>
                    {(rule.core ?? []).length > 0 && (
                      <>
                        <Heading
                          title="Core positives"
                          hint="Required for a top grade. A warning sign means it is missing on this riven."
                        />
                        <Chips list={rule.core!} present={present} warnMissing />
                      </>
                    )}
                    <Heading
                      title={(rule.core ?? []).length ? 'Other positives' : 'Wanted positives'}
                      hint="Any of these is a good roll for this weapon."
                    />
                    <Chips
                      list={rule.good.filter((g) => !(rule.core ?? []).includes(g))}
                      present={present}
                    />
                    <div className="my-3 border-t border-slate-700" />
                    <Heading
                      title="Preferred negatives"
                      hint="Negatives that hurt this weapon least."
                    />
                    {rule.neg.length ? (
                      <Chips list={rule.neg} present={present} minus />
                    ) : (
                      <p className="text-xs text-slate-500">None listed</p>
                    )}
                    <p className="mt-4 text-[11px] text-white/45">
                      ✓ = on this riven. Source: community roll sheet by 44bananas.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </NcCard>
      </div>
    </div>
  )
}

function Heading({ title, hint }: { title: string; hint: string }): React.JSX.Element {
  return (
    <div className="mb-1.5 mt-1 flex items-center gap-1.5 text-sm font-semibold">
      {title}
      <span title={hint} className="cursor-help text-xs text-slate-400">
        ⓘ
      </span>
    </div>
  )
}

function Chips({
  list,
  present,
  minus,
  warnMissing
}: {
  list: string[]
  present: Set<string>
  minus?: boolean
  warnMissing?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[...new Set(list)].map((s) => {
        const on = present.has(s)
        return (
          <span
            key={s}
            title={s}
            className={`rounded-md border px-2 py-0.5 text-xs ${
              on
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                : warnMissing
                  ? 'border-amber-400/60 bg-amber-500/10 text-amber-200'
                  : 'border-slate-600 text-slate-300'
            }`}
          >
            {on ? '✓ ' : warnMissing ? '⚠ ' : ''}
            {minus ? '− ' : ''}
            {abbrName(s).replace(/^\w/, (c) => c.toUpperCase())}
          </span>
        )
      })}
    </div>
  )
}
