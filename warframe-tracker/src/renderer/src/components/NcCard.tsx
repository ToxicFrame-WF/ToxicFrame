// Night City item card frame, taken from the Night City inventory card: a cyan name tab with a
// slanted end above a cyan-framed box. The card inside keeps
// its content; main.css drops its own frame and the name it shows (marked with "nc-name").
export default function NcCard({
  title,
  active,
  accent,
  className = '',
  children
}: {
  title: string
  className?: string // on the card itself, e.g. "min-h-0 flex-1" to fill a column
  active?: boolean // selected card: lit like a hovered one
  accent?: string // recolours the tab and frame, e.g. green for something finished
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <article className={`nc-card flex min-w-0 flex-col ${className}`} data-on={active || undefined}>
      <div
        className="nc-tab shrink-0 truncate px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-black"
        style={{ maxWidth: '85%', ...(accent ? { background: accent } : {}) }}
        title={title}
      >
        {title}
      </div>
      <div
        className="nc-card-body flex min-h-0 flex-1 flex-col border"
        style={{ background: '#00000040', ...(accent ? { borderColor: `${accent}99` } : {}) }}
      >
        {children}
      </div>
    </article>
  )
}
