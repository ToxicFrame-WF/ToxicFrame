import { useEffect } from 'react'
import { CYCLES, shouldNotify } from '../cycleAlerts'
import { getSettings } from '../settings'

// Notifies a few minutes before a picked world-cycle state starts (once per start time).
export function useCycleAlerts(): void {
  useEffect(() => {
    const fired = new Set<string>()
    const bootAt = Date.now()
    let ws: WorldState | null = null
    let loadedAt = 0

    const tick = async (): Promise<void> => {
      const { minutes, picks } = getSettings().cycleAlerts
      if (picks.length === 0) return
      if (Date.now() - loadedAt > 60_000) {
        try {
          ws = await window.api.getWorldState()
          loadedAt = Date.now()
        } catch {
          return
        }
      }
      if (!ws) return
      const now = Date.now()
      for (const c of CYCLES) {
        const cur = ws[c.key]
        if (!cur) continue
        for (const pick of picks) {
          const [key, state] = pick.split(':')
          if (key !== c.key || !shouldNotify(c.states, cur, state, minutes, now)) continue
          const id = `${pick}@${cur.expiry}`
          if (fired.has(id)) continue
          fired.add(id)
          const left = Date.parse(cur.expiry) - now
          if (now - bootAt < 30_000 && left < 30_000) continue // boot: skip about-to-start ones
          window.api.notify({
            kind: 'cycle',
            title: `${c.label} ${state} in ${Math.max(1, Math.round(left / 60_000))} min`,
            body: c.where
          })
        }
      }
    }

    void tick()
    const t = setInterval(() => void tick(), 15_000)
    return () => clearInterval(t)
  }, [])
}
