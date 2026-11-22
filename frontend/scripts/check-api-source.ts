import assert from 'node:assert/strict'
import test from 'node:test'
import { runWithEnvLock } from './lib/env-lock.ts'
import { classifyDiscountForNormalList, getDiscountOrigin, getDiscounts } from '../src/api/discounts.ts'
import { mockDiscounts } from '../src/api/mockDiscounts.ts'
import { mockShops } from '../src/api/mockShops.ts'
import { getShopOrigin, getShops } from '../src/api/shops.ts'
import type { Discount } from '../src/types/discount.ts'
import {
  ApiHttpError,
  ApiJsonError,
  ApiNetworkError,
  ApiResponseShapeError,
  DataSourceConfigError,
  DISCOUNT_LIST_PATH,
  SHOP_LIST_PATH,
} from '../src/api/workersApi.ts'

const fixedNow = new Date('2026-11-05T03:00:00Z')

test('list paths use the read API', () => {
  assert.equal(SHOP_LIST_PATH, '/api/v1/shops')
  assert.equal(DISCOUNT_LIST_PATH, '/api/v1/discounts')
})

test('mock mode returns five shops and does not mutate the source', async () => {
  const snapshot = mockShops.map((shop) => ({ ...shop }))
  const shops = await withEnv({ source: 'mock' }, () => getShops())
  assert.equal(shops.length, 5)
  assert.equal(new Set(shops.map((shop) => shop.id)).size, 5)
  assert.equal(getShopOrigin(shops[0]!), 'mock')
  assert.equal('isMock' in shops[0]!, false)
  assert.equal(getShopOrigin(mockShops[0]!), undefined)

  shops[0]!.name = '変更'
  shops.pop()

  assert.deepEqual(
    mockShops.map((shop) => ({ ...shop })),
    snapshot,
  )
  const again = await withEnv({ source: 'mock' }, () => getShops())
  assert.equal(again.length, 5)
  assert.equal(again[0]?.name, snapshot[0]?.name)
})

test('unset data source stays on mock and does not call the network', async () => {
  let called = false
  await withFetch(async () => {
    called = true
    throw new TypeError('failed')
  }, async () => {
    const shops = await withEnv({ source: undefined, base: undefined }, () => getShops())
    assert.equal(shops.length, 5)
    assert.equal(called, false)
  })
})

test('invalid data source is an error and does not call the network', async () => {
  let called = false
  await withFetch(async () => {
    called = true
    return jsonResponse({ items: [] })
  }, async () => {
    await assert.rejects(
      () => withEnv({ source: 'database', base: 'http://127.0.0.1:8787' }, () => getShops()),
      DataSourceConfigError,
    )
    assert.equal(called, false)
  })
})

