import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarize, type StatsPayload } from '../src/main/marketMath.ts'

type Row = { datetime: string; volume: number; median: number; subtype?: string }
type LiveRow = Row & { order_type: 'sell'; min_price: number; max_price: number }
const DAY = 86_400_000
const AT = Date.parse('2026-11-27T12:00:00Z')
const day = (ago: number, volume: number, median: number, subtype?: string): Row => ({
  datetime: new Date(AT - ago * DAY).toISOString(),
  volume,
  median,
  subtype
})
const closed = (rows: Row[]): { statistics_closed: { '90days': Row[] } } => ({
  statistics_closed: { '90days': rows }
})

test('7 day window excludes a day exactly 8 days old; med7 is volume weighted', () => {
  const s = summarize(closed([day(8, 100, 1), day(6, 3, 10), day(1, 1, 20)]), AT)
  assert.equal(s.vol7, 4 / 7)
  assert.equal(s.med7, (3 * 10 + 20) / 4)
  assert.equal(s.vol90, 104 / 90)
})

test('med7 is 0, not NaN, without sales in the window', () => {
  const s = summarize(closed([day(30, 5, 7)]), AT)
  assert.equal(s.med7, 0)
  assert.equal(s.med90, 7)
  assert.equal(summarize({}, AT).med90, 0)
})

test('relics use the intact rows only', () => {
  const s = summarize(closed([day(1, 1, 5, 'intact'), day(1, 50, 99, 'radiant')]), AT)
  assert.equal(s.med7, 5)
  assert.equal(s.vol7, 1 / 7)
})

test('low is undefined when the latest sell row is older than the live age', () => {
  const row = (agoMs: number, min: number): LiveRow => ({
    datetime: new Date(AT - agoMs).toISOString(),
    volume: 0,
    median: 0,
    order_type: 'sell',
    min_price: min,
    max_price: min
  })
  const live = (rows: LiveRow[]): StatsPayload => ({ statistics_live: { '48hours': rows } })
  assert.equal(summarize(live([row(4 * 3_600_000, 9)]), AT).low, undefined)
  assert.equal(summarize(live([row(4 * 3_600_000, 9), row(3_600_000, 8)]), AT).low, 8)
})
