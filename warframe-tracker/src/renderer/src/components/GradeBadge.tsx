import type { Grade } from '../rivens'

// Riven grade as coloured text in a frame
const TEXT: Record<Grade, string> = {
  Perfect: 'border-amber-300/60 bg-amber-400/15 text-amber-200',
  Good: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200',
  OK: 'border-sky-400/50 bg-sky-500/10 text-sky-200',
  Bad: 'border-rose-400/50 bg-rose-500/10 text-rose-200'
}

export default function GradeBadge({ grade }: { grade: Grade }): React.JSX.Element {
  return (
    <span
      title={`Riven grade: ${grade}`}
      className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${TEXT[grade]}`}
    >
      {grade}
    </span>
  )
}
