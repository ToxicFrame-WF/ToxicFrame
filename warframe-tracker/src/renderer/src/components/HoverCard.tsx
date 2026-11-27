import { useLayoutEffect, useRef, useState } from 'react'
import NcCard from './NcCard'

// A list row that opens a card when hovered or focused (keyboard too). The card is fixed to the
// window, beside the row, so scrolling panels can't clip it, and it moves up when it would run
// past the bottom. In Night City it is the house card frame with `title` in its tab.
export default function HoverCard({
  title,
  content,
  side = 'left',
  className = '',
  children
}: {
  title: string
  content: React.ReactNode
  side?: 'left' | 'right' | 'cursor' // beside the row, or following the mouse
  className?: string // on the row
  children: React.ReactNode
}): React.JSX.Element {
  const [at, setAt] = useState<{ left?: number; right?: number; top: number } | null>(null)
  const show = (e: React.SyntheticEvent<HTMLLIElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    setAt(
      side === 'left'
        ? { right: window.innerWidth - r.left + 8, top: r.top }
        : { left: r.right + 8, top: r.top }
    )
  }
  // 'cursor': just below-right of the pointer, flipped left near the window's right edge
  // (keyboard focus has no pointer, so it opens right of the row)
  const follow = (e: React.MouseEvent<HTMLLIElement>): void => {
    if (side !== 'cursor') return
    const top = e.clientY + 16
    setAt(
      e.clientX + 16 + 384 > window.innerWidth
        ? { right: window.innerWidth - e.clientX + 16, top }
        : { left: e.clientX + 16, top }
    )
  }
  const hide = (): void => setAt(null)
  // once drawn, move the card up if it would run past the bottom of the window
  const card = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = card.current
    if (!at || !el) return
    const top = Math.max(8, Math.min(at.top, window.innerHeight - el.offsetHeight - 8))
    if (top !== at.top) setAt({ ...at, top })
  }, [at])
  return (
    <li
      tabIndex={0}
      onMouseEnter={side === 'cursor' ? follow : show}
      onMouseMove={follow}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className={`cursor-help outline-none focus:bg-white/5 ${className}`}
    >
      {children}
      {at && (
        <div
          ref={card}
          role="tooltip"
          className="nc-dialog-card pointer-events-none fixed z-50 w-96 text-left bg-transparent"
          style={at}
        >
          <NcCard title={title}>
            <div className="p-4">
              <div className="nc-name mb-3 text-base font-bold text-white">{title}</div>
              {content}
            </div>
          </NcCard>
        </div>
      )}
    </li>
  )
}

// A line that opens a card of modifiers with their descriptions when hovered or focused. The
// card is fixed to the window, left of the line: the scrolling panel would clip it otherwise.
type Mod = { name: string; desc?: string }
export function ModifierHover({
  title,
  deviation,
  mods,
  label,
  children
}: {
  title: string
  deviation?: Mod // the mission's special twist, shown on its own
  mods: Mod[]
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <HoverCard
      title={title}
      className="flex items-center justify-between rounded px-1 py-0.5 hover:bg-white/5"
      content={
        <>
          {deviation && (
            <div className="mb-3 border-l-2 border-amber-300 bg-amber-300/10 px-3 py-2">
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                Deviation
              </div>
              <div className="text-sm font-semibold text-white">{deviation.name}</div>
              {deviation.desc && (
                <div className="mt-0.5 text-[13px] leading-relaxed text-white/75">
                  {deviation.desc}
                </div>
              )}
            </div>
          )}
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
            {label}
          </div>
          {mods.map((m) => (
            <div key={m.name} className="border-t border-white/10 py-2 first-of-type:border-t-0">
              <div className="text-sm font-semibold text-white">{m.name}</div>
              {m.desc && (
                <div className="mt-0.5 text-[13px] leading-relaxed text-white/75">{m.desc}</div>
              )}
            </div>
          ))}
        </>
      }
    >
      <span className="min-w-0 truncate">{children}</span>
      <span className="text-xs text-white/40" aria-hidden>
        ⓘ
      </span>
    </HoverCard>
  )
}
