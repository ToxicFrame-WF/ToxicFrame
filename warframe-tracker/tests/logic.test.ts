// Run with `npm test` (Node strips the TypeScript types itself; no test framework needed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectFor } from '../src/renderer/src/archonShards.ts'
import { rankFromXp } from '../src/renderer/src/masteryMath.ts'
import { matchListing, listingGrades } from '../src/renderer/src/rivenFilter.ts'
import { slugFromName } from '../src/main/marketSlug.ts'
import { applySnapshot } from '../src/main/statsMath.ts'
import {
  formatStat,
  gradeRiven,
  parseRivens,
  rivenName,
  rivenStats,
  rollGrade,
  statName
} from '../src/renderer/src/rivens.ts'
import { cycleKuva, migratePlans, planFit, rivenOdds } from '../src/renderer/src/rivenPlan.ts'
import { variantMap } from '../src/renderer/src/rivenVariants.ts'
import { parseRivenText } from '../src/main/rivenParse.ts'
import { rewardBoxes } from '../src/main/rewardGeometry.ts'
import { eraFromText, matchPart, screenFromTitle } from '../src/main/partMatch.ts'
import {
  acceleratorFromEvent,
  displayAccelerator,
  validateAccelerator,
  type KeyLike
} from '../src/renderer/src/hotkeys.ts'
import { chatPlayerFromLine } from '../src/main/chatParse.ts'
import { rulesFromCsv } from '../src/main/rivenSheet.ts'
import { acquisitionText } from '../src/main/wikiText.ts'
import { missingCost } from '../src/renderer/src/sets.ts'
import { resourceNeeds } from '../src/renderer/src/resourceNeeds.ts'

const shard = (color: string, names: string[]): never =>
  ({ color, effects: names.map((name) => ({ name, regular: 'r', tauforged: 't' })) }) as never
const upgrade = (tail: string): string =>
  `/Lotus/Upgrades/Invigorations/ArchonCrystalUpgrades/ArchonCrystalUpgrade${tail}`
const name = (tail: string, s: never): string =>
  effectFor({ color: '', tau: true, upgrade: upgrade(tail) }, s).name

test('shard effects: order-sensitive keywords pick the right effect', () => {
  const azure = shard('Azure', [
    'Max health',
    'Shield capacity',
    'Armor',
    'Energy max',
    'Health regen'
  ])
  assert.equal(name('WarframeHealthRegenMythic', azure), 'Health regen')
  assert.equal(name('WarframeHealth', azure), 'Max health')
  const violet = shard('Violet', [
    'Ability damage vs electricity',
    'Primary electricity damage',
    'Melee critical damage',
    'Health ↔ energy pickups'
  ])
  assert.equal(name('WarframePrimaryElectricDamage', violet), 'Primary electricity damage')
  assert.equal(name('WarframeElectricDamage', violet), 'Ability damage vs electricity')
  const crimson = shard('Crimson', [
    'Ability strength',
    'Melee critical damage',
    'Secondary critical chance'
  ])
  assert.equal(name('WarframeAbilityStrengthMythic', crimson), 'Ability strength')
  assert.equal(name('WarframeSecondaryCritChance', crimson), 'Secondary critical chance')
})

test('shard effects: unknown upgrade falls back to a readable name', () => {
  assert.equal(name('WarframeSomethingNew', shard('Amber', ['Casting speed'])), 'Something New')
})

test('mastery rank from affinity', () => {
  assert.equal(rankFromXp(0, 'frame', 30), 0)
  assert.equal(rankFromXp(900_000, 'frame', 30), 30) // 1000 * 30^2
  assert.equal(rankFromXp(899_999, 'frame', 30), 29)
  assert.equal(rankFromXp(450_000, 'weapon', 30), 30) // 500 * 30^2
  assert.equal(rankFromXp(10_000_000, 'weapon', 40), 40) // capped at max rank
  assert.equal(rankFromXp(-5, 'weapon', 30), 0)
})

test('market names built from mod names (checked live 2026-11-18)', () => {
  assert.equal(slugFromName('Primed Reach'), 'primed_reach')
  assert.equal(slugFromName("Kavat's Grace"), 'kavats_grace')
  assert.equal(slugFromName('Hata-Satya'), 'hata_satya')
  assert.equal(slugFromName('Arcane Energize'), 'arcane_energize')
})

test('stats: relics opened = drops in the relic count, summed per day', () => {
  const bal = { platinum: 1, credits: 2, ducats: 3, endo: 4, aya: 5, vitus: 6 }
  let h = applySnapshot({ days: {} }, '2026-11-19', bal, 100) // first snapshot: nothing opened
  assert.equal(h.days['2026-11-19'].relicsOpened, 0)
  h = applySnapshot(h, '2026-11-19', bal, 95) // opened 5
  h = applySnapshot(h, '2026-11-19', bal, 98) // got 3 more: not "opened"
  h = applySnapshot(h, '2026-11-19', { ...bal, platinum: 9 }, 90) // opened 8
  assert.equal(h.days['2026-11-19'].relicsOpened, 13)
  assert.equal(h.days['2026-11-19'].platinum, 9) // last balance of the day wins
  h = applySnapshot(h, '2026-11-20', bal, 90)
  assert.equal(h.days['2026-11-20'].relicsOpened, 0)
})

test('rivens: stats, types and veiled stacks from the inventory', () => {
  assert.equal(statName('WeaponCritChanceMod'), 'Critical chance')
  assert.equal(statName('WeaponFireRateMod', true), 'Attack speed')
  assert.equal(statName('WeaponMeleeFactionDamageCorpus'), 'Damage to Corpus')
  assert.equal(statName('WeaponDamageAmountMod'), 'Damage')
  assert.equal(statName('WeaponFactionDamageGrineer'), 'Damage to Grineer')
  const r = parseRivens({
    Upgrades: [
      {
        ItemType: '/Lotus/Upgrades/Mods/Randomized/LotusRifleRandomModRare',
        ItemId: { $oid: 'a' },
        UpgradeFingerprint: JSON.stringify({
          compat: '/Lotus/Weapons/X',
          lvl: 8,
          lvlReq: 11,
          rerolls: 10,
          pol: 'AP_DEFENSE',
          buffs: [{ Tag: 'WeaponFireRateMod' }],
          curses: [{ Tag: 'WeaponReloadSpeedMod' }]
        })
      },
      { ItemType: '/Lotus/Upgrades/Mods/Rifle/Serration', UpgradeFingerprint: '{}' }
    ],
    RawUpgrades: [{ ItemType: '/Lotus/Upgrades/Mods/Randomized/RawMeleeRandomMod', ItemCount: 19 }]
  })
  assert.equal(r.unveiled.length, 1)
  assert.deepEqual(
    [r.unveiled[0].type, r.unveiled[0].rank, r.unveiled[0].mr, r.unveiled[0].polarity],
    ['Rifle', 8, 11, 'defense']
  )
  assert.deepEqual(r.unveiled[0].buffs, ['Fire rate'])
  assert.deepEqual(r.unveiled[0].curses, ['Reload speed'])
  assert.deepEqual(r.veiled, [{ type: 'Melee', count: 19 }])
})

test('riven grades from the sheet rows', () => {
  const rules = rulesFromCsv(
    'WEAPON,POSITIVE STATS:,,,,NEGATIVE STATS:\nhek,CD/MS/DMG/CC/FR CORRO/VIRAL/WeakDMG,,,,REC/PUNC/ZOOM\n"orthos",CD AS RANGE,,,,ZOOM\n'
  )
  assert.deepEqual(rules.hek.neg, ['REC', 'PUNC', 'ZOOM'])
  const r = (
    b: string[],
    c: string[] = [],
    type = 'Shotgun'
  ): Parameters<typeof gradeRiven>[0] => ({
    buffTags: b,
    curseTags: c,
    type
  })
  const great = gradeRiven(
    r(['WeaponCritDamageMod', 'WeaponFireIterationsMod'], ['WeaponZoomFovMod']),
    rules.hek
  )
  assert.equal(great, 'Perfect')
  const good = gradeRiven(
    r(['WeaponCritDamageMod', 'WeaponFireIterationsMod', 'WeaponClipMaxMod']),
    rules.hek
  )
  assert.equal(good, 'Good')
  assert.equal(
    gradeRiven(r(['WeaponCritDamageMod', 'WeaponClipMaxMod'], ['WeaponFireRateMod']), rules.hek),
    'OK'
  )
  // 2 wanted positives stay Good even with a negative the sheet doesn't prefer
  assert.equal(
    gradeRiven(r(['WeaponCritDamageMod', 'WeaponFireRateMod'], ['WeaponClipMaxMod']), rules.hek),
    'Good'
  )
  assert.equal(gradeRiven(r(['WeaponClipMaxMod']), rules.hek), 'Bad')
  // melee fire rate is attack speed
  assert.equal(
    gradeRiven(
      r(['WeaponCritDamageMod', 'WeaponFireRateMod', 'WeaponMeleeRangeIncMod'], [], 'Melee'),
      rules.orthos
    ),
    'Perfect'
  )
  assert.equal(gradeRiven(r([]), undefined), undefined)
})

test('riven stat percentages (every weapon 1.2 since dispositions were retired)', () => {
  const r = {
    itemType: 'Arch',
    weapon: 'Grattler',
    rank: 8,
    buffTags: ['WeaponCritDamageMod', 'WeaponFireIterationsMod'],
    curseTags: ['WeaponArmorPiercingDamageMod'],
    buffRolls: [2 ** 29, 2 ** 29],
    curseRolls: [2 ** 29]
  }
  const data = {
    values: {
      Arch: {
        WeaponCritDamageMod: 0.0133,
        WeaponFireIterationsMod: 0.01,
        WeaponArmorPiercingDamageMod: 0.01333
      }
    }
  }
  const s = rivenStats(r, data)
  // middle roll (1.0): 0.0133 * 90 * 1.2 * 1.2375 * 1 * 1
  assert.equal(formatStat('WeaponCritDamageMod', s.buffs[0]!), '+177.8%')
  assert.equal(formatStat('WeaponArmorPiercingDamageMod', s.curses[0]!), '-71.3%')
  assert.equal(formatStat('WeaponFactionDamageGrineer', 0.5), 'x1.50')
  assert.equal(rivenStats({ ...r, buffTags: ['UnknownTag'] }, data).buffs[0], undefined)
})

