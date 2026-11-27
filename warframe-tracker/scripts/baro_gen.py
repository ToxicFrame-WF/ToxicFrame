# Regenerates src/main/baroMods.ts from the wiki's Baro Ki'Teer data.
# Usage:
#   curl -s "https://wiki.warframe.com/w/Module:Baro/data?action=raw" -o baro.lua
#   python scripts/baro_gen.py baro.lua src/main/baroMods.ts
import re,sys
src=open(sys.argv[1],encoding='utf8').read()
# each entry: ["Name"] = { ... } at 2-tab depth; read its own fields
out=[]
for m in re.finditer(r'\n\t\t\["([^"]+)"\] = \{(.*?)\n\t\t\}', src, re.S):
    body=m.group(2)
    g=lambda k: (re.search(r'\n\t\t\t'+k+r' = ("?)([^"\n,]*)\1', body) or [None,None,None])[2]
    t=g('Type'); d=g('DucatCost'); c=g('CreditCost'); n=g('Name') or m.group(1)
    if t and re.search(r'\bMod\b',t) and d and c: out.append((n,int(d),int(c)))
out.sort()
lines=['// Baro Ki\'Teer mod prices from the wiki (wiki.warframe.com/w/Module:Baro/data, read 2026-11-21).',
 '// shortcut: a hand-refreshed copy; regenerate with scripts/baro_gen.py when Baro adds new mods.',
 '// name -> [ducats, credits]',
 'export const BARO_MODS: Record<string, [number, number]> = {']
lines+=[f"  {n!r}: [{d}, {c}],".replace("'",'"') if "'" in n else f"  '{n}': [{d}, {c}]," for n,d,c in out]
lines.append('}')
open(sys.argv[2],'w',encoding='utf8',newline='\n').write('\n'.join(lines)+'\n')
print(len(out), 'mods')
