import { useState } from 'react'
import { usePlanetIcons } from '../hooks/usePlanetIcons'
import Pic from './Pic'

// Ducat token: the wiki's picture when it loads, otherwise a drawn coin.
export default function DucatIcon({ size = 16 }: { size?: number }): React.JSX.Element {
  const src = usePlanetIcons().ducats
  // remember which picture failed, so a new address is tried again
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (src && failedSrc !== src)
    return <Pic src={src} size={size} onFail={() => setFailedSrc(src)} />
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className="shrink-0" aria-hidden>
      <defs>
        <radialGradient id="ducatCoin" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#c89b3c" />
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="8.5" fill="url(#ducatCoin)" stroke="#8a6d23" strokeWidth="1" />
      <circle cx="10" cy="10" r="4.5" fill="none" stroke="#8a6d23" strokeOpacity=".6" />
    </svg>
  )
}
