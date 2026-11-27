import { useEffect, useState } from 'react'
import RecommendPanel from './RecommendPanel'
import { useSettings } from '../../settings'
import { useInteractKey } from '../../hooks/useInteractKey'
import RewardsPanel, { type RewardsData } from './RewardsPanel'
import RivenPanel, { type RivenData } from './RivenPanel'

// Root of the overlay window. The window covers the whole screen and is click-through until
// the interact hotkey; panels sit where they cover nothing the player needs. Recommended relics stays
// mounted while hidden (same place in the tree), so its relics, inventory and prices are ready
// the moment it opens.
export default function Overlay(): React.JSX.Element {
  const [s, setS] = useState<OverlayState>({ panel: null, interactive: false })
  const key = useInteractKey(s.panel)
  useEffect(() => {
    window.api.getOverlayState().then(setS)
    return window.api.onOverlayState(setS)
  }, [])
  const corner = useSettings().recommendCorner
  const era = s.panel === 'recommend' ? ((s.data as { era?: string | null })?.era ?? null) : null

  return (
    <div className="pointer-events-none fixed inset-0 select-none text-white">
      <div
        hidden={!s.panel}
        className={`pointer-events-auto absolute ${s.panel === 'rewards' || s.panel === 'riven' ? 'left-0 top-0' : { 'top-right': 'right-4 top-4', 'bottom-right': 'bottom-4 right-4', 'bottom-left': 'bottom-4 left-4' }[corner]}`}
      >
        <div className={`relative ${s.interactive ? 'outline outline-2 outline-cyan-500' : ''}`}>
          {s.interactive && (
            <button
              onClick={() => window.api.closeOverlay()}
              aria-label="Close overlay"
              className="absolute right-2 top-1.5 z-10 text-slate-300 hover:text-white"
            >
              ✕
            </button>
          )}
          {s.panel === 'rewards' && <RewardsPanel data={(s.data ?? {}) as RewardsData} />}
          {s.panel === 'riven' && (
            <RivenPanel data={(s.data ?? {}) as RivenData} interactive={s.interactive} />
          )}
          <div hidden={s.panel !== 'recommend'}>
            <RecommendPanel era={era} visible={s.panel === 'recommend'} />
          </div>
          {/* the reward boxes sit under the cards and need no clicking, so no hint there */}
          {s.panel === 'recommend' && (
            <div className="mt-1 text-center text-[11px] text-slate-300 [text-shadow:0_1px_2px_#000]">
              {key && (s.interactive ? `${key} to return to the game` : `${key} to interact`)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
