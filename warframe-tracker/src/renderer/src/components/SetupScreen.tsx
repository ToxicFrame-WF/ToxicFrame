import { useState } from 'react'
import license from '../../../../../LICENSE?raw' // bundled into the build; dev allows it via server.fs.allow
import icon from '../../../../resources/icon.png'
import { updateSettings } from '../settings'

const OPTIONS = [
  {
    manual: false,
    title: 'Automatic (recommended)',
    text: 'The inventory refreshes after loading screens.'
  },
  {
    manual: true,
    title: 'Manual',
    text: 'The inventory helper only runs when you press Refresh.'
  }
]

// First-run screen: intro, license and the inventory choice. Shown until accepted.
export default function SetupScreen({
  controls
}: {
  controls: React.ReactNode
}): React.JSX.Element {
  const [manual, setManual] = useState(false)
  const [accepted, setAccepted] = useState(false)
  return (
    <div className="flex h-full flex-col bg-slate-950">
      <div className="nc-topnav flex shrink-0 items-center border-b pl-4 [-webkit-app-region:drag]">
        <span className="font-tektur text-sm font-bold italic tracking-[0.12em]">
          <span className="text-[#ff6b5a]">Toxic</span>
          <span className="text-[#50d8e0]">Frame</span>
        </span>
        {/* spacer: main.css disables ml-auto inside .nc-topnav */}
        <div className="flex-1" />
        {controls}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 rounded-2xl border border-[#a63a45] bg-gradient-to-b from-[#2a0c0f] to-[#12080a] p-6">
          <div className="flex items-center gap-4 border-b border-[#a63a45] pb-3">
            <img src={icon} alt="" className="h-16 w-16" />
            <div>
              <div className="font-tektur text-3xl font-bold tracking-wide text-slate-100">
                Welcome to{' '}
                <span className="italic">
                  <span className="text-[#ff6b5a]">Toxic</span>
                  <span className="text-[#50d8e0]">Frame</span>
                </span>
              </div>
              <div className="font-tektur text-xs font-medium uppercase tracking-[0.3em] text-[#a63a45]">
                First setup
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            ToxicFrame is a Warframe companion: inventory, relics, rivens and market in one place.
            It is a fan-made tool, not affiliated with Digital Extremes. Use it at your own risk.
          </p>
          <section>
            <div className="mb-1 font-tektur text-sm font-bold uppercase tracking-[0.2em] text-[#ff6b5a]">
              License
            </div>
            <p className="mb-2 text-sm text-slate-300">
              ToxicFrame is free software under the GPL-3.0-or-later license.
            </p>
            <pre className="h-40 overflow-y-auto whitespace-pre-wrap rounded border border-[#a63a45] bg-black/40 p-2 text-xs text-slate-400">
              {license}
            </pre>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              I accept the license
            </label>
          </section>
          <section>
            <div className="mb-2 font-tektur text-sm font-bold uppercase tracking-[0.2em] text-[#ff6b5a]">
              Inventory updates
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {OPTIONS.map((o) => (
                <button
                  key={o.title}
                  role="radio"
                  aria-checked={manual === o.manual}
                  onClick={() => setManual(o.manual)}
                  className={`rounded border p-3 text-left ${
                    manual === o.manual
                      ? 'border-[#5ef6ff] bg-[#50d8e0]/10'
                      : 'border-[#a63a45] hover:bg-white/5'
                  }`}
                >
                  <div className="font-tektur font-bold normal-case tracking-wide text-slate-100">
                    {o.title}
                  </div>
                  <div className="text-xs normal-case tracking-normal text-slate-400">{o.text}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">You can change this later in Settings.</p>
          </section>
          <button
            disabled={!accepted}
            onClick={() => updateSettings({ manualInventory: manual, setupDone: true })}
            className="rounded border border-[#5ef6ff] bg-[#50d8e0]/15 px-4 py-2 font-tektur font-bold normal-case tracking-wider text-[#5ef6ff] enabled:hover:bg-[#50d8e0]/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Accept and start
          </button>
        </div>
      </div>
    </div>
  )
}
