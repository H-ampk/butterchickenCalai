import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyNormalizedAddress } from '../src/geocoding/classify.ts'
import { geocodeAddress } from '../src/geocoding/geocodeAddress.ts'
import { addressReviewJson, buildAddressReview } from '../src/geocoding/reviewData.ts'
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

const inputAddress = '広島県広島市中区国泰寺町一丁目6番34号'

test('accepted_candidate keeps the candidate point and no review reasons', () => {
  const source = normalized()
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
    source,
  })
  assert.equal(record.status, 'accepted_candidate')
  assert.deepEqual(record.acceptedCandidate, {
    latitude: 34.38552071,
    longitude: 132.454471652,
  })
  assert.equal(record.referencePoint, null)
  assert.deepEqual(record.reasons, [])
  assert.equal(record.inputAddress, inputAddress)
})

test('needs_review keeps the reference point and the town-representative reason', () => {
  const source = normalized({
    city: '広島市安佐北区',
    town: '安佐町大字飯室',
    addr: '3052-1',
    point: { latitude: 34.556528, longitude: 132.440467, pointLevel: 3 },
    municipalityName: '広島市安佐北区',
    townName: '安佐町大字飯室',
  })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
    source,
  })
  assert.equal(record.status, 'needs_review')
  assert.equal(record.acceptedCandidate, null)
  assert.deepEqual(record.referencePoint, {
    latitude: 34.556528,
    longitude: 132.440467,
    pointLevel: 3,
  })
  assert.deepEqual(
    record.reasons.map((item) => item.code),
    ['residential_point_is_town_representative'],
  )
})

test('a town representative point is not stored as an accepted candidate', () => {
  const source = normalized({
    addr: null,
    level: 3,
    point: { latitude: 34.385795, longitude: 132.457012, pointLevel: 3 },
  })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
    source,
  })
  assert.equal(record.acceptedCandidate, null)
  assert.equal(record.referencePoint?.pointLevel, 3)
  assert.ok(record.reasons.some((item) => item.code === 'town_level_only'))
  assert.equal(
    record.reasons.some((item) => item.code === 'residential_point_is_town_representative'),
    false,
  )
})

test('invalid_address returns no adoptable point', () => {
  const source = normalized({
    town: null,
    addr: null,
    other: '存在しない町1番1号',
    level: 2,
    point: { latitude: 34.386288, longitude: 132.454992, pointLevel: 2 },
  })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
    source,
  })
  assert.equal(record.status, 'invalid_address')
  assert.equal(record.acceptedCandidate, null)
  assert.equal(record.referencePoint, null)
  assert.ok(record.reasons.some((item) => item.code === 'invalid_address'))
})

test('service_error returns no adoptable point and keeps the failure kind', async () => {
  const assessment = await geocodeAddress(inputAddress, async () => {
    throw new Error('住所データ ja/広島県/広島市中区.json の取得に失敗しました: 503')
  })
  const record = buildAddressReview({ inputAddress, assessment })
  assert.equal(record.status, 'service_error')
  assert.equal(record.acceptedCandidate, null)
  assert.equal(record.referencePoint, null)
  assert.deepEqual(record.serviceFailure, { kind: 'upstream', retryable: true })
  assert.deepEqual(
    record.reasons.map((item) => item.code),
    ['service_error'],
  )
  assert.equal(addressReviewJson(record).includes('json'), false)
  assert.equal(addressReviewJson(record).includes('503'), false)
})

test('an unresolved remainder is kept on the review record', () => {
  const source = normalized({ other: ' 広島市役所' })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
    source,
  })
  assert.equal(record.normalized?.other, ' 広島市役所')
  assert.ok(record.reasons.some((item) => item.code === 'unresolved_remainder'))
})

