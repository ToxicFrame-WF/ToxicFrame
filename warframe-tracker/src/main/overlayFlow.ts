import { appendFileSync, existsSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, screen } from 'electron'
import { loadRelics } from './gameData'
import { getPrefs } from './appPrefs'
import { getOverlayState, hideOverlay, placeOverlay, setOverlayData, showOverlay } from './overlay'
import type { GameEvent } from './gameEvents'
import {
  captureArea,
  gameArea,
  readCycleCost,
  readEra,
  readRewards,
  readRivenTexts,
  readScreen,
  type GameArea
} from './rewardReader'
import { rewardBoxes } from './rewardGeometry'
import { isWarframeActive } from './ocr'
import { getRivenCatalog } from './marketContracts'
import { parseRivenText } from './rivenParse'
import { analyseRiven } from './rivenOverlay'

// the watcher retries every 0.5-1 s, so the same error is logged only when it changes
let lastWarn = ''
function warnOnce(what: string, e: unknown): void {
  const msg = `${what} ${e instanceof Error ? e.message : String(e)}`
  if (msg !== lastWarn) console.warn(msg)
  lastWarn = msg
}

// What the overlays show and when: game-log events, the screen watcher, and the reward reading.

// every 0.5 s while a relic screen is open (so the overlay closes quickly), else every 1 s
export function startScreenWatch(): void {
  let odd = false
  setInterval(() => {
    odd = !odd
    if (screenNow || odd) void watchScreen()
  }, 500)
}

// shortcut: the log's own-reward line ('ownReward') is not used yet; it could confirm one card
export function onGameEvent(ev: GameEvent): void {
  if (ev.type === 'relicPicker') {
    if (getPrefs().overlayRecommend) showRecommend()
  } else if (ev.type === 'rewards') {
    if (getPrefs().overlayRewards && getOverlayState().panel !== 'rewards') void showRewards()
  } else if (ev.type === 'rewardsClosed') hideOverlay('rewards')
  else if (ev.type === 'loading') hideOverlay()
}

// Screen watcher: Warframe writes its log in batches up to 10 s late, so while Warframe is the
// active window the relic screens are recognised by their title (one half-size screenshot a
// second). It opens and closes the overlays and reads the relic picker's era tab.
let screenNow: 'picker' | 'rewards' | 'riven' | null = null
let misses = 0
let era: string | null = null
let watching = false
export async function watchScreen(): Promise<void> {
  const prefs = getPrefs()
  const rivenUp = getOverlayState().panel === 'riven' // a hotkey-opened panel must hide on alt-tab
  if (
    watching ||
    !prefs.setupDone || // no screen capture before the first-run screen is accepted
    (!prefs.overlayRecommend && !prefs.overlayRewards && !prefs.overlayRiven && !rivenUp)
  )
    return
  watching = true
  try {
    if (!(await isWarframeActive())) {
      if (prefs.overlayKeepTabbed) return // keep what is shown; the screen is not Warframe's to read
      // alt-tabbed out: the picker panel must not stay on top of other apps
      if (screenNow === 'picker') hideOverlay('recommend')
      hideOverlay('riven')
      screenNow = null
      return
    }
    const area = await gameArea(true)
    const img = await captureArea(area, 0.5)
    const now = await readScreen(prefs.menuScale, img, prefs.overlayRiven)
    // one unreadable frame is not a closed screen; the riven button vanishes for seconds while
    // a cycle animates, so that panel waits ~5 s of misses
    if (!now && screenNow && ++misses < (screenNow === 'riven' ? 10 : 2)) return
    misses = 0
    if (now !== screenNow) {
      const was = screenNow
      screenNow = now
      // the rewards title often fails to read, so only the log or a timer closes that panel
      if (was === 'picker') hideOverlay('recommend')
      if (was === 'riven') hideOverlay('riven')
      rivenOff = false
      if (now) placeOverlay(area.display.bounds)
      if (now === 'picker' && prefs.overlayRecommend) showRecommend()
      if (now === 'rewards' && prefs.overlayRewards && getOverlayState().panel !== 'rewards')
        void showRewards(undefined, area)
    }
    // the card changes with every cycle, so it is read again while the screen is open
    if (now === 'riven' && prefs.overlayRiven && !rivenOff) void showRiven(area)
    if (now === 'picker' && getOverlayState().panel === 'recommend') {
      const e = await readEra(prefs.menuScale, img)
      if (e !== era) setOverlayData('recommend', { era: (era = e) })
    }
  } catch (e) {
    warnOnce('screen watch failed:', e)
  } finally {
    watching = false
  }
}

export function showRecommend(): void {
  if (!getPrefs().setupDone) return
  if (getOverlayState().panel === 'recommend') return
  showOverlay('recommend', { era: screenNow === 'picker' ? era : null })
}

