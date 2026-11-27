import { useEffect, useState } from 'react'

let loading: Promise<ItemMeta> | null = null

export function useItemMeta(): ItemMeta {
  const [meta, setMeta] = useState<ItemMeta>({})
  useEffect(() => {
    const request = loading ?? (loading = window.api.getItemMeta())
    request.then(setMeta)
  }, [])
  return meta
}
