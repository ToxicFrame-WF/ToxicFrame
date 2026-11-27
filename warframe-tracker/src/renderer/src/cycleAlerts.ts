// World-cycle reminders: which cycles/states exist and the pure "notify now?" decision.
export type CycleKey = 'cetus' | 'vallis' | 'cambion' | 'zariman' | 'duviri'

// Order matters: the state after the last one wraps to the first.
export const CYCLES: { key: CycleKey; label: string; where: string; states: string[] }[] = [
  { key: 'cetus', label: 'Cetus', where: 'Earth · Plains of Eidolon', states: ['day', 'night'] },
  { key: 'vallis', label: 'Orb Vallis', where: 'Venus · Orb Vallis', states: ['warm', 'cold'] },
  {
    key: 'cambion',
    label: 'Cambion Drift',
    where: 'Deimos · Cambion Drift',
    states: ['fass', 'vome']
  },
  { key: 'zariman', label: 'Zariman', where: 'Zariman Ten Zero', states: ['corpus', 'grineer'] },
  {
    key: 'duviri',
    label: 'Duviri',
    where: 'Duviri',
    states: ['sorrow', 'fear', 'joy', 'anger', 'envy']
  }
]

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

// The state that starts when `cur` ends (undefined if the state is unknown).
export function nextState(states: string[], cur: string): string | undefined {
  const i = states.indexOf(cur.toLowerCase())
  return i < 0 ? undefined : states[(i + 1) % states.length]
}

// True when the picked state is the next one and starts within `minutes` (and is still ahead).
export function shouldNotify(
  states: string[],
  cur: { state: string; expiry: string },
  pick: string,
  minutes: number,
  now: number
): boolean {
  const start = Date.parse(cur.expiry)
  if (!Number.isFinite(start) || nextState(states, cur.state) !== pick) return false
  return start > now && start - now <= minutes * 60_000
}