// Where the price boxes go, in the overlay window's CSS pixels: one under each card, as wide as
// the card, below the squad's names; `scale` sizes the text like the game's UI.
export function rewardLayout(
  count: number,
  area?: GameArea
): {
  boxes: { x: number; w: number }[]
  top: number
  scale: number
} {
  const d = area?.display ?? screen.getPrimaryDisplay()
  const sf = d.scaleFactor
  const a = area ?? { x: 0, y: 0, w: d.size.width * sf, h: d.size.height * sf }
  const scale = (a.w / 2560) * (getPrefs().menuScale / 85)
  const boxes = rewardBoxes(a.w, a.h, getPrefs().menuScale, count)
  return {
    boxes: boxes.map((b) => ({ x: (a.x + b.x) / sf, w: b.w / sf })),
    top: (a.y + boxes[0].y + boxes[0].h + 110 * scale) / sf, // just under the players' names
    scale: scale / sf
  }
}

// Reads the reward cards off the screen and shows their value. The names come from the relic
// drop tables, so a match is always a real reward with its market slug.
let rewardsTimer: ReturnType<typeof setTimeout> | undefined
export async function showRewards(image?: Electron.NativeImage, known?: GameArea): Promise<void> {
  if (!getPrefs().setupDone) return
  showOverlay('rewards', { reading: true })
  // the 15 s pick countdown is over by then, whether or not the log has said so yet
  clearTimeout(rewardsTimer)
  rewardsTimer = setTimeout(() => hideOverlay('rewards'), 17_000)
  const slugs = new Map<string, string | undefined>()
  const unvaulted = new Set<string>() // dropped by at least one relic that is not vaulted
  for (const r of loadRelics())
    for (const rw of r.rewards) {
      slugs.set(rw.item, rw.slug)
      if (!r.vaulted) unvaulted.add(rw.item)
    }
  await new Promise((r) => setTimeout(r, 500)) // let the cards finish animating in
  try {
    // a test screenshot stands for the whole main screen
    const area = known ?? (image ? undefined : await gameArea())
    const read = await readRewards({
      area,
      menuScale: getPrefs().menuScale,
      names: [...slugs.keys()],
      image
    })
    if (getOverlayState().panel !== 'rewards') return // the screen already closed
    // no reward names: another "…/REWARDS" screen, not the fissure rewards
    if (!read.items.some((i) => i.name)) return hideOverlay('rewards')
    setOverlayData('rewards', {
      items: read.items.map((i) => ({
        ...i,
        slug: i.name ? slugs.get(i.name) : undefined,
        vaulted: !!i.name && !unvaulted.has(i.name)
      })),
      layout: rewardLayout(read.count, area)
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('reward read failed:', e)
    const log = join(app.getPath('userData'), 'overlay-errors.log')
    if (existsSync(log) && statSync(log).size > 1_000_000) writeFileSync(log, '') // keep it small
    appendFileSync(
      log,
      `${new Date().toISOString()} reward read: ${e instanceof Error ? e.stack : msg}
`
    )
    if (getOverlayState().panel === 'rewards') setOverlayData('rewards', { error: msg })
  }
}

// Riven overlay: reads the card(s) on screen and shows grades, similar listings and suggested
// rolls beside them (one panel for the current roll, plus the old roll on the confirm screen).
// Panels are drawn at a 380 px reference width and zoomed with the window, left or right edge.
let rivenKey = ''
let rivenBusy = false
let rivenOff = false // the hotkey closed it: stay closed until the screen is left
export function toggleRivenPanel(): void {
  if (getOverlayState().panel === 'riven') {
    rivenOff = true
    return hideOverlay('riven')
  }
  rivenOff = false
  rivenKey = ''
  void showRiven()
}

async function showRiven(known?: GameArea): Promise<void> {
  if (rivenBusy) return
  rivenBusy = true
  try {
    const area = known ?? (await gameArea())
    const shot = await captureArea(area)
    const read = await readRivenTexts(shot, getPrefs().menuScale)
    const cost = await readCycleCost(shot, getPrefs().menuScale).catch(() => undefined)
    const key = [...read.now, '#', ...read.old].join('|')
    if (key === rivenKey && getOverlayState().panel === 'riven') return
    rivenKey = key
    const weapons = Object.values((await getRivenCatalog()).weapons).map((w) => w.name)
    const [now, old] = await Promise.all([
      analyseRiven(parseRivenText(read.now, weapons), cost),
      analyseRiven(parseRivenText(read.old, weapons))
    ])
    if (!now) return
    const sf = area.display.scaleFactor
    const k = area.w / 2560
    const data = {
      cards: old ? [old, now] : [now],
      layout: {
        left: (area.x + 24 * k) / sf,
        right: (area.x + 2154 * k) / sf,
        top: (area.y + 458 * k) / sf,
        scale: k / sf
      }
    }
    if (getOverlayState().panel === 'riven') setOverlayData('riven', data)
    else {
      placeOverlay(area.display.bounds)
      showOverlay('riven', data)
    }
  } catch (e) {
    warnOnce('riven read failed:', e)
  } finally {
    rivenBusy = false
  }
}
