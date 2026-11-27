// Reference: 2560x1440, Menu Scale 85, measured on tests/fixtures/reward-screen-2560x1440-scale85.png.
// Warframe sizes its UI from the window width and places this row from the top: in a 2560×1400
// window (above the taskbar) the names sit exactly where they do at 2560×1440.
const REF_W = 2560
const REF_SCALE = 85
const PITCH = 275 // card centre to card centre
const BOX_W = 270
const BOX_H = 55
const BOX_TOP = 575 // box top, from the top of the game window

export type Box = { x: number; y: number; w: number; h: number }

/** Name-text boxes (full-size pixels) for `count` centred reward cards. */
export function rewardBoxes(
  screenW: number,
  _screenH: number, // unused: the UI scales with the width
  menuScale: number,
  count: number
): Box[] {
  const s = (screenW / REF_W) * (menuScale / REF_SCALE)
  const out: Box[] = []
  for (let i = 0; i < count; i++) {
    const cx = screenW / 2 + (i - (count - 1) / 2) * PITCH * s
    out.push({
      x: Math.round(cx - (BOX_W * s) / 2),
      y: Math.round(BOX_TOP * s),
      w: Math.round(BOX_W * s),
      h: Math.round(BOX_H * s)
    })
  }
  return out
}

// Riven card text (name, stats, MR line) and the button under the card, measured on 2560x1440
// screenshots at Menu Scale 85. The card is centred; on the confirm screen the old roll sits
// 407 px to the left. Scaled like the reward row (from the window width, anchored at the top).
export const RIVEN_OLD_OFFSET = -407
export function rivenBox(screenW: number, menuScale: number, offset = 0): Box {
  const s = (screenW / REF_W) * (menuScale / REF_SCALE)
  return {
    x: Math.round(screenW / 2 + (offset - 175) * s),
    y: Math.round(800 * s), // a long name wraps to 2 lines and starts ~825 (4 stats + note)
    w: Math.round(350 * s),
    h: Math.round(285 * s)
  }
}
export const RIVEN_BUTTON = { x: 1030, y: 1165, w: 500, h: 70 } // "CYCLE FOR" / "CONFIRM", at the reference size
