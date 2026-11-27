import { app } from 'electron'
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tsvLines } from './ocrTsv'

export type OcrResult = { text: string; lines: string[] }

// One long-lived PowerShell: reads a PNG path per stdin line, writes one JSON line per image.
// '::rect' answers with the active window's client area "x,y,w,h" in screen pixels.
// The line '::fg' instead answers with the foreground window's process name (no start-up cost).
const SCRIPT = `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics,ContentType=WindowsRuntime]
$asTask=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'})[0]
function Await($op,$t){$task=$asTask.MakeGenericMethod($t).Invoke($null,@($op));$task.Wait();$task.Result}
$e=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
Add-Type -Namespace W -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int p); [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r); [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p); public struct RECT { public int L, T, R, B; } public struct POINT { public int X, Y; }'
[Console]::Out.WriteLine('{"ready":true}');[Console]::Out.Flush()
while(($path=[Console]::In.ReadLine()) -ne $null){
  if($path -eq '::rect'){
    $h=[W.U]::GetForegroundWindow();$r=New-Object W.U+RECT;$pt=New-Object W.U+POINT
    [void][W.U]::GetClientRect($h,[ref]$r);[void][W.U]::ClientToScreen($h,[ref]$pt)
    $o=@{lines=@("$($pt.X),$($pt.Y),$($r.R),$($r.B)")}
    [Console]::Out.WriteLine((ConvertTo-Json $o -Compress));[Console]::Out.Flush();continue
  }
  if($path -eq '::fg'){
    $p=0;[void][W.U]::GetWindowThreadProcessId([W.U]::GetForegroundWindow(),[ref]$p)
    $o=@{lines=@((Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName)}
    [Console]::Out.WriteLine((ConvertTo-Json $o -Compress));[Console]::Out.Flush();continue
  }
  try{
    $f=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
    $s=Await ($f.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $d=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($s)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $b=Await ($d.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $r=Await ($e.RecognizeAsync($b)) ([Windows.Media.Ocr.OcrResult])
    $o=@{lines=@($r.Lines|%{$_.Text})}
  }catch{ $o=@{error=$_.Exception.Message;lines=@()} }
  [Console]::Out.WriteLine((ConvertTo-Json $o -Compress));[Console]::Out.Flush()
}`

type Job = { resolve: (r: OcrResult) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
let proc: ChildProcessWithoutNullStreams | null = null
let ready: Promise<void> | null = null
let buf = ''
const pending: Job[] = []
let chain: Promise<unknown> = Promise.resolve()

function failAll(err: Error): void {
  for (const j of pending.splice(0)) {
    clearTimeout(j.timer)
    j.reject(err)
  }
}

function start(): Promise<void> {
  const scriptFile = join(ocrTempDir(), 'ocr.ps1') // -File: stdin stays ours (-EncodedCommand hung)
  writeFileSync(scriptFile, SCRIPT)
  const p = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptFile],
    { windowsHide: true }
  )
  proc = p
  buf = ''
  return new Promise<void>((resolve, reject) => {
    let up = false
    p.stdout.setEncoding('utf8')
    p.stdout.on('data', (d: string) => {
      buf += d
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (!line) continue
        if (!up) {
          up = true
          resolve()
          continue
        }
        const job = pending.shift()
        if (!job) continue
        clearTimeout(job.timer)
        try {
          // OCR text can hold control characters the JSON writer lets through
          const o = JSON.parse([...line].map((c) => (c < ' ' ? ' ' : c)).join('')) as {
            lines?: string[] | string
            error?: string
          }
          if (o.error) job.reject(new Error(o.error))
          else {
            const lines = (Array.isArray(o.lines) ? o.lines : o.lines ? [o.lines] : []).filter(
              Boolean
            )
            job.resolve({ text: lines.join('\n'), lines })
          }
        } catch (e) {
          job.reject(e as Error)
        }
      }
    })
    const dead = (): void => {
      if (proc === p) proc = ready = null
      if (!up) reject(new Error('OCR process failed to start'))
      failAll(new Error('OCR process exited'))
    }
    p.on('exit', dead)
    p.on('error', dead)
  })
}

