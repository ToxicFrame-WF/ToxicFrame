import { getRivenGrades } from './rivenGrades'
import { getRivenData } from './rivenData'
import { getRivenCatalog } from './marketContracts'
import { searchAuctions } from './rivenSearch'
import { tagOf } from '../renderer/src/rivenFilter'
import { lockAdvice, planOdds, slugTag, type PlanWants } from '../renderer/src/rivenPlan'
import { rollingPlan } from './rivenSniper'
import type { ParsedRiven } from './rivenParse'
import {
  abbrName,
  gradeRiven,
  type RivenCard,
  rivenStats,
  rivenType,
  rollGrade,
  statName
} from '../renderer/src/rivens'

// A card shows 3 or 4 stat lines; the last one is the negative when there are 4 and, with 3, only
// when its roll cannot be a third positive. The roll (0..1) comes from the values rivenStats gives
// for the lowest and highest possible roll.
// shortcut: assumes the card shows rank 8 values and uses the weapon-type base values; an unranked
// riven shown on the card would grade too low.
function rolls(
  p: ParsedRiven,
  itemType: string,
  data: Awaited<ReturnType<typeof getRivenData>>
): { q?: number; curse: boolean; fixed?: number }[] {
  const n = p.stats.length
  const options = n === 3 ? [0, 1] : [n === 4 ? 1 : 0]
  for (const curses of options) {
    const tags = p.stats.map((s) => s.tag ?? '?') // '?': no base value, so no grade
    const mk = (roll: number): ReturnType<typeof rivenStats> =>
      rivenStats(
        {
          buffTags: tags.slice(0, n - curses),
          curseTags: tags.slice(n - curses),
          buffRolls: Array(n).fill(roll),
          curseRolls: Array(n).fill(roll),
          rank: 8,
          itemType
        },
        data
      )
    const [lo, hi] = [mk(0), mk(2 ** 30)]
    const flat = (r: typeof lo): (number | undefined)[] => [...r.buffs, ...r.curses]
    const fixed: (number | undefined)[] = []
    const qs = p.stats.map((s, i) => {
      const a = Math.abs(flat(lo)[i] ?? NaN)
      const b = Math.abs(flat(hi)[i] ?? NaN)
      const q = (Math.abs(s.value) - a) / (b - a)
      // OCR drops the decimal point on the dimmed old card now and then (+75.5% -> +755%)
      const q10 = (Math.abs(s.value) / 10 - a) / (b - a)
      if (q > 1.03 && q10 >= -0.03 && q10 <= 1.03) {
        fixed[i] = s.value / 10
        return q10
      }
      return q
    })
    const ok = qs.every((q) => q >= -0.03 && q <= 1.03)
    if (ok || curses === options[options.length - 1])
      return qs.map((q, i) => ({
        q: Number.isNaN(q) ? undefined : Math.min(1, Math.max(0, q)),
        curse: i >= n - curses,
        fixed: fixed[i]
      }))
  }
  return p.stats.map(() => ({ curse: false }))
}

type Auction = { price: number; attrs: { name: string; positive: boolean }[] }
async function cheapest(slug: string): Promise<Auction[]> {
  return (await searchAuctions(slug))
    .filter((a) => a.status !== 'offline')
    .map((a) => ({ price: a.price, attrs: a.attrs }))
}

