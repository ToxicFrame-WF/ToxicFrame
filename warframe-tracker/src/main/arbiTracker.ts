// Follows one Arbitration run from EE.log events, feeds the Live tab and saves a summary.
import { BrowserWindow, app } from 'electron'
import { join } from 'path'
import { readFileSync, renameSync, writeFileSync } from 'fs'
import { getPrefs } from './appPrefs'
import { arbiEventFromLine, type ArbiEvent } from './arbiParse'
import type { ArbiRun, ArbiState } from '../preload/index.d'

// wiki.warframe.com "Arbitration Shield Drone": 1x Vitus Essence at 6%; "Vitus Essence": 1 more is
// guaranteed per completed rotation. Rotations are 5 minutes in Survival.
const DRONE_VE = 0.06
export const ROTATION_SEC = 300
const expectedVitus = (r: { drones: number; rotations: number | null }): number =>
  (r.rotations ?? 0) + r.drones * DRONE_VE

let state: ArbiState = { phase: 'idle', run: null }
let startSec = 0
let drones = new Set<string>()
let pending: { node: string; name: string } | null = null

const runsFile = (): string => join(app.getPath('userData'), 'arbiRuns.json')
// throws when the file is there but unreadable or broken, so saveRun never writes over it
function readRuns(): ArbiRun[] {
  let text: string
  try {
    text = readFileSync(runsFile(), 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
  const runs = JSON.parse(text)
  if (!Array.isArray(runs)) throw new Error('arbiRuns.json is not a list')
  return runs
}
export function getArbiRuns(): ArbiRun[] {
  try {
    return readRuns()
  } catch {
    return []
  }
}
function saveRun(r: ArbiRun): void {
  try {
    writeFileSync(runsFile() + '.tmp', JSON.stringify([r, ...readRuns()]))
    renameSync(runsFile() + '.tmp', runsFile())
  } catch (e) {
    console.warn('arbitration run not saved:', e) // the old history stays as it was
  }
}

export const getArbiState = (): ArbiState => state

function push(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('arbi:state', state)
    w.webContents.send('arbi:runs')
  }
}

function finish(completed: boolean, endSec: number): void {
  const run = state.run
  if (!run) return
  const done: ArbiRun = { ...run, completed, durationSec: Math.round(endSec - startSec) }
  done.vitus = expectedVitus(done)
  saveRun(done)
  // the summary stays on the Live tab until the next run starts
  state = { phase: 'done', run: done }
  push()
}

export function onArbiEvent(e: ArbiEvent): void {
  const run = state.run
  if (e.type === 'selected') pending = { node: e.node, name: e.name }
  else if (e.type === 'loaded') {
    // a new load replaces whatever was showing, even an unfinished run
    if (state.phase === 'recording') finish(false, e.t)
    startSec = e.t
    drones = new Set()
    const name = pending?.node === e.node ? pending.name : e.node
    state = {
      phase: 'recording',
      run: {
        id: `${Date.now()}`,
        node: e.node,
        name,
        mode: '',
        role: e.role,
        startedAt: Date.now(),
        durationSec: 0,
        // shortcut: only Survival rotations are visible in the log; other modes stay unknown
        rotations: null,
        drones: 0,
        completed: false,
        vitus: 0
      }
    }
    if (getPrefs().autoOpenArbi)
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('arbi:show')
    push()
  } else if (state.phase !== 'recording' || !run) return
  else if (e.type === 'mode') {
    run.mode = e.mode
    if (e.mode === 'MT_SURVIVAL') run.rotations = 0
    push()
  } else if (e.type === 'rotation') {
    run.rotations = e.count
    run.lastRotationAt = Date.now()
    push()
  } else if (e.type === 'drone') {
    drones.add(e.id)
    run.drones = drones.size
    push()
  } else if (e.type === 'ended') finish(true, e.t)
  else if (e.type === 'loading') finish(false, e.t)
}

// from the log watcher, once per line
export function arbiLine(line: string): void {
  const e = arbiEventFromLine(line)
  if (e) onArbiEvent(e)
}
