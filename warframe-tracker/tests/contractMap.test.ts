import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchContractRiven, staleStats, toContractItem } from '../src/renderer/src/contractMap.ts'

const cat = {
  weapons: { soma: { name: 'Soma', gameRef: '/Lotus/Weapons/Soma' } },
  attrs: {
    critical_chance: { name: 'Critical Chance', unit: 'percent' },
    critical_damage: { name: 'Critical Damage', unit: 'percent' }
  }
}
const data = {
  values: { T: { WeaponCritChanceMod: 1, WeaponCritDamageMod: 1 } },
  affix: { WeaponCritChanceMod: ['crita', 'cron'], WeaponCritDamageMod: ['acri', 'tis'] } as Record<
    string,
    [string, string]
  >
}
const riven = {
  id: '1',
  type: 'Rifle',
  weapon: '/Lotus/Weapons/Soma',
  rank: 8,
  mr: 11,
  rerolls: 3,
  polarity: 'attack',
  buffs: [],
  curses: [],
  buffTags: ['WeaponCritChanceMod', 'WeaponCritDamageMod'],
  curseTags: [],
  buffRolls: [2 ** 30, 0],
  curseRolls: [],
  itemType: 'T'
}

test('maps weapon, polarity, stats and name', () => {
  const { item, problems } = toContractItem(riven, cat, data)
  assert.deepEqual(problems, [])
  assert.equal(item?.weapon_url_name, 'soma')
  assert.equal(item?.polarity, 'madurai')
  assert.deepEqual(
    item?.attributes.map((a) => a.url_name),
    ['critical_chance', 'critical_damage']
  )
  assert.equal(item?.name, 'Critatis')
})

test('blocks on an unmapped weapon or stat instead of guessing', () => {
  assert.ok(toContractItem({ ...riven, weapon: '/Lotus/Nope' }, cat, data).problems.length)
  assert.ok(
    toContractItem({ ...riven, buffTags: ['WeaponZoomFovMod', 'WeaponCritDamageMod'] }, cat, data)
      .problems.length
  )
})

test('matches a contract to the inventory riven with the same weapon and stats', () => {
  const c = {
    weaponRef: '/Lotus/Weapons/Soma',
    attributes: [
      { name: 'Critical Damage', positive: true },
      { name: 'Critical Chance', positive: true }
    ],
    rerolls: 3,
    rank: 8,
    mastery: 11,
    polarity: 'madurai'
  }
  const other = { ...riven, id: '2', rerolls: 9 }
  assert.equal(matchContractRiven(c, [other, riven])?.id, '1') // closest roll history wins
  assert.equal(matchContractRiven(c, [{ ...riven, weapon: '/Lotus/Other' }]), undefined)
  assert.equal(matchContractRiven({ ...c, attributes: [c.attributes[0]] }, [riven]), undefined)
  assert.equal(matchContractRiven({ ...c, weaponRef: undefined }, [riven]), undefined)
})

test('an inventory riven naming the internal "…Base" class still matches and maps', () => {
  const hek = { ...riven, weapon: '/Lotus/Weapons/QuadShotgunBase' }
  const c = {
    weaponRef: '/Lotus/Weapons/QuadShotgun',
    attributes: [
      { name: 'Critical Chance', positive: true },
      { name: 'Critical Damage', positive: true }
    ]
  }
  assert.equal(matchContractRiven(c, [hek])?.id, '1')
  const hekCat = {
    ...cat,
    weapons: { hek: { name: 'Hek', gameRef: '/Lotus/Weapons/QuadShotgun' } }
  }
  assert.equal(toContractItem(hek, hekCat, data).item?.weapon_url_name, 'hek')
})

test('real Attica contract: wfm stat names map to tags and match the inventory riven', () => {
  const attrs = [
    { name: 'Fire Rate / Attack Speed', positive: true },
    { name: 'Critical Damage', positive: true },
    { name: 'Damage', positive: true }
  ]
  const attica = {
    ...riven,
    weapon: '/Lotus/Weapons/Tenno/Pistols/Attica',
    type: 'Pistol',
    itemType: 'P',
    rank: 8,
    mr: 11,
    rerolls: 10,
    polarity: 'vazarin',
    buffTags: ['WeaponFireRateMod', 'WeaponCritDamageMod', 'WeaponDamageAmountMod'],
    curseTags: []
  }
  const c = {
    weaponRef: attica.weapon,
    attributes: attrs,
    rerolls: 10,
    rank: 8,
    mastery: 11,
    polarity: 'vazarin'
  }
  assert.equal(matchContractRiven(c, [attica])?.id, '1')
  // the catalog may also spell the damage stat out
  const c2 = {
    ...c,
    attributes: [attrs[0], attrs[1], { name: 'Base Damage / Melee Damage', positive: true }]
  }
  assert.equal(matchContractRiven(c2, [attica])?.id, '1')
})

test('staleStats flags old listed values, tolerates rounding, flags a changed stat set', () => {
  const c = (
    v: number,
    extra: { name: string; value: number; positive: boolean }[] = []
  ): { attributes: { name: string; value: number; positive: boolean }[] } => ({
    attributes: [
      { name: 'Critical Chance', value: v, positive: true },
      { name: 'Critical Damage', value: 100, positive: true },
      ...extra
    ]
  })
  // current values for this riven (rank 8)
  const now = toContractItem(riven, cat, data).item!.attributes
  const cc = now[0].value
  const cd = now[1].value
  const same = {
    attributes: [
      { name: 'Critical Chance', value: cc, positive: true },
      { name: 'Critical Damage', value: cd + 0.05, positive: true }
    ]
  }
  assert.equal(staleStats(same, riven, cat, data).stale, false)
  const old = {
    attributes: [
      { name: 'Critical Chance', value: cc / 0.846, positive: true },
      { name: 'Critical Damage', value: cd, positive: true }
    ]
  }
  const r = staleStats(old, riven, cat, data)
  assert.equal(r.stale, true)
  assert.equal(r.diffs[0].name, 'Critical Chance')
  assert.equal(r.item?.name, 'Critatis')
  assert.equal(
    staleStats(c(cc, [{ name: 'Zoom', value: 1, positive: true }]), riven, cat, data).stale,
    true
  )
  assert.equal(staleStats(same, { ...riven, weapon: '/x' }, cat, data).stale, false) // unmappable
})
