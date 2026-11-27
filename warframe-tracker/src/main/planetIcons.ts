import { app, net } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

// Wiki page whose main picture is used for each planet icon.
const PAGES: Record<string, string> = {
  earth: 'Earth',
  venus: 'Venus',
  deimos: 'Deimos',
  forma: 'Forma',
  aya: 'Aya',
  ducats: 'Ducats',
  platinum: 'Platinum',
  endo: 'Endo',
  credits: 'Credits',
  vitus: 'Vitus Essence'
}
const WIKI = 'https://wiki.warframe.com'
// Exact wiki files for the currencies, used when the page lookup finds nothing.
const FILES: Record<string, string> = {
  endo: 'Endo.png',
  aya: 'Aya.png',
  credits: 'Credits.png',
  vitus: 'VitusEssence.png'
}
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const file = (): string => join(app.getPath('userData'), 'planet-icons.json')
let cache: Record<string, string> | null = null

async function get(url: string): Promise<Response | null> {
  try {
    const res = await net.fetch(url, {
      headers: { 'User-Agent': 'ToxicFrame/0.1 (personal hobby tracker)' }
    })
    return res.ok ? res : null
  } catch {
    return null
  }
}

// The wiki is a MediaWiki site, so ask its API for the page's main image first and fall back
// to the page's og:image tag.
async function findImage(title: string): Promise<string | undefined> {
  const api = await get(
    `${WIKI}/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=160&titles=${encodeURIComponent(title)}`
  )
  if (api) {
    try {
      const json = (await api.json()) as {
        query?: { pages?: Record<string, { thumbnail?: { source?: string } }> }
      }
      const page = Object.values(json.query?.pages ?? {})[0]
      if (page?.thumbnail?.source) return page.thumbnail.source
    } catch {
      // fall through to the page itself
    }
  }

  const html = await get(`${WIKI}/w/${encodeURIComponent(title)}`)
  if (html) {
    const text = await html.text()
    const m =
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(text) ??
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(text)
    if (m) return new URL(m[1].replace(/&amp;/g, '&'), WIKI).toString()
  }
  return undefined
}

export async function getPlanetIcons(): Promise<Record<string, string>> {
  if (!cache) {
    let planets: Record<string, string> = {}
    try {
      const saved = JSON.parse(readFileSync(file(), 'utf8')) as {
        at: number
        icons: Record<string, string>
      }
      if (Date.now() - saved.at < MAX_AGE_MS && Object.keys(PAGES).every((k) => saved.icons[k])) {
        planets = saved.icons
      }
    } catch {
      // nothing saved yet
    }
    if (!Object.keys(planets).length) {
      for (const [key, title] of Object.entries(PAGES)) {
        const url = await findImage(title)
        if (url) planets[key] = url
      }
      for (const [key, name] of Object.entries(FILES)) {
        if (!planets[key]) planets[key] = `${WIKI}/images/thumb/${name}/160px-${name}`
      }
      console.log('Planet icons found:', planets)
      if (Object.keys(planets).length) {
        try {
          writeFileSync(file(), JSON.stringify({ at: Date.now(), icons: planets }))
        } catch {
          // not critical
        }
      }
    }
    cache = planets
  }

  return { ...cache }
}
