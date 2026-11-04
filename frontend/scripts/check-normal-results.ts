import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyDiscountForNormalList } from '../src/api/discountPeriod.ts'
import {
  CatalogReadFailure,
  discountsForShop,
  findStoredDiscount,
  findStoredShop,
  readNormalShops,
  readRowsOrFail,
  shopsForNormalResults,
  shopsForNormalResultsIgnoringChannel,
} from '../src/read/normalResults.ts'
import type { Discount } from '../src/types/discount.ts'
import type { Shop } from '../src/types/shop.ts'

const now = new Date('2026-11-05T03:00:00Z')

const validShop: Shop = {
  id: 'shop-valid',
  name: '架空商店',
  address: '広島県広島市中区（架空）',
  latitude: 34.3955,
  longitude: 132.4553,
}

const secondShop: Shop = {
  id: 'shop-second',
  name: '架空食堂',
  address: '広島県広島市中区（架空）',
  latitude: 34.3942,
  longitude: 132.4638,
}

const invalidShop: Shop = {
  id: 'shop-invalid',
  name: '座標が範囲外',
  address: '広島県広島市（架空）',
  latitude: 120,
  longitude: 132.45,
}

test('normal shop results are empty when nothing is stored', () => {
  assert.deepEqual(shopsForNormalResults([]), [])
})

test('normal shop results keep several valid shops and drop invalid coordinates', () => {
  const notANumber: Shop = { ...validShop, id: 'shop-nan', latitude: Number.NaN }
  const shops = shopsForNormalResults([validShop, invalidShop, notANumber, secondShop])
  assert.deepEqual(shops.map((shop) => shop.id), ['shop-valid', 'shop-second'])
  shops[0]!.name = '変更'
  assert.equal(validShop.name, '架空商店')
})

test('stored shop lookup finds an existing id and misses an unknown id', () => {
  assert.equal(findStoredShop([validShop, invalidShop], 'shop-invalid')?.id, 'shop-invalid')
  assert.equal(findStoredShop([validShop], 'missing'), undefined)
})

test('registration channel does not decide whether a shop is returned', () => {
  const shops = shopsForNormalResultsIgnoringChannel([
    { shop: validShop, registrationChannel: 'gmail' },
    { shop: secondShop, registrationChannel: 'manual' },
    { shop: invalidShop, registrationChannel: 'gmail' },
  ])
  assert.deepEqual(shops.map((shop) => shop.id), ['shop-valid', 'shop-second'])
  assert.equal('registrationChannel' in shops[0]!, false)
})

test('discounts stay linked to a shop, including an empty link', () => {
  const discounts = [discount('d-1', 'shop-valid'), discount('d-2', 'shop-second')]
  assert.deepEqual(discountsForShop(discounts, 'shop-valid').map((item) => item.id), ['d-1'])
  assert.deepEqual(discountsForShop(discounts, 'shop-missing'), [])
  assert.equal(findStoredDiscount(discounts, 'd-2')?.shopId, 'shop-second')
  assert.equal(findStoredDiscount(discounts, 'missing'), undefined)
})

test('reading rows keeps zero results distinct from a failed read', async () => {
  const none = await readNormalShops({ readRows: async () => [] })
  assert.deepEqual(none, [])

  const many = await readNormalShops({
    readRows: async () => [validShop, invalidShop, secondShop],
  })
  assert.deepEqual(many.map((shop) => shop.id), ['shop-valid', 'shop-second'])

  await assert.rejects(
    () => readRowsOrFail({ readRows: async () => Promise.reject(new Error('d1 unavailable')) }),
    (error: unknown) => {
      assert.ok(error instanceof CatalogReadFailure)
      return true
    },
  )
})

test('stored discounts keep rows outside the sale window and invalid datetimes', () => {
  const before = discount('before', 'shop-valid', {
    startsAt: '2026-12-01T00:00:00Z',
    endsAt: '2026-12-31T00:00:00Z',
  })
  const during = discount('during', 'shop-valid', {
    startsAt: '2026-11-01T00:00:00Z',
    endsAt: null,
  })
  const ended = discount('ended', 'shop-valid', {
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-02-01T00:00:00Z',
  })
  const invalid = discount('invalid', 'shop-valid', {
    startsAt: '2026-02-30T00:00:00Z',
    endsAt: null,
  })
  const stored = discountsForShop([before, during, ended, invalid], 'shop-valid')
  assert.deepEqual(stored.map((item) => item.id), ['before', 'during', 'ended', 'invalid'])
  assert.deepEqual(classifyDiscountForNormalList(before, now), {
    kind: 'exclude',
    reason: 'not-started',
  })
  assert.deepEqual(classifyDiscountForNormalList(during, now), { kind: 'include' })
  assert.deepEqual(classifyDiscountForNormalList(ended, now), {
    kind: 'exclude',
    reason: 'ended',
  })
  assert.deepEqual(classifyDiscountForNormalList(invalid, now), {
    kind: 'undecided',
    reason: 'invalid-datetime',
  })
})

function discount(
  id: string,
  shopId: string,
  period: Pick<Discount, 'startsAt' | 'endsAt'> = {
    startsAt: '2026-11-01T00:00:00Z',
    endsAt: null,
  },
): Discount {
  return {
    id,
    shopId,
    subject: '架空の商品',
    content: '10%OFF',
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  }
}
