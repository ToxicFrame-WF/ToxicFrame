import { useEffect } from 'react'
import { matchesPrefs, niceNode } from '../arbitrations'
import { getSettings } from '../settings'

// Desktop notifications for arbitrations while the app is open: recurring ones for rotations that
// match your preferences, and one-time reminders you set with the bell on the schedule.
const FIRED_KEY = 'toxicframe.arbFired'

function loadFired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function saveFired(fired: Set<string>): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...fired].slice(-300)))
  } catch {
    // not critical
  }
}

export function useArbitrationAlerts(): void {
  useEffect(() => {
    let slots: ArbitrationSlot[] = []
    let loadedAt = 0
    const fired = loadFired()

    const tick = async (): Promise<void> => {
      const s = getSettings()
      const reminders = new Set(s.arbReminders)
      if (!s.arbPrefs.notify && reminders.size === 0) return
      if (Date.now() - loadedAt > 5 * 60_000) {
        try {
          slots = await window.api.getArbitrationForecast()
          loadedAt = Date.now()
        } catch {
          return
        }
      }
      const nowSec = Math.floor(Date.now() / 1000)
      const advance = s.arbPrefs.advanceMin * 60
      for (const slot of slots) {
        const wanted =
          reminders.has(slot.start) ||
          (s.arbPrefs.notify && matchesPrefs(slot, s.arbPrefs, s.arbFavorites))
        if (!wanted) continue
        const what = `${slot.type || 'Arbitration'} · ${niceNode(slot.name)}${slot.tier ? ` (${slot.tier} tier)` : ''}`
        const pre = `${slot.start}:pre`
        const at = `${slot.start}:start`
        if (
          advance > 0 &&
          nowSec >= slot.start - advance &&
          nowSec < slot.start &&
          !fired.has(pre)
        ) {
          fired.add(pre)
          window.api.notify({
            kind: 'arbitration',
            title: 'Arbitration soon',
            body: `${what} starts in ${Math.max(1, Math.round((slot.start - nowSec) / 60))} min`
          })
        }
        if (
          s.arbPrefs.alsoAtStart &&
          nowSec >= slot.start &&
          nowSec < slot.start + 300 &&
          !fired.has(at)
        ) {
          fired.add(at)
          window.api.notify({ kind: 'arbitration', title: 'Arbitration started', body: what })
        }
      }
      saveFired(fired)
    }

    void tick()
    const t = setInterval(() => void tick(), 20_000)
    return () => clearInterval(t)
  }, [])
}
