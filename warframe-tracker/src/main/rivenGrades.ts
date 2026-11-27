import { app, net } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { rulesFromCsv, type GradeRule } from './rivenSheet'

// Riven grade rules from the community sheet AlecaFrame also uses ("good/god rolls for selling",
// by 44bananas). One tab per weapon class; each row: weapon, wanted stats, acceptable negatives.
// Fetched as CSV and cached for a week.
const SHEET = 'https://docs.google.com/spreadsheets/d/1zbaeJBuBn44cbVKzJins_E3hTDpnmvOk8heYN-G8yy8'
const TABS = ['0', '1505239276', '1413904270', '289737427', '965095749'] // primary … robotic
const MAX_AGE = 7 * 24 * 60 * 60 * 1000
const file = (): string => join(app.getPath('userData'), 'riven-grades-3.json')

export async function getRivenGrades(): Promise<Record<string, GradeRule>> {
  try {
    const saved = JSON.parse(readFileSync(file(), 'utf8')) as {
      at: number
      rules: Record<string, GradeRule>
    }
    if (Date.now() - saved.at < MAX_AGE) return saved.rules
  } catch {
    // nothing saved yet
  }
  const rules: Record<string, GradeRule> = {}
  try {
    for (const gid of TABS) {
      const res = await net.fetch(`${SHEET}/export?format=csv&gid=${gid}`)
      if (res.ok) Object.assign(rules, rulesFromCsv(await res.text()))
    }
    if (Object.keys(rules).length) writeFileSync(file(), JSON.stringify({ at: Date.now(), rules }))
  } catch {
    // offline: no grades this time
  }
  return rules
}
