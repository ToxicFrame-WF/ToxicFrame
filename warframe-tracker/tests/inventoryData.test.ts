import { test } from 'node:test'
import assert from 'node:assert/strict'
import { relicTotal } from '../src/main/inventoryData.ts'

test('relicTotal counts a missing ItemCount as 0', () => {
  assert.equal(relicTotal([{ ItemCount: undefined }, { ItemCount: 3 }]), 3)
  assert.equal(relicTotal(undefined), 0)
})
