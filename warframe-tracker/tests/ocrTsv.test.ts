import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tsvLines } from '../src/main/ocrTsv.ts'

test('tesseract tsv words are grouped into lines', () => {
  const h = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext'
  const tsv = [
    h,
    '1\t1\t0\t0\t0\t0\t0\t0\t100\t50\t-1\t',
    '5\t1\t1\t1\t1\t1\t5\t5\t30\t10\t96\tVolt',
    '5\t1\t1\t1\t1\t2\t40\t5\t30\t10\t95\tPrime',
    '5\t1\t1\t1\t2\t1\t5\t20\t30\t10\t90\tBlueprint',
    '5\t1\t1\t1\t2\t2\t40\t20\t30\t10\t-1\t ',
    ''
  ].join('\r\n')
  assert.deepEqual(tsvLines(tsv), ['Volt Prime', 'Blueprint'])
  assert.deepEqual(tsvLines(''), [])
})
