// Shared Archon shard helpers: parse installed shards from the inventory and name their effects.

// Installed shards come from Suits[].ArchonCrystalUpgrades: [{ UpgradeType, Color }] where Color is
// ACC_<RED|YELLOW|BLUE|GREEN|ORANGE|PURPLE>[_MYTHIC]. Format taken from open-source server
// emulators; NOT yet verified against a live account with shards slotted.
const COLOR_CODE: Record<string, string> = {
  RED: 'Crimson',
  YELLOW: 'Amber',
  BLUE: 'Azure',
  GREEN: 'Emerald',
  ORANGE: 'Topaz',
  PURPLE: 'Violet'
}
export type Installed = { color: string; tau: boolean; upgrade: string }

// UpgradeType is a path like .../ArchonCrystalUpgradeWarframeAbilityStrength. Exact suffixes are
// not verified, so match on keywords and fall back to a prettified suffix.
const EFFECT_KEYWORDS: [RegExp, string][] = [
  [/AbilityStrength/i, 'Ability strength'],
  [/AbilityDuration/i, 'Ability duration'],
  [/PrimaryStatus/i, 'Primary status chance'],
  [/SecondaryCrit(?!.*(Heat|Fire))/i, 'Secondary critical chance'],
  [/(Heat|Fire).*Crit|Crit.*(Heat|Fire)/i, 'Secondary crit per heat kill'],
  [/MeleeCrit/i, 'Melee critical damage'],
  [/(Initial|Spawn|Start).*Energy/i, 'Max energy on spawn'],
  [/HealthOrb/i, 'Health orb effectiveness'],
  [/EnergyOrb/i, 'Energy orb effectiveness'],
  [/Cast/i, 'Casting speed'],
  [/Parkour/i, 'Parkour velocity'],
  [/(Health|Energy).*Conver|Conver/i, 'Health ↔ energy pickups'],
  [/HealthRegen/i, 'Health regen'],
  [/Shield.*(Blast|Explo)|(Blast|Explo).*Shield/i, 'Shield regen on blast kill'],
  [/(Blast|Explo).*(Heal|Health)|(Heal|Health).*(Blast|Explo)/i, 'Health per blast kill'],
  [/Toxin.*(Heal|Health)|(Heal|Health).*Toxin/i, 'Health on toxin hit'],
  [/Toxin/i, 'Toxin status damage'],
  [/Corros.*Stack|Stack.*Corros/i, 'Max corrosion stacks'],
  [/Corros/i, 'Ability damage vs corrosion'],
  [/Radiation/i, 'Ability damage vs radiation'],
  [/Primary.*Electric/i, 'Primary electricity damage'],
  [/Electric/i, 'Ability damage vs electricity'],
  [/Armou?r/i, 'Armor'],
  [/Shield/i, 'Shield capacity'],
  [/Energy/i, 'Energy max'],
  [/Health/i, 'Max health']
]

export function effectFor(
  sh: Installed,
  shard: ArchonShard | undefined
): { name: string; value?: string } {
  const tail = (sh.upgrade.split('/').pop() ?? '').replace(/^ArchonCrystalUpgrade(Warframe)?/, '')
  const names = new Set(shard?.effects.map((e) => e.name))
  const hit = EFFECT_KEYWORDS.find(([re, n]) => re.test(tail) && (!shard || names.has(n)))
  const eff = hit && shard?.effects.find((e) => e.name === hit[1])
  if (eff) return { name: eff.name, value: sh.tau ? eff.tauforged : eff.regular }
  const pretty = tail.replace(/Mythic$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
  return { name: pretty || 'Unknown effect' }
}

// Other pages (Foundry) can jump here and open one Warframe's shard window.
let pendingInspect: string | null = null
export const peekPendingInspect = (): string | null => pendingInspect
export function clearPendingInspect(): void {
  pendingInspect = null
}
export function inspectShards(frame: string): void {
  pendingInspect = frame
  window.dispatchEvent(new CustomEvent('toxicframe:navigate', { detail: 'archon-shards' }))
}

export function parseInstalled(suits: unknown): Map<string, Installed[]> {
  const m = new Map<string, Installed[]>()
  if (!Array.isArray(suits)) return m
  for (const s of suits as {
    ItemType?: string
    ArchonCrystalUpgrades?: { Color?: string; UpgradeType?: string }[]
  }[]) {
    if (!s.ItemType || !Array.isArray(s.ArchonCrystalUpgrades)) continue
    const list: Installed[] = []
    for (const u of s.ArchonCrystalUpgrades) {
      const match = /^ACC_([A-Z]+?)(_MYTHIC)?$/.exec(u?.Color ?? '')
      const color = match && COLOR_CODE[match[1]]
      if (color) list.push({ color, tau: !!match[2], upgrade: u?.UpgradeType ?? '' })
    }
    if (list.length) m.set(s.ItemType, [...(m.get(s.ItemType) ?? []), ...list])
  }
  return m
}
