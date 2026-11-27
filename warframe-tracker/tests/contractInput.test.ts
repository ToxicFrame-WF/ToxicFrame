import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkContractChange, checkContractCreate } from '../src/main/contractInput.ts'

test('contract change keeps only known, valid fields', () => {
  const r = checkContractChange({
    visible: false,
    buyout_price: null,
    note: 'x'.repeat(400),
    evil: 1
  })
  assert.ok(
    r.ok && !('evil' in r.value) && r.value.note?.length === 300 && r.value.buyout_price === null
  )
  assert.equal(checkContractChange({ starting_price: -1 }).ok, false)
  assert.equal(checkContractChange({ starting_price: 1.5 }).ok, false)
  assert.equal(checkContractChange({ visible: 'yes' }).ok, false)
})

test('contract create rebuilds the body and rejects bad shapes', () => {
  const body = {
    item: {
      type: 'riven',
      name: 'a-b',
      weapon_url_name: 'soma',
      polarity: 'madurai',
      mod_rank: 8,
      re_rolls: 2,
      mastery_level: 10,
      extra: 1,
      attributes: [{ url_name: 'critical_chance', value: 100.5, positive: true, x: 1 }]
    },
    starting_price: 50,
    buyout_price: null,
    minimal_reputation: 0,
    note: '',
    visible: true,
    junk: 1
  }
  const r = checkContractCreate(body)
  assert.ok(r.ok)
  assert.ok(r.ok && !('junk' in r.value) && !('extra' in (r.value.item as object)))
  assert.equal(
    checkContractCreate({
      ...body,
      item: { ...body.item, attributes: [{ url_name: 'a', value: NaN, positive: true }] }
    }).ok,
    false
  )
  assert.equal(checkContractCreate({ ...body, starting_price: 'x' }).ok, false)
})

test('create accepts unset optional fields', () => {
  const r = checkContractCreate({
    item: {
      type: 'riven',
      name: 'a',
      weapon_url_name: 'hek',
      polarity: 'madurai',
      mod_rank: 8,
      re_rolls: 0,
      mastery_level: 8,
      attributes: []
    },
    starting_price: 100,
    buyout_price: undefined,
    minimal_reputation: undefined,
    note: undefined,
    visible: true
  })
  assert.ok(r.ok)
})
