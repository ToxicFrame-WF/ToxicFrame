import { gradeRiven, type Grade, type Riven } from './rivens.ts'

// Weapon names, variants, grade sheet rule and grade of a riven. Shared by the Rivens tab and
// My contracts so both show the same name / variants / grade for the same riven.
type Item = {
  uniqueName: string
  name: string
  group?: string
  imageName?: string
}
type Rule = { core?: string[]; good: string[]; neg: string[] }

// some rivens name the weapon's internal base class ("…/QuadShotgunBase" = Hek), so each weapon is
// also found under its unique name + "Base"
export const weaponLookup = <T extends Item>(items: T[]): Map<string, T> =>
  new Map(
    items.flatMap((i): [string, T][] => [
      [i.uniqueName, i],
      [`${i.uniqueName}Base`, i]
    ])
  )

// weapons you own (all gear sections)
export function ownedWeapons(raw: Record<string, unknown>): Set<string> {
  const set = new Set<string>()
  for (const k of ['LongGuns', 'Pistols', 'Melee', 'SpaceGuns', 'SpaceMelee', 'SentinelWeapons'])
    for (const g of (Array.isArray(raw[k]) ? raw[k] : []) as { ItemType?: string }[])
      if (g.ItemType) set.add(g.ItemType)
  return set
}

export function rivenView<T extends Item>(
  weapons: Map<string, T>,
  owned: Set<string>,
  rules: Record<string, Rule>,
  picked: Record<string, string> = {}
): {
  nameOf: (u: string) => string
  variantsOf: (base: string) => T[]
  shownOf: (r: Riven) => T | undefined
  shownName: (r: Riven) => string
  ruleOf: (r: Riven) => Rule | undefined
  gradeOf: (r: Riven) => Grade | undefined
} {
  // weapon name, or a readable guess from the path for kitgun/zaw parts the catalog lacks
  const nameOf = (u: string): string =>
    weapons.get(u)?.name ??
    (u.split('/').pop() ?? '').replace(/Weapon$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
  // A riven fits its base weapon and every variant ("Tenet Arca Plasmor", "Hek" -> "Vaykor Hek",
  // "Lato Prime"): catalog weapons whose name contains the base name as whole words.
  const variantsOf = (base: string): T[] => {
    const b = weapons.get(base)
    if (!b) return []
    const re = new RegExp(`(^|\\s)${b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i')
    const all = [...new Set(weapons.values())].filter(
      (w) => w.group === 'weapon' && re.test(w.name)
    )
    // owned first, then the base weapon, then by name
    return all.sort(
      (x, y) =>
        Number(owned.has(y.uniqueName)) - Number(owned.has(x.uniqueName)) ||
        Number(y.uniqueName === base) - Number(x.uniqueName === base) ||
        x.name.localeCompare(y.name)
    )
  }
  const shownOf = (r: Riven): T | undefined =>
    weapons.get(picked[r.id] ?? '') ?? variantsOf(r.weapon)[0] ?? weapons.get(r.weapon)
  const shownName = (r: Riven): string => shownOf(r)?.name ?? nameOf(r.weapon)
  // the sheet may list a variant on its own row; otherwise the base weapon's row applies
  const ruleOf = (r: Riven): Rule | undefined =>
    rules[shownName(r).toLowerCase()] ?? rules[nameOf(r.weapon).toLowerCase()]
  return {
    nameOf,
    variantsOf,
    shownOf,
    shownName,
    ruleOf,
    gradeOf: (r) => gradeRiven(r, ruleOf(r))
  }
}