test('wiki acquisition text: section only, no markup or boilerplate', () => {
  const html =
    '<h2><span id="Overview">Overview</span></h2><p>Skip me</p>' +
    '<h2><span id="Acquisition">Acquisition</span><span>[edit]</span></h2>' +
    '<p>Main blueprint from the <a href="/w/Q">quest</a>&#160;reward.</p><table><tr><td>x</td></tr></table>' +
    '<ul><li>Chassis: Void Storms</li></ul><p>All drop rates data is obtained from DE</p>' +
    '<h2><span id="Notes">Notes</span></h2><p>Not this</p>'
  assert.equal(
    acquisitionText(html),
    ['Main blueprint from the quest reward.', '• Chassis: Void Storms'].join('\n')
  )
  assert.equal(acquisitionText('<p>no section</p>'), null)
})

test('riven names follow the roll order (checked against live names)', () => {
  const affix: Record<string, [string, string]> = {
    WeaponCritDamageMod: ['acri', 'tis'],
    WeaponPunctureDepthMod: ['lexi', 'nok'],
    WeaponToxinDamageMod: ['toxi', 'tox'],
    WeaponFireIterationsMod: ['sati', 'can'],
    WeaponFireRateMod: ['croni', 'dra']
  }
  // Dual Toxocyst "Toxi-lexitis"
  const toxo = {
    buffTags: ['WeaponCritDamageMod', 'WeaponPunctureDepthMod', 'WeaponToxinDamageMod'],
    buffRolls: [415259861, 713007104, 962919564]
  }
  assert.equal(rivenName(toxo, affix), 'Toxi-lexitis')
  // Grattler "Acrican" and Dragon Nikana "Cronitis": two stats, highest roll gives the prefix
  assert.equal(
    rivenName(
      {
        buffTags: ['WeaponCritDamageMod', 'WeaponFireIterationsMod'],
        buffRolls: [832585187, 440390232]
      },
      affix
    ),
    'Acrican'
  )
  assert.equal(
    rivenName(
      { buffTags: ['WeaponCritDamageMod', 'WeaponFireRateMod'], buffRolls: [635295779, 986912220] },
      affix
    ),
    'Cronitis'
  )
  assert.equal(
    rivenName({ buffTags: ['Unknown', 'WeaponFireRateMod'], buffRolls: [1, 2] }, affix),
    undefined
  )
  assert.deepEqual([0.389, 0.664, 0.897, 0].map(rollGrade), ['B-', 'B+', 'A+', 'D'])
})

test('grade sheet: required stats and negatives in any column', () => {
  const rules = rulesFromCsv(
    [
      'WEAPON,POSITIVE STATS:',
      'tazicor,MS SC FR/PT ,,,DTI,,',
      'grattler,CD MS FR/DTC/CC/DMG,,,,,,PUNC/REC/ZOOM,,(NOTE: x)'
    ].join('\n')
  )
  assert.deepEqual(rules.tazicor.core, ['MS', 'SC'])
  assert.deepEqual(rules.tazicor.neg, ['DTI'])
  assert.deepEqual(rules.grattler.neg, ['PUNC', 'REC', 'ZOOM'])
  // Tazicor with fire rate + punch through only: no required stat, so Good not Perfect
  const taz = {
    buffTags: ['WeaponPunctureDepthMod', 'WeaponFireRateMod'],
    curseTags: [],
    type: 'Pistol'
  }
  assert.equal(gradeRiven(taz, rules.tazicor), 'Good')
})

test('grade sheet: first stat counts as core when none stands alone', () => {
  const rules = rulesFromCsv(
    ['WEAPON,POSITIVE STATS:', 'dual toxocyst,CD/MS/DMG/FR/CC/PT CORRO/VIRAL,,,,ZOOM/PUNC'].join(
      '\n'
    )
  )
  assert.deepEqual(rules['dual toxocyst'].core, ['CD'])
})

test('spliced traits get a value and a name part', () => {
  const r = {
    itemType: 'X',
    rank: 8,
    buffTags: ['WeaponGasDamageMod', 'WeaponCritDamageMod'],
    curseTags: [],
    buffRolls: [2 ** 29, 1],
    curseRolls: []
  }
  // 0.01 * 90 * 1.2 * 0.99 (two positives) * 1.0 roll * 1 rank = 1.0692
  assert.equal(formatStat('WeaponGasDamageMod', rivenStats(r, { values: {} }).buffs[0]!), '+106.9%')
  assert.equal(rivenName(r, { WeaponCritDamageMod: ['acri', 'tis'] }), 'Calitis')
})

import { cetusCycle, vallisCycle, duviriCycle, prettyPath } from '../src/main/worldMath.ts'
test('world cycles', () => {
  const end = Date.UTC(2026, 0, 1, 12)
  assert.equal(cetusCycle(end, end - 60 * 60000).state, 'day')
  assert.equal(cetusCycle(end, end - 10 * 60000).state, 'night')
  assert.ok(['warm', 'cold'].includes(vallisCycle().state))
  assert.ok(Date.parse(duviriCycle().expiry) > Date.now())
  assert.equal(prettyPath('/Lotus/Types/Items/MiscItems/OrokinCatalyst'), 'Orokin Catalyst')
})

import { rankProgress, medallions, title } from '../src/renderer/src/syndicates.ts'
test('syndicate math', () => {
  assert.equal(rankProgress(5, 372000)?.toNext, 0)
  assert.equal(rankProgress(3, 80500)?.toNext, 60500)
  assert.equal(rankProgress(5, 5), undefined) // Kahl uses another scale
  assert.equal(title('ArbitersSyndicate', 5), 'Maxim')
  const m = medallions([
    { ItemType: '/Lotus/Types/Items/SyndicateDogTags/NewLokaRareDogTag', ItemCount: 1 },
    { ItemType: '/Lotus/Types/Items/SyndicateDogTags/NewLokaUncommonDogTag', ItemCount: 3 },
    { ItemType: '/Lotus/Types/Items/SyndicateDogTags/UniversalSyndicateDogTag', ItemCount: 46 }
  ])
  assert.equal(m.byTag.NewLokaSyndicate.standing, 8000)
  assert.equal(m.universal, 46)
})

import { buildWorldState, NO_NAMES } from '../src/main/worldMath.ts'
test('world state from DE feed shapes', () => {
  const now = Date.UTC(2026, 10, 19, 12)
  const d = (ms: number): unknown => ({ $date: { $numberLong: String(ms) } })
  const ws = {
    Alerts: [
      {
        _id: { $oid: 'a1' },
        Activation: d(now - 1e5),
        Expiry: d(now + 1e6),
        MissionInfo: {
          location: 'SolNode147',
          missionType: 'MT_TERRITORY',
          missionReward: {
            countedItems: [{ ItemType: '/Lotus/Types/Items/MiscItems/Fieldron', ItemCount: 3 }]
          }
        }
      }
    ],
    ActiveMissions: [
      {
        _id: { $oid: 'f1' },
        Node: 'SolNode147',
        MissionType: 'MT_TERRITORY',
        Modifier: 'VoidT4',
        Hard: true,
        Expiry: d(now + 1e6)
      }
    ],
    VoidStorms: [{ Node: 'CrewBattleNode503', ActiveMissionTier: 'VoidT1', Expiry: d(now + 1e6) }],
    VoidTraders: [{ Node: 'EarthHUB', Activation: d(now + 1e6), Expiry: d(now + 2e6) }],
    SyndicateMissions: [{ Tag: 'CetusSyndicate', Expiry: d(now + 60 * 60000) }]
  }
  const names = {
    ...NO_NAMES,
    nodes: { SolNode147: { value: 'Cinxia (Ceres)', type: '', enemy: 'Grineer' } },
    missions: { MT_TERRITORY: 'Interception' }
  }
  const w = buildWorldState(
    ws,
    names,
    { itemName: (p) => p.split('/').pop()!, itemImage: () => undefined },
    now
  )
  assert.equal(w.rewardEntries[0].title, 'Interception · Cinxia (Ceres)')
  assert.deepEqual(w.rewardEntries[0].rewards, ['3x Fieldron'])
  assert.deepEqual(
    w.fissures.map((f) => [f.tier, f.isHard, f.isStorm]),
    [
      ['Axi', true, false],
      ['Lith', false, true]
    ]
  )
  assert.equal(w.baro?.location, 'Strata Relay (Earth)')
  assert.equal(w.cetus?.state, 'day')
  // without browse.wf names it still works, with raw ids
  assert.equal(
    buildWorldState(ws, NO_NAMES, { itemName: (p) => p, itemImage: () => undefined }, now)
      .fissures[0].node,
    'SolNode147'
  )
})

import { localDay } from '../src/main/statsMath.ts'
test('stats days use the local calendar day', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 0, 30)), '2026-01-05')
})

import { tradeStats } from '../src/renderer/src/tradeStats.ts'
test('trade log totals', () => {
  const items: Record<string, { name: string; tags: string[] }> = {
    a: { name: 'Khora Prime Set', tags: ['set', 'prime'] },
    b: { name: 'Arcane Energize', tags: ['arcane_enhancement'] }
  }
  const s = tradeStats(
    [
      { at: 1, type: 'sell', itemId: 'a', platinum: 75, quantity: 1 },
      { at: 2, type: 'sell', itemId: 'a', platinum: 70, quantity: 2 },
      { at: 3, type: 'buy', itemId: 'b', platinum: 40, quantity: 1 }
    ],
    (id) => items[id]
  )
  assert.equal(s.received, 215)
  assert.equal(s.spent, 40)
  assert.deepEqual(s.byCategory.Sets, { received: 215, spent: 0 })
  assert.equal(s.largestSale?.platinum, 140)
  assert.deepEqual(s.topSales[0], { name: 'Khora Prime Set', quantity: 3, platinum: 215 })
  assert.equal(s.lastAt, 3)
})
test('trade flips: profit on the units both bought and sold', () => {
  const s = tradeStats(
    [
      { at: 1, type: 'buy', itemId: 'a', platinum: 10, quantity: 3 },
      { at: 2, type: 'sell', itemId: 'a', platinum: 25, quantity: 2 },
      { at: 3, type: 'sell', itemId: 'b', platinum: 99, quantity: 1 }
    ],
    (id) => ({ name: id, tags: [] })
  )
  assert.equal(s.flips.length, 1)
  assert.deepEqual({ units: s.flips[0].units, profit: s.flips[0].profit }, { units: 2, profit: 30 })
  assert.deepEqual(s.held, [{ name: 'a', icon: undefined, units: 1, paid: 10 }])
})
test('trade flips: parts bought and sold as a set make one set row', () => {
  const s = tradeStats(
    [
      {
        at: 1,
        type: 'buy',
        itemId: '',
        name: 'Titania Prime Systems Blueprint',
        platinum: 35,
        quantity: 1
      },
      {
        at: 2,
        type: 'buy',
        itemId: '',
        name: 'Titania Prime Neuroptics Blueprint',
        platinum: 20,
        quantity: 1
      },
      { at: 3, type: 'sell', itemId: '', name: 'Titania Prime Set', platinum: 85, quantity: 1 }
    ],
    () => undefined
  )
  assert.equal(s.flips.length, 1)
  assert.deepEqual(
    { name: s.flips[0].name, profit: s.flips[0].profit, parts: s.flips[0].parts?.length },
    { name: 'Titania Prime Set', profit: 30, parts: 2 }
  )
  assert.equal(s.flips[0].trades.length, 3)
  assert.deepEqual(s.held, []) // the parts left in the set
})
test('trade busiest window: the 3-hour slot with the most sales', () => {
  const at = (h: number) => new Date(2026, 10, 21, h).getTime() // a Saturday
  const s = tradeStats(
    [18, 19, 20, 9].map((h) => ({
      at: at(h),
      type: 'sell' as const,
      itemId: 'a',
      platinum: 1,
      quantity: 1
    })),
    (id) => ({ name: id, tags: [] })
  )
  assert.deepEqual(s.busiest, { day: 6, hour: 18, count: 3, sales: 4 })
})

