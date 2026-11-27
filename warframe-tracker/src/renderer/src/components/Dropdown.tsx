import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type DropdownOption = { value: string; label: string; disabled?: boolean }

// Shared replacement for the native <select> (its OS popup does not match the Night City look).
export default function Dropdown({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className = '',
  ariaLabel,
  title,
  disabled
}: {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  label?: string // dim uppercase prefix, e.g. "Sort"
  size?: 'md' | 'sm'
  className?: string
  ariaLabel?: string
  title?: string
  disabled?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    maxH: number
  }>()
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const selected = options.find((o) => o.value === value)

  const close = (refocus = true): void => {
    setOpen(false)
    if (refocus) btn.current?.focus()
  }
  const openUp = (): void => {
    const i = options.findIndex((o) => o.value === value && !o.disabled)
    setActive(
      i >= 0
        ? i
        : Math.max(
            0,
            options.findIndex((o) => !o.disabled)
          )
    )
    setOpen(true)
  }
  const pick = (i: number): void => {
    const o = options[i]
    if (!o || o.disabled) return
    if (o.value !== value) onChange(o.value)
    close()
  }
  const step = (from: number, dir: 1 | -1): number => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir)
      if (!options[i].disabled) return i
    return from
  }

  // Place under the button, flip up when there is more room above.
  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - 8
    const above = r.top - 8
    const up = below < 220 && above > below
    setPos({
      left: r.left,
      width: r.width,
      ...(up ? { bottom: window.innerHeight - r.top + 2 } : { top: r.bottom + 2 }),
      maxH: Math.max(120, Math.min(320, up ? above : below))
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent): void => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    const away = (e: Event): void => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false) // page scrolled or resized
    }
    document.addEventListener('mousedown', down)
    window.addEventListener('resize', away)
    window.addEventListener('scroll', away, true)
    return () => {
      document.removeEventListener('mousedown', down)
      window.removeEventListener('resize', away)
      window.removeEventListener('scroll', away, true)
    }
  }, [open])

  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true })
  }, [open, pos])
  useEffect(() => {
    panel.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, pos])

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation() // do not also close a dialog around us
      close()
    } else if (e.key === 'Tab') setOpen(false)
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(step(active, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(step(active, -1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(step(-1, 1))
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(step(options.length, -1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(active)
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const k = e.key.toLowerCase()
      const n = options.length
      for (let j = 1; j <= n; j++) {
        const i = (active + j) % n
        if (!options[i].disabled && options[i].label.toLowerCase().startsWith(k)) {
          setActive(i)
          break
        }
      }
    }
  }

  const sm = size === 'sm'
  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(false) : openUp())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            openUp()
          }
        }}
        // nc-quiet: inside a card the theme would paint every bordered button red
        className={`nc-quiet inline-flex min-w-0 items-center gap-2 border border-cyan-400/60 bg-black/40 text-left !normal-case !tracking-normal hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 ${
          sm ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
        } ${className}`}
      >
        {label && (
          <span className="shrink-0 text-[10px] font-normal !uppercase tracking-widest text-white/50">
            {label}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-bold">{selected?.label ?? ''}</span>
        <svg aria-hidden viewBox="0 0 10 6" className="h-1.5 w-2.5 shrink-0 text-cyan-300">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel ?? label}
            aria-activedescendant={`${id}-${active}`}
            onKeyDown={onKey}
            style={{
              position: 'fixed',
              left: pos.left,
              minWidth: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxH,
              zIndex: 10000
            }}
            className="overflow-y-auto border border-cyan-400/60 bg-[#170710] py-1 outline-none"
          >
            {options.map((o, i) => (
              <div
                key={o.value + i}
                id={`${id}-${i}`}
                data-i={i}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 !normal-case !tracking-normal ${
                  sm ? 'text-xs' : 'text-sm'
                } ${o.disabled ? 'cursor-not-allowed opacity-40' : ''} ${
                  i === active && !o.disabled ? 'bg-cyan-400/15 text-cyan-200' : 'text-white/90'
                }`}
              >
                <span aria-hidden className="w-3 shrink-0 text-cyan-300">
                  {o.value === value ? '✓' : ''}
                </span>
                {o.label}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
