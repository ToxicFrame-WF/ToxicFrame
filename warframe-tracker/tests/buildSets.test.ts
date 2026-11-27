import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSets } from '../src/renderer/src/hooks/buildSets.ts'

test('buildSets counts buildable sets from the scarcest part', () => {
  const m = (name: string, need?: number): InvMeta => ({
    kind: 'part',
    name,
    parent: 'p',
    tradable: true,
    isPrime: true,
    need
  })
  const meta = { a: m('Foo Prime Barrel'), b: m('Foo Prime Stock', 2) }
  const [s] = buildSets(
    meta,
    [
      { key: 'a', count: 5 },
      { key: 'b', count: 5 }
    ],
    new Map()
  )
  assert.equal(s.slug, 'foo_prime_set')
  assert.equal(s.count, 2)
})
