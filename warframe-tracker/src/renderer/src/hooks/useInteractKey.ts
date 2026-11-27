import { useEffect, useState } from 'react'
import { displayAccelerator } from '../hotkeys'

// The overlay's "click on it" hotkey as text ("Ctrl + Tab"), or '' when it is off. Read again
// whenever `refresh` changes (e.g. each time a panel opens), since it is set in another window.
export function useInteractKey(refresh?: unknown): string {
  const [key, setKey] = useState('Ctrl + Tab')
  useEffect(() => {
    window.api
      .getOverlayHotkeys()
      .then((k) => setKey(k.interact ? displayAccelerator(k.interact) : ''))
      .catch(() => undefined)
  }, [refresh])
  return key
}