import { parseAlecaFrame, mergeDays, mergeTrades, removeImported } from '../src/main/afImport.ts'
test('AlecaFrame import: days fill gaps, sales/purchases kept, swaps skipped, no duplicates', () => {
  const plat = (cnt: number) => ({ name: '/AF_Special/Platinum', displayName: 'Platinum', cnt })
  const json = {
    generalDataPoints: [
      {
        ts: '2024-07-11T00:00:00.000Z',
        plat: 683,
        credits: 1,
        endo: 2,
        ducats: 50,
        aya: 4,
        vitus: null,
        relicOpened: 12
      }
    ],
    trades: [
      {
        ts: '2024-07-14T09:50:12.861Z',
        type: 0,
        user: 'a',
        totalPlat: 35,
        tx: [
          {
            name: '/Lotus/Types/Recipes/WarframeRecipes/TitaniaPrimeSystemsComponent',
            displayName: 'Titania Prime Systems Blueprint',
            cnt: 1
          }
        ],
        rx: [plat(35)]
      },
      {
        ts: '2024-07-15T10:33:33.426Z',
        type: 1,
        user: 'b',
        totalPlat: 5,
        tx: [plat(5)],
        rx: [{ name: '/Lotus/Upgrades/Mods/X', displayName: 'Creeping Bullseye', cnt: 1 }]
      },
      { ts: '2024-07-28T23:10:29.216Z', type: 2, user: 'c', totalPlat: 0, tx: [], rx: [] },
      {
        ts: '2025-04-23T14:07:47.395Z',
        type: 0,
        user: 'd',
        totalPlat: 70,
        rx: [plat(70)],
        tx: ['Blueprint', 'Chassis Blueprint', 'Neuroptics Blueprint', 'Systems Blueprint'].map(
          (p) => ({
            name: '/Lotus/Types/Recipes/WarframeRecipes/KhoraPrime' + p,
            displayName: 'Khora Prime ' + p,
            cnt: 1
          })
        )
      }
    ]
  }
  const p = parseAlecaFrame(json)
  assert.equal(p.days['2024-07-11'].relicsOpened, 12)
  assert.deepEqual(
    p.trades.map((t) => [t.type, t.name, t.platinum]),
    [
      ['sell', 'Titania Prime Systems Blueprint', 35],
      ['buy', 'Creeping Bullseye', 5],
      ['sell', 'Khora Prime Set', 70]
    ]
  )
  const own = { days: { '2024-07-11': { ...p.days['2024-07-11'], platinum: 1 } } }
  assert.equal(mergeDays(own, p.days).history.days['2024-07-11'].platinum, 1) // own day kept
  assert.equal(mergeTrades(p.trades, p.trades).added.length, 0)
  // undo takes out exactly what the import added and keeps the app's own data
  const days = mergeDays(own, p.days)
  const mine = { at: 1, type: 'sell' as const, itemId: 'x', platinum: 9, quantity: 1 }
  const log = mergeTrades([mine], p.trades)
  const undone = removeImported(days.history, log.trades, { days: days.added, trades: log.added })
  assert.deepEqual(Object.keys(undone.history.days), ['2024-07-11'])
  assert.deepEqual(undone.trades, [mine])
  assert.throws(() => parseAlecaFrame({ foo: 1 }))
})

import { toAlecaFrame } from '../src/renderer/src/afExport.ts'
test('export uses the AlecaFrame layout and round-trips through the import', () => {
  const days = {
    '2026-11-01': {
      platinum: 100,
      credits: 1,
      ducats: 2,
      endo: 3,
      aya: 4,
      vitus: 0,
      relicsOpened: 5
    },
    '2026-11-02': {
      platinum: 140,
      credits: 1,
      ducats: 2,
      endo: 3,
      aya: 4,
      vitus: 0,
      relicsOpened: 0
    }
  }
  const trades = [
    {
      at: Date.UTC(2026, 10, 2, 12),
      type: 'sell' as const,
      itemId: 'x',
      platinum: 20,
      quantity: 2
    },
    {
      at: Date.UTC(2026, 10, 2, 13),
      type: 'buy' as const,
      itemId: '',
      platinum: 5,
      quantity: 1,
      name: 'Vitality',
      user: 'bob'
    }
  ]
  const out = toAlecaFrame(days, trades, () => 'Arcane Energize') as {
    generalDataPoints: { platGain?: number; trades: number }[]
    trades: { type: number; totalPlat: number; tx: { displayName: string }[] }[]
  }
  assert.equal(out.generalDataPoints[1].platGain, 40)
  assert.equal(out.generalDataPoints[1].trades, 2)
  assert.deepEqual(
    out.trades.map((t) => [t.type, t.totalPlat]),
    [
      [0, 40],
      [1, 5]
    ]
  )
  assert.equal(out.trades[0].tx[0].displayName, 'Arcane Energize')
  const back = parseAlecaFrame(out)
  assert.equal(back.trades.length, 2)
  assert.equal(back.days['2026-11-01'].relicsOpened, 5)
})

import { scanTrades, planTrade, NEW_SCAN } from '../src/main/tradeParse.ts'
test('auto-track: finished trades from EE.log close the matching orders', () => {
  const log = [
    '123.4 Script [Info]: Dialog.lua: Dialog::CreateOkCancel(description=Are you sure you want to accept this trade? You are offering',
    'Khora Prime Neuroptics Blueprint',
    'and will receive from SomePlayer the following:',
    'Platinum x 30',
    ', leftItem=/Menu/Confirm_Item_Ok, rightItem=/Menu/Confirm_Item_Cancel)',
    '125.0 Script [Info]: Dialog.lua: Dialog::CreateOk(description=The trade was successful!, leftItem=/Menu/Confirm_Item_Ok)'
  ]
  // split across two reads, like the log watcher sees it
  const a = scanTrades(log.slice(0, 3).join(String.fromCharCode(10)), NEW_SCAN)
  assert.equal(a.done.length, 0)
  const whole = scanTrades(log.slice(3).join(String.fromCharCode(10)), a.state)
  assert.deepEqual(whole.done[0], {
    user: 'SomePlayer',
    gave: [{ name: 'Khora Prime Neuroptics Blueprint', count: 1 }],
    got: [{ name: 'Platinum', count: 30 }]
  })
  const orders = [
    { id: 'o1', type: 'sell', itemId: 'k', quantity: 2, platinum: 35 },
    { id: 'o2', type: 'buy', itemId: 'k', quantity: 1, platinum: 20 }
  ]
  const plan = planTrade(whole.done[0], orders, (id) =>
    id === 'k' ? 'Khora Prime Neuroptics Blueprint' : undefined
  )!
  assert.equal(plan.type, 'sell')
  assert.deepEqual(
    plan.closes.map((c) => [c.order.id, c.quantity]),
    [['o1', 1]]
  )
  assert.equal(plan.lines[0].platinum, 30) // paid 30 against a 35 listing: the real price is logged
  // a failed trade is dropped
  assert.equal(
    scanTrades(
      [...log.slice(0, 5), 'Dialog::CreateOk(description=The trade failed.'].join(
        String.fromCharCode(10)
      ),
      NEW_SCAN
    ).done.length,
    0
  )
})

test('auto-track: a set order is closed when all its parts were traded', () => {
  const parts = [
    { name: 'Kestrel Prime Blueprint', count: 1 },
    { name: 'Kestrel Prime Blade', count: 2 },
    { name: 'Kestrel Prime Grip', count: 1 }
  ]
  const trade = {
    user: 'p',
    gave: [
      { name: 'Kestrel Prime Blueprint', count: 1 },
      { name: 'Kestrel Prime Blade', count: 2 },
      { name: 'Kestrel Prime Grip', count: 1 }
    ],
    got: [{ name: 'Platinum', count: 30 }]
  }
  const orders = [{ id: 's', type: 'sell', itemId: 'set', quantity: 3, platinum: 30 }]
  const nameOf = (id: string) => (id === 'set' ? 'Kestrel Prime Set' : undefined)
  const plan = planTrade(trade, orders, nameOf, () => parts)!
  assert.deepEqual(
    plan.closes.map((c) => [c.order.id, c.quantity]),
    [['s', 1]]
  )
  assert.deepEqual(
    plan.lines.map((l) => [l.name, l.quantity, l.platinum]),
    [['Kestrel Prime Set', 1, 30]]
  )
  // a missing part: no set order closed, the loose parts are still logged
  const partial = { ...trade, gave: trade.gave.slice(0, 2) }
  const p2 = planTrade(partial, orders, nameOf, () => parts)!
  assert.equal(p2.closes.length, 0)
  assert.equal(p2.lines.length, 2)
})

