import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { respondToReadApi } from '../src/readApi/handleReadApi.ts'
import {
  classifyDiscountVisibility,
  isDetailDiscount,
  isNormalListDiscount,
  isStoredDiscountPublishable,
  type DiscountVisibilityKind,
} from '../src/readApi/discountVisibility.ts'
import { LIKE_ESCAPE, shopMatchesSearch, toContainsLikePattern } from '../src/readApi/likePattern.ts'
import { normalizeQueryText } from '../src/readApi/parseQuery.ts'
import {
  toPublicDiscount,
  toPublicShop,
  type DiscountSourceRow,
  type ShopSourceRow,
} from '../src/readApi/publicJson.ts'
import {
  decideDiscountDetail,
  decideShopDetail,
  listPublicDiscounts,
  listPublicShops,
  pageShopDiscounts,
} from '../src/readApi/publicPage.ts'
import { hasValidShopCoordinates, isValidLatitude, isValidLongitude } from '../src/readApi/shopVisibility.ts'
import { classifySaleWindow, readStoredUtcInstant } from '../src/readApi/utcInstant.ts'
import { isUtcSecondTimestamp } from '../src/utcTimestamp.ts'

const NOW_TEXT = '2026-11-09T12:00:00Z'
const NOW_MS = Date.parse(NOW_TEXT)
const NOW = new Date(NOW_MS)

