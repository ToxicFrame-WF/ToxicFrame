import { timeLeft, useNow } from '../hooks/useWorldState'

// Ticks on its own so the screen around it doesn't redraw every second
export default function Countdown({ to }: { to: string }): React.JSX.Element {
  return <>{timeLeft(to, useNow())}</>
}
