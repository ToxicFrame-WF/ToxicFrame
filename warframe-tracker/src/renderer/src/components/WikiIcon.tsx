// Official wiki icons (white PNGs, names verified 2026-11-16), tinted with a CSS mask so the
// colour can match the card. If the picture fails to load the mask shows nothing, so the title
// still explains it on hover.
export default function WikiIcon({
  file,
  title,
  color,
  size = 22
}: {
  file: string
  title: string
  color: string
  size?: number
}): React.JSX.Element {
  // !border-0: icons skip the Night City picture frame. Only the wiki's white "(xWhite)" icons can be tinted; coloured pictures are shown as they are
  if (!file.includes('(xWhite)'))
    return (
      <img
        loading="lazy"
        src={`https://wiki.warframe.com/images/${encodeURIComponent(file)}`}
        alt={title}
        title={title}
        width={size}
        height={size}
        className="inline-block shrink-0 object-contain !border-0"
      />
    )
  const url = `url("https://wiki.warframe.com/images/${encodeURIComponent(file)}")`
  return (
    <span
      title={title}
      aria-label={title}
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center'
      }}
    />
  )
}
