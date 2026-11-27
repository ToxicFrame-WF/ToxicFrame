# Regenerates src/main/wikiResources.ts from the wiki's resource data.
# Usage:
#   curl -s "https://wiki.warframe.com/w/Module:Resources/data?action=raw" -o res.lua
#   python scripts/wiki_resources_gen.py res.lua src/main/wikiResources.ts
# then update the read date in the file's first line.
import re, sys, json

KEEP = {'Resource', 'Research', 'Gem', 'Ore', 'Plant', 'Fish Part', 'Pigment', 'Conservation',
        'Event', 'Currency'}

src = open(sys.argv[1], encoding='utf8').read()
src = src[src.index('local ResourceData'):]
out = {}
for m in re.finditer(r'\n\t\["([^"]+)"\] = \{(.*?)\n\t\}', src, re.S):
    b = m.group(2)
    g = lambda k: (re.search(r'\n\t\t' + k + r' = "([^"]*)"', b) or [None, None])[1]
    t, i, im = g('Type'), g('InternalName'), g('Image')
    if t in KEEP and i:
        out[i.replace('/Lotus/StoreItems/', '/Lotus/')] = [t, im or '']

lines = ["// What counts as a resource, from the wiki (wiki.warframe.com/w/Module:Resources/data, read 2026-11-23).",
         "// shortcut: a hand-refreshed copy; regenerate with scripts/wiki_resources_gen.py when new resources come out.",
         "// game unique name -> [wiki type, wiki image file]",
         "export const WIKI_RESOURCES: Record<string, [string, string]> = {"]
lines += ['  ' + json.dumps(k) + ': ' + json.dumps(out[k], ensure_ascii=False) + ',' for k in sorted(out)]
lines.append('}')
open(sys.argv[2], 'w', encoding='utf8', newline='\n').write('\n'.join(lines) + '\n')
print(len(out), 'resources')
