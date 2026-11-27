// Flat line icons drawn in the current text colour (Windows draws emoji in colour).
const PATHS = {
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  bellOff: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20',
  lock: 'M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V7a4 4 0 0 1 8 0v4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  clock: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 6v6l4 2',
  gift: 'M3 8h18v4H3zM12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5',
  chart: 'M3 3v18h18M7 16v-4M12 16V8M17 16V9',
  infinity:
    'M12 12c-2-2.7-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.3 6-4zm0 0c2 2.7 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.3-6 4z',
  coins:
    'M4 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM4 7v5c0 1.7 3.1 3 7 3M18 7v3M4 12v5c0 1.7 3.1 3 7 3M14 15c0-1.4 2.2-2.5 5-2.5s5 1.1 5 2.5-2.2 2.5-5 2.5-5-1.1-5-2.5zm0 0v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4',
  cart: 'M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6M9 21h.01M18 21h.01',
  swap: 'M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7',
  search: 'M3 11a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.3-4.3',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  sort: 'M3 6h18M6 12h12M10 18h4',
  gear: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1'
} as const

export default function Icon({
  name,
  size = 16,
  className = ''
}: {
  name: keyof typeof PATHS
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