// Linux: same '::fg' / '::rect' / png-path protocol, answered by xdotool and the tesseract CLI.
// A missing tool logs once and answers empty, so callers see "not Warframe / no rect / no text".
const warned = new Set<string>()
function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve) =>
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 16e6 }, (err, out) => {
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT' && !warned.has(cmd)) {
        warned.add(cmd)
        console.warn(
          `[ocr] '${cmd}' not found: install ${cmd === 'tesseract' ? 'tesseract and tesseract-data-eng' : 'xdotool'}`
        )
      }
      resolve(err ? '' : out)
    })
  )
}

async function linuxOnce(job: string, timeoutMs: number): Promise<OcrResult> {
  let lines: string[]
  if (job === '::fg' || job === '::rect') {
    const id = (await run('xdotool', ['getactivewindow'], timeoutMs)).trim()
    const pid = id && (await run('xdotool', ['getwindowpid', id], timeoutMs)).trim()
    let cmd = ''
    try {
      cmd = pid && /^\d+$/.test(pid) ? readFileSync(`/proc/${pid}/cmdline`, 'utf8') : ''
    } catch {
      /* process gone */
    }
    if (!/Warframe\.x64\.exe/i.test(cmd)) lines = []
    else if (job === '::fg') lines = ['Warframe']
    else {
      const g = Object.fromEntries(
        (await run('xdotool', ['getwindowgeometry', '--shell', id], timeoutMs))
          .split('\n')
          .map((l) => l.split('='))
      )
      lines = g.WIDTH ? [`${g.X},${g.Y},${g.WIDTH},${g.HEIGHT}`] : []
    }
  } else {
    // psm 6: reward name boxes are one block of 1-2 lines
    lines = tsvLines(
      await run('tesseract', [job, 'stdout', '-l', 'eng', '--psm', '6', 'tsv'], timeoutMs)
    )
  }
  return { text: lines.join('\n'), lines }
}

function once(pngPath: string, timeoutMs: number): Promise<OcrResult> {
  if (process.platform === 'linux') return linuxOnce(pngPath, timeoutMs)
  ready ??= start()
  return ready.then(
    () =>
      new Promise<OcrResult>((resolve, reject) => {
        // died after start: a job queued now would take the next process's first answer
        if (!proc) return reject(new Error('OCR process exited'))
        const timer = setTimeout(() => {
          proc?.kill() // exit handler rejects everything and clears state
        }, timeoutMs)
        pending.push({ resolve, reject, timer })
        proc.stdin.write(pngPath + '\n')
      })
  )
}

/** OCR one PNG. Serialised; retries once with a fresh process if the old one died or timed out. */
export function ocrImage(pngPath: string, timeoutMs = 8000): Promise<OcrResult> {
  const run = async (): Promise<OcrResult> => {
    try {
      return await once(pngPath, timeoutMs)
    } catch (e) {
      if (!/exited|failed to start/.test(String(e))) throw e
      return once(pngPath, timeoutMs)
    }
  }
  const r = chain.then(run, run)
  chain = r.catch(() => undefined)
  return r
}

/** Is Warframe the active window? Uses the running PowerShell, so it answers in milliseconds. */
export async function isWarframeActive(): Promise<boolean> {
  try {
    return /^Warframe/i.test((await ocrImage('::fg', 3000)).text)
  } catch {
    return false
  }
}

/** The active window's drawing area in physical screen pixels (call while Warframe is active). */
export async function activeWindowRect(): Promise<{
  x: number
  y: number
  w: number
  h: number
} | null> {
  try {
    const [x, y, w, h] = (await ocrImage('::rect', 3000)).text.split(',').map(Number)
    return w > 0 && h > 0 ? { x, y, w, h } : null
  } catch {
    return null
  }
}

/** Start the PowerShell early so the first overlay does not pay its start-up. */
export function warmOcr(): void {
  if (process.platform === 'linux') return
  ready ??= start()
  ready.catch(() => undefined)
}

export function ocrTempDir(): string {
  const d = join(app.getPath('temp'), 'toxicframe-ocr')
  mkdirSync(d, { recursive: true })
  return d
}

// A fresh name per capture: rewriting one fixed file failed with "UNKNOWN: open" while the OCR
// process (or a virus scanner) still held the previous copy. 32 names rotate, so the folder stays small.
let tempN = 0
export function ocrTempFile(name: string): string {
  return join(ocrTempDir(), `${tempN++ % 32}-${name}`)
}

export function shutdownOcr(): void {
  proc?.kill()
  proc = ready = null
}
