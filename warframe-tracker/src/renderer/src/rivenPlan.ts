import { tagOf } from './rivenFilter.ts'

// Riven plans: what to roll for (wanted positives, accepted negatives, min roll strength), the odds
// one cycle (reroll) gets there, how a card measures up, and the riven-sniper.json migration.
export interface PlanWants {
  pos: { tag: string; required: boolean }[] // required = must be on the riven; else only "nice"
  negs: string[] // accepted negative tags; empty = any negative is fine
}

// kuva of the next reroll after n rerolls (the game's cost ladder; 3500 from the 10th on)
const LADDER = [900, 1000, 1200, 1400, 1700, 2000, 2350, 2750, 3150, 3500]
export const cycleKuva = (rerolls?: number): number =>
  rerolls === undefined ? 3500 : LADDER[Math.min(Math.max(0, Math.floor(rerolls)), 9)]

function* subsets(a: string[], k: number, from = 0, cur: string[] = []): Generator<string[]> {
  if (cur.length === k) return yield cur
  for (let i = from; i < a.length; i++) yield* subsets(a, k, i + 1, [...cur, a[i]])
}

// P(one cycle satisfies the plan): the riven has 2 or 3 positives (equal chance) drawn uniformly
// without repeats from `pool`, then a negative with 50% chance from what is left. Satisfied = every
// required stat is among the positives (with only "nice" stats: at least one of them) and the
// negative, if any, is accepted (any, when none are listed). Roll strength is not part of it.
// shortcut: the pool is uniform; no in-game stat weights are published in the browse.wf export.
export function rivenOdds(pool: string[], w: PlanWants): number {
  const req = w.pos.filter((p) => p.required).map((p) => p.tag)
  const nice = w.pos.filter((p) => !p.required).map((p) => p.tag)
  if (!w.pos.length) return 0
  let total = 0
  for (const k of [2, 3]) {
    if (pool.length < k) continue
    let hit = 0
    let n = 0
    for (const s of subsets(pool, k)) {
      n++
      if (!req.every((t) => s.includes(t)) || (!req.length && !nice.some((t) => s.includes(t))))
        continue
      const left = pool.length - k
      const ok = w.negs.length && left ? w.negs.filter((t) => !s.includes(t)).length / left : 1
      hit += 0.5 + 0.5 * ok
    }
    total += n ? hit / n / 2 : 0
  }
  return total
}

export function planOdds(
  pool: string[],
  w: PlanWants,
  rerolls?: number
): { cycles: number; kuva: number } | undefined {
  const p = rivenOdds(pool, w)
  return p > 0 ? { cycles: 1 / p, kuva: Math.round(cycleKuva(rerolls) / p / 100) * 100 } : undefined
}
export const oddsText = (o?: { cycles: number; kuva: number }): string =>
  o
    ? `≈1 in ${o.cycles < 10 ? o.cycles.toFixed(1) : Math.round(o.cycles)} cycles · ~${(o.kuva / 1000).toFixed(o.kuva < 10000 ? 1 : 0)}k kuva`
    : ''

// The cycle button text ("CYCLE FOR 3,500") -> kuva; undefined when it does not read.
export const parseCycleCost = (text: string): number | undefined => {
  const n = Number(/FOR\s*(\d[\d,. ]*)/i.exec(text)?.[1]?.replace(/\D/g, ''))
  return n >= 100 ? n : undefined
}
// A manual lock doubles the cost, so a price off the ladder whose half is on it means "locked".
// shortcut: 2000 is on the ladder and also 2 x 1000, read as unlocked.
export const costState = (cost: number): { base: number; locked: boolean } =>
  !LADDER.includes(cost) && LADDER.includes(cost / 2)
    ? { base: cost / 2, locked: true }
    : { base: cost, locked: false }

// Like rivenOdds, but with one positive `tag` locked: it stays, and so does the layout (`npos`
// positives, a negative or not), so a cycle only redraws the other positives and the negative.
export function lockedOdds(
  pool: string[],
  w: PlanWants,
  tag: string,
  layout: { npos: number; neg: boolean }
): number {
  const req = w.pos.filter((p) => p.required).map((p) => p.tag)
  const nice = w.pos.filter((p) => !p.required).map((p) => p.tag)
  const rest = pool.filter((t) => t !== tag)
  if (!w.pos.length || !pool.includes(tag) || rest.length < layout.npos - 1) return 0
  const left = pool.length - layout.npos
  let hit = 0
  let n = 0
  for (const sub of subsets(rest, layout.npos - 1)) {
    n++
    const s = [tag, ...sub]
    if (!req.every((t) => s.includes(t)) || (!req.length && !nice.some((t) => s.includes(t))))
      continue
    hit += !layout.neg
      ? 1
      : w.negs.length && left
        ? w.negs.filter((t) => !s.includes(t)).length / left
        : 1
  }
  return n ? hit / n : 0
}