test('auto-track: extra copies, items without an order, mixed trades and swaps', () => {
  const nameOf = (id: string) => ({ a: 'Arcane Energize', b: 'Vitality' })[id]
  const orders = [
    { id: 'oa', type: 'sell', itemId: 'a', quantity: 2, platinum: 40 },
    { id: 'ob', type: 'sell', itemId: 'b', quantity: 1, platinum: 10 }
  ]
  // 3 Energize (order covers 2) + 1 Vitality for 130: order closed for 2, the 3rd still logged
  const t = {
    user: 'x',
    gave: [
      { name: 'Arcane Energize', count: 3 },
      { name: 'Vitality', count: 1 }
    ],
    got: [{ name: 'Platinum', count: 130 }]
  }
  const p = planTrade(t, orders, nameOf)!
  assert.deepEqual(
    p.closes.map((c) => [c.order.id, c.quantity]),
    [
      ['oa', 2],
      ['ob', 1]
    ]
  )
  assert.equal(
    p.lines.reduce((n, l) => n + l.quantity, 0),
    4
  )
  assert.equal(Math.round(p.lines.reduce((n, l) => n + l.platinum * l.quantity, 0)), 130)
  // mixed: gave Vitality + 5 plat, got Energize -> a purchase of Energize for 5
  const mixed = {
    user: 'y',
    gave: [
      { name: 'Vitality', count: 1 },
      { name: 'Platinum', count: 5 }
    ],
    got: [{ name: 'Arcane Energize', count: 1 }]
  }
  const m = planTrade(mixed, orders, nameOf)!
  assert.equal(m.type, 'buy')
  assert.deepEqual(
    m.lines.map((l) => [l.name, l.platinum]),
    [['Arcane Energize', 5]]
  )
  // a swap without platinum is not a sale or purchase
  assert.equal(
    planTrade(
      {
        user: 'z',
        gave: [{ name: 'Vitality', count: 1 }],
        got: [{ name: 'Arcane Energize', count: 1 }]
      },
      orders,
      nameOf
    ),
    null
  )
})

test('AlecaFrame import keeps everything: swaps, both sides, ranks, pictures, MR and completion', () => {
  const plat = (cnt: number) => ({
    name: '/AF_Special/Platinum',
    displayName: 'Platinum',
    cnt,
    rank: -1
  })
  const json = {
    generalDataPoints: [
      {
        ts: '2026-11-10T00:00:00.000Z',
        plat: 1,
        credits: 1,
        endo: 1,
        ducats: 1,
        aya: 1,
        vitus: 72,
        relicOpened: 0,
        mr: 27,
        percentageCompletion: 57
      }
    ],
    trades: [
      // swap: two mods for an arcane
      {
        ts: '2026-11-10T14:10:34.942Z',
        type: 2,
        user: 'Schamy',
        totalPlat: 0,
        tx: [
          {
            name: '/Lotus/Fish/A',
            displayName: 'Cryptosuctus',
            cnt: 3,
            rank: 76,
            picture: 'https://x/a.png'
          }
        ],
        rx: [
          {
            name: '/AF_Special/Riven/Latron/Deci-puraata',
            displayName: 'Latron Deci-puraata',
            cnt: 1,
            rank: 0
          }
        ]
      },
      // marked as a swap by AlecaFrame but with platinum on one side: a purchase for 16
      {
        ts: '2025-05-15T13:14:47.404Z',
        type: 2,
        user: 'xurrue',
        totalPlat: 16,
        tx: [plat(16), { name: '/Lotus/Fish/K', displayName: 'Kymaeros', cnt: 1, rank: 83 }],
        rx: [{ name: '/Lotus/Bond/C', displayName: 'Contagious Bond', cnt: 1, rank: 0 }]
      }
    ]
  }
  const p = parseAlecaFrame(json)
  assert.equal(p.days['2026-11-10'].mr, 27)
  assert.equal(p.days['2026-11-10'].completion, 57)
  const [mixed, swap] = p.trades.sort((a, b) => a.at - b.at)
  assert.equal(swap.type, 'trade')
  assert.deepEqual(swap.gave, [
    { name: 'Cryptosuctus', count: 3, path: '/Lotus/Fish/A', rank: 76, picture: 'https://x/a.png' }
  ])
  assert.equal(swap.got?.[0].name, 'Latron Deci-puraata')
  assert.equal(mixed.type, 'buy')
  assert.equal(mixed.platinum, 16)
  // export and import again: nothing lost
  const back = parseAlecaFrame(toAlecaFrame(p.days, p.trades, () => undefined))
  assert.deepEqual(
    back.trades.sort((a, b) => a.at - b.at),
    [mixed, swap]
  )
  assert.equal(back.days['2026-11-10'].mr, 27)
})

import { parseIncursions, challengeName } from '../src/main/worldMath.ts'
test('Steel Path incursions and bounty names from browse.wf', () => {
  const txt = ['1736726400;SolNode27,ClanNode23', '1736812800;SolNode128,SolNode709', ''].join(
    String.fromCharCode(10)
  )
  const day2 = 1736812800 * 1000
  assert.deepEqual(parseIncursions(txt, day2 + 3600_000), {
    nodes: ['SolNode128', 'SolNode709'],
    expiry: new Date(day2 + 864e5).toISOString()
  })
  assert.equal(parseIncursions(txt, 0), undefined)
  assert.equal(
    challengeName('/Lotus/Types/Challenges/Zariman/ZarimanKillAsOperatorEasyChallenge'),
    'Kill As Operator Easy'
  )
})

import { buildConquests } from '../src/main/worldMath.ts'
test('Deep / Temporal Archimedea from the world state Conquests block', () => {
  const d = (ms: number) => ({ $date: { $numberLong: String(ms) } })
  const conquests = [
    {
      Activation: d(1000),
      Expiry: d(9000),
      Type: 'CT_LAB',
      Missions: [
        {
          faction: 'FC_MITW',
          missionType: 'MT_ARTIFACT',
          difficulties: [
            { type: 'CD_NORMAL', deviation: 'DoubleTrouble', risks: ['PointBlank'] },
            { type: 'CD_HARD', deviation: 'DoubleTrouble', risks: ['PointBlank', 'EMPBlackHole'] }
          ]
        }
      ],
      Variables: ['Undersupplied']
    },
    { Activation: d(1000), Expiry: d(2000), Type: 'CT_HEX', Missions: [], Variables: [] }
  ]
  const C = '/Lotus/Language/Conquest/'
  const names = {
    nodes: {},
    missions: { MT_ARTIFACT: 'Disruption' },
    dict: {},
    os: {
      [C + 'SolarMapLabConquestNode']: 'Deep Archimedea',
      [C + 'MissionVariant_LabConquest_DoubleTrouble']: 'Double Trouble',
      [C + 'Condition_PointBlank']: 'Point Blank',
      [C + 'Condition_MagneticHounds']: 'Magnetic Hounds',
      [C + 'PersonalMod_MaxAmmo']: 'Undersupplied',
      [C + 'PersonalMod_MaxAmmo_Desc']: 'Max ammo <b>-50%</b>'
    }
  }
  const a = buildConquests(conquests, names, 5000) // the Temporal one has expired
  assert.equal(a.length, 1)
  assert.equal(a[0].kind, 'Deep Archimedea')
  assert.equal(a[0].missions[0].mission, 'Disruption')
  assert.equal(a[0].missions[0].faction, 'The Murmur')
  assert.deepEqual(
    a[0].missions[0].risks.map((r) => r.name),
    ['Point Blank', 'Magnetic Hounds']
  )
  assert.deepEqual(a[0].variables[0], { name: 'Undersupplied', desc: 'Max ammo -50%' })
})

import { rollCycles } from '../src/main/worldMath.ts'
test('rollCycles moves a cached Plains cycle past day/night and the next bounty', () => {
  const bountyEnd = Date.UTC(2026, 10, 20, 12, 0)
  const day = { state: 'day', expiry: new Date(bountyEnd - 50 * 60_000).toISOString() }
  const d = { cetus: day } as unknown as Parameters<typeof rollCycles>[0]
  // 10 min after night started: night, ends at the bounty end
  rollCycles(d, bountyEnd - 40 * 60_000)
  assert.equal(d.cetus!.state, 'night')
  assert.equal(d.cetus!.expiry, new Date(bountyEnd).toISOString())
  assert.equal(d.cambion!.state, 'vome')
  // past the bounty end: the next 150 min cycle, day again
  rollCycles(d, bountyEnd + 60_000)
  assert.equal(d.cetus!.state, 'day')
  assert.equal(d.cetus!.expiry, new Date(bountyEnd + 100 * 60_000).toISOString())
})

import { newCopies, lowerBaseline } from '../src/renderer/src/newItems.ts'
test('new items: only increases count, and selling lowers the baseline', () => {
  const base = { stock: 1, blade: 2 }
  assert.deepEqual(newCopies(base, { stock: 2, blade: 2, relic: 3 }), { stock: 1, relic: 3 })
  // sold both blades, then got one back: that one is new
  const lowered = lowerBaseline(base, { stock: 1, blade: 0 })
  assert.deepEqual(lowered, { stock: 1 })
  assert.deepEqual(newCopies(lowered, { stock: 1, blade: 1 }), { blade: 1 })
})

import { niceTop, monthTicks, niceDate } from '../src/renderer/src/statsChart.ts'
test('balance chart: round scale top and month labels', () => {
  assert.equal(niceTop(2180), 2500)
  assert.equal(niceTop(440), 500)
  assert.equal(niceTop(1000), 1000)
  assert.equal(niceTop(0), 1)
  assert.deepEqual(monthTicks(['2024-07-11', '2024-07-20', '2024-08-01', '2024-08-02']), [
    { i: 0, label: "Jul '24" },
    { i: 2, label: "Aug '24" }
  ])
  assert.equal(niceDate('2024-07-11'), '11 Jul 2024')
  // 29 months thinned to at most 8 labels
  const days = Array.from({ length: 29 }, (_, k) => {
    const m = (6 + k) % 12
    return `${2024 + Math.floor((6 + k) / 12)}-${String(m + 1).padStart(2, '0')}-01`
  })
  const ticks = monthTicks(days)
  assert.ok(ticks.length <= 8)
  // 29 months need a 6-month step: calendar-aligned Jul / Jan labels, evenly spaced
  assert.deepEqual(
    ticks.map((t) => t.label),
    ["Jul '24", "Jan '25", "Jul '25", "Jan '26", "Jul '26"]
  )
})

import { countTop } from '../src/renderer/src/statsChart.ts'
test('count charts: whole-number scale', () => {
  assert.equal(countTop(24), 40)
  assert.equal(countTop(61), 80)
  assert.equal(countTop(1), 2)
})

