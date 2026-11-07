import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSearchText } from '../src/searchText.ts'

test('NFKC then trim then lower case', () => {
  assert.equal(normalizeSearchText('　架空ＣＡＦＥ１２　'), '架空cafe12')
  assert.equal(normalizeSearchText('  Example-Town  '), 'example-town')
  assert.equal(normalizeSearchText('Ａ'), 'a')
})

test('empty and whitespace-only text normalize to an empty string', () => {
  assert.equal(normalizeSearchText(''), '')
  assert.equal(normalizeSearchText('  '), '')
  assert.equal(normalizeSearchText('　'), '')
})
