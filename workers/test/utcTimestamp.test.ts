import assert from 'node:assert/strict'
import test from 'node:test'
import { isUtcSecondTimestamp } from '../src/utcTimestamp.ts'

test('accepts a real UTC second timestamp', () => {
  assert.equal(isUtcSecondTimestamp('2026-01-01T00:00:00Z'), true)
  assert.equal(isUtcSecondTimestamp('2024-02-29T23:59:59Z'), true)
  assert.equal(isUtcSecondTimestamp('2026-06-15T12:00:00Z'), true)
})

test('rejects values the database format check also rejects', () => {
  assert.equal(isUtcSecondTimestamp('2026-01-01T00:00:00.000Z'), false)
  assert.equal(isUtcSecondTimestamp('2026-01-01T00:00:00+00:00'), false)
  assert.equal(isUtcSecondTimestamp('2026-01-01T00:00:00+09:00'), false)
  assert.equal(isUtcSecondTimestamp('2026-01-01T00:00:00z'), false)
  assert.equal(isUtcSecondTimestamp('2026-01-01 00:00:00Z'), false)
  assert.equal(isUtcSecondTimestamp('2026-13-01T00:00:00Z'), false)
  assert.equal(isUtcSecondTimestamp('2026-00-01T00:00:00Z'), false)
  assert.equal(isUtcSecondTimestamp('2026-01-00T00:00:00Z'), false)
  assert.equal(isUtcSecondTimestamp('2026-01-32T00:00:00Z'), false)
  assert.equal(isUtcSecondTimestamp('2026-01-01T24:00:00Z'), false)
  assert.equal(isUtcSecondTimestamp('2026-01-01T00:60:00Z'), false)
  assert.equal(isUtcSecondTimestamp('2026-01-01T00:00:60Z'), false)
})

test('rejects calendar-invalid dates that the database check still allows', () => {
  assert.equal(isUtcSecondTimestamp('2026-02-31T00:00:00Z'), false)
  assert.equal(isUtcSecondTimestamp('2026-02-29T00:00:00Z'), false)
  assert.equal(isUtcSecondTimestamp('2026-04-31T12:00:00Z'), false)
})

test('keeps years below 100 as the written four digits', () => {
  const accepted = [
    '0000-01-01T00:00:00Z',
    '0000-02-29T00:00:00Z',
    '0001-01-01T00:00:00Z',
    '0004-02-29T00:00:00Z',
    '0096-02-29T12:00:00Z',
    '0099-01-01T00:00:00Z',
    '2000-02-29T00:00:00Z',
    '2024-02-29T00:00:00Z',
  ]
  const rejected = [
    '0099-02-29T00:00:00Z',
    '0100-02-29T00:00:00Z',
    '1900-02-29T00:00:00Z',
    '-001-01-01T00:00:00Z',
    '+001-01-01T00:00:00Z',
  ]
  for (const value of accepted) {
    assert.equal(isUtcSecondTimestamp(value), true, value)
  }
  for (const value of rejected) {
    assert.equal(isUtcSecondTimestamp(value), false, value)
  }
})
