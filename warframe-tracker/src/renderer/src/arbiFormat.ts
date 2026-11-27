// Display helpers for the Arbitration pages (ArbiRun/ArbiState are global types in preload/index.d.ts).
const MODES: Record<string, string> = {
  MT_SURVIVAL: 'Survival',
  MT_DEFENSE: 'Defense',
  MT_EXTERMINATION: 'Exterminate',
  MT_INTEL: 'Spy',
  MT_TERRITORY: 'Interception',
  MT_EXCAVATE: 'Excavation',
  MT_ASSASSINATION: 'Assassination',
  MT_MOBILE_DEFENSE: 'Mobile Defense',
  MT_RESCUE: 'Rescue',
  MT_SABOTAGE: 'Sabotage',
  MT_CAPTURE: 'Capture',
  MT_ARTIFACT: 'Disruption',
  MT_CORRUPTION: 'Void Flood'
}
export const modeLabel = (m: string): string => (m ? (MODES[m] ?? m.replace(/^MT_/, '')) : '...')

export const mmss = (sec: number): string => {
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