test('rivens: near-max roll is S', () => {
  assert.equal(rollGrade(0.99), 'S')
  assert.equal(rollGrade(0.95), 'S')
  assert.equal(rollGrade(0.94), 'A+')
})

test('sets: missing parts cost, unpriced part, complete set', () => {
  const price = (s?: string): number => ({ blade: 10, handle: 4 })[s ?? ''] ?? 0
  // 1 blade short and 2 handles short (need 2, have 0)
  assert.equal(
    missingCost(
      [
        { have: 0, need: 1, slug: 'blade' },
        { have: 0, need: 2, slug: 'handle' },
        { have: 3, need: 1, slug: 'bp' }
      ],
      price
    ),
    18
  )
  assert.equal(missingCost([{ have: 1, need: 1, slug: 'blade' }], price), 0)
  // a lacking part with no price: can't be finished by buying
  assert.equal(missingCost([{ have: 0, need: 1, slug: 'guard' }], price), null)
})

test('resourceNeeds sums the resources of the included blueprints only', () => {
  const items = [
    {
      uniqueName: 'a',
      components: [
        { uniqueName: 'ferrite', itemCount: 100, kind: 'resource' },
        { uniqueName: 'bp', itemCount: 1, kind: 'blueprint' }
      ]
    },
    { uniqueName: 'b', components: [{ uniqueName: 'ferrite', itemCount: 50, kind: 'resource' }] },
    { uniqueName: 'c', components: [{ uniqueName: 'ferrite', itemCount: 999, kind: 'resource' }] }
  ]
  const n = resourceNeeds(items, (id) => id !== 'c')
  assert.equal(n.get('ferrite'), 150)
  assert.equal(n.has('bp'), false)
})

test('resourceNeeds counts through parts you lack, not parts you own', () => {
  const items = [{ uniqueName: 'frame', components: [] }]
  const recipes = {
    frame: [
      ['chassis', 1],
      ['cell', 3]
    ] as [string, number][],
    chassis: [['ferrite', 1000]] as [string, number][]
  }
  assert.equal(resourceNeeds(items, () => true, recipes).get('ferrite'), 1000)
  assert.equal(resourceNeeds(items, () => true, recipes).get('cell'), 3)
  const withChassis = resourceNeeds(
    items,
    () => true,
    recipes,
    (id) => (id === 'chassis' ? 1 : 0)
  )
  assert.equal(withChassis.has('ferrite'), false)
})

test('resourceNeeds keeps refined resources whole', () => {
  const items = [{ uniqueName: 'moa', components: [] }]
  const recipes = {
    moa: [['alloy', 30]] as [string, number][],
    alloy: [['ore', 10]] as [string, number][]
  }
  const n = resourceNeeds(
    items,
    () => true,
    recipes,
    () => 0,
    (id) => id === 'alloy'
  )
  assert.equal(n.get('alloy'), 30)
  assert.equal(n.has('ore'), false)
})

import { cleanModText } from '../src/main/worldMath.ts'
test('Archimedea modifier text: placeholders and colour tags removed', () => {
  assert.equal(cleanModText('Ability durations reduced by |val|%.'), 'Ability durations reduced.')
  assert.equal(
    cleanModText('Shield recharge delay increased |val|%.'),
    'Shield recharge delay increased.'
  )
  assert.equal(cleanModText('Take <DT_ELECTRICITY>Electricity Damage'), 'Take Electricity Damage')
})
test('Archimedea: modifiers missing from the dictionary get their wiki name', () => {
  const [a] = buildConquests(
    [
      {
        Type: 'CT_HEX',
        Activation: { $date: { $numberLong: '0' } },
        Expiry: { $date: { $numberLong: '4102444800000' } },
        Missions: [],
        Variables: ['AoeDebuff']
      }
    ],
    NO_NAMES
  )
  assert.equal(a.variables[0].name, 'Low Yield')
})

import { weekKey, nextReset, weeklyCounts, autoDone } from '../src/renderer/src/weekly.ts'
test('weekly: week starts Monday 00:00 UTC', () => {
  assert.equal(weekKey(Date.parse('2026-11-23T00:00:00Z')), '2026-11-23') // a Monday
  assert.equal(weekKey(Date.parse('2026-11-22T23:59:59Z')), '2026-11-16') // Sunday night
  assert.equal(nextReset(Date.parse('2026-11-25T12:00:00Z')), Date.parse('2026-11-30T00:00:00Z'))
})
test('weekly: slivers spent tick Palladino, Stock gained ticks Kahl', () => {
  const misc = (slivers: number, stock: number) => [
    { ItemType: '/Lotus/Types/Gameplay/Eidolon/Resources/RivenFragment', ItemCount: slivers },
    { ItemType: '/Lotus/Types/Items/MiscItems/KahlCreds', ItemCount: stock },
    { ItemType: '/Lotus/Types/Gameplay/NarmerSorties/ArchonCrystalAmar', ItemCount: 99 }
  ]
  const start = weeklyCounts(misc(750, 19))
  assert.deepEqual(autoDone(start, weeklyCounts(misc(750, 19))), [])
  assert.deepEqual(autoDone(start, weeklyCounts(misc(740, 29))), ['palladino', 'kahl'])
})

import { netracellRuns } from '../src/renderer/src/weekly.ts'
test('weekly: Archimedea unlocks use 2 Search Pulses each, leaving the rest for Netracells', () => {
  assert.equal(netracellRuns(false, false), 5)
  assert.equal(netracellRuns(true, false), 3)
  assert.equal(netracellRuns(true, true), 1)
})

import { endgameStreak } from '../src/renderer/src/weekly.ts'
test('weekly: Endgame streak counts finished weeks in a row', () => {
  const h = { '2026-11-02': true, '2026-11-09': true, '2026-11-16': true }
  assert.equal(endgameStreak(h, '2026-11-23'), 3) // this week still open
  assert.equal(endgameStreak({ ...h, '2026-11-23': true }, '2026-11-23'), 4)
  assert.equal(endgameStreak({ '2026-11-02': true, '2026-11-16': true }, '2026-11-23'), 1) // gap
})

import { icebindRuns } from '../src/renderer/src/weekly.ts'
test('weekly: Lanthorns tick Deep, Pix Chips tick Temporal, Splicers count Icebind runs', () => {
  const misc = (l: number, p: number, sp: number) => [
    { ItemType: '/Lotus/Types/Gameplay/EntratiLab/Resources/EntratiLanthornBundle', ItemCount: l },
    { ItemType: '/Lotus/Types/Items/MiscItems/1999ConquestBucks', ItemCount: p },
    { ItemType: '/Lotus/Types/Items/MiscItems/RivenSplicer', ItemCount: sp }
  ]
  const start = weeklyCounts(misc(0, 4, 4))
  assert.deepEqual(autoDone(start, weeklyCounts(misc(1, 4, 4))), []) // one Netracell lanthorn
  assert.deepEqual(autoDone(start, weeklyCounts(misc(3, 10, 6))), ['deep', 'temporal'])
  assert.equal(icebindRuns(start, weeklyCounts(misc(0, 4, 6))), 2)
  assert.equal(icebindRuns(start, weeklyCounts(misc(0, 4, 12))), 3)
})

import { eliteTier } from '../src/renderer/src/weekly.ts'
test('weekly: Elite Archimedea tier from Vosfor (Deep) and Pix Chips (Temporal)', () => {
  const c = (vosfor: number, pixChips: number) => ({
    slivers: 0,
    stock: 0,
    lanthorns: 0,
    splicers: 0,
    vosfor,
    pixChips
  })
  const start = c(5000, 4)
  assert.equal(eliteTier('deep', start, c(5010, 4)), 0)
  assert.equal(eliteTier('deep', start, c(5020, 4)), 28)
  assert.equal(eliteTier('deep', start, c(5070, 4)), 37)
  assert.equal(eliteTier('temporal', start, c(5000, 10)), 28)
  assert.equal(eliteTier('temporal', start, c(5000, 19)), 37)
})

import { teshinOffer, bird3Shard } from '../src/renderer/src/weekly.ts'
import { parseAcrithis } from '../src/main/wikiText.ts'
test('weekly shops: Teshin and Bird 3 rotations, Acrithis report parsing', () => {
  assert.equal(teshinOffer(Date.parse('2020-11-16T12:00:00Z')).now.name, 'Umbra Forma Blueprint')
  assert.equal(teshinOffer(Date.parse('2021-01-11T12:00:00Z')).now.name, 'Umbra Forma Blueprint') // 8 weeks on
  assert.equal(teshinOffer(Date.parse('2020-11-23T12:00:00Z')).next.name, 'Kitgun Riven Mod')
  assert.deepEqual(bird3Shard(Date.parse('2022-09-19T12:00:00Z')), {
    now: 'Amber',
    next: 'Crimson'
  })
  const raw =
    '{{#vardefine:AcrithisObserved|November 23, 2026}}<!--\n-->{{#vardefine:AcrithisItem1|Forma}}<!--\n-->{{#vardefine:AcrithisItem2|10,000 Kuva}}'
  assert.deepEqual(parseAcrithis(raw), {
    observed: 'November 23, 2026',
    items: ['Forma', '10,000 Kuva']
  })
})

import { weekTicks } from '../src/renderer/src/weekly.ts'
test('weekly: Elite mode spends pulses at the unlock, ticks Deep only at 37', () => {
  const base = {
    on: new Set<string>(),
    off: new Set<string>(),
    auto: new Set<string>(),
    elite: true,
    both: false
  }
  const at28 = weekTicks({ ...base, tiers: { deep: 28 } })
  assert.equal(at28.ticked('deep'), false)
  assert.equal(at28.netracellMax, 3)
  assert.equal(weekTicks({ ...base, tiers: { deep: 37 } }).ticked('deep'), true)
  assert.equal(weekTicks({ ...base, tiers: {}, both: true }).netracellMax, 1)
  assert.equal(
    weekTicks({ ...base, elite: false, tiers: {}, auto: new Set(['deep']) }).ticked('deep'),
    true
  )
})