test('api mode loads shops, empty lists, and failures without falling back to mock', async () => {
  const shop = {
    id: 'shop_example_01',
    name: '架空商店 紙屋町',
    address: '広島県広島市中区紙屋町1丁目（架空）',
    latitude: 34.3955,
    longitude: 132.4553,
    createdAt: '2026-10-26T06:00:00Z',
    updatedAt: '2026-10-26T06:00:00Z',
  }

  await withFetch(async (input) => {
    assert.equal(requestUrl(input), 'http://127.0.0.1:8787/api/v1/shops')
    return jsonResponse({ items: [shop], limit: 20, offset: 0, total: 1 })
  }, async () => {
    const shops = await withEnv(apiEnv, () => getShops())
    assert.deepEqual(shops, [
      {
        id: shop.id,
        name: shop.name,
        address: shop.address,
        latitude: shop.latitude,
        longitude: shop.longitude,
      },
    ])
    assert.equal(getShopOrigin(shops[0]!), 'api')
    assert.equal('createdAt' in shops[0]!, false)
  })

  await withFetch(async () => jsonResponse({ items: [], limit: 20, offset: 0, total: 0 }), async () => {
    const shops = await withEnv(apiEnv, () => getShops())
    assert.deepEqual(shops, [])
  })

  await withFetch(async () => new Response('nope', { status: 503 }), async () => {
    await assert.rejects(() => withEnv(apiEnv, () => getShops()), (error: unknown) => {
      assert.ok(error instanceof ApiHttpError)
      assert.equal(error.status, 503)
      return true
    })
  })

  await withFetch(async () => {
    throw new TypeError('Failed to fetch')
  }, async () => {
    await assert.rejects(() => withEnv(apiEnv, () => getShops()), ApiNetworkError)
  })

  await withFetch(async () => new Response('not-json', { status: 200 }), async () => {
    await assert.rejects(() => withEnv(apiEnv, () => getShops()), ApiJsonError)
  })

  await withFetch(async () => jsonResponse([{ id: 'bare-array' }]), async () => {
    await assert.rejects(() => withEnv(apiEnv, () => getShops()), ApiResponseShapeError)
  })

  await withFetch(async () => jsonResponse({ items: [{ id: 'missing-fields' }] }), async () => {
    await assert.rejects(() => withEnv(apiEnv, () => getShops()), ApiResponseShapeError)
  })

  await withFetch(async () => {
    throw new TypeError('offline')
  }, async () => {
    await assert.rejects(() => withEnv({ source: 'api', base: undefined }, () => getShops()), DataSourceConfigError)
  })

  await withFetch((_input, init) => {
    const signal = init?.signal
    assert.ok(signal)
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(signal.reason)
      })
    })
  }, async () => {
    const realTimeout = AbortSignal.timeout
    AbortSignal.timeout = ((milliseconds: number) => {
      assert.equal(milliseconds, 10_000)
      const controller = new AbortController()
      setTimeout(() => {
        controller.abort(new DOMException('timeout', 'TimeoutError'))
      }, 0)
      return controller.signal
    }) as typeof AbortSignal.timeout
    try {
      await assert.rejects(() => withEnv(apiEnv, () => getShops()), ApiNetworkError)
    } finally {
      AbortSignal.timeout = realTimeout
    }
  })
})

test('mock discounts keep ended rows and can be matched to shops', async () => {
  const snapshot = mockDiscounts.map((discount) => ({ ...discount }))
  const discounts = await withEnv({ source: 'mock' }, () => getDiscounts())
  assert.equal(discounts.length, mockDiscounts.length)
  assert.equal(getDiscountOrigin(discounts[0]!), 'mock')
  assert.ok(discounts.some((discount) => discount.endsAt === null))
  assert.ok(discounts.some((discount) => discount.id === 'dev-discount-04'))

  const shopIds = new Set(mockShops.map((shop) => shop.id))
  for (const discount of discounts) {
    assert.ok(shopIds.has(discount.shopId))
    assert.equal('isMock' in discount, false)
  }

  const byId = new Map(discounts.map((discount) => [discount.id, discount]))
  assert.deepEqual(classifyDiscountForNormalList(byId.get('dev-discount-01')!, fixedNow), {
    kind: 'include',
  })
  assert.deepEqual(classifyDiscountForNormalList(byId.get('dev-discount-02')!, fixedNow), {
    kind: 'include',
  })
  assert.deepEqual(classifyDiscountForNormalList(byId.get('dev-discount-03')!, fixedNow), {
    kind: 'exclude',
    reason: 'not-started',
  })
  assert.deepEqual(classifyDiscountForNormalList(byId.get('dev-discount-04')!, fixedNow), {
    kind: 'exclude',
    reason: 'ended',
  })
  assert.deepEqual(classifyDiscountForNormalList(byId.get('dev-discount-05')!, fixedNow), {
    kind: 'undecided',
    reason: 'starts-at-null',
  })

  discounts[0]!.content = '変更'
  discounts.pop()
  assert.deepEqual(
    mockDiscounts.map((discount) => ({ ...discount })),
    snapshot,
  )
})

