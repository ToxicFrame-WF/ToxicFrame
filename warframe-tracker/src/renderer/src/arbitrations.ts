// Shared helpers for the Arbitrations pages and alerts.
import type { ArbPrefs } from './settings'

export const MISSION_TYPES = [
  'Alchemy',
  'Dark Sector Defection',
  'Dark Sector Defense',
  'Dark Sector Disruption',
  'Dark Sector Excavation',
  'Dark Sector Survival',
  'Defense',
  'Disruption',
  'Excavation',
  'Infested Salvage',
  'Interception',
  'Mirror Defense',
  'Survival',
  'Void Armageddon',
  'Void Cascade',
  'Void Flood'
]
export const PLANETS = [
  'Ceres',
  'Deimos',
  'Earth',
  'Eris',
  'Europa',
  'Jupiter',
  'Lua',
  'Mars',
  'Mercury',
  'Neptune',
  'Phobos',
  'Pluto',
  'Saturn',
  'Sedna',
  'Uranus',
  'Venus',
  'Void',
  'Zariman'
]
export const TIERS = ['S', 'A', 'B', 'C', 'D', 'Unrated']

// "Elara (Jupiter)" -> "Jupiter"
export const planetOf = (name: string): string => /\(([^)]+)\)\s*$/.exec(name)?.[1] ?? ''
// "Elara (Jupiter)" -> "Elara, Jupiter"
export const niceNode = (name: string): string => name.replace(/\s*\((.+)\)\s*$/, ', $1')

const sameFaction = (chip: string, enemy: string): boolean =>
  chip === enemy ||
  (chip === 'Infested' && /^infest/i.test(enemy)) ||
  (chip === 'The Murmur' && /murmur/i.test(enemy))

// Does this rotation fit the saved preferences? Empty groups let everything through.
export function matchesPrefs(s: ArbitrationSlot, p: ArbPrefs, favorites: string[]): boolean {
  return (
    (!p.missionTypes.length || p.missionTypes.includes(s.type)) &&
    (!p.planets.length || p.planets.includes(planetOf(s.name))) &&
    (!p.factions.length || p.factions.some((f) => sameFaction(f, s.enemy))) &&
    (!p.tiers.length || p.tiers.includes(s.tier ?? 'Unrated')) &&
    (!p.nodes.length || p.nodes.includes(s.name)) &&
    (!p.favOnly || favorites.includes(s.name))
  )
}
export const factionCls = (e: string): string =>
  /grineer/i.test(e)
    ? 'bg-amber-500/15 text-amber-300'
    : /corpus/i.test(e)
      ? 'bg-sky-500/15 text-sky-300'
      : /infest/i.test(e)
        ? 'bg-lime-500/15 text-lime-300'
        : /orokin|corrupt/i.test(e)
          ? 'bg-yellow-500/15 text-yellow-300'
          : 'bg-slate-500/20 text-slate-300'
