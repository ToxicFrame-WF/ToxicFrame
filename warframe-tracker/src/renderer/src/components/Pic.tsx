import { useEffect, useState } from 'react'

// Square picture that is always drawn at its true proportions (as a background image, so
// it can never be stretched). Tries `src`, then `fallback`, then shows `letter`.
export default function Pic({
  src,
  fallback,
  size,
  round,
  letter,
  onFail
}: {
  src?: string
  fallback?: string
  size: number
  round?: boolean
  letter?: string
  onFail?: () => void
}): React.JSX.Element | null {
  const candidates = [src, fallback].filter((u): u is string => Boolean(u))
  const key = candidates.join('|')
  // how many of the candidates have failed to load (reset automatically when they change)
  const [fails, setFails] = useState({ key, n: 0 })
  const n = fails.key === key ? fails.n : 0
  const url = candidates[n]

  useEffect(() => {
    if (!url) {
      onFail?.()
      return
    }
    let alive = true
    const probe = new Image()
    probe.onerror = () => {
      if (alive) setFails({ key, n: n + 1 })
    }
    probe.src = url
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, n])

  if (!url) {
    return letter ? (
      <span
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center text-xs text-slate-500"
      >
        {letter}
      </span>
    ) : null
  }
  return (
    <div
      role="img"
      style={{
        width: size,
        height: size,
        flex: 'none',
        backgroundImage: `url("${url}")`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        borderRadius: round ? '9999px' : undefined
      }}
    />
  )
}
