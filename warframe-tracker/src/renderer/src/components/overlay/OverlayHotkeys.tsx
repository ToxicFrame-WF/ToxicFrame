import { useEffect, useState } from 'react'
import { acceleratorFromEvent, displayAccelerator } from '../../hotkeys'

type Which = 'toggle' | 'interact' | 'riven'

function Row({
  label,
  hint,
  value,
  error,
  onSet
}: {
  label: string
  hint?: string
  value: string
  error?: string
  onSet: (accel: string) => void
}): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  return (
    <div className="border-t border-slate-700/70 py-2.5 first:border-t-0">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-sm text-slate-200">{label}</span>
        <button
          type="button"
          onClick={() => setRecording(true)}
          onBlur={() => setRecording(false)}
          onKeyDown={(e) => {
            if (!recording) return
            e.preventDefault()
            if (e.key === 'Escape') return setRecording(false)
            const accel = acceleratorFromEvent(e)
            if (!accel) return // lone modifier or unsupported key
            setRecording(false)
            onSet(accel)
          }}
          className="nc-quiet w-44 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 hover:border-slate-500"
        >
          {recording ? 'Press keys…' : displayAccelerator(value)}
        </button>
        <button
          type="button"
          title="Turn off"
          disabled={!value}
          onClick={() => onSet('')}
          className="nc-quiet rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-40"
        >
          ✕
        </button>
      </div>
      {hint && <div className="mt-1 text-xs !normal-case text-slate-500">{hint}</div>}
      {error && <div className="mt-1 text-xs !normal-case text-rose-400">{error}</div>}
    </div>
  )
}

export default function OverlayHotkeys(): React.JSX.Element {
  const [keys, setKeys] = useState<Record<Which, string>>({ toggle: '', interact: '', riven: '' })
  const [errors, setErrors] = useState<Partial<Record<Which, string>>>({})
  useEffect(() => {
    window.api.getOverlayHotkeys().then((h) => setKeys(h))
  }, [])
  const set = async (which: Which, accel: string): Promise<void> => {
    const r = await window.api.setOverlayHotkey(which, accel)
    setErrors((e) => ({ ...e, [which]: r.ok ? undefined : r.error }))
    if (r.ok) setKeys((k) => ({ ...k, [which]: accel }))
  }
  return (
    <div>
      <Row
        label="Show / hide recommended relics"
        hint="Off by default: the overlay opens by itself on the relic screen."
        value={keys.toggle}
        error={errors.toggle}
        onSet={(a) => set('toggle', a)}
      />
      <Row
        label="Read the riven card on screen"
        hint="Off by default: the riven overlay opens by itself on the riven cycle screen."
        value={keys.riven}
        error={errors.riven}
        onSet={(a) => set('riven', a)}
      />
      <Row
        label="Click on the overlay (scroll, close)"
        hint={keys.interact ? undefined : 'Off: the overlay can never be clicked.'}
        value={keys.interact}
        error={errors.interact}
        onSet={(a) => set('interact', a)}
      />
    </div>
  )
}