import { summarize } from '../src/main/marketMath.ts'
import { setDeals, flips, movers, liquidity } from '../src/renderer/src/marketTools.ts'
const AT = Date.parse('2026-11-24T00:00:00Z')
const daysAgo = (n: number) => new Date(AT - n * 86_400_000).toISOString()
test('market summary: last 7 calendar days, recent orders only, unranked only', () => {
  const day = (ago: number, volume: number, median: number, mod_rank?: number) => ({
    datetime: daysAgo(ago),
    volume,
    median,
    mod_rank
  })
  const order = (hoursAgo: number, order_type: 'buy' | 'sell', price: number) => ({
    datetime: new Date(AT - hoursAgo * 3_600_000).toISOString(),
    order_type,
    min_price: price,
    max_price: price,
    volume: 1,
    median: price
  })
  const s = summarize(
    {
      statistics_closed: {
        // a busy day 70 days ago must not count as this week
        '90days': [day(70, 100, 5), day(3, 10, 50), day(1, 6, 20), day(1, 7, 99, 5)]
      },
      statistics_live: {
        '48hours': [order(5, 'sell', 240), order(1, 'buy', 18), order(1, 'sell', 25)]
      }
    },
    AT
  )
  assert.equal(s.vol7, 16 / 7)
  assert.equal(s.med7, (10 * 50 + 6 * 20) / 16)
  assert.equal(s.vol90, 116 / 90)
  assert.deepEqual([s.low, s.high], [25, 18])
  // the only sell row is 5 hours old: no lowest listing
  assert.equal(
    summarize({ statistics_live: { '48hours': [order(5, 'sell', 240)] } }, AT).low,
    undefined
  )
})
test('market summary: relics use Intact only, never mixed with Radiant', () => {
  const row = (subtype: string, order_type: 'buy' | 'sell', price: number) => ({
    datetime: daysAgo(0),
    subtype,
    order_type,
    min_price: price,
    max_price: price,
    volume: 1,
    median: price
  })
  const s = summarize(
    {
      statistics_closed: {
        '90days': [
          { datetime: daysAgo(1), volume: 2, median: 6, subtype: 'intact' },
          { datetime: daysAgo(1), volume: 1, median: 200, subtype: 'radiant' }
        ]
      },
      statistics_live: {
        '48hours': [row('intact', 'buy', 5), row('radiant', 'sell', 239), row('intact', 'sell', 8)]
      }
    },
    AT
  )
  assert.deepEqual([s.med7, s.low, s.high], [6, 8, 5])
})
test('market tools: set deals, flips, movers, liquidity', () => {
  const st = {
    set: { vol7: 2, vol90: 2, med7: 100, med90: 100, low: 110 },
    a: { vol7: 5, vol90: 5, med7: 30, med90: 15, low: 30, high: 10 },
    b: { vol7: 1, vol90: 1, med7: 20, med90: 20, low: 20, high: 19 }
  }
  const d = setDeals(
    {
      set: [
        { slug: 'a', qty: 2 },
        { slug: 'b', qty: 1 }
      ]
    },
    st
  )
  assert.deepEqual([d[0].partsCost, d[0].profit], [80, 20])
  assert.deepEqual(
    flips(st).map((f) => [f.slug, f.margin]),
    [['a', 18]]
  )
  assert.deepEqual(
    movers(st).map((m) => [m.slug, m.change]),
    [
      ['a', 1],
      ['set', 0]
    ]
  )
  assert.equal(liquidity(st)[0].slug, 'set')
})
test('trade flips: a set needing a part twice counts both bought copies', () => {
  const s = tradeStats(
    [
      { at: 1, type: 'buy', itemId: '', name: 'Dual Kamas Prime Blade', platinum: 20, quantity: 2 },
      { at: 2, type: 'sell', itemId: '', name: 'Dual Kamas Prime Set', platinum: 90, quantity: 1 }
    ],
    () => undefined,
    (part) => (part === 'Dual Kamas Prime Blade' ? 2 : 1)
  )
  assert.equal(s.flips[0].profit, 50)
  assert.deepEqual(s.held, [])
})
import { onlineBest, liveSet, liveFlip } from '../src/renderer/src/marketTools.ts'
test('live checks: online orders only, set and flip profit, gone when nobody sells', () => {
  const b = onlineBest({
    sell: [
      { platinum: 10, status: 'offline' },
      { platinum: 14, status: 'ingame' },
      { platinum: 12, status: 'online' }
    ],
    buy: [
      { platinum: 9, status: 'online' },
      { platinum: 11, status: 'invisible' }
    ]
  })
  assert.deepEqual(b, { low: 12, high: 9, sellers: 2 })
  const best = {
    set: { low: 61, sellers: 3 },
    a: { low: 10, sellers: 1 },
    b: { low: 5, sellers: 1 }
  }
  const parts = [
    { slug: 'a', qty: 2 },
    { slug: 'b', qty: 1 }
  ]
  assert.deepEqual(liveSet('set', parts, best), { profit: 35, buy: 25, sell: 60 })
  assert.equal(liveSet('set', [...parts, { slug: 'c', qty: 1 }], best).profit, null)
  assert.deepEqual(liveFlip(b), { profit: 1, buy: 10, sell: 11 })
  assert.equal(liveFlip({ sellers: 0, high: 5 }).profit, null)
})

test('chat tabs: only private F-tabs give a player name', () => {
  const l = (c: string): string =>
    `1.0 Sys [Info]: ChatRedux.lua: ChatRedux::AddTab: Adding tab with channel name: ${c} to index 3`
  assert.equal(chatPlayerFromLine(l('FSomePlayer')), 'SomePlayer')
  assert.equal(chatPlayerFromLine(l('FSomePlayer') + ' extra text'), 'SomePlayer')
  for (const c of ['H_abc', 'Q_abc', 'R_abc', 'Sclan', 'Cglobal'])
    assert.equal(chatPlayerFromLine(l(c)), null)
  assert.equal(chatPlayerFromLine('unrelated line'), null)
})

test('cycle reminders: only the picked NEXT state, inside the window, not past', async () => {
  const { shouldNotify } = await import('../src/renderer/src/cycleAlerts.ts')
  const S = ['day', 'night']
  const now = Date.parse('2026-01-01T00:00:00Z')
  const cur = (s: string, min: number): { state: string; expiry: string } => ({
    state: s,
    expiry: new Date(now + min * 60_000).toISOString()
  })
  assert.equal(shouldNotify(S, cur('day', 2), 'night', 3, now), true)
  assert.equal(shouldNotify(S, cur('day', 5), 'night', 3, now), false)
  assert.equal(shouldNotify(S, cur('night', 2), 'night', 3, now), false)
  assert.equal(shouldNotify(S, cur('day', -1), 'night', 3, now), false)
})

test('rewardBoxes: reference layout, centring and scaling', () => {
  const [a, b, c] = rewardBoxes(2560, 1440, 85, 3)
  assert.ok(Math.abs(a.x - 870) <= 3 && Math.abs(c.x + c.w - 1690) <= 3)
  assert.ok(Math.abs(a.y - 575) <= 3 && a.h >= 50)
  assert.equal(b.x + b.w / 2, 1280)
  for (const n of [1, 2, 4]) {
    const bs = rewardBoxes(2560, 1440, 85, n)
    assert.equal(bs.length, n)
    assert.ok(Math.abs(bs[0].x + bs[n - 1].x + bs[n - 1].w - 2560) <= 2)
  }
  const small = rewardBoxes(1920, 1080, 85, 3)[0]
  assert.ok(Math.abs(small.w - 270 * 0.75) <= 1 && Math.abs(small.y - (540 - 145 * 0.75)) <= 1)
  assert.ok(rewardBoxes(2560, 1440, 100, 1)[0].w > 270)
})

test('matchPart: OCR misreads, quantity, junk', () => {
  const names = [
    'Citrine Prime Systems Blueprint',
    'Burston Prime Stock',
    'Forma Blueprint',
    'Ash Prime Chassis'
  ]
  assert.equal(matchPart('Citrine Prilli Systems Blueprint', names)?.name, names[0])
  assert.equal(matchPart('Citrine Prime Systems\nBlueprint', names)?.name, names[0])
  assert.equal(matchPart('burston  prime stock', names)?.name, names[1])
  const f = matchPart('2 X Forma Blueprint', names)
  assert.equal(f?.name, 'Forma Blueprint')
  assert.equal(f?.quantity, 2)
  assert.equal(matchPart('2X Forma Blueprint', names)?.quantity, 2)
  assert.equal(matchPart('xq 7 zzz', names), null)
})

test('relic value: expected, best-of-N and recommend', async () => {
  const { expected, expectedBest, recommend, DEFAULT_OVERLAY_FILTERS } =
    await import('../src/renderer/src/relicValue.ts')
  const relic = (id: string): never =>
    ({
      id,
      tier: 'Lith',
      name: id,
      vaulted: false,
      rewards: [
        { item: 'A', slug: id + 'a', rarity: 'Common', chances: { Intact: 50, Radiant: 100 } },
        { item: 'B', slug: id + 'b', rarity: 'Rare', chances: { Intact: 50, Radiant: 0 } }
      ]
    }) as never
  const r = relic('x')
  const v = (rw: { item: string }): number => (rw.item === 'A' ? 10 : 30)
  assert.equal(expected(r, 'Intact', v), 20)
  assert.equal(expectedBest(r, 'Intact', v, 1), 20)
  assert.equal(expectedBest(r, 'Intact', v, 2), 10 * 0.25 + 30 * 0.75) // best of two rolls
  assert.equal(expectedBest(r, 'Missing', v, 2), 0)
  const get = (slug?: string): { price: number } => ({ price: slug?.endsWith('b') ? 100 : 1 })
  const counts = (id: string): Record<string, number> | undefined =>
    id === 'x' ? { Intact: 2, Radiant: 1 } : id === 'c' ? { Radiant: 3 } : undefined
  const all = [r, relic('c'), relic('n')]
  const top = recommend(all, counts, DEFAULT_OVERLAY_FILTERS, get, {}, new Map())
  assert.deepEqual(
    top.map((t) => `${t.relic.id}:${t.state}`),
    ['x:Intact', 'x:Radiant', 'c:Radiant'] // Radiant ties keep list order
  )
  const f = { ...DEFAULT_OVERLAY_FILTERS, refinement: 'Radiant' }
  assert.equal(recommend(all, counts, f, get, {}, new Map(), 1).length, 1)
})

test('eraFromText reads the relic picker era label', () => {
  assert.equal(eraFromText('LITH ERA'), 'Lith')
  assert.equal(eraFromText('  requiem era '), 'Requiem')
  assert.equal(eraFromText('OMNIA ERA'), null)
  assert.equal(eraFromText('VOID RELICS'), null)
})