test('discount period leaves the undecided boundary undecided', () => {
  const atEnd = discountAt({
    startsAt: '2026-11-01T00:00:00Z',
    endsAt: '2026-11-05T03:00:00Z',
  })
  assert.deepEqual(classifyDiscountForNormalList(atEnd, fixedNow), {
    kind: 'undecided',
    reason: 'ends-at-boundary',
  })

  const startedNow = discountAt({
    startsAt: '2026-11-05T03:00:00Z',
    endsAt: null,
  })
  assert.deepEqual(classifyDiscountForNormalList(startedNow, fixedNow), { kind: 'include' })

  const noZone = discountAt({
    startsAt: '2026-11-01T00:00:00',
    endsAt: null,
  })
  assert.deepEqual(classifyDiscountForNormalList(noZone, fixedNow), {
    kind: 'undecided',
    reason: 'invalid-datetime',
  })

  const endedWithoutStart = discountAt({
    startsAt: null,
    endsAt: '2026-02-01T00:00:00Z',
  })
  assert.deepEqual(classifyDiscountForNormalList(endedWithoutStart, fixedNow), {
    kind: 'exclude',
    reason: 'ended',
  })
})

test('nonexistent calendar dates stay undecided', () => {
  const absentDay = discountAt({
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-02-30T00:00:00Z',
  })
  assert.deepEqual(classifyDiscountForNormalList(absentDay, fixedNow), {
    kind: 'undecided',
    reason: 'invalid-datetime',
  })

  const absentStart = discountAt({
    startsAt: '2025-02-29T00:00:00+09:00',
    endsAt: null,
  })
  assert.deepEqual(classifyDiscountForNormalList(absentStart, fixedNow), {
    kind: 'undecided',
    reason: 'invalid-datetime',
  })

  const april31 = discountAt({
    startsAt: '2026-04-31T00:00:00Z',
    endsAt: null,
  })
  assert.deepEqual(classifyDiscountForNormalList(april31, fixedNow), {
    kind: 'undecided',
    reason: 'invalid-datetime',
  })

  const leapDay = discountAt({
    startsAt: '2024-02-29T00:00:00Z',
    endsAt: '2024-03-01T00:00:00Z',
  })
  assert.deepEqual(
    classifyDiscountForNormalList(leapDay, new Date('2024-02-29T12:00:00Z')),
    { kind: 'include' },
  )

  const monthEnd = discountAt({
    startsAt: '2026-01-31T15:00:00+09:00',
    endsAt: null,
  })
  assert.deepEqual(
    classifyDiscountForNormalList(monthEnd, new Date('2026-01-31T06:00:00Z')),
    { kind: 'include' },
  )
})

