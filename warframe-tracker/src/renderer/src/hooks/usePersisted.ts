import { useEffect, useState } from 'react'

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
    try {
      localStorage.setItem(`ui.${key}`, JSON.stringify(value))
    } catch {
      // storage full or blocked: keep working, just don't remember
    }
  }, [key, value])
  return [value, setValue]
}
