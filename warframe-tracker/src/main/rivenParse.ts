// Reads the text of a riven card ("Bubonico Deci-toxifel", "+106% Status Duration",
// "x0.56 Damage to Grineer"; the MR line is ignored). No Electron here, so tests can load it.
import { matchPart } from './partMatch.ts'
import { STATS, statName } from '../renderer/src/rivens.ts'

export interface ParsedStat {
  text: string // as the card shows it
  label: string
  tag?: string // game stat tag, when the label is a known stat
  value: number // fraction (+106% -> 1.06); a faction multiplier x0.56 -> -0.44
}
export interface ParsedRiven {
  name: string
  weapon?: string
  stats: ParsedStat[] // positives first, the negative (if any) last, as the card shows them
}

const STAT_TAGS: [string, string][] = [
  ...Object.keys(STATS).map((t): [string, string] => [statName(t), t]),
  ...['Grineer', 'Corpus', 'Infested', 'Corrupted'].map((f): [string, string] => [
    statName(`WeaponFactionDamage${f}`),
    `WeaponFactionDamage${f}`
  ]),
  ['Attack speed', 'WeaponFireRateMod']
]
export const tagFromLabel = (label: string): string | undefined => {
  const m = matchPart(
    label,
    STAT_TAGS.map((s) => s[0]),
    0.6
  )
  return m ? STAT_TAGS.find((s) => s[0] === m.name)?.[1] : undefined
}

// OCR splits "81 .1" and reads the % sign as "0/0" now and then; the label may be lost behind an icon
// ("+1 31 .70/0 z Toxin" = +131.7% Toxin: the element icon reads as a stray letter)
const STAT = /(?:^|[^a-z])([+\-�]|x)\s*(\d[\d ]*(?:\s?[.,]\s?\d+)?)\s*(%|s)?\s*(.*)$/i

export function parseRivenText(lines: string[], weapons: string[]): ParsedRiven {
  const stats: ParsedStat[] = []
  let name = ''
  for (const line of lines.map((l) => l.trim()).filter(Boolean)) {
    // melee crit chance wraps "(x2 for Heavy Attacks)" onto its own line
    if (line.startsWith('(') && stats.length) {
      stats[stats.length - 1].text += ` ${line}`
      continue
    }
    // "+146.5% Critical Chance" / "for Slide Attack" is one stat: crit chance on slide
    if (/^for slide attack/i.test(line) && stats.length) {
      const last = stats[stats.length - 1]
      last.text += ' on slide'
      last.label = 'Critical chance on slide'
      last.tag = 'SlideAttackCritChanceMod'
      continue
    }
    const m = STAT.exec(line.replace(/0\s*\/\s*0/g, '%'))
    if (m) {
      const raw = m[4].replace(/^\S\s+/, '') // a lone icon letter before the label
      const tag = tagFromLabel(raw)
      // one tag can have two names (Fire rate / Attack speed): keep the one the card used
      const names = STAT_TAGS.filter((t) => t[1] === tag).map((t) => t[0])
      const label = tag ? (matchPart(raw, names, 0)?.name ?? names[0]) : raw
      const n = Number(m[2].replace(/\s/g, '').replace(',', '.'))
      const sign = m[1].toLowerCase()
      const value =
        sign === 'x' ? n - 1 : (sign === '+' ? 1 : -1) * (m[3] === 's' || !m[3] ? n : n / 100)
      stats.push({
        text: `${m[1]}${m[2].replace(/\s/g, '')}${m[3] ? (m[3] === 's' ? 's' : '%') : ''} ${label}`.trim(),
        label,
        tag,
        value
      })
    } else if (!stats.length)
      name += name.endsWith('-') ? line : ` ${line}`.trimEnd() // wrapped name
    else if (/^[a-z]/i.test(line) && !/^mr\b/i.test(line)) {
      // a long label wraps: "-100.2% Chance to Gain" / "Combo Count"
      const last = stats[stats.length - 1]
      const label = `${last.label} ${line}`
      const tag = tagFromLabel(label)
      last.text = `${last.text} ${line}`
      if (tag) {
        last.tag = tag
        last.label = label
      }
    }
  }
  name = name.trim()
  // the weapon is the name's first words ("Dual Toxocyst Deci-toxifel")
  const words = name.split(/\s+/)
  let weapon: string | undefined
  let best = 0.8
  // the box may catch a stray line of card art above the name, so the weapon can start later
  let from = 0
  for (let i = 0; i < words.length - 1; i++)
    for (let k = 1; k <= Math.min(3, words.length - 1 - i); k++) {
      const w = matchPart(words.slice(i, i + k).join(' '), weapons)
      if (w && (w.score > best || (w.score === best && i === from))) {
        best = w.score
        weapon = w.name
        from = i
      }
    }
  return { name: words.slice(from).join(' '), weapon, stats }
}