test('screenFromTitle tells the relic screens apart', () => {
  assert.equal(screenFromTitle('VOID RELICS/REFINEMENT'), 'picker')
  assert.equal(screenFromTitle('V O I D  R E L I C S'), 'picker')
  assert.equal(screenFromTitle('REWARDS'), 'rewards')
  assert.equal(screenFromTitle('ARSENAL'), null)
})

test('hotkeys: accelerator from key event, validation, display', () => {
  const ev = (code: string, o: object = {}): KeyLike => ({
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...o
  })
  assert.equal(
    acceleratorFromEvent(ev('KeyO', { ctrlKey: true, shiftKey: true })),
    'Control+Shift+O'
  )
  assert.equal(acceleratorFromEvent(ev('Tab', { ctrlKey: true })), 'Control+Tab')
  assert.equal(acceleratorFromEvent(ev('ArrowUp', { altKey: true })), 'Alt+Up')
  assert.equal(acceleratorFromEvent(ev('F13')), 'F13')
  assert.equal(acceleratorFromEvent(ev('ControlLeft', { ctrlKey: true })), null)
  assert.equal(validateAccelerator(''), null)
  assert.equal(validateAccelerator('F5'), null)
  assert.equal(validateAccelerator('Control+Tab'), null)
  assert.notEqual(validateAccelerator('O'), null)
  assert.notEqual(validateAccelerator('Tab'), null)
  assert.notEqual(validateAccelerator('Control'), null)
  assert.equal(displayAccelerator('Control+Shift+O'), 'Ctrl + Shift + O')
  assert.equal(displayAccelerator(''), 'Off')
})

test('import fills only gaps (never today) and undo gives the original back', () => {
  const day = { platinum: 1, credits: 0, ducats: 0, endo: 0, aya: 0, vitus: 0, relicsOpened: 0 }
  const h = { days: { '2026-11-01': { ...day, platinum: 5 } } }
  const log = [{ at: 1, type: 'sell' as const, itemId: 'x', platinum: 10, quantity: 1 }]
  const d = mergeDays(h, { '2026-11-01': day, '2026-11-02': day, '2026-11-26': day }, '2026-11-26')
  assert.deepEqual(d.added, ['2026-11-02'])
  assert.equal(d.history.days['2026-11-01'].platinum, 5) // existing day kept
  const t = mergeTrades(log, [log[0], { ...log[0], at: 2 }])
  assert.deepEqual(t.added, [2])
  const out = removeImported(d.history, t.trades, { days: d.added, trades: t.added })
  assert.deepEqual(out.history, h)
  assert.deepEqual(out.trades, log)
})

// OCR output of the riven cards in AlecaFrame's screenshots (2560x1440), Windows OCR as-is
test('riven card text: old roll with a lost label and a split decimal', () => {
  const p = parseRivenText(
    [
      'Bubonico Deci-',
      'toxifel',
      '+106% Status Duration',
      'O +94.4% �Gas',
      '+95.4%',
      '+81 .1% Weapon Recoil',
      'MR8',
      '0141'
    ],
    ['Bubonico', 'Dual Toxocyst']
  )
  assert.equal(p.name, 'Bubonico Deci-toxifel')
  assert.equal(p.weapon, 'Bubonico')
  assert.deepEqual(
    p.stats.map((s) => [s.tag, Math.round(s.value * 1000) / 1000]),
    [
      ['WeaponProcTimeMod', 1.06],
      ['WeaponGasDamageMod', 0.944],
      [undefined, 0.954],
      ['WeaponRecoilReductionMod', 0.811]
    ]
  )
})

test('riven card text: faction multiplier is a negative', () => {
  const p = parseRivenText(
    [
      'Bubonico Magna-',
      'herafel',
      '+146.4% *Impact',
      'O +94.4% OGas',
      '+46.4% Zoom',
      'x0.56 Damage to Grineer',
      '0 142'
    ],
    ['Bubonico']
  )
  assert.equal(p.weapon, 'Bubonico')
  assert.equal(p.stats.length, 4)
  assert.equal(p.stats[0].tag, 'WeaponImpactDamageMod')
  assert.equal(p.stats[3].tag, 'WeaponFactionDamageGrineer')
  assert.ok(Math.abs(p.stats[3].value + 0.44) < 1e-9)
})

test('riven finder: match %, required stats, ranges', () => {
  const at = (slug: string, positive = true): RivenListing['attrs'][number] => ({
    slug,
    name: slug,
    value: 1,
    positive
  })
  const l = { price: 100, rerolls: 3, rank: 8, attrs: [at('cc'), at('cd'), at('ms', false)] }
  const base = { minMatch: 0, mustNeg: false }
  const f = (o: object): ReturnType<typeof matchListing> =>
    matchListing(l, { ...base, pos: [], ...o })
  assert.equal(
    f({
      pos: [
        { slug: 'cc', required: true },
        { slug: 'x', required: false }
      ]
    })?.pct,
    50
  )
  assert.equal(f({ pos: [{ slug: 'x', required: true }] }), null)
  assert.equal(
    f({ pos: [{ slug: 'cc', required: true }], neg: { slug: 'ms', required: true } })?.pct,
    100
  )
  assert.equal(f({ neg: { slug: 'cc', required: true } }), null) // cc is a positive, not a negative
  assert.equal(f({ pos: [{ slug: 'x', required: false }], minMatch: 10 }), null)
  assert.equal(f({ priceMax: 99 }), null)
  assert.equal(f({ rerollMin: 3, rerollMax: 3 })?.pct, 100)
  assert.equal(matchListing({ ...l, attrs: [at('cc')] }, { ...base, pos: [], mustNeg: true }), null)
})

test('riven finder: listing roll grades', () => {
  const data = { values: { T: { WeaponCritChanceMod: 1 / 90 / 1.2 } } } // base so rank 8, 2 pos: 0.99 x roll
  const at = (value: number): RivenListing['attrs'][number] => ({
    slug: 'cc',
    name: 'Critical Chance',
    unit: 'percent',
    value,
    positive: true
  })
  const l = (value: number): Parameters<typeof listingGrades>[0] => ({
    price: 1,
    rerolls: 0,
    rank: 8,
    attrs: [at(value), { ...at(value), name: 'Critical Chance' }]
  })
  const top = listingGrades(l(99 * 1.1), 'T', data)[0]
  const low = listingGrades(l(99 * 0.9), 'T', data)[0]
  assert.equal(top?.grade, 'S')
  assert.equal(low?.grade, 'D')
})

test('riven text: icon letters, %-as-0/0 and the heavy-attack line', () => {
  const p = parseRivenText(
    [
      'Skiajati Croni-critatio',
      '+156.2% Critical Chance',
      '(x2 for Heavy Attacks)',
      '+47.8% Attack Speed',
      '+75.50 /0 f Electricity',
      'Cedo',
      '+1 31 .70/0 z Toxin',
      '-49.4% VPuncture'
    ],
    ['Skiajati']
  )
  assert.equal(p.stats.length, 5)
  assert.match(p.stats[0].text, /\(x2 for Heavy Attacks\)$/)
  assert.deepEqual(
    p.stats.slice(2).map((s) => [s.tag, Math.round(s.value * 1000) / 1000]),
    [
      ['WeaponElectricityDamageMod', 0.755],
      ['WeaponToxinDamageMod', 1.317],
      ['WeaponArmorPiercingDamageMod', -0.494]
    ]
  )
})

test('fair price: lower quartile of comparables, trimmed, needs 6', async () => {
  const { fairPrice, dealScore } = await import('../src/renderer/src/rivenFair.ts')
  const mk = (id: string, price: number, s: string[]): never =>
    ({ id, price, attrs: s.map((slug) => ({ slug, positive: true })) }) as never
  const me = mk('me', 50, ['a', 'b', 'c'])
  // same layout as `me` (3 positives, no negative), sharing 2+ stats
  const all = [
    me,
    mk('1', 100, ['a', 'b', 'd']),
    mk('2', 120, ['b', 'c', 'd']),
    mk('3', 140, ['a', 'c', 'd']),
    mk('4', 160, ['a', 'b', 'e']),
    mk('5', 180, ['b', 'c', 'e']),
    mk('6', 200, ['a', 'c', 'e'])
  ]
  assert.equal(fairPrice(me, all), 120)
  assert.equal(fairPrice(me, all.slice(0, 6)), undefined) // only 5 comparables
  assert.equal(fairPrice(me, [...all, mk('x', 5, ['z', 'y', 'a'])]), 120) // shares < 2 stats
  const many = [
    me,
    ...Array.from({ length: 10 }, (_, i) =>
      mk(`${i}`, i === 0 ? 1 : i === 9 ? 9999 : 100, ['a', 'b', 'd'])
    )
  ]
  assert.equal(fairPrice(me, many), 100) // 1p and 9999p trimmed
  // regression (Acceltra): 3-positive curse-free rivens at 2000p must not set the fair price of a weak
  // 2-positive riven with a curse
  const mk2 = (id: string, price: number, n: number, neg: boolean): never =>
    ({
      id,
      price,
      attrs: [
        ...['a', 'b', 'c'].slice(0, n).map((slug) => ({ slug, positive: true })),
        ...(neg ? [{ slug: 'z', positive: false }] : [])
      ]
    }) as never
  const weak = mk2('w', 200, 2, true)
  const mix = [
    weak,
    ...[1, 2, 3, 4].map((i) => mk2(`g${i}`, 2000, 3, false)),
    ...[250, 300, 350, 400, 450, 500].map((p, i) => mk2(`c${i}`, p, 2, true))
  ]
  assert.equal(fairPrice(weak, mix), 300)
  assert.equal(dealScore(50, 100), 0.5)
  // regression (real Acceltra data, 2026-11-26, 71 priced): the median of the asks (2000-10000p wishful
  // listings) made 500p rivens "77% under fair"; the lower quartile keeps most near fair
  const { readFileSync } = await import('node:fs')
  const real = JSON.parse(
    readFileSync(new URL('./fixtures/acceltra-listings.json', import.meta.url), 'utf8')
  )
  const d = real.flatMap(
    (l: never) => dealScore((l as { price: number }).price, fairPrice(l, real)) ?? []
  )
  assert.ok(d.length > 50) // 56 of 85 have 6+ comparables
  assert.ok(d.filter((x: number) => x >= 0.6).length <= 3, 'few listings 60%+ under')
  assert.ok(d.filter((x: number) => x < 0.3).length / d.length > 0.7, 'most within 30% of fair')
  assert.equal(dealScore(50, undefined), undefined)
})

