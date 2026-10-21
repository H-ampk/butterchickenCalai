import assert from 'node:assert/strict'
import test from 'node:test'
import type { Shop } from '../src/types/shop.ts'
import { filterShops, searchShops } from '../src/utils/shopSearch.ts'

const shops: readonly Shop[] = [
  {
    id: 'kamiya',
    name: '架空商店 紙屋町',
    address: '広島県広島市中区紙屋町1丁目（架空）',
    latitude: 34.3955,
    longitude: 132.4553,
  },
  {
    id: 'cafe',
    name: 'Butter Cafe',
    address: '広島県広島市中区袋町（架空）',
    latitude: 34.39,
    longitude: 132.45,
  },
  {
    id: 'wide',
    name: 'Ｓｈｏｐ１２',
    address: '広島県広島市南区（架空）',
    latitude: -90,
    longitude: 180,
  },
  {
    id: 'missing',
    name: '位置なし店',
    address: '住所未設定',
    latitude: Number.NaN,
    longitude: Number.POSITIVE_INFINITY,
  },
]

test('searches by shop name', () => {
  const result = searchShops(shops, '紙屋町')
  assert.deepEqual(
    result.map((shop) => shop.id),
    ['kamiya'],
  )
})

test('searches by address', () => {
  const result = searchShops(shops, '袋町')
  assert.deepEqual(
    result.map((shop) => shop.id),
    ['cafe'],
  )
})

test('matches a partial string', () => {
  const result = searchShops(shops, '紙屋')
  assert.deepEqual(
    result.map((shop) => shop.id),
    ['kamiya'],
  )
})

test('ignores letter case', () => {
  const result = searchShops(shops, 'butter cafe')
  assert.deepEqual(
    result.map((shop) => shop.id),
    ['cafe'],
  )
})

test('trims whitespace around the query', () => {
  const result = searchShops(shops, '  紙屋町  ')
  assert.deepEqual(
    result.map((shop) => shop.id),
    ['kamiya'],
  )
})

test('returns every shop for an empty query and keeps order', () => {
  const result = searchShops(shops, '   ')
  assert.deepEqual(
    result.map((shop) => shop.id),
    shops.map((shop) => shop.id),
  )
})

test('returns an empty list when nothing matches', () => {
  assert.deepEqual(searchShops(shops, '存在しない店'), [])
})

test('normalizes full-width alphanumeric characters', () => {
  assert.deepEqual(
    searchShops(shops, 'shop12').map((shop) => shop.id),
    ['wide'],
  )
  assert.deepEqual(
    searchShops(shops, 'ＳＨＯＰ１２').map((shop) => shop.id),
    ['wide'],
  )
})

test('keeps source order when several shops match', () => {
  const result = searchShops(shops, '広島')
  assert.deepEqual(
    result.map((shop) => shop.id),
    ['kamiya', 'cafe', 'wide'],
  )
})

test('does not mutate the source array or shop objects', () => {
  const source = shops.map((shop) => ({ ...shop }))
  const snapshot = source.map((shop) => ({ ...shop }))

  const searched = searchShops(source, '紙屋町')
  const filtered = filterShops(source, { query: '広島', hasCoordinates: true })

  assert.notEqual(searched, source)
  assert.notEqual(filtered, source)
  assert.equal(source.length, snapshot.length)
  assert.deepEqual(source, snapshot)
  assert.deepEqual(
    searched.map((shop) => shop.id),
    ['kamiya'],
  )
})

test('filters shops that have valid coordinates', () => {
  const result = filterShops(shops, { hasCoordinates: true })
  assert.deepEqual(
    result.map((shop) => shop.id),
    ['kamiya', 'cafe', 'wide'],
  )
})

test('filters shops that lack valid coordinates', () => {
  const result = filterShops(shops, { hasCoordinates: false })
  assert.deepEqual(
    result.map((shop) => shop.id),
    ['missing'],
  )
})

test('treats NaN and Infinity as invalid coordinates', () => {
  const invalid: Shop[] = [
    { id: 'nan-lat', name: 'a', address: 'b', latitude: Number.NaN, longitude: 0 },
    { id: 'inf-lng', name: 'a', address: 'b', latitude: 0, longitude: Number.NEGATIVE_INFINITY },
  ]
  assert.deepEqual(filterShops(invalid, { hasCoordinates: true }), [])
  assert.equal(filterShops(invalid, { hasCoordinates: false }).length, 2)
})

test('accepts latitude and longitude at the inclusive bounds', () => {
  const bounds: Shop[] = [
    { id: 'ok', name: '境界', address: '地点', latitude: 90, longitude: -180 },
    { id: 'lat', name: '境界外', address: '地点', latitude: 90.0001, longitude: 0 },
    { id: 'lng', name: '境界外', address: '地点', latitude: -90, longitude: -180.0001 },
  ]
  assert.deepEqual(
    filterShops(bounds, { hasCoordinates: true }).map((shop) => shop.id),
    ['ok'],
  )
  assert.deepEqual(
    filterShops(bounds, { hasCoordinates: false }).map((shop) => shop.id),
    ['lat', 'lng'],
  )
})

test('combines query and coordinate filters with AND', () => {
  const result = filterShops(shops, { query: '広島', hasCoordinates: true })
  assert.deepEqual(
    result.map((shop) => shop.id),
    ['kamiya', 'cafe', 'wide'],
  )
  assert.deepEqual(filterShops(shops, { query: '位置なし', hasCoordinates: true }), [])
  assert.deepEqual(
    filterShops(shops, { query: '位置なし', hasCoordinates: false }).map((shop) => shop.id),
    ['missing'],
  )
})

test('returns an empty list for an empty shop array', () => {
  assert.deepEqual(searchShops([], '紙屋町'), [])
  assert.deepEqual(filterShops([], { query: '紙屋町', hasCoordinates: true }), [])
})
