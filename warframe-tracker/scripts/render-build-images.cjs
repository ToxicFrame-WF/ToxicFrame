// Renders build/icon.svg to the files electron-builder uses:
//   icon.svg             -> build/icon.png (1024), build/icon.ico (16-256), resources/icon.png (512)
// Run from warframe-tracker/:  npx electron scripts/render-build-images.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const out = (p) => path.join(root, p)

async function render(svgFile, width, height) {
  const svg = fs.readFileSync(out(svgFile), 'utf8')
  const win = new BrowserWindow({ width, height, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } })
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 400)) // let fonts and filters settle
  let img = await win.webContents.capturePage({ x: 0, y: 0, width, height })
  win.destroy()
  if (img.getSize().width !== width) img = img.resize({ width, height, quality: 'best' })
  return img
}

function ico(img) {
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const pngs = sizes.map((s) => img.resize({ width: s, height: s, quality: 'best' }).toPNG())
  const head = Buffer.alloc(6)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(sizes.length, 4)
  let offset = 6 + 16 * sizes.length
  const dir = sizes.map((s, i) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(s % 256, 0) // 0 means 256
    e.writeUInt8(s % 256, 1)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(pngs[i].length, 8)
    e.writeUInt32LE(offset, 12)
    offset += pngs[i].length
    return e
  })
  return Buffer.concat([head, ...dir, ...pngs])
}

app.disableHardwareAcceleration()
app.on('window-all-closed', () => {}) // keep running between renders; we quit ourselves
app.whenReady().then(async () => {
  const icon = await render('build/icon.svg', 1024, 1024)
  fs.writeFileSync(out('build/icon.png'), icon.toPNG())
  fs.writeFileSync(out('resources/icon.png'), icon.resize({ width: 512, height: 512, quality: 'best' }).toPNG())
  fs.writeFileSync(out('build/icon.ico'), ico(icon))
  console.log('rendered build images')
  app.quit()
})