// Expected kuva to reach the plan with one cycle button price `cost` (as read: doubled when a stat
// is already locked), locking `tag` or not. undefined = locking cannot reach the plan.
export function lockAdvice(
  pool: string[],
  w: PlanWants,
  tag: string,
  layout: { npos: number; neg: boolean },
  cost: number
):
  | {
      free: { cycles: number; kuva: number }
      locked: { cycles: number; kuva: number }
      already: boolean
    }
  | undefined {
  const { base, locked } = costState(cost)
  const pl = lockedOdds(pool, w, tag, layout)
  const pf = rivenOdds(pool, w)
  if (pl <= 0 || pf <= 0) return undefined
  const mk = (p: number, c: number): { cycles: number; kuva: number } => ({
    cycles: 1 / p,
    kuva: Math.round(c / p / 100) * 100
  })
  return { free: mk(pf, base), locked: mk(pl, base * 2), already: locked }
}

// wfm attribute slug -> game stat tag ([] when it has none)
export const slugTag = (
  attrs: Record<string, { name: string }>,
  slug: string,
  melee: boolean
): string[] => {
  const t = attrs[slug] && tagOf(attrs[slug].name, melee)
  return t ? [t] : []
}

// How a card measures up: per-stat tick (undefined = no opinion), the plan verdict and a sort score.
export function planFit(
  stats: { tag?: string; curse: boolean; q?: number }[],
  w: PlanWants & { minRoll?: number }
): {
  ok: (boolean | undefined)[]
  label: string
  kind: 'match' | 'partial' | 'off'
  score: number
} {
  const want = new Set(w.pos.map((p) => p.tag))
  const have = stats.filter((s) => !s.curse && s.tag)
  const hit = have.filter((s) => want.has(s.tag!))
  const neg = stats.find((s) => s.curse)
  const negOk = !neg || !w.negs.length || w.negs.includes(neg.tag ?? '')
  const qs = hit.flatMap((s) => (s.q === undefined ? [] : [s.q]))
  const avg = qs.length ? qs.reduce((a, b) => a + b, 0) / qs.length : 0
  const rollOk = !w.minRoll || !qs.length || avg * 100 >= w.minRoll
  const reqOk = w.pos.filter((p) => p.required).every((p) => have.some((s) => s.tag === p.tag))
  const match = reqOk && negOk && rollOk && (w.pos.some((p) => p.required) || hit.length > 0)
  const kind = match ? 'match' : hit.length === 0 ? 'off' : 'partial'
  return {
    ok: stats.map((s) =>
      s.curse ? (w.negs.length ? w.negs.includes(s.tag ?? '') : undefined) : want.has(s.tag ?? '')
    ),
    kind,
    label:
      kind === 'match'
        ? 'Matches your plan'
        : kind === 'off'
          ? 'Off plan'
          : `${hit.length} of ${w.pos.length} plan stats`,
    score: (match ? 100 : 0) + hit.length * 10 + avg
  }
}

// riven-sniper.json: version 1 had alerts only; plans add accepted negatives and the Use switch.
// Alerts keep their filter and Snipe state (paused); the old single negative becomes an accepted one.
export interface Migrated<A> {
  alerts: A[]
  seen: string[]
  webhook: string
  v: 2
}
export function migratePlans(raw: unknown): {
  state: Migrated<Record<string, unknown>>
  changed: boolean
} {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const alerts = (Array.isArray(s.alerts) ? s.alerts : []).map((a) => {
    const x = a as Record<string, unknown> & { filter?: { neg?: { slug?: string } } }
    return {
      ...x,
      negs: Array.isArray(x.negs) ? x.negs : x.filter?.neg?.slug ? [x.filter.neg.slug] : [],
      use: x.use === true
    }
  })
  return {
    state: {
      alerts,
      seen: Array.isArray(s.seen) ? (s.seen as string[]) : [],
      webhook: typeof s.webhook === 'string' ? s.webhook : '',
      v: 2
    },
    changed: s.v !== 2
  }
}
