// Community grade for an arbitration node (tier list by the Arbitration Goons, shown on browse.wf).
const COLORS: Record<string, string> = {
  S: 'border-amber-300/60 bg-amber-400/15 text-amber-200',
  A: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200',
  B: 'border-sky-400/60 bg-sky-500/15 text-sky-200',
  C: 'border-slate-400/60 bg-slate-500/15 text-slate-200',
  D: 'border-orange-400/60 bg-orange-500/15 text-orange-200',
  F: 'border-rose-400/60 bg-rose-500/15 text-rose-200'
}

export default function TierBadge({
  tier,
  long = false
}: {
  tier?: string
  long?: boolean // "S Tier" instead of "S"
}): React.JSX.Element | null {
  if (!tier && !long) return null
  const cls = tier ? (COLORS[tier] ?? COLORS.C) : 'border-slate-600 bg-slate-900/60 text-slate-300'
  return (
    <span
      title={
        tier ? `Community grade ${tier} (Arbitration Goons)` : 'No community grade for this node'
      }
      className={`shrink-0 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-bold ${cls}`}
    >
      {tier ? (long ? `${tier} Tier` : tier) : long ? 'Unrated' : '—'}
    </span>
  )
}
