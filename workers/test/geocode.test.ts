import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyNormalizedAddress } from '../src/geocoding/classify.ts'
import { geocodeAddress } from '../src/geocoding/geocodeAddress.ts'
import { toNormalizedAddress } from '../src/geocoding/geoloniaAdapter.ts'
import type { NormalizeResult } from '@geolonia/normalize-japanese-addresses'
import type { NormalizedAddress } from '../src/geocoding/types.ts'

function normalized(overrides: Partial<NormalizedAddress> = {}): NormalizedAddress {
  return {
    pref: '広島県',
    city: '広島市中区',
    town: '国泰寺町一丁目',
    addr: '6-34',
    other: '',
    level: 8,
    point: { latitude: 34.38552071, longitude: 132.454471652, pointLevel: 8 },
    prefectureName: '広島県',
    municipalityName: '広島市中区',
    townName: '国泰寺町一丁目',
    ...overrides,
  }
}

test('level 8 and point level 8 with an empty remainder is an accepted candidate', () => {
  const assessment = classifyNormalizedAddress(normalized())
  assert.equal(assessment.status, 'accepted_candidate')
  assert.deepEqual(assessment.acceptedPoint, {
    latitude: 34.38552071,
    longitude: 132.454471652,
  })
  assert.equal(assessment.referencePoint, null)
  assert.equal(assessment.failure, null)
})

test('a residential number whose point is the town representative needs review', () => {
  const assessment = classifyNormalizedAddress(normalized({
    pref: '広島県',
    city: '広島市安佐北区',
    town: '安佐町大字飯室',
    addr: '3052-1',
    level: 8,
    point: { latitude: 34.556528, longitude: 132.440467, pointLevel: 3 },
    prefectureName: '広島県',
    municipalityName: '広島市安佐北区',
    townName: '安佐町大字飯室',
  }))
  assert.equal(assessment.status, 'needs_review')
  assert.equal(assessment.acceptedPoint, null)
  assert.deepEqual(assessment.referencePoint, {
    latitude: 34.556528,
    longitude: 132.440467,
    pointLevel: 3,
  })
})

test('a town representative point needs review and is not accepted', () => {
  const assessment = classifyNormalizedAddress(normalized({
    addr: null,
    level: 3,
    point: { latitude: 34.385795, longitude: 132.457012, pointLevel: 3 },
  }))
  assert.equal(assessment.status, 'needs_review')
  assert.equal(assessment.acceptedPoint, null)
  assert.equal(assessment.referencePoint?.pointLevel, 3)
})

test('a municipality-only result is an invalid address and keeps no point', () => {
  const assessment = classifyNormalizedAddress(normalized({
    town: null,
    addr: null,
    other: '存在しない町1番1号',
    level: 2,
    point: { latitude: 34.386288, longitude: 132.454992, pointLevel: 2 },
  }))
  assert.equal(assessment.status, 'invalid_address')
  assert.equal(assessment.acceptedPoint, null)
  assert.equal(assessment.referencePoint, null)
  assert.equal(assessment.normalized?.level, 2)
})

test('level 0 is an invalid address', () => {
  const assessment = classifyNormalizedAddress(normalized({
    pref: null,
    city: null,
    town: null,
    addr: null,
    level: 0,
    point: null,
    prefectureName: null,
    municipalityName: null,
    townName: null,
  }))
  assert.equal(assessment.status, 'invalid_address')
  assert.equal(assessment.referencePoint, null)
})

test('blank input is invalid and does not call the normalizer', async () => {
  let called = false
  const assessment = await geocodeAddress('  ', async () => {
    called = true
    return normalized()
  })
  assert.equal(called, false)
  assert.equal(assessment.status, 'invalid_address')
  assert.equal(assessment.normalized, null)
  assert.equal(assessment.acceptedPoint, null)
})

test('a non-empty unresolved remainder needs review', () => {
  const assessment = classifyNormalizedAddress(normalized({ other: ' 広島市役所' }))
  assert.equal(assessment.status, 'needs_review')
  assert.equal(assessment.acceptedPoint, null)
  assert.equal(assessment.normalized?.other, ' 広島市役所')
  assert.equal(assessment.referencePoint?.pointLevel, 8)
})

test('a latitude outside the valid range is an invalid address', () => {
  const assessment = classifyNormalizedAddress(normalized({
    point: { latitude: 90.1, longitude: 132.45, pointLevel: 8 },
  }))
  assert.equal(assessment.status, 'invalid_address')
  assert.equal(assessment.acceptedPoint, null)
  assert.equal(assessment.referencePoint, null)
})

