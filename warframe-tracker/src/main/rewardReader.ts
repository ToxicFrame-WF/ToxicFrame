import { desktopCapturer, nativeImage, screen, type Display, type NativeImage } from 'electron'
import { writeFileSync } from 'fs'
import { activeWindowRect, isWarframeActive, ocrImage, ocrTempFile } from './ocr'
import { eraFromText, isRivenButton, matchPart, screenFromTitle } from './partMatch'
import { parseCycleCost } from '../renderer/src/rivenPlan'
import { RIVEN_BUTTON, RIVEN_OLD_OFFSET, rewardBoxes, rivenBox } from './rewardGeometry'

export type RewardItem = { name: string | null; raw: string; score: number; quantity: number }

// Where the game is drawn: Warframe's window (it may not fill its screen, e.g. above the taskbar,
// or sit on another monitor), in physical pixels relative to that display's top-left corner.
export type GameArea = { display: Display; x: number; y: number; w: number; h: number }

// knownActive: the caller already checked that Warframe is the active window
export async function gameArea(knownActive = false): Promise<GameArea> {
  const r = knownActive || (await isWarframeActive()) ? await activeWindowRect() : null
  if (r) {
    const dip = screen.screenToDipRect(null, { x: r.x, y: r.y, width: r.w, height: r.h })
    const d = screen.getDisplayMatching(dip)
    const sf = d.scaleFactor
    return {
      display: d,
      x: Math.round((dip.x - d.bounds.x) * sf),
      y: Math.round((dip.y - d.bounds.y) * sf),
      w: r.w,
      h: r.h
    }
  }
  const d = screen.getPrimaryDisplay()
  return {
    display: d,
    x: 0,
    y: 0,
    w: Math.round(d.size.width * d.scaleFactor),
    h: Math.round(d.size.height * d.scaleFactor)
  }
}

/** A screenshot of just the game area; `scale` below 1 captures a smaller, cheaper image. */
export async function captureArea(area: GameArea, scale = 1): Promise<NativeImage> {
  const d = area.display
  const thumbnailSize = {
    width: Math.round(d.size.width * d.scaleFactor * scale),
    height: Math.round(d.size.height * d.scaleFactor * scale)
  }
  const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize })
  const src = srcs.find((s) => s.display_id === String(d.id)) ?? srcs[0]
  if (!src) throw new Error('no screen source')
  return src.thumbnail.crop({
    x: Math.round(area.x * scale),
    y: Math.round(area.y * scale),
    width: Math.round(area.w * scale),
    height: Math.round(area.h * scale)
  })
}

async function readCount(
  img: NativeImage,
  menuScale: number,
  names: string[],
  count: number
): Promise<RewardItem[]> {
  const { width, height } = img.getSize()
  // Boxes are independent, so OCR them in turn (ocrImage serialises on the single process anyway).
  const items: RewardItem[] = []
  for (const [i, b] of rewardBoxes(width, height, menuScale, count).entries()) {
    const f = ocrTempFile(`box${count}-${i}.png`)
    writeFileSync(
      f,
      img
        .crop({ x: b.x, y: b.y, width: b.w, height: b.h })
        .resize({ width: b.w * 2, height: b.h * 2, quality: 'best' })
        .toPNG()
    )
    // one unreadable card must not fail the others
    const raw = await ocrImage(f).then(
      (r) => r.lines.join(' '),
      () => ''
    )
    const m = matchPart(raw, names)
    items.push({ name: m?.name ?? null, raw, score: m?.score ?? 0, quantity: m?.quantity ?? 1 })
  }
  return items
}

/** Reads the reward names off the Void Fissure reward screen (read-only screen capture). */
export async function readRewards(opts: {
  menuScale: number
  names: string[]
  image?: NativeImage
  area?: GameArea
}): Promise<{ count: number; items: RewardItem[] }> {
  const img = opts.image ?? (await captureArea(opts.area ?? (await gameArea())))
  let best = { count: 0, items: [] as RewardItem[], total: -1 }
  // fewest cards first, and only a strictly better score wins: with 2 cards, the middle two of
  // the 4-card boxes read the same names, so a tie must keep the smaller count
  for (let count = 1; count <= 4; count++) {
    const items = await readCount(img, opts.menuScale, opts.names, count)
    // Wrong counts misalign boxes and score low; unmatched cards add nothing, so more matches win.
    const total = items.reduce((a, it) => a + (it.name ? it.score : 0), 0)
    if (total > best.total + 1e-9) best = { count, items, total }
  }
  return { count: best.count, items: best.items }
}

