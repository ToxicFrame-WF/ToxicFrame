import PlatIcon from '../PlatIcon'
import NcCard from '../NcCard'
import type { RivenCard } from '../../rivens'
import { oddsText, planFit } from '../../rivenPlan'

export interface RivenData {
  cards?: RivenCard[]
  layout?: { left: number; right: number; top: number; scale: number }
}

const VERDICT = {
  Bad: 'bg-rose-500 text-white',
  OK: 'bg-amber-400 text-black',
  Good: 'bg-emerald-500 text-black',
  Great: 'bg-amber-300 text-black'
}
// grade letter -> colour: S/A green, B teal, C amber, D red
const gradeColor = (g?: string): string =>
  !g
    ? 'text-slate-500'
    : g[0] === 'S' || g[0] === 'A'
      ? 'text-emerald-300'
      : g[0] === 'B'
        ? 'text-cyan-300'
        : g[0] === 'C'
          ? 'text-amber-300'
          : 'text-rose-400'
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '')

const RANK = { Bad: 0, OK: 1, Good: 2, Great: 3 }
const avgQ = (c: RivenCard): number => {
  const q = c.stats.filter((s) => !s.curse && s.q !== undefined).map((s) => s.q as number)
  return q.length ? q.reduce((a, b) => a + b, 0) / q.length : 0
}
const fit = (c: RivenCard): ReturnType<typeof planFit> | undefined =>
  c.plan &&
  planFit(c.stats, {
    pos: c.plan.pos,
    negs: c.plan.negs.map((n) => n.tag),
    minRoll: c.plan.minRoll
  })
const isWanted = (c: RivenCard, text: string, curse: boolean): boolean | undefined => {
  const list = curse ? c.negatives : c.wanted.map((w) => w.name)
  return list.length ? list.some((n) => norm(text).endsWith(norm(n))) : undefined
}
// the negative landed on a stat the build wants (plan stat, or the sheet's wanted list)
function hurts(c: RivenCard): string[] {
  return c.stats
    .filter((s) => s.curse)
    .flatMap((s) => {
      const w = c.plan
        ? c.plan.pos.find((p) => p.tag === s.tag)
        : c.wanted.find((x) => norm(s.text).endsWith(norm(x.name)))
      return w ? [w.name] : []
    })
}
// a negative on a wanted stat caps the sheet verdict at OK (the sheet only checks positives)
const verdictOf = (c: RivenCard): RivenCard['verdict'] =>
  c.verdict && hurts(c).length && (c.verdict === 'Good' || c.verdict === 'Great') ? 'OK' : c.verdict

// one line saying why: "2 of 3 stats wanted, weak rolls"
function reason(c: RivenCard): string {
  const pos = c.stats.filter((s) => !s.curse)
  const want = pos.filter((s) => isWanted(c, s.text, false)).length
  const q = avgQ(c)
  return `${want} of ${pos.length} stats wanted · ${q >= 0.66 ? 'strong' : q >= 0.33 ? 'average' : 'weak'} rolls`
}