test('api mode loads discounts and reports http and shape failures', async () => {
  const discount = discountAt({
    startsAt: '2026-10-26T15:00:00Z',
    endsAt: '2026-10-27T06:00:00Z',
  })

  await withFetch(async (input) => {
    assert.equal(requestUrl(input), 'http://127.0.0.1:8787/api/v1/discounts')
    return jsonResponse({ items: [discount], limit: 20, offset: 0, total: 1 })
  }, async () => {
    const discounts = await withEnv(apiEnv, () => getDiscounts())
    assert.deepEqual(discounts, [discount])
    assert.equal(getDiscountOrigin(discounts[0]!), 'api')
    assert.equal(discounts[0]?.shopId, 'dev-shop-01')
  })

  await withFetch(async () => new Response('missing', { status: 404 }), async () => {
    await assert.rejects(() => withEnv(apiEnv, () => getDiscounts()), (error: unknown) => {
      assert.ok(error instanceof ApiHttpError)
      assert.equal(error.status, 404)
      return true
    })
  })

  await withFetch(async () => {
    throw new TypeError('Failed to fetch')
  }, async () => {
    await assert.rejects(() => withEnv(apiEnv, () => getDiscounts()), ApiNetworkError)
  })

  await withFetch(async () => {
    return jsonResponse({
      items: [
        {
          id: discount.id,
          shopId: discount.shopId,
          subject: discount.subject,
          content: discount.content,
          startsAt: discount.startsAt,
          createdAt: discount.createdAt,
          updatedAt: discount.updatedAt,
        },
      ],
    })
  }, async () => {
    await assert.rejects(() => withEnv(apiEnv, () => getDiscounts()), ApiResponseShapeError)
  })

  await withFetch(async () => {
    return jsonResponse({
      items: [
        {
          id: discount.id,
          shopId: discount.shopId,
          subject: null,
          content: '本文のみ',
          startsAt: null,
          endsAt: null,
        },
      ],
    })
  }, async () => {
    const discounts = await withEnv(apiEnv, () => getDiscounts())
    assert.equal(discounts[0]?.subject, null)
    assert.equal(discounts[0]?.content, '本文のみ')
    assert.equal('createdAt' in discounts[0]!, false)
    assert.equal('updatedAt' in discounts[0]!, false)
  })
})

const apiEnv = { source: 'api', base: 'http://127.0.0.1:8787' }

function discountAt(period: Pick<Discount, 'startsAt' | 'endsAt'>): Discount {
  return {
    id: 'dev-discount-boundary',
    shopId: 'dev-shop-01',
    subject: '架空の境界',
    content: '判定用',
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.toString()
  }
  return input.url
}

let queue: Promise<void> = Promise.resolve()

function exclusive(run: () => Promise<void>): Promise<void> {
  const next = queue.then(run, run)
  queue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

function withEnv<T>(
  env: { source: string | undefined; base?: string | undefined },
  run: () => Promise<T>,
): Promise<T> {
  return runWithEnvLock(async () => {
    const previousSource = process.env.VITE_DATA_SOURCE
    const previousBase = process.env.VITE_API_BASE_URL
    assignEnv('VITE_DATA_SOURCE', env.source)
    assignEnv('VITE_API_BASE_URL', env.base)
    try {
      return await run()
    } finally {
      assignEnv('VITE_DATA_SOURCE', previousSource)
      assignEnv('VITE_API_BASE_URL', previousBase)
    }
  })
}

test('withEnv keeps values until the promise settles and restores them', async () => {
  const previousSource = process.env.VITE_DATA_SOURCE
  const previousBase = process.env.VITE_API_BASE_URL
  const seen = await Promise.all([
    withEnv({ source: 'mock', base: 'http://mock.invalid' }, async () => {
      await delay(30)
      return `${process.env.VITE_DATA_SOURCE}|${process.env.VITE_API_BASE_URL}`
    }),
    withEnv({ source: 'api', base: 'http://127.0.0.1:8787' }, async () => {
      await delay(10)
      return `${process.env.VITE_DATA_SOURCE}|${process.env.VITE_API_BASE_URL}`
    }),
  ])
  assert.deepEqual(seen.sort(), ['api|http://127.0.0.1:8787', 'mock|http://mock.invalid'])

  await assert.rejects(
    () =>
      withEnv({ source: 'api', base: 'http://127.0.0.1:8787' }, async () => {
        await Promise.resolve()
        throw new Error('boom')
      }),
    /boom/,
  )
  assert.equal(process.env.VITE_DATA_SOURCE, previousSource)
  assert.equal(process.env.VITE_API_BASE_URL, previousBase)
})

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function assignEnv(name: 'VITE_DATA_SOURCE' | 'VITE_API_BASE_URL', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}

async function withFetch(
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<void>,
): Promise<void> {
  await exclusive(async () => {
    const previous = globalThis.fetch
    globalThis.fetch = fetchImpl as typeof fetch
    try {
      await run()
    } finally {
      globalThis.fetch = previous
    }
  })
}