test('the original address is preserved without trimming', () => {
  const source = normalized()
  const record = buildAddressReview({
    inputAddress: '  広島県広島市中区国泰寺町一丁目6番34号  ',
    assessment: classifyNormalizedAddress(source),
    source,
  })
  assert.equal(record.inputAddress, '  広島県広島市中区国泰寺町一丁目6番34号  ')
})

test('review JSON keeps candidate and reference points apart', () => {
  const source = normalized({ other: '建物名' })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
    source,
  })
  const parsed = JSON.parse(addressReviewJson(record)) as {
    acceptedCandidate: unknown
    referencePoint: { pointLevel: number } | null
    reasons: { code: string; message: string }[]
    inputAddress: string
  }
  assert.equal(parsed.acceptedCandidate, null)
  assert.equal(parsed.referencePoint?.pointLevel, 8)
  assert.equal(parsed.inputAddress, inputAddress)
  assert.equal(parsed.reasons[0]?.code, 'unresolved_remainder')
  assert.equal(typeof parsed.reasons[0]?.message, 'string')
})

test('several observed reasons are kept together', () => {
  const source = normalized({
    other: '建物名',
    addr: null,
    pref: '広島県',
    prefectureName: '岡山県',
    point: null,
  })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
    source,
  })
  assert.deepEqual(
    record.reasons.map((item) => item.code),
    ['missing_point', 'unresolved_remainder', 'component_mismatch', 'missing_block'],
  )
})

test('a missing official name is not reported as a mismatch', () => {
  const source = normalized({ prefectureName: null })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
    source,
  })
  assert.equal(
    record.reasons.some((item) => item.code === 'component_mismatch'),
    false,
  )
})

test('an omitted source still keeps reasons that the assessment itself shows', () => {
  const source = normalized({ other: '建物名' })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
  })
  assert.equal(record.status, 'needs_review')
  assert.equal(record.normalized?.other, '建物名')
  assert.deepEqual(
    record.reasons.map((item) => item.code),
    ['unresolved_remainder'],
  )
})

test('an omitted source keeps a town-representative reason from the reference point', () => {
  const source = normalized({
    point: { latitude: 34.556528, longitude: 132.440467, pointLevel: 3 },
  })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
  })
  assert.deepEqual(
    record.reasons.map((item) => item.code),
    ['residential_point_is_town_representative'],
  )
})

test('an omitted source does not invent a component mismatch', () => {
  const source = normalized({ pref: '広島県', prefectureName: '岡山県' })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
  })
  assert.equal(
    record.reasons.some((item) => item.code === 'component_mismatch'),
    false,
  )
})

test('an in-range point dropped by an unrecognized level stays an invalid address', () => {
  const source = normalized({
    town: null,
    addr: null,
    level: 2,
    point: { latitude: 34.386288, longitude: 132.454992, pointLevel: 2 },
  })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(source),
    source,
  })
  assert.deepEqual(
    record.reasons.map((item) => item.code),
    ['invalid_address'],
  )
})

test('a conflicting source does not supply reasons for the assessment', () => {
  const assessed = normalized()
  const conflicting = normalized({
    other: '別住所',
    point: { latitude: 34.1, longitude: 132.1, pointLevel: 3 },
  })
  const record = buildAddressReview({
    inputAddress,
    assessment: classifyNormalizedAddress(assessed),
    source: conflicting,
  })
  assert.equal(record.status, 'accepted_candidate')
  assert.deepEqual(record.acceptedCandidate, {
    latitude: 34.38552071,
    longitude: 132.454471652,
  })
  assert.deepEqual(
    record.reasons.map((item) => item.code),
    ['input_mismatch'],
  )
})

test('a service error ignores a conflicting normalized source', async () => {
  const assessment = await geocodeAddress(inputAddress, async () => {
    throw new Error('timeout after 300 ms')
  })
  const record = buildAddressReview({
    inputAddress,
    assessment,
    source: normalized(),
  })
  assert.deepEqual(
    record.reasons.map((item) => item.code),
    ['service_error'],
  )
  assert.equal(record.acceptedCandidate, null)
})