// Answers, in order: is it good (and why), which stats count, what it is worth, what is missing.
function Card({
  c,
  pick,
  chips = true,
  interactive
}: {
  c: RivenCard
  pick?: 'keep' | 'skip'
  chips?: boolean
  interactive?: boolean
}): React.JSX.Element {
  const has = (n: string): boolean =>
    c.stats.some((s) => !s.curse && norm(s.text).endsWith(norm(n)))
  const pf = fit(c)
  const hurt = hurts(c)
  const verdict = verdictOf(c)
  const planKind = {
    match: VERDICT.Great,
    partial: VERDICT.OK,
    off: VERDICT.Bad
  }
  // only listings sharing 2+ stats count as similar (one shared stat says nothing about price)
  const close = c.similar.filter((a) => a.attrs.filter((x) => x.matched).length >= 2)
  const cheapest = close.length ? Math.min(...close.map((a) => a.price)) : undefined
  // chips: the plan when there is one (required stats starred), else the sheet's picks
  const aim = c.plan
    ? c.plan.pos.map((w) => ({
        name: w.name,
        core: w.required,
        on: c.stats.some((s) => !s.curse && s.tag === w.tag)
      }))
    : c.wanted.map((w) => ({ ...w, on: has(w.name) }))
  const negs = c.plan ? c.plan.negs.map((n) => n.name) : c.negatives
  return (
    <NcCard title={c.name} className="w-[400px]" accent={pick === 'keep' ? '#34d399' : undefined}>
      <div className="nc-screen p-3 text-[15px] normal-case text-white">
        {pick && (
          <div
            className={`mb-2 text-center text-sm font-bold ${pick === 'keep' ? 'text-emerald-300' : 'text-slate-400'}`}
          >
            {pick === 'keep' ? '▲ Better roll — keep this one' : 'Weaker roll'}
          </div>
        )}
        <div className="flex items-stretch gap-2">
          {pf ? (
            <div className={`flex-1 rounded py-1 text-center ${planKind[pf.kind]}`}>
              <div className="text-lg font-bold leading-tight">{pf.label}</div>
              {verdict && (
                <div className="text-xs font-semibold opacity-80">
                  Sheet: {verdict} roll · {reason(c)}
                </div>
              )}
            </div>
          ) : (
            verdict && (
              <div className={`flex-1 rounded py-1 text-center ${VERDICT[verdict]}`}>
                <div className="text-lg font-bold leading-tight">{verdict} roll</div>
                <div className="text-xs font-semibold">{reason(c)}</div>
              </div>
            )
          )}
        </div>
        {hurt.length > 0 && (
          <div className="mt-2 rounded border border-amber-400/70 bg-amber-400/15 px-2 py-1 text-sm font-semibold text-amber-200">
            ⚠ Negative on a {c.plan ? 'plan' : 'key'} stat: {hurt.join(', ')}
          </div>
        )}
        {c.lock && (c.lock.already || c.lock.locked.kuva < c.lock.free.kuva) && (
          <div className="mt-2 rounded border border-sky-300/50 bg-sky-300/10 px-2 py-1 text-sm font-semibold text-sky-200">
            🔒 {c.lock.already ? 'Locked' : 'Lock'} {c.lock.name}: {oddsText(c.lock.locked)}
            {!c.lock.already && ` (vs ${oddsText(c.lock.free)})`}
          </div>
        )}
        <div className="mt-3 flex text-[11px] uppercase tracking-wider text-slate-400">
          <span className="flex-1">Stat</span>
          <span>Roll strength</span>
        </div>
        {c.stats.map((s, i) => {
          const ok = pf ? pf.ok[i] : isWanted(c, s.text, s.curse)
          // strength towards the best possible roll (for a negative: the mildest)
          const q = s.q === undefined ? undefined : s.curse ? 1 - s.q : s.q
          return (
            <div key={i} className="py-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-4 text-center font-bold ${ok === undefined ? 'text-slate-500' : ok ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {ok === undefined ? '·' : ok ? '✓' : '✗'}
                </span>
                <span className={`min-w-0 flex-1 truncate ${s.curse ? 'text-rose-300' : ''}`}>
                  {s.text.replace(/\s*\(x2 for Heavy Attacks\)/i, ' ×2 heavy')}
                </span>
                {/* an unwanted stat's grade is greyed: its strength does not matter */}
                <span
                  className={`w-9 shrink-0 text-left text-lg font-bold tabular-nums ${ok === false ? 'text-white/35' : gradeColor(s.grade)}`}
                >
                  {s.grade ?? '?'}
                </span>
              </div>
              {q !== undefined && (
                <div className="ml-6 mr-11 h-1 rounded bg-white/10">
                  <div
                    className={`h-full rounded ${ok === false ? 'bg-white/30' : s.curse ? 'bg-rose-400' : 'bg-fuchsia-400'}`}
                    style={{ width: `${Math.round(q * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
        <div className="mt-2 space-y-1 border-t border-white/15 pt-2 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">
              {cheapest !== undefined ? 'Similar from' : 'Similar:'}
            </span>
            {cheapest !== undefined ? (
              <span className="inline-flex items-center gap-1 font-bold">
                {cheapest}
                <PlatIcon size={14} />
              </span>
            ) : (
              <span className="text-slate-400">no close listings</span>
            )}
          </div>
        </div>
        {c.plan?.odds && (
          <div className="mt-1 text-sm text-slate-300">Plan odds {oddsText(c.plan.odds)}</div>
        )}
        {/* the sheet's picks as chips, so a riven that fits your own build can be judged too */}
        {chips && (
          <div className="mt-2 border-t border-white/15 pt-2">
            <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">
              Aim for{' '}
              <span className="normal-case">
                ({c.plan ? 'plan' : 'green: on this riven · ★ key stat'})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {aim.map((w) => (
                <span
                  key={w.name}
                  className={`rounded px-1.5 py-0.5 text-xs ${w.on ? 'bg-emerald-500 text-black' : w.core ? 'bg-amber-300/25 text-amber-200' : 'bg-white/10'}`}
                >
                  {w.core ? '★ ' : ''}
                  {w.name}
                </span>
              ))}
            </div>
            {negs.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="text-xs text-slate-400">
                  OK negatives{c.plan ? ' (plan)' : ''}:
                </span>
                {negs.map((n) => (
                  <span
                    key={n}
                    className="rounded bg-rose-500/20 px-1.5 py-0.5 text-xs text-rose-200"
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {interactive && c.find && (
          <button
            onClick={() => window.api.findSimilarRiven(c.find!)}
            className="mt-2 w-full cursor-pointer rounded border border-white/30 py-1 text-xs font-semibold hover:bg-white/10"
          >
            Find similar on the market
          </button>
        )}
      </div>
    </NcCard>
  )
}

// One panel per card at the screen's left (old roll, or the only card) and right edge (new roll).
export default function RivenPanel({
  data,
  interactive
}: {
  data: RivenData
  interactive?: boolean
}): React.JSX.Element | null {
  const { cards, layout } = data
  if (!cards || !layout) return null
  // confirm screen: say which roll to keep (wanted stats first, then roll strength)
  const score = (c: RivenCard): number =>
    fit(c)?.score ?? (verdictOf(c) ? RANK[verdictOf(c)!] : 0) + avgQ(c) * 0.9
  const pick: ('keep' | 'skip')[] | undefined =
    cards.length === 2
      ? score(cards[1]) > score(cards[0])
        ? ['skip', 'keep']
        : ['keep', 'skip']
      : undefined
  return (
    <>
      {cards.map((c, i) => {
        const right = cards.length === 2 && i === 1
        // zoom only the inner box: zoom on the fixed box would also scale its left/top.
        // The new roll hangs from the game's right edge (mirroring the left margin) so a
        // larger panel grows inwards instead of off screen.
        const edge = layout.right + 406 * layout.scale // game area's right edge, CSS px
        return (
          <div
            key={i}
            className="fixed"
            style={{
              top: layout.top,
              ...(right
                ? { right: window.innerWidth - edge + 24 * layout.scale }
                : { left: layout.left })
            }}
          >
            <div style={{ zoom: layout.scale * 1.15 }}>
              {/* confirm screen: the chips are the same for both cards, so only the left shows them */}
              <Card c={c} pick={pick?.[i]} chips={i === 0} interactive={interactive} />
            </div>
          </div>
        )
      })}
    </>
  )
}
