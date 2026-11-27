import { test } from 'node:test'
import assert from 'node:assert/strict'
import { undercutsToTell, UNDERCUT_REPEAT_MS } from '../src/main/undercutLogic.ts'

test('undercutsToTell announces once, again only on a lower price or after the repeat window', () => {
  const orders = [
    { id: 'a', platinum: 10 },
    { id: 'b', platinum: 10 }
  ]
  const told = new Map<string, { low: number; at: number }>()
  const low = (a?: number, b?: number): Map<string, number | undefined> =>
    new Map([
      ['a', a],
      ['b', b]
    ])
  assert.deepEqual(undercutsToTell(orders, low(8, 10), told, 0), [{ id: 'a', low: 8 }]) // b is equal
  assert.deepEqual(undercutsToTell(orders, low(8, 10), told, 1000), []) // already told
  assert.deepEqual(undercutsToTell(orders, low(7, 10), told, 2000), [{ id: 'a', low: 7 }]) // dropped
  assert.equal(undercutsToTell(orders, low(7, 10), told, UNDERCUT_REPEAT_MS + 3000).length, 1)
  undercutsToTell(orders, low(undefined, 10), told, 0) // resolved
  assert.equal(undercutsToTell(orders, low(9, 10), told, 5).length, 1) // new undercut
})

test('undercutsToTell edge cases', () => {
  const orders = [{ id: 'a', platinum: 10 }]
  const mk = (): Map<string, { low: number; at: number }> => new Map()
  const low = (n?: number): Map<string, number | undefined> => new Map([['a', n]])
  assert.deepEqual(undercutsToTell(orders, low(10), mk(), 0), []) // tie is no undercut
  const told = mk()
  undercutsToTell(orders, low(8), told, 0)
  assert.equal(undercutsToTell(orders, low(8), told, UNDERCUT_REPEAT_MS).length, 0) // window edge
  assert.equal(undercutsToTell(orders, low(8), told, UNDERCUT_REPEAT_MS + 1).length, 1) // re-announced
  const t2 = mk()
  undercutsToTell(orders, low(5), t2, 0)
  assert.deepEqual(undercutsToTell(orders, low(9), t2, 1000), []) // rising inside the window
  // a failed fetch leaves the order out of the call, so its told entry survives
  undercutsToTell([], new Map(), t2, 2000)
  assert.deepEqual(undercutsToTell(orders, low(5), t2, 3000), [])
})