test('riven history: one snapshot per 6 h, old ones thin out and expire', async () => {
  const { addSnap } = await import('../src/main/rivenSnap.ts')
  const L = [
    {
      price: 5,
      rerolls: 1,
      attrs: [
        { slug: 'a', positive: true },
        { slug: 'b', positive: false }
      ]
    }
  ] as never
  const D = 86_400_000
  const now = 400 * D
  const a = addSnap([], L, now)!
  assert.deepEqual(a[0].l[0], [5, 1, ['a', '-b']])
  assert.equal(addSnap(a, L, now + 5 * 3_600_000), undefined)
  assert.equal(addSnap(a, [], now + D), undefined)
  const old = [
    { t: now - 2 * 365 * D, l: [] },
    { t: now - 60 * D, l: [] },
    { t: now - 60 * D + 3_600_000, l: [] }
  ]
  assert.equal(addSnap(old, L, now)!.length, 2) // year-old dropped, same-day pair thinned, new added
})

test('sniper: only online sellers, once per auction id, deal threshold', async () => {
  const { newHits } = await import('../src/renderer/src/rivenFair.ts')
  const mk = (id: string, price: number, status: string): never =>
    ({
      id,
      price,
      status,
      rerolls: 0,
      rank: 0,
      attrs: [
        { slug: 'a', positive: true },
        { slug: 'b', positive: true }
      ]
    }) as never
  const list = [
    mk('1', 40, 'online'),
    mk('2', 100, 'offline'),
    mk('3', 100, 'ingame'),
    mk('4', 100, 'ingame'),
    mk('5', 100, 'ingame'),
    mk('6', 100, 'ingame'),
    mk('7', 100, 'ingame')
  ]
  const f = { pos: [{ slug: 'a', required: true }], minMatch: 0, mustNeg: false }
  const seen = new Set<string>()
  assert.deepEqual(
    newHits({ filter: f }, list, seen).map((l: { id: string }) => l.id),
    ['1', '3', '4', '5', '6', '7']
  )
  seen.add('1')
  seen.add('3')
  assert.deepEqual(
    newHits({ filter: f }, list, seen).map((l: { id: string }) => l.id),
    ['4', '5', '6', '7']
  )
  // fair = lower quartile of the others (100,100,100,100 for the 40p one) -> 40p listing is under fair only vs the dearer ones
  assert.deepEqual(
    newHits({ filter: f, minDeal: 30 }, list, new Set()).map((l: { id: string }) => l.id),
    ['1']
  )
})

test('price trends: window, filtered average, attribute popularity', async () => {
  const { trends } = await import('../src/renderer/src/rivenTrends.ts')
  const D = 86_400_000
  const snaps = [
    { t: 100 * D, l: [[100, 0, ['a', 'b', '-c']]] },
    {
      t: 10 * D,
      l: [
        [10, 0, ['a']],
        [30, 0, ['b']]
      ]
    }
  ] as never
  const f = { pos: [{ slug: 'b', required: true }], minMatch: 0, mustNeg: false }
  const all = trends(snaps, f, null, 101 * D)
  assert.equal(all.avg, 47)
  assert.equal(all.filteredAvg, 65)
  assert.equal(all.attrs[0].slug, 'a')
  const recent = trends(snaps, f, 30, 101 * D)
  assert.equal(recent.snaps, 1)
  assert.equal(recent.avg, 100)
  assert.equal(trends([], f, null, 1).avg, undefined)
})

test('riven plan odds, hand-computed', () => {
  const pool10 = Array.from({ length: 10 }, (_, i) => `s${i}`)
  const near = (a: number, b: number): void => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)
  // one required stat: (9/45 + 36/120) / 2
  near(rivenOdds(pool10, { pos: [{ tag: 's0', required: true }], negs: [] }), 0.25)
  // two required: (1/45 + 8/120) / 2
  near(
    rivenOdds(pool10, {
      pos: [
        { tag: 's0', required: true },
        { tag: 's1', required: true }
      ],
      negs: []
    }),
    2 / 45
  )
  // pool a-d, a required, only b accepted as a negative: (1/3 + 1/2) / 2
  near(
    rivenOdds(['a', 'b', 'c', 'd'], { pos: [{ tag: 'a', required: true }], negs: ['b'] }),
    5 / 12
  )
  assert.equal(rivenOdds(pool10, { pos: [], negs: [] }), 0)
  assert.equal(cycleKuva(), 3500)
  assert.equal(cycleKuva(0), 900)
})

test('riven plan fit against a card', () => {
  const w = {
    pos: [
      { tag: 'a', required: true },
      { tag: 'b', required: false }
    ],
    negs: ['n']
  }
  const st = (tag: string, curse = false): { tag: string; curse: boolean; q: number } => ({
    tag,
    curse,
    q: 0.8
  })
  assert.equal(planFit([st('a'), st('b'), st('n', true)], w).kind, 'match')
  assert.equal(planFit([st('a'), st('x'), st('z', true)], w).label, '1 of 2 plan stats')
  assert.equal(planFit([st('x'), st('y')], w).label, 'Off plan')
  assert.equal(planFit([st('a')], { ...w, minRoll: 90 }).kind, 'partial')
})

test('sniper alerts migrate to plans without losing data', () => {
  const old = {
    alerts: [
      { id: '1', slug: 'x', paused: true, filter: { pos: [], neg: { slug: 'n', required: false } } }
    ],
    seen: ['a'],
    webhook: 'w'
  }
  const { state, changed } = migratePlans(old)
  assert.ok(changed)
  assert.deepEqual(state.alerts[0], { ...old.alerts[0], negs: ['n'], use: false })
  assert.deepEqual([state.seen, state.webhook, state.v], [['a'], 'w', 2])
  assert.equal(migratePlans(state).changed, false)
  assert.equal(migratePlans(null).state.alerts.length, 0)
})

test('riven text: wrapped name, a stray art line and a two-line stat', () => {
  const p = parseRivenText(
    [
      'r. 4',
      'Skiajati Pleci-',
      'acrinem',
      '+146.5% Critical Chance',
      'for Slide Attack',
      '+105.4% Critical Damage',
      '+8.7s Combo Duration',
      '-80.2% Status Chance',
      'MR 15',
      '013'
    ],
    ['Skiajati', 'Dual Toxocyst']
  )
  assert.equal(p.weapon, 'Skiajati')
  assert.equal(p.name, 'Skiajati Pleci-acrinem')
  assert.equal(p.stats.length, 4)
  assert.equal(p.stats[0].tag, 'SlideAttackCritChanceMod')
})

test('riven text: a wrapped stat label is joined and re-tagged', () => {
  const p = parseRivenText(
    ['Skiajati Locti-vexitox', '+2.3 Range', '-100.2% Chance to Gain', 'Combo Count', 'MR 15'],
    ['Skiajati']
  )
  assert.equal(p.stats.length, 2)
  assert.equal(p.stats[1].tag, 'WeaponMeleeComboPointsOnHitMod')
})

test('weapon variants resolve to their base riven weapon', () => {
  const m = variantMap(
    ['Acceltra Prime', 'Kuva Bramma', 'Mk1-Braton', 'Braton', 'Prisma Gorgon', 'Zorg Prime'],
    ['Acceltra', 'Bramma', 'Braton', 'Gorgon']
  )
  assert.deepEqual(m, {
    'Acceltra Prime': 'Acceltra',
    'Kuva Bramma': 'Bramma',
    'Mk1-Braton': 'Braton',
    'Prisma Gorgon': 'Gorgon'
  })
})

test('attackModes: one mode per attack, else a single mode from the top-level stats', async () => {
  const { attackModes } = await import('../src/main/weaponStats.ts')
  const two = attackModes(
    [
      { name: 'Impact', crit_chance: 32, damage: { impact: 35 } },
      { name: 'Explosion', damage: { slash: 8.8 } },
      { name: 'Empty', damage: {} }
    ],
    {}
  )
  assert.deepEqual(
    two.map((m) => m.name),
    ['Impact', 'Explosion']
  )
  assert.equal(two[0].crit, 32)
  const one = attackModes(undefined, { crit: 20, damage: { heat: 5 } })
  assert.equal(one.length, 1)
  assert.equal(one[0].crit, 20)
})
test('trade stats: a quantity-0 trade gives no NaN or Infinity', () => {
  const s = tradeStats(
    [
      { at: 1, type: 'buy', itemId: 'a', platinum: 10, quantity: 0 },
      { at: 2, type: 'sell', itemId: 'a Set', platinum: 25, quantity: 0 }
    ],
    (id) => ({ name: id, tags: [] })
  )
  assert.ok(Number.isFinite(s.spent + s.received))
  assert.equal(s.flips.length, 0)
})

test('applySnapshot keeps mr and completion already on the day', () => {
  const bal = { platinum: 1, credits: 2, ducats: 3, endo: 4, aya: 5, vitus: 6 }
  const h0 = { days: { d: { ...bal, relicsOpened: 0, mr: 30, completion: 55 } } }
  const h = applySnapshot(h0, 'd', { ...bal, platinum: 9 }, 10)
  assert.equal(h.days.d.mr, 30)
  assert.equal(h.days.d.completion, 55)
  assert.equal(h.days.d.platinum, 9)
})

test('toAlecaFrame buckets a 00:30 local trade on its local day', async () => {
  const { toAlecaFrame } = await import('../src/renderer/src/afExport.ts')
  const at = new Date(2026, 10, 20, 0, 30).getTime()
  const day = { platinum: 1, credits: 0, ducats: 0, endo: 0, aya: 0, vitus: 0, relicsOpened: 0 }
  const out = toAlecaFrame({ '2026-11-20': day }, [{ at } as never], () => undefined) as {
    generalDataPoints: { trades: number }[]
  }
  assert.equal(out.generalDataPoints[0].trades, 1)
})

test('toData sums relic refinements and skips zero counts', async () => {
  const { toData } = await import('../src/main/inventoryData.ts')
  const P = '/Lotus/Types/Game/Projections/T1VoidProjectionAxi1'
  const d = toData(
    {
      relics: [
        { ItemType: P + 'Bronze', ItemCount: 2 },
        { ItemType: P + 'Gold', ItemCount: 1 },
        { ItemType: P + 'Silver', ItemCount: 0 }
      ]
    },
    0
  )
  assert.deepEqual(d.relics[P + 'Bronze'], { Intact: 2, Flawless: 1 })
})
