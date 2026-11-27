// Times of day in the PC's own clock format (Windows Region setting), not Chromium's en-US.
let hour12: boolean | undefined
// shortcut: read once at start; a clock drawn before the answer arrives uses the locale default
// until its next redraw (the countdowns redraw every second)
void window.api.getHour12().then((h) => (hour12 = h ?? undefined))

export const clock = (sec: number): string =>
  new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12 })
