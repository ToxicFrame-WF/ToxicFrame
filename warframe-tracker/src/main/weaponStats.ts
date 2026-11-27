// Per attack-mode stats for the item detail window, from @wfcd/items weapon data.
export interface RawAttack {
  name?: string
  speed?: number
  crit_chance?: number
  crit_mult?: number
  status_chance?: number
  damage?: Record<string, number>
}
export interface AttackMode {
  name: string
  crit?: number // percent
  critMult?: number
  status?: number // percent
  fireRate?: number
  damage: Record<string, number>
}

/** One mode per listed attack; a weapon without any gets a single mode from its top-level numbers. */
export function attackModes(
  attacks: RawAttack[] | undefined,
  top: {
    crit?: number
    critMult?: number
    status?: number
    fireRate?: number
    damage?: Record<string, number>
  }
): AttackMode[] {
  const modes = (attacks ?? [])
    .filter((a) => a.damage && Object.keys(a.damage).length)
    .map((a) => ({
      name: a.name ?? 'Attack',
      crit: a.crit_chance,
      critMult: a.crit_mult,
      status: a.status_chance,
      fireRate: a.speed,
      damage: a.damage ?? {}
    }))
  return modes.length ? modes : [{ name: 'Attack', ...top, damage: top.damage ?? {} }]
}
