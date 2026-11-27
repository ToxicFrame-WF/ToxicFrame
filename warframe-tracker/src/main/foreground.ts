import { execFile } from 'child_process'
import { readFileSync } from 'fs'

// Fixed script, no user input. Prints the process name of the foreground window.
const SCRIPT = `Add-Type -Namespace W -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int p);'
$p = 0; [void][W.U]::GetWindowThreadProcessId([W.U]::GetForegroundWindow(), [ref]$p)
(Get-Process -Id $p).ProcessName`

// Any failure counts as "not in the foreground" so the notification still shows.
export function isWarframeForeground(): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform === 'linux') return void linuxForeground().then(resolve)
    if (process.platform !== 'win32') return resolve(false)
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', SCRIPT],
      { timeout: 3000, windowsHide: true },
      (err, out) => resolve(!err && /^Warframe/i.test(String(out).trim()))
    )
  })
}

let warnedNoXdotool = false

// Linux: Warframe runs under Wine/XWayland, so the X11 active window's pid belongs to the Wine process.
function linuxForeground(): Promise<boolean> {
  return new Promise((resolve) =>
    execFile('xdotool', ['getactivewindow', 'getwindowpid'], { timeout: 3000 }, (err, out) => {
      if (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT' && !warnedNoXdotool) {
          warnedNoXdotool = true
          console.warn('xdotool not found: cannot tell whether Warframe is in the foreground')
        }
        return resolve(false)
      }
      const pid = parseInt(String(out), 10)
      if (!pid) return resolve(false)
      try {
        resolve(/Warframe/i.test(readFileSync(`/proc/${pid}/cmdline`, 'latin1')))
      } catch {
        resolve(false)
      }
    })
  )
}
