import { useEffect, useState } from 'react'

let loading: Promise<Record<string, string>> | null = null

// Planet icon addresses (shared by every card, fetched once).
export function usePlanetIcons(): Record<string, string> {
  const [icons, setIcons] = useState<Record<string, string>>({})
  useEffect(() => {
    const request = loading ?? (loading = window.api.getPlanetIcons())
    request.then(setIcons).catch(() => {})
  }, [])
  return icons
}