test('a longitude outside the valid range is an invalid address', () => {
  const assessment = classifyNormalizedAddress(normalized({
    point: { latitude: 34.3, longitude: 180.1, pointLevel: 8 },
  }))
  assert.equal(assessment.status, 'invalid_address')
  assert.equal(assessment.referencePoint, null)
})

test('NaN and Infinity are invalid addresses', () => {
  for (const latitude of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const assessment = classifyNormalizedAddress(normalized({
      point: { latitude, longitude: 132.45, pointLevel: 8 },
    }))
    assert.equal(assessment.status, 'invalid_address')
    assert.equal(assessment.acceptedPoint, null)
  }
})

test('a recognized address without a point needs review', () => {
  const assessment = classifyNormalizedAddress(normalized({ point: null }))
  assert.equal(assessment.status, 'needs_review')
  assert.equal(assessment.acceptedPoint, null)
  assert.equal(assessment.referencePoint, null)
  assert.equal(assessment.normalized?.pointLevel, null)
})

test('an unrecognized address without a point is invalid', () => {
  const assessment = classifyNormalizedAddress(normalized({
    level: 0,
    point: null,
    pref: null,
    city: null,
    town: null,
    addr: null,
  }))
  assert.equal(assessment.status, 'invalid_address')
})

test('a normalizer exception is a service error without a point', async () => {
  const assessment = await geocodeAddress('広島県広島市中区国泰寺町一丁目6番34号', async () => {
    throw new Error('住所データ ja/広島県/広島市中区.json の取得に失敗しました: 500')
  })
  assert.equal(assessment.status, 'service_error')
  assert.equal(assessment.acceptedPoint, null)
  assert.equal(assessment.referencePoint, null)
  assert.equal(assessment.normalized, null)
  assert.deepEqual(assessment.failure, { kind: 'upstream', retryable: true })
  assert.equal(JSON.stringify(assessment).includes('json'), false)
})

test('a timeout is a retryable service error', async () => {
  const assessment = await geocodeAddress('広島県広島市中区国泰寺町一丁目6番34号', async () => {
    const error = new Error('The operation was aborted due to timeout')
    error.name = 'TimeoutError'
    throw error
  })
  assert.equal(assessment.status, 'service_error')
  assert.deepEqual(assessment.failure, { kind: 'timeout', retryable: true })
  assert.equal(assessment.acceptedPoint, null)
})

test('a 404 from the address data is not marked retryable', async () => {
  const assessment = await geocodeAddress('広島県広島市中区国泰寺町一丁目6番34号', async () => {
    throw new Error('住所データの取得に失敗しました: 404')
  })
  assert.deepEqual(assessment.failure, { kind: 'upstream', retryable: false })
})

test('mismatched municipality metadata is not accepted', () => {
  const assessment = classifyNormalizedAddress(normalized({ municipalityName: '広島市西区' }))
  assert.equal(assessment.status, 'needs_review')
  assert.equal(assessment.acceptedPoint, null)
})

test('the adapter maps the measured Kokutaiji-machi result', () => {
  const result = {
    pref: '広島県',
    city: '広島市中区',
    town: '国泰寺町一丁目',
    addr: '6-34',
    other: '',
    level: 8,
    point: { lat: 34.38552071, lng: 132.454471652, level: 8 },
    metadata: {
      input: '広島県広島市中区国泰寺町一丁目6番34号',
      prefecture: { pref: '広島県' },
      city: { city: '広島市', ward: '中区' },
      machiAza: { oaza_cho: '国泰寺町', chome: '一丁目' },
    },
  } as NormalizeResult
  const assessment = classifyNormalizedAddress(toNormalizedAddress(result))
  assert.equal(assessment.status, 'accepted_candidate')
  assert.equal(assessment.normalized?.level, 8)
  assert.equal(assessment.normalized?.pointLevel, 8)
})

test('the adapter maps the measured Imuro chiban result to review', () => {
  const result = {
    pref: '広島県',
    city: '広島市安佐北区',
    town: '安佐町大字飯室',
    addr: '3052-1',
    other: '',
    level: 8,
    point: { lat: 34.556528, lng: 132.440467, level: 3 },
    metadata: {
      input: '広島県広島市安佐北区安佐町大字飯室3052番地1',
      prefecture: { pref: '広島県' },
      city: { city: '広島市', ward: '安佐北区' },
      machiAza: { oaza_cho: '安佐町大字飯室' },
    },
  } as NormalizeResult
  const assessment = classifyNormalizedAddress(toNormalizedAddress(result))
  assert.equal(assessment.status, 'needs_review')
  assert.equal(assessment.acceptedPoint, null)
  assert.equal(assessment.referencePoint?.pointLevel, 3)
})
