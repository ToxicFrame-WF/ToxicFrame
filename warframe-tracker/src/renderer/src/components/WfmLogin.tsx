import { useEffect, useState } from 'react'

// Sign-in window for warframe.market, shown on top of the settings dialog.
export default function WfmLogin({
  onLinked,
  onClose
}: {
  onLinked: (name: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (): Promise<void> => {
    if (busy || !email.trim() || !password) return
    setBusy(true)
    setError('')
    const result = await window.api.wfmLogin(email.trim(), password)
    setBusy(false)
    if (result.ok) {
      setPassword('')
      onLinked(result.name ?? 'your account')
    } else {
      setError(result.error ?? 'Sign-in failed.')
    }
  }

  const input =
    'w-full rounded-lg bg-slate-900 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-600 focus:ring-violet-400'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-800 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-lg font-bold tracking-tight">
          <span className="text-sky-300">warframe</span>.market
        </div>
        <h2 className="mb-4 text-xl font-bold">Sign in to warframe.market</h2>

        <label className="mb-1 block text-sm text-slate-300">Email</label>
        <input
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className={`${input} mb-3`}
        />
        <label className="mb-1 block text-sm text-slate-300">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className={`${input} mb-4`}
        />

        {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

        <button
          onClick={submit}
          disabled={busy || !email.trim() || !password}
          className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:cursor-default disabled:opacity-50"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>

        <p className="mt-4 text-sm text-slate-300">
          New to warframe.market?{' '}
          <a
            href="https://warframe.market"
            target="_blank"
            rel="noreferrer"
            className="text-violet-300 underline"
          >
            Create an account
          </a>
        </p>

        <details className="mt-3 border-t border-slate-700 pt-3 text-sm text-slate-300">
          <summary className="cursor-pointer">Usually sign in with Steam?</summary>
          <p className="mt-2 text-xs text-slate-400">
            This sign-in needs an email and password. If your account was made through Steam, open
            your account settings on warframe.market and set an email and password there first, then
            use them here.
          </p>
        </details>

        <p className="mt-3 text-xs text-slate-500">
          Your password goes only to warframe.market and is not saved. After signing in, only a
          login token is kept, encrypted by your operating system.
        </p>
      </div>
    </div>
  )
}
