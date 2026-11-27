import { useEffect, useRef, useState } from 'react'
import NcCard from './NcCard'
import { createPortal } from 'react-dom'
import { toAlecaFrame } from '../afExport'

// Stats > "Data export & API": export stats + trades in AlecaFrame's JSON layout, or import one
// AlecaFrame export (days fill gaps in Stats, trades go to Trading > Analytics).
export default function DataExport(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  const exportJson = async (): Promise<void> => {
    const [history, trades, meta] = await Promise.all([
      window.api.getStatsHistory(),
      window.api.getTrades(),
      window.api.getItemMeta()
    ])
    const names = new Map(Object.values(meta).map((e) => [e.id, e.name]))
    const json = toAlecaFrame(history.days, trades, (id) => names.get(id))
    const url = URL.createObjectURL(new Blob([JSON.stringify(json)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'toxicframeStatsExport.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage(`Exported ${trades.length} trades and ${Object.keys(history.days).length} days.`)
  }

  const importJson = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const r = await window.api.importAlecaFrame(await file.text())
    setMessage(
      r.ok
        ? `Imported ${r.days} days and ${r.trades} trades. Reopen the page to see them.`
        : (r.error ?? 'Import failed.')
    )
  }

  const [confirming, setConfirming] = useState(false)
  const undoImport = async (): Promise<void> => {
    setConfirming(false)
    const r = await window.api.undoLastImport()
    setMessage(
      r
        ? `Removed ${r.days} days and ${r.trades} trades from the last import. Reopen the page to see it.`
        : 'There is no import to undo.'
    )
  }

  const item = 'block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-800'
  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => {
          const b = btnRef.current?.getBoundingClientRect()
          if (b) setPos({ left: Math.max(8, b.right - 288), top: b.bottom + 8 }) // right-aligned, 288px = w-72
          setOpen((o) => !o)
        }}
        aria-expanded={open}
        className="rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
      >
        ⤓ Data export &amp; API
      </button>
      {open &&
        // rendered on <body>: the page panel's cut-corner clip would hide anything that sticks out
        createPortal(
          <div
            className="fixed z-50 w-72 border border-slate-600 bg-[#170710] p-2 shadow-xl"
            style={pos}
          >
            <div>
              <button onClick={exportJson} className={item}>
                Export data as JSON
              </button>
              <button onClick={() => fileRef.current?.click()} className={item}>
                Import data (ToxicFrame or AlecaFrame)
              </button>
              <button onClick={() => setConfirming(true)} className={item}>
                Undo last import
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                onChange={importJson}
                className="hidden"
              />
              {message && <p className="px-3 pt-2 text-xs text-slate-300">{message}</p>}
            </div>
          </div>,
          document.body
        )}
      {confirming && (
        <ConfirmUndo onCancel={() => setConfirming(false)} onConfirm={() => void undoImport()} />
      )}
    </div>
  )
}

// In-app confirm (the system dialog does not match the app): a card over a dark backdrop.
function ConfirmUndo({
  onCancel,
  onConfirm
}: {
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  const btn = 'rounded-lg border px-4 py-2 text-sm font-semibold'
  return createPortal(
    <section
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-label="Undo last import"
        onClick={(e) => e.stopPropagation()}
        className="nc-dialog-card w-full max-w-md rounded-lg bg-[#1b1e2b] text-slate-100"
      >
        <NcCard title="Undo last import">
          <div className="p-5">
            <div className="nc-name mb-2 text-lg font-bold">Undo last import</div>
            <p className="text-sm text-slate-300">
              Remove the days and trades the last import added? Everything recorded since stays.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onCancel} className={`${btn} border-slate-600 hover:bg-slate-800`}>
                Cancel
              </button>
              <button
                autoFocus
                onClick={onConfirm}
                className={`${btn} border-rose-400/70 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30`}
              >
                Undo import
              </button>
            </div>
          </div>
        </NcCard>
      </div>
    </section>,
    document.querySelector('main') ?? document.body
  )
}
