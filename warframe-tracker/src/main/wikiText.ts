// The text between the "Acquisition" heading and the next h2, without tables, markup and the
// drop-table boilerplate lines.
export function acquisitionText(html: string): string | null {
  const at = html.search(/id="Acquisition"/)
  if (at < 0) return null
  let s = html.slice(at)
  s = s.slice(s.indexOf('</h2>') + 5)
  const end = s.search(/<h2/)
  if (end > 0) s = s.slice(0, end)
  const text = s
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, '')
    .replace(/<table[\s\S]*?<\/table>/g, ' ')
    .replace(/<li>/g, '\n• ')
    .replace(/<\/p>|<\/li>|<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) => l && !/^\[edit|^All drop rates data|^See Mission Rewards|Denotes Vaulted/.test(l)
    )
    .join('\n')
  return text || null
}

// Acrithis's reported weekly wares, from the wiki page's lines like
// {{#vardefine:AcrithisObserved|November 23, 2026}} and {{#vardefine:AcrithisItem1|Forma}}
export function parseAcrithis(raw: string): { observed: string; items: string[] } | null {
  const v = (k: string): string | undefined =>
    new RegExp(`#vardefine:${k}\\|([^}]+)}}`).exec(raw)?.[1].trim()
  const observed = v('AcrithisObserved')
  const items = [1, 2, 3, 4, 5].map((n) => v(`AcrithisItem${n}`)).filter((x): x is string => !!x)
  return observed && items.length ? { observed, items } : null
}
