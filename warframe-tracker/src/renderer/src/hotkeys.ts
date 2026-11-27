// Pure helpers for global hotkeys (Electron accelerator strings). Shared by the settings recorder
// and the main process validation.
const MODS = ['Control', 'Alt', 'Shift', 'Super']
const NAMED: Record<string, string> = {
  Tab: 'Tab',
  Space: 'Space',
  Enter: 'Return',
  NumpadEnter: 'Return',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/'
}

export interface KeyLike {
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

// the key part of an accelerator for a KeyboardEvent.code, or null for modifiers/unsupported keys
function keyName(code: string): string | null {
  let m = /^Key([A-Z])$/.exec(code) ?? /^Digit([0-9])$/.exec(code)
  if (m) return m[1]
  m = /^Numpad([0-9])$/.exec(code)
  if (m) return 'num' + m[1]
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
  return NAMED[code] ?? null
}

export function acceleratorFromEvent(e: KeyLike): string | null {
  const key = keyName(e.code)
  if (!key) return null
  const mods = [
    e.ctrlKey && 'Control',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
    e.metaKey && 'Super'
  ].filter(Boolean)
  return [...mods, key].join('+')
}

export const isFunctionKey = (key: string): boolean => /^F([1-9]|1[0-9]|2[0-4])$/.test(key)

// error text, or null when fine ('' = off)
export function validateAccelerator(accel: string): string | null {
  if (!accel) return null
  const parts = accel.split('+')
  const key = parts[parts.length - 1]
  if (!key || MODS.includes(key)) return 'Press a key as well as the modifier'
  if (!parts.slice(0, -1).some((p) => MODS.includes(p)) && !isFunctionKey(key))
    return 'Needs Ctrl, Alt, Shift or Win (or be a function key), or it would be taken from the game'
  return null
}

export function displayAccelerator(accel: string): string {
  if (!accel) return 'Off'
  return accel
    .split('+')
    .map((p) => (p === 'Control' ? 'Ctrl' : p === 'Super' ? 'Win' : p.replace(/^num/, 'Num ')))
    .join(' + ')
}