function shop(overrides: Partial<ShopSourceRow> = {}): ShopSourceRow {
  return {
    id: 'shop_1',
    name: '架空商店',
    address: '広島市',
    latitude: 34.39,
    longitude: 132.45,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function discount(overrides: Partial<DiscountSourceRow> = {}): DiscountSourceRow {
  return {
    id: 'discount_1',
    shop_id: 'shop_1',
    subject: '件名',
    content: null,
    starts_at: '2026-11-01T00:00:00Z',
    ends_at: '2026-12-01T00:00:00Z',
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

function isoFromIndex(index: number): string {
  const parsed = new Date(Date.UTC(2026, 0, 1, 0, 0, index))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}T${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}:${pad(parsed.getUTCSeconds())}Z`
}

function assertLiteralContains(pattern: string, query: string): void {
  const normalized = normalizeQueryText(query)
  assert.equal(pattern.startsWith('%'), true)
  assert.equal(pattern.endsWith('%'), true)
  const inner = pattern.slice(1, -1)
  let decoded = ''
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index]
    if (char === LIKE_ESCAPE) {
      const escaped = inner[index + 1]
      assert.equal(escaped === '%' || escaped === '_' || escaped === LIKE_ESCAPE, true)
      decoded += escaped
      index += 1
      continue
    }
    assert.equal(char === '%' || char === '_', false)
    decoded += char
  }
  assert.equal(decoded, normalized)
}

test('shop coordinates accept inclusive bounds and reject everything outside them', () => {
  assert.equal(isValidLatitude(-90), true)
  assert.equal(isValidLatitude(90), true)
  assert.equal(isValidLongitude(-180), true)
  assert.equal(isValidLongitude(180), true)
  assert.equal(hasValidShopCoordinates(-90, -180), true)
  assert.equal(hasValidShopCoordinates(90, 180), true)
  assert.equal(hasValidShopCoordinates(0, 0), true)

  assert.equal(isValidLatitude(-90.0001), false)
  assert.equal(isValidLatitude(90.0001), false)
  assert.equal(isValidLongitude(-180.0001), false)
  assert.equal(isValidLongitude(180.0001), false)
  assert.equal(hasValidShopCoordinates(90.1, 0), false)
  assert.equal(hasValidShopCoordinates(0, 180.1), false)

  assert.equal(hasValidShopCoordinates(null, null), false)
  assert.equal(hasValidShopCoordinates(null, 132.45), false)
  assert.equal(hasValidShopCoordinates(34.39, null), false)
  assert.equal(hasValidShopCoordinates(undefined, 0), false)
  assert.equal(hasValidShopCoordinates(Number.NaN, 0), false)
  assert.equal(hasValidShopCoordinates(0, Number.NaN), false)
  assert.equal(hasValidShopCoordinates(Number.POSITIVE_INFINITY, 0), false)
  assert.equal(hasValidShopCoordinates(0, Number.NEGATIVE_INFINITY), false)
  assert.equal(hasValidShopCoordinates('34.39', '132.45'), false)
  assert.equal(hasValidShopCoordinates(34, false), false)
})

test('an empty shop name and address stay public when coordinates are valid', () => {
  const row = shop({
    name: '',
    address: '',
    latitude: -90,
    longitude: 180,
    name_search: 'SECRET_NAME_SEARCH',
    address_search: 'SECRET_ADDRESS_SEARCH',
    updated_at: '2026-11-09T00:00:00Z',
    sql_error: 'SELECT secret FROM sqlite',
  })
  const mapped = toPublicShop(row)
  assert.ok(mapped)
  assert.deepEqual(mapped.body, {
    id: 'shop_1',
    name: '',
    address: '',
    latitude: -90,
    longitude: 180,
  })
  assert.deepEqual(Object.keys(mapped.body), ['id', 'name', 'address', 'latitude', 'longitude'])
  const json = JSON.stringify(mapped.body)
  assert.equal(json.includes('SECRET'), false)
  assert.equal(json.includes('created'), false)
  assert.equal(json.includes('SELECT'), false)
  assert.equal(json.includes('sqlite'), false)

  const page = listPublicShops([row], { q: null, limit: 20, offset: 0 })
  assert.equal(page.total, 1)
  assert.deepEqual(page.items, [mapped.body])

  const detail = decideShopDetail(row)
  assert.equal(detail.status, 'ok')
  if (detail.status === 'ok') {
    assert.deepEqual(detail.body, mapped.body)
  }
})

test('null shop name and address are public empty strings, and a non-string name is not', () => {
  const empty = toPublicShop(shop({ name: null, address: null }))
  assert.ok(empty)
  assert.equal(empty.body.name, '')
  assert.equal(empty.body.address, '')

  assert.equal(toPublicShop(shop({ name: 1 })), null)
  assert.equal(decideShopDetail(shop({ latitude: null })).status, 'not_found')
  assert.equal(decideShopDetail(null).status, 'not_found')
})

test('discount text is public when either subject or content survives trim', () => {
  const shopRow = shop()
  const cases: Array<{ subject: unknown; content: unknown; kind: DiscountVisibilityKind }> = [
    { subject: '件名', content: null, kind: 'during' },
    { subject: null, content: '本文', kind: 'during' },
    { subject: '  件名  ', content: '', kind: 'during' },
    { subject: '', content: '', kind: 'invalid-stored' },
    { subject: null, content: null, kind: 'invalid-stored' },
    { subject: '   ', content: '\t', kind: 'invalid-stored' },
    { subject: '　', content: '　　', kind: 'invalid-stored' },
    { subject: '　', content: '本文', kind: 'during' },
    { subject: 1, content: '本文', kind: 'invalid-stored' },
  ]
  for (const entry of cases) {
    const kind = classifyDiscountVisibility(
      {
        subject: entry.subject,
        content: entry.content,
        startsAt: '2026-11-01T00:00:00Z',
        endsAt: '2026-12-01T00:00:00Z',
        shop: shopRow,
      },
      NOW_MS,
    )
    assert.equal(kind, entry.kind, JSON.stringify(entry))
    assert.equal(isStoredDiscountPublishable(kind), entry.kind === 'during')
  }

  const spaced = toPublicDiscount(discount({ subject: '  件名  ', content: '' }))
  assert.ok(spaced)
  assert.equal(spaced.body.subject, '  件名  ')
  const subjectOnly = toPublicDiscount(discount({ subject: '件名', content: null }))
  assert.ok(subjectOnly)
  assert.equal(subjectOnly.body.subject, '件名')
  assert.equal(subjectOnly.body.content, null)
  const contentOnly = toPublicDiscount(discount({ subject: null, content: '本文' }))
  assert.ok(contentOnly)
  assert.equal(contentOnly.body.subject, null)
  assert.equal(contentOnly.body.content, '本文')
  assert.equal(toPublicDiscount(discount({ subject: '　', content: '　　' })), null)
})

test('a discount on an unpublished shop is excluded from the list and the detail', () => {
  const hidden = shop({ id: 'hidden', latitude: null, longitude: null })
  const row = discount({ shop_id: 'hidden' })
  const kind = classifyDiscountVisibility(
    {
      subject: row.subject,
      content: row.content,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      shop: hidden,
    },
    NOW_MS,
  )
  assert.equal(kind, 'unpublished-shop')
  assert.equal(isNormalListDiscount(kind), false)
  assert.equal(isDetailDiscount(kind), false)
  assert.equal(isStoredDiscountPublishable(kind), false)

  const page = listPublicDiscounts([row], [hidden], { limit: 20, offset: 0 }, NOW)
  assert.equal(page.total, 0)
  assert.deepEqual(page.items, [])
  assert.equal(decideDiscountDetail(row, [hidden], NOW).status, 'not_found')
  assert.equal(decideDiscountDetail(null, [shop()], NOW).status, 'not_found')

  const missingShop = classifyDiscountVisibility(
    {
      subject: '件名',
      content: '本文',
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      shop: null,
    },
    NOW_MS,
  )
  assert.equal(missingShop, 'unpublished-shop')
})

test('sale window boundaries follow startsAt <= now < endsAt', () => {
  const shopRow = shop()
  const expectKind = (startsAt: unknown, endsAt: unknown, kind: DiscountVisibilityKind) => {
    const actual = classifyDiscountVisibility(
      { subject: '件名', content: null, startsAt, endsAt, shop: shopRow },
      NOW_MS,
    )
    assert.equal(actual, kind, `${String(startsAt)} .. ${String(endsAt)}`)
    assert.equal(classifySaleWindow(startsAt, endsAt, NOW_MS), kind)
  }

  expectKind('2026-11-09T12:00:01Z', '2026-11-09T13:00:00Z', 'before')
  expectKind('2026-11-09T12:00:00Z', '2026-11-09T13:00:00Z', 'during')
  expectKind('2026-11-09T11:00:00Z', '2026-11-09T12:00:01Z', 'during')
  expectKind('2026-11-09T11:00:00Z', '2026-11-09T12:00:00Z', 'after')
  expectKind('2026-11-09T11:00:00Z', '2026-11-09T11:59:59Z', 'after')
  expectKind(null, '2026-11-09T13:00:00Z', 'during')
  expectKind(null, NOW_TEXT, 'after')
  expectKind('2026-11-09T11:00:00Z', null, 'during')
  expectKind('2026-11-09T12:00:00Z', null, 'during')
  expectKind('2026-11-09T12:00:01Z', null, 'before')
  expectKind(null, null, 'during')

  assert.equal(isNormalListDiscount('during'), true)
  assert.equal(isNormalListDiscount('before'), false)
  assert.equal(isNormalListDiscount('after'), false)
  assert.equal(isDetailDiscount('during'), true)
  assert.equal(isDetailDiscount('after'), true)
  assert.equal(isDetailDiscount('before'), false)
  assert.equal(isStoredDiscountPublishable('before'), true)
  assert.equal(isStoredDiscountPublishable('after'), true)
  assert.equal(isStoredDiscountPublishable('invalid-stored'), false)
})

test('invalid stored datetimes and impossible ranges are not a sale phase', () => {
  const shopRow = shop()
  const invalidValues = [
    '2026-11-09T12:00:00+09:00',
    '2026-11-09T12:00:00+00:00',
    '2026-11-09T12:00:00.000Z',
    '2026-11-09T12:00:00',
    '2026-11-09 12:00:00Z',
    '2026-11-09T12:00:00z',
    '2026-11-09T12:00Z',
    '2026-02-31T00:00:00Z',
    '2023-02-29T00:00:00Z',
    '1900-02-29T00:00:00Z',
    '2026-13-01T00:00:00Z',
    '2026-00-10T00:00:00Z',
    '2026-11-00T00:00:00Z',
    '2026-11-09T24:00:00Z',
    '2026-11-09T23:60:00Z',
    '2026-11-09T23:59:60Z',
    '',
    1_731_153_600,
  ]
  for (const value of invalidValues) {
    assert.equal(readStoredUtcInstant(value).kind, 'invalid', String(value))
    const kind = classifyDiscountVisibility(
      {
        subject: '件名',
        content: '本文',
        startsAt: value,
        endsAt: '2026-12-01T00:00:00Z',
        shop: shopRow,
      },
      NOW_MS,
    )
    assert.equal(kind, 'invalid-stored', String(value))
  }

  assert.equal(readStoredUtcInstant('2024-02-29T00:00:00Z').kind, 'instant')
  assert.equal(readStoredUtcInstant('2000-02-29T23:59:59Z').kind, 'instant')
  assert.equal(readStoredUtcInstant('2024-02-29T12:00:00Z').kind, 'instant')
  assert.equal(readStoredUtcInstant(null).kind, 'absent')

  const lowYears = [
    ['0000-01-01T00:00:00Z', true],
    ['0000-02-29T00:00:00Z', true],
    ['0001-01-01T00:00:00Z', true],
    ['0004-02-29T00:00:00Z', true],
    ['0096-02-29T12:00:00Z', true],
    ['0099-01-01T00:00:00Z', true],
    ['0099-02-29T00:00:00Z', false],
    ['0100-02-29T00:00:00Z', false],
    ['1900-02-29T00:00:00Z', false],
    ['2000-02-29T00:00:00Z', true],
    ['2024-02-29T00:00:00Z', true],
    ['-001-01-01T00:00:00Z', false],
    ['+001-01-01T00:00:00Z', false],
  ] as const
  for (const [value, accepted] of lowYears) {
    assert.equal(isUtcSecondTimestamp(value), accepted, value)
    assert.equal(readStoredUtcInstant(value).kind, accepted ? 'instant' : 'invalid', value)
  }
  const year99 = readStoredUtcInstant('0099-12-31T23:59:59Z')
  const year100 = readStoredUtcInstant('0100-01-01T00:00:00Z')
  assert.equal(year99.kind, 'instant')
  assert.equal(year100.kind, 'instant')
  if (year99.kind === 'instant' && year100.kind === 'instant') {
    assert.equal(year99.ms < year100.ms, true)
    const nowMs = year99.ms
    assert.equal(classifySaleWindow('0099-12-31T23:59:59Z', '0100-01-01T00:00:00Z', nowMs), 'during')
    assert.equal(classifySaleWindow('0099-12-31T23:59:59Z', '0100-01-01T00:00:00Z', year100.ms), 'after')
    assert.equal(classifySaleWindow('0100-01-01T00:00:00Z', '0100-01-02T00:00:00Z', year100.ms), 'during')
    assert.equal(classifySaleWindow('0099-01-01T00:00:00Z', '0099-12-31T23:59:59Z', nowMs), 'after')
  }
  assert.equal(classifySaleWindow('0099-02-29T00:00:00Z', '0100-01-01T00:00:00Z', 0), 'invalid')
  assert.equal(classifySaleWindow('0001-01-02T00:00:00Z', '0001-01-01T00:00:00Z', 0), 'invalid')
  assert.equal(classifySaleWindow(null, null, year99.kind === 'instant' ? year99.ms : 0), 'during')
  assert.throws(() => classifySaleWindow(null, null, Number.POSITIVE_INFINITY), /finite timestamp/)
  assert.throws(() => classifySaleWindow(null, null, Number.NaN), /finite timestamp/)

  for (const [startsAt, endsAt] of [
    [NOW_TEXT, NOW_TEXT],
    ['2026-11-09T13:00:00Z', '2026-11-09T12:00:00Z'],
  ] as const) {
    const kind = classifyDiscountVisibility(
      { subject: '件名', content: '本文', startsAt, endsAt, shop: shopRow },
      NOW_MS,
    )
    assert.equal(kind, 'invalid-stored', `${startsAt} .. ${endsAt}`)
    assert.equal(toPublicDiscount(discount({ starts_at: startsAt, ends_at: endsAt })), null)
    assert.equal(isDetailDiscount(kind), false)
  }
})

test('ended discounts stay out of the list and remain available as a detail', () => {
  const shopRow = shop()
  const ended = discount({
    id: 'ended',
    starts_at: '2026-11-01T00:00:00Z',
    ends_at: NOW_TEXT,
    created_at: '2026-12-01T00:00:00Z',
  })
  const before = discount({
    id: 'before',
    starts_at: '2026-11-09T12:00:01Z',
    ends_at: '2026-11-09T13:00:00Z',
  })
  const during = discount({ id: 'during' })
  const page = listPublicDiscounts([ended, before, during], [shopRow], { limit: 20, offset: 0 }, NOW)
  assert.deepEqual(
    page.items.map((item) => item.id),
    ['during'],
  )
  assert.equal(page.total, 1)

  const endedDetail = decideDiscountDetail(ended, [shopRow], NOW)
  assert.equal(endedDetail.status, 'ok')
  if (endedDetail.status === 'ok') {
    assert.equal(endedDetail.body.endsAt, NOW_TEXT)
    assert.deepEqual(Object.keys(endedDetail.body), ['id', 'shopId', 'subject', 'content', 'startsAt', 'endsAt'])
    assert.equal(JSON.stringify(endedDetail.body).includes('createdAt'), false)
    assert.equal(JSON.stringify(endedDetail.body).includes('updatedAt'), false)
  }
  assert.equal(decideDiscountDetail(before, [shopRow], NOW).status, 'not_found')
})

test('like patterns normalize text and escape like metacharacters', () => {
  assert.equal(LIKE_ESCAPE.length, 1)
  const japanese = toContainsLikePattern('紙屋町')
  assert.deepEqual(japanese, { kind: 'contains', pattern: '%紙屋町%', escape: LIKE_ESCAPE })

  const folded = toContainsLikePattern(' Ａ ')
  assert.deepEqual(folded, { kind: 'contains', pattern: '%a%', escape: LIKE_ESCAPE })
  const katakana = toContainsLikePattern('ｶﾞ')
  assert.deepEqual(katakana, { kind: 'contains', pattern: '%ガ%', escape: LIKE_ESCAPE })

  const cased = toContainsLikePattern('Kamiya')
  assert.deepEqual(cased, { kind: 'contains', pattern: '%kamiya%', escape: LIKE_ESCAPE })
  const trimmed = toContainsLikePattern('  紙屋町  ')
  assert.deepEqual(trimmed, { kind: 'contains', pattern: '%紙屋町%', escape: LIKE_ESCAPE })

  assert.deepEqual(toContainsLikePattern(''), { kind: 'none' })
  assert.deepEqual(toContainsLikePattern('   '), { kind: 'none' })
  assert.deepEqual(toContainsLikePattern('　'), { kind: 'none' })

  for (const query of ['%', '_', '\\', 'a%_b\\c', '100%', '紙屋町']) {
    const built = toContainsLikePattern(query)
    assert.equal(built.kind, 'contains', query)
    if (built.kind === 'contains') {
      assert.equal(built.escape, LIKE_ESCAPE)
      assertLiteralContains(built.pattern, query)
    }
  }

  assert.equal(shopMatchesSearch('Kamiya Shop', '広島市', 'KAMIYA'), true)
  assert.equal(shopMatchesSearch('ガ', '広島市', 'ｶﾞ'), true)
  assert.equal(shopMatchesSearch('架空商店', '  紙屋町一丁目  ', '  紙屋町  '), true)
  assert.equal(shopMatchesSearch('架空商店', '広島市', '   '), true)
  assert.equal(shopMatchesSearch('架空商店', '広島市', null), true)
  assert.equal(shopMatchesSearch('1000', '広島市', '%'), false)
  assert.equal(shopMatchesSearch('100%', '広島市', '%'), true)
  assert.equal(shopMatchesSearch('ab', '広島市', '_'), false)
  assert.equal(shopMatchesSearch('a_b', '広島市', '_'), true)
  assert.equal(shopMatchesSearch('a\\b', '広島市', '\\'), true)
  assert.equal(shopMatchesSearch('ab', '広島市', '\\'), false)
})

test('paging reports the filtered total and does not page before visibility or search', () => {
  const none = listPublicShops([], { q: null, limit: 20, offset: 0 })
  assert.deepEqual(none, { items: [], total: 0, limit: 20, offset: 0 })

  const one = listPublicShops([shop({ id: 'only' })], { q: null, limit: 20, offset: 0 })
  assert.equal(one.total, 1)
  assert.equal(one.items.length, 1)

  const twenty = Array.from({ length: 20 }, (_, index) =>
    shop({ id: `s${String(index).padStart(2, '0')}`, created_at: isoFromIndex(index) }),
  )
  const page20 = listPublicShops(twenty, { q: null, limit: 20, offset: 0 })
  assert.equal(page20.total, 20)
  assert.equal(page20.items.length, 20)

  const twentyOne = [
    ...twenty,
    shop({ id: 's20', created_at: isoFromIndex(20) }),
  ]
  const first = listPublicShops(twentyOne, { q: null, limit: 20, offset: 0 })
  assert.equal(first.total, 21)
  assert.equal(first.items.length, 20)
  assert.equal(first.items[0]?.id, 's20')
  const limited = listPublicShops(twentyOne, { q: null, limit: 1, offset: 0 })
  assert.deepEqual(
    limited.items.map((item) => item.id),
    ['s20'],
  )
  assert.equal(limited.total, 21)
  const maxLimit = listPublicShops(twentyOne, { q: null, limit: 100, offset: 0 })
  assert.equal(maxLimit.items.length, 21)
  assert.equal(maxLimit.total, 21)
  assert.equal(maxLimit.limit, 100)
  const tail = listPublicShops(twentyOne, { q: null, limit: 20, offset: 20 })
  assert.equal(tail.total, 21)
  assert.deepEqual(
    tail.items.map((item) => item.id),
    ['s00'],
  )
  const past = listPublicShops(twentyOne, { q: null, limit: 20, offset: 21 })
  assert.deepEqual(past.items, [])
  assert.equal(past.total, 21)
  assert.equal(past.offset, 21)

  const hundred = Array.from({ length: 100 }, (_, index) =>
    shop({ id: `h${String(index).padStart(3, '0')}`, created_at: isoFromIndex(index) }),
  )
  const all = listPublicShops(hundred, { q: null, limit: 100, offset: 0 })
  assert.equal(all.total, 100)
  assert.equal(all.items.length, 100)
})

test('equal created_at values sort by id ascending after newer rows', () => {
  const rows = [
    shop({ id: 'b', created_at: '2026-06-01T00:00:00Z' }),
    shop({ id: 'z', created_at: '2026-07-01T00:00:00Z' }),
    shop({ id: 'a', created_at: '2026-06-01T00:00:00Z' }),
    shop({ id: 'c', created_at: '2026-06-01T00:00:00Z' }),
  ]
  const page = listPublicShops(rows, { q: null, limit: 20, offset: 0 })
  assert.deepEqual(
    page.items.map((item) => item.id),
    ['z', 'a', 'b', 'c'],
  )
})

test('private rows and search misses are removed before total and paging', () => {
  const matching = Array.from({ length: 21 }, (_, index) =>
    shop({
      id: `pub${String(index).padStart(2, '0')}`,
      name: '紙屋町店',
      created_at: isoFromIndex(index),
    }),
  )
  const hidden = Array.from({ length: 5 }, (_, index) =>
    shop({
      id: `hid${index}`,
      name: '紙屋町店',
      latitude: null,
      longitude: null,
      created_at: isoFromIndex(100 + index),
    }),
  )
  const other = Array.from({ length: 5 }, (_, index) =>
    shop({
      id: `oth${index}`,
      name: '別の店',
      address: '呉市',
      created_at: isoFromIndex(200 + index),
    }),
  )
  const page = listPublicShops([...hidden, ...other, ...matching], {
    q: '紙屋町',
    limit: 20,
    offset: 0,
  })
  assert.equal(page.total, 21)
  assert.equal(page.items.length, 20)
  assert.equal(
    page.items.every((item) => item.id.startsWith('pub')),
    true,
  )
  assert.equal(page.items[0]?.id, 'pub20')
  const total: number = page.total
  const itemCount: number = page.items.length
  assert.equal(total > itemCount, true)

  const unsearched = listPublicShops([...hidden, ...matching], { q: '   ', limit: 20, offset: 0 })
  assert.equal(unsearched.total, 21)
  assert.equal(
    unsearched.items.some((item) => item.id.startsWith('hid')),
    false,
  )
})

test('discount lists page after the sale window and keep one now for the request', () => {
  const shopRow = shop()
  const during = Array.from({ length: 21 }, (_, index) =>
    discount({
      id: `d${String(index).padStart(2, '0')}`,
      created_at: isoFromIndex(index),
    }),
  )
  const excluded = [
    discount({ id: 'ended', ends_at: NOW_TEXT, created_at: isoFromIndex(300) }),
    discount({ id: 'before', starts_at: '2026-11-09T12:00:01Z', ends_at: '2026-11-10T00:00:00Z', created_at: isoFromIndex(301) }),
    discount({ id: 'blank', subject: '　', content: '  ', created_at: isoFromIndex(302) }),
    discount({
      id: 'hidden-shop',
      shop_id: 'hidden',
      created_at: isoFromIndex(303),
    }),
  ]
  const page = listPublicDiscounts(
    [...excluded, ...during],
    [shopRow, shop({ id: 'hidden', latitude: null, longitude: 0 })],
    { limit: 20, offset: 0 },
    NOW,
  )
  assert.equal(page.total, 21)
  assert.equal(page.items.length, 20)
  assert.equal(
    page.items.every((item) => item.id.startsWith('d')),
    true,
  )
  assert.equal(JSON.stringify(page).includes('createdAt'), false)

  class ShiftingDate extends Date {
    calls = 0
    override getTime(): number {
      const ms = super.getTime() + this.calls * 1000
      this.calls += 1
      return ms
    }
  }
  const clock = new ShiftingDate(NOW_MS)
  const open = discount({
    id: 'open',
    starts_at: NOW_TEXT,
    ends_at: '2026-11-09T12:00:01Z',
    created_at: '2026-11-09T00:00:00Z',
  })
  const next = discount({
    id: 'next',
    starts_at: '2026-11-09T12:00:01Z',
    ends_at: '2026-11-09T12:00:02Z',
    created_at: '2026-11-09T00:00:01Z',
  })
  const shifted = listPublicDiscounts([open, next], [shopRow], { limit: 20, offset: 0 }, clock)
  assert.equal(clock.calls, 1)
  assert.deepEqual(
    shifted.items.map((item) => item.id),
    ['open'],
  )
  assert.equal(shifted.total, 1)
})

test('a shop discount list is not_found for an unpublished shop and empty when nothing is on sale', () => {
  const visible = shop({ id: 'visible' })
  const hidden = shop({ id: 'hidden', latitude: null, longitude: null })
  const ended = discount({ id: 'ended', shop_id: 'visible', ends_at: NOW_TEXT })
  const other = discount({ id: 'other', shop_id: 'visible', subject: '別店', content: '販売中' })
  const hiddenDuring = discount({ id: 'hidden-during', shop_id: 'hidden' })
  assert.equal(
    pageShopDiscounts([hiddenDuring], [hidden], 'hidden', { limit: 20, offset: 0 }, NOW).status,
    'not_found',
  )
  const empty = pageShopDiscounts([ended, other], [visible], 'missing', { limit: 20, offset: 0 }, NOW)
  assert.equal(empty.status, 'not_found')
  const noSale = pageShopDiscounts([ended], [visible], 'visible', { limit: 20, offset: 0 }, NOW)
  assert.deepEqual(noSale, { status: 'ok', page: { items: [], total: 0, limit: 20, offset: 0 } })
  const listed = pageShopDiscounts([ended, other, hiddenDuring], [visible, hidden], 'visible', { limit: 20, offset: 0 }, NOW)
  assert.equal(listed.status, 'ok')
  if (listed.status === 'ok') {
    assert.deepEqual(
      listed.page.items.map((item) => item.id),
      ['other'],
    )
    assert.equal(listed.page.total, 1)
  }
})

test('pure list results do not replace the provisional internal_error response', async () => {
  const response = respondToReadApi(new Request('http://127.0.0.1/api/v1/shops?q=%E7%B4%99%E5%B1%8B%E7%94%BA'))
  assert.ok(response)
  assert.equal(response.status, 500)
  const body = await response.text()
  assert.equal(body.includes('"items"'), false)
  assert.equal(body.includes('internal_error'), true)

  const page = listPublicShops([shop({ name: '紙屋町店' })], { q: '紙屋町', limit: 20, offset: 0 })
  assert.equal(page.total, 1)
  assert.equal(page.items[0]?.name, '紙屋町店')
})

test('read API modules do not query D1 or read the current time themselves', () => {
  const dir = new URL('../src/readApi/', import.meta.url)
  const files = readdirSync(dir).filter((name) => name.endsWith('.ts'))
  assert.equal(files.length >= 6, true)
  for (const name of files) {
    const source = readFileSync(new URL(name, dir), 'utf8')
    assert.equal(/\bSELECT\b|\.prepare\(/.test(source), false, name)
    assert.equal(/\bDate\.now\(/.test(source), false, name)
    assert.equal(/new Date\(\)/.test(source), false, name)
  }
})
