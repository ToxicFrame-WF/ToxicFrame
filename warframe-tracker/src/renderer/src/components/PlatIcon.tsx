import { useState } from 'react'
import { usePlanetIcons } from '../hooks/usePlanetIcons'
import Pic from './Pic'

// Platinum coin: the wiki's picture when it loads, otherwise a drawn coin.
export default function PlatIcon({ size = 16 }: { size?: number }): React.JSX.Element {
  const src = usePlanetIcons().platinum
  // remember which picture failed, so a new address is tried again
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (src && failedSrc !== src)
    return <Pic src={src} size={size} onFail={() => setFailedSrc(src)} />
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className="shrink-0" aria-hidden>
      <defs>
        <radialGradient id="platCoin" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#f4f7fb" />
          <stop offset="1" stopColor="#8d99ae" />
        </radialGradient>
      </defs>
      <path d="M10 1.5l7 4v9l-7 4-7-4v-9z" fill="url(#platCoin)" stroke="#5b667a" strokeWidth="1" />
      <path d="M10 5l4 2.3v5.4L10 15l-4-2.3V7.3z" fill="none" stroke="#ffffff" strokeOpacity=".7" />
    </svg>
  )
}