// OCR one box of a screenshot; boxes are measured at 2560 px wide, menu scale 85, and scaled
// like the game's UI (from the window width, anchored top-left)
async function readBox(
  img: NativeImage,
  menuScale: number,
  box: { x: number; y: number; w: number; h: number },
  file: string,
  invert = false
): Promise<string> {
  const k = (img.getSize().width / 2560) * (menuScale / 85)
  const b = {
    x: Math.round(box.x * k),
    y: Math.round(box.y * k),
    width: Math.round(box.w * k),
    height: Math.round(box.h * k)
  }
  const f = ocrTempFile(file)
  let part = img.crop(b).resize({ width: b.width * 2, height: b.height * 2, quality: 'best' })
  if (invert) part = inverted(part)
  writeFileSync(f, part.toPNG())
  return (await ocrImage(f)).text
}

// dark text on light: the reward screen's thin red title only reads this way
function inverted(img: NativeImage): NativeImage {
  const size = img.getSize()
  const px = Buffer.from(img.toBitmap()) // BGRA
  for (let i = 0; i < px.length; i += 4) {
    const grey = 255 - Math.round(px[i] * 0.11 + px[i + 1] * 0.59 + px[i + 2] * 0.3)
    px[i] = px[i + 1] = px[i + 2] = grey
  }
  return nativeImage.createFromBitmap(px, size)
}

/** The era tab open on the relic picker ("LITH ERA" at the top left), or null. */
export async function readEra(menuScale: number, img?: NativeImage): Promise<string | null> {
  const shot = img ?? (await captureArea(await gameArea()))
  return eraFromText(await readBox(shot, menuScale, { x: 60, y: 100, w: 600, h: 90 }, 'era.png'))
}

/** Which relic screen is open, from its title at the top left ("VOID RELICS/REFINEMENT",
 * "VOID FISSURE/REWARDS"). */
export async function readScreen(
  menuScale: number,
  img: NativeImage,
  rivens = false
): Promise<'picker' | 'rewards' | 'riven' | null> {
  const box = { x: 150, y: 25, w: 1000, h: 110 }
  const read = await readBox(img, menuScale, box, 'title.png')
  // the reward screen's thin red title only reads inverted
  const text = read.trim() ? read : await readBox(img, menuScale, box, 'title-inv.png', true)
  const screen = screenFromTitle(text)
  // the riven screens have no title that reads: the button under the card does
  if (!screen && rivens && isRivenButton(await readBox(img, menuScale, RIVEN_BUTTON, 'cycle.png')))
    return 'riven'
  return screen
}

/** Kuva the cycle button asks for ("CYCLE FOR 3,500"), or undefined when it does not read. */
export async function readCycleCost(
  img: NativeImage,
  menuScale: number
): Promise<number | undefined> {
  return parseCycleCost(await readBox(img, menuScale, RIVEN_BUTTON, 'cycle.png'))
}

/** The text lines of the riven card(s): [old roll or null, current roll]. The old roll only
 * exists on the confirm screen, so it is read second and only counts if it parses. */
export async function readRivenTexts(
  img: NativeImage,
  menuScale: number
): Promise<{ now: string[]; old: string[] }> {
  const w = img.getSize().width
  const read = async (offset: number, file: string): Promise<string[]> => {
    const b = rivenBox(w, menuScale, offset)
    const f = ocrTempFile(file)
    writeFileSync(
      f,
      img
        .crop({ x: b.x, y: b.y, width: b.w, height: b.h })
        .resize({ width: b.w * 2, height: b.h * 2, quality: 'best' })
        .toPNG()
    )
    return (await ocrImage(f).catch(() => ({ lines: [] as string[] }))).lines
  }
  return { now: await read(0, 'riven-now.png'), old: await read(RIVEN_OLD_OFFSET, 'riven-old.png') }
}