export async function analyseRiven(p: ParsedRiven, cost?: number): Promise<RivenCard | null> {
  if (!p.weapon || p.stats.length < 2) return null
  const [cat, data, rules] = await Promise.all([
    getRivenCatalog(),
    getRivenData(),
    getRivenGrades()
  ])
  const slug = Object.keys(cat.weapons).find((k) => cat.weapons[k].name === p.weapon)
  const wf = slug ? cat.weapons[slug] : undefined
  const typeKey = Object.keys(data.values).find(
    (k) => rivenType(k).toLowerCase().replace(/\W/g, '') === wf?.rivenType
  )
  const rs = rolls(p, typeKey ?? '', data)
  const stats = p.stats.map((s, i) => ({
    text:
      rs[i].fixed === undefined
        ? s.text
        : s.text.replace(/[\d.]+(?=%)/, String(Math.round(Math.abs(rs[i].fixed!) * 1000) / 10)),
    q: rs[i].q,
    tag: p.stats[i].tag,
    curse: rs[i].curse,
    grade: rs[i].q === undefined ? undefined : rollGrade(rs[i].curse ? 1 - rs[i].q! : rs[i].q!)
  }))
  const tagsOf = (curse: boolean): string[] =>
    p.stats.flatMap((s, i) => (s.tag && rs[i].curse === curse ? [s.tag] : []))
  const melee = wf?.rivenType === 'melee' || wf?.rivenType === 'zaw'
  const rule = rules[p.weapon.toLowerCase()]
  const g = gradeRiven(
    { buffTags: tagsOf(false), curseTags: tagsOf(true), type: melee ? 'Melee' : 'Rifle' },
    rule
  )
  // similar listings: most of this riven's wanted stats first, then the cheapest
  // match by game stat tag and side (wfm says "Electric Damage", the card "Electricity"), not by name
  const mine = new Set(p.stats.map((s, i) => s.tag && `${s.tag}|${rs[i].curse}`).filter(Boolean))
  const mark = (a: Auction): { text: string; matched: boolean; positive: boolean }[] =>
    a.attrs.map((x) => ({
      text: x.name,
      positive: x.positive,
      matched: mine.has(`${tagOf(x.name, melee)}|${!x.positive}`)
    }))
  let similar: RivenCard['similar'] = []
  if (slug)
    try {
      similar = (await cheapest(slug))
        .map((a) => ({ price: a.price, attrs: mark(a) }))
        .sort(
          (a, b) =>
            b.attrs.filter((x) => x.matched).length - a.attrs.filter((x) => x.matched).length ||
            a.price - b.price
        )
        .slice(0, 3)
    } catch {
      // offline: the rest of the panel still works
    }
  const wfmSlug = (tag?: string): string[] =>
    Object.keys(cat.attrs)
      .filter((s) => tag && tagOf(cat.attrs[s].name, melee) === tag)
      .slice(0, 1)
  const find = slug && {
    slug,
    pos: tagsOf(false).flatMap(wfmSlug),
    neg: tagsOf(true).flatMap(wfmSlug)[0]
  }
  // the weapon's rolling plan, as tags; odds from the riven type's stat pool
  const rp = slug ? rollingPlan(slug) : undefined
  let plan: RivenCard['plan']
  if (rp) {
    const tg = (s: string): { tag: string; name: string }[] => {
      return slugTag(cat.attrs, s, !!melee).map((tag) => ({ tag, name: statName(tag, !!melee) }))
    }
    const pos = rp.filter.pos.flatMap((w) =>
      tg(w.slug).map((t) => ({ ...t, required: w.required }))
    )
    const negs = rp.negs.flatMap(tg)
    plan = {
      pos,
      negs,
      minRoll: rp.minRoll,
      odds: planOdds(Object.keys(data.values[typeKey ?? ''] ?? {}), {
        pos: pos.map((x) => ({ tag: x.tag, required: x.required })),
        negs: negs.map((n) => n.tag)
      })
    }
  }
  // lock suggestion: the strongest wanted positive (plan stats, else the sheet's key/wanted stats)
  let lock: RivenCard['lock']
  const pool = Object.keys(data.values[typeKey ?? ''] ?? {})
  const sheetTags = (list: string[]): string[] =>
    list.flatMap((a) => tagOf(abbrName(a), !!melee) ?? [])
  const wants: PlanWants | undefined = plan
    ? {
        pos: plan.pos.map((x) => ({ tag: x.tag, required: x.required })),
        negs: plan.negs.map((n) => n.tag)
      }
    : rule && (rule.core.length || rule.good.length)
      ? {
          pos: rule.core.length
            ? sheetTags(rule.core).map((tag) => ({ tag, required: true }))
            : sheetTags(rule.good).map((tag) => ({ tag, required: false })),
          negs: sheetTags(rule.neg)
        }
      : undefined
  if (wants && cost) {
    const npos = tagsOf(false).length
    const cand = stats
      .filter((s) => !s.curse && s.tag && wants.pos.some((w) => w.tag === s.tag))
      .sort((a, b) => (b.q ?? 0) - (a.q ?? 0))[0]
    const adv =
      cand?.tag && lockAdvice(pool, wants, cand.tag, { npos, neg: tagsOf(true).length > 0 }, cost)
    if (cand && adv) lock = { name: statName(cand.tag!, !!melee), ...adv }
  }
  return {
    lock,
    plan,
    find: find || undefined,
    name: p.name,
    weapon: p.weapon,
    verdict: g && ({ Perfect: 'Great', Good: 'Good', OK: 'OK', Bad: 'Bad' } as const)[g],
    stats,
    similar,
    // the sheet repeats stats (one row per weapon variant)
    wanted: [...new Set((rule?.good ?? []).map(abbrName))].map((name) => ({
      name,
      core: (rule?.core ?? []).some((a) => abbrName(a) === name)
    })),
    negatives: [...new Set((rule?.neg ?? []).map(abbrName))]
  }
}
