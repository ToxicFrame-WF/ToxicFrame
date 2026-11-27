import { useEffect, useRef, useState } from 'react'

// Long card lists: draw the first `step` items, then `step` more whenever the end comes within a
// screen of view, instead of building hundreds of cards (with pictures) before anything shows.
// `resetKey` changes (tab, search, filters) start again from the first batch.
export function useGrowingList(
  total: number,
  resetKey: unknown,
  step = 40
): { limit: number; sentinel: React.RefObject<HTMLDivElement | null> } {
  // the count belongs to one resetKey; a new key starts over at the first batch
  const [grown, setGrown] = useState({ key: resetKey, limit: step })
  const limit = Object.is(grown.key, resetKey) ? grown.limit : step
  const sentinel = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || limit >= total) return
    // watch from the nearest scrolling panel (pages scroll inside the layout, not the window),
    // so the margin really reaches a screen ahead
    let root: HTMLElement | null = el.parentElement
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY))
      root = root.parentElement
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setGrown({ key: resetKey, limit: limit + step })
      },
      { root, rootMargin: '0px 0px 800px 0px' } // a screen ahead, so scrolling never meets the end
    )
    io.observe(el)
    return () => io.disconnect()
  }, [limit, total, step, resetKey])
  return { limit, sentinel }
}
