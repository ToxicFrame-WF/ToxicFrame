import { useEffect, useState } from 'react'

// World state refreshes every minute (the main process caches it for a minute as well).
export function useWorldState(): WorldState | null {
  const [ws, setWs] = useState<WorldState | null>(null)
  useEffect(() => {
    let alive = true
    let atEnd: ReturnType<typeof setTimeout> | undefined
    const load = (): void => {
      window.api
        .getWorldState()
        .then((d) => {
          if (!alive || !d) return
          setWs(d)
          // reload as soon as the next cycle (Earth, Vallis, …) ends, so no timer sits at "—"
          const ends = [d.cetus, d.vallis, d.cambion, d.zariman, d.duviri]
            .map((c) => (c ? new Date(c.expiry).getTime() - Date.now() : Infinity))
            .filter((ms) => ms > 0)
          clearTimeout(atEnd)
          const next = Math.min(...ends)
          if (next < 60_000) atEnd = setTimeout(load, next + 1500)
        })
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(t)
      clearTimeout(atEnd)
    }
  }, [])
  return ws
}

// Ticks once a second (or every `ms`) so countdowns stay live. Keep it low in the tree: every
// tick redraws the component that calls it.
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function timeLeft(expiry: string, now: number): string {
  const ms = new Date(expiry).getTime() - now
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m ${sec}s`
  return `${m}m ${sec}s`
}

// Arbitration schedule (from browse.wf), re-read every minute so "current" rolls over on the hour.
export function useArbitrations(): ArbitrationInfo | null {
  const [info, setInfo] = useState<ArbitrationInfo | null>(null)
  useEffect(() => {
    let alive = true
    const load = (): void => {
      window.api
        .getArbitrations()
        .then((d) => {
          if (alive) setInfo(d)
        })
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  return info
}
