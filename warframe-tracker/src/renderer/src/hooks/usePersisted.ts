import { useEffect, useState } from 'react'

const EVENT = 'persisted-change'

// useState that survives closing the app: the value is kept in localStorage under `key`.
// A bad or missing saved value falls back to `initial`.
export function usePersisted<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`ui.${key}`)
      if (saved == null) return initial
      const v: unknown = JSON.parse(saved)
      const ok =
        initial === null ||
        (v !== null && typeof v === typeof initial && Array.isArray(v) === Array.isArray(initial))
      return ok ? (v as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    const raw = JSON.stringify(value)
    try {
      if (localStorage.getItem(`ui.${key}`) === raw) return
      localStorage.setItem(`ui.${key}`, raw)
    } catch {
      // storage full or blocked: keep working, just don't remember
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key, raw } }))
  }, [key, value])
  // other components using the same key (e.g. the Weekly page and the app-wide recorder) follow
  useEffect(() => {
    const on = (e: Event): void => {
      const d = (e as CustomEvent<{ key: string; raw: string }>).detail
      if (d.key === key)
        setValue((cur) => (JSON.stringify(cur) === d.raw ? cur : JSON.parse(d.raw)))
    }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [key])
  return [value, setValue]
}
