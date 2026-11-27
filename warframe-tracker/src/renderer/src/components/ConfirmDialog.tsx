import { useEffect, useRef } from 'react'
import NcCard from './NcCard'

// The app's own confirm box; open it with confirmBox() from ./confirmBox.
export interface ConfirmOptions {
  title: string
  message: React.ReactNode
  confirm?: string // label of the confirming button, default "OK"
  danger?: boolean // red confirming button, for actions that remove something
}

export default function ConfirmDialog({
  title,
  message,
  confirm = 'OK',
  danger,
  onDone
}: ConfirmOptions & { onDone: (ok: boolean) => void }): React.JSX.Element {
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    // capture + stopPropagation: Escape closes only this box, not the dialog under it
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onDone(false)
      } else if (e.key === 'Tab') {
        const f = card.current?.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]')
        if (!f?.length) return
        const first = f[0]
        const last = f[f.length - 1]
        const at = document.activeElement
        if (!card.current?.contains(at) || (e.shiftKey && at === first)) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
        } else if (!e.shiftKey && at === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      before?.focus?.()
    }
  }, [onDone])
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6"
      onClick={() => onDone(false)}
    >
      <div
        ref={card}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="nc-dialog-card w-full max-w-md rounded-lg bg-slate-800 text-slate-100 shadow-2xl"
      >
        <NcCard title={title}>
          <div className="p-5 text-sm">
            <div className="leading-relaxed text-slate-200">{message}</div>
            <div className="mt-5 flex justify-end gap-2">
              {/* nc-quiet: Cancel must not look like the dangerous button */}
              <button
                onClick={() => onDone(false)}
                className="nc-quiet rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                autoFocus
                onClick={() => onDone(true)}
                className={`rounded-lg px-4 py-1.5 font-semibold text-white ${
                  danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-violet-600 hover:bg-violet-500'
                }`}
              >
                {confirm}
              </button>
            </div>
          </div>
        </NcCard>
      </div>
    </div>
  )
}
