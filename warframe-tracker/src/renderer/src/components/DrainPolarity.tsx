import WikiIcon from './WikiIcon'

// A mod's capacity drain with its polarity icon, as the game shows it ("18" + Madurai mark).
// Rivens: drain is 10 at rank 0 and +1 per rank (base drain 10 for every riven type).
// Polarity names from the riven fingerprint (AP_ATTACK …) to the wiki's names and icons.
const POLARITY: Record<string, string> = {
  attack: 'Madurai',
  defense: 'Vazarin',
  tactic: 'Naramon',
  power: 'Zenurik',
  ward: 'Unairu',
  precept: 'Penjaga',
  umbra: 'Umbra',
  // warframe.market auction values are the wiki names, lower case
  madurai: 'Madurai',
  vazarin: 'Vazarin',
  naramon: 'Naramon',
  zenurik: 'Zenurik',
  unairu: 'Unairu',
  penjaga: 'Penjaga'
}

export default function DrainPolarity({
  drain,
  polarity,
  size = 14
}: {
  drain: number
  polarity?: string
  size?: number
}): React.JSX.Element {
  const name = polarity ? (POLARITY[polarity] ?? polarity) : undefined
  return (
    <span
      className="inline-flex items-center gap-1 font-semibold"
      title={`Drains ${drain} mod capacity${name ? ` · ${name} polarity` : ''}`}
    >
      {drain}
      {name && (
        <WikiIcon
          file={`${name}_Pol(xWhite).png`}
          title={`${name} polarity`}
          color="currentColor"
          size={size}
        />
      )}
    </span>
  )
}
