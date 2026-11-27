import { useEffect, useState } from 'react'

// The game's Void Traces icon (a drawn one if it can't be loaded).
let traceIcon: Promise<string | null> | null = null // one lookup for every card
export default function VoidTraceIcon({ small }: { small?: boolean }): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    ;(traceIcon ??= window.api.getVoidTraceIcon().catch(() => null)).then(setSrc)
  }, [])
  const size = small ? 'h-4 w-4' : 'h-7 w-7'

  // the game's own icon; the drawn one is only a fallback if it can't be loaded
  if (src && !failed) {
    return (
      <img
        loading="lazy"
        src={src}
        alt=""
        className={`${size} object-contain !border-0`}
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <svg viewBox="0 0 32 32" className={size} aria-hidden>
      <defs>
        <linearGradient id="voidTrace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eaf5ff" />
          <stop offset="1" stopColor="#4aa3ff" />
        </linearGradient>
      </defs>
      <path
        d="M16 2c1 6 8 8 8 15a8 8 0 0 1-16 0c0-3 2-5 3-7 1 2 2 3 3 3 0-4-1-7 2-11z"
        fill="url(#voidTrace)"
      />
      <path
        d="M12 22c2 3 8 3 10-1"
        stroke="#0b0e18"
        strokeOpacity=".35"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
