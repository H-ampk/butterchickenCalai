import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { errorResponse } from '../src/readApi/errors.ts'
import { planReadApi, respondToReadApi } from '../src/readApi/handleReadApi.ts'
import { parseReadQuery } from '../src/readApi/parseQuery.ts'
import { recognizeReadRoute, type ReadRoute } from '../src/readApi/recognizeRoute.ts'
import { handleRequest, type Env } from '../src/index.ts'

const origin = 'http://127.0.0.1'

function request(path: string, method = 'GET'): Request {
  return new Request(`${origin}${path}`, { method })
}

function assertPublicError(body: string, code: string): void {
  const parsed: unknown = JSON.parse(body)
  assert.equal(typeof parsed, 'object')
  assert.notEqual(parsed, null)
  const record = parsed as { error?: { code?: string; message?: string } }
  assert.deepEqual(Object.keys(record), ['error'])
  assert.deepEqual(Object.keys(record.error ?? {}).sort(), ['code', 'message'])
  assert.equal(record.error?.code, code)
  assert.equal(typeof record.error?.message, 'string')
  assert.equal((record.error?.message ?? '').length > 0, true)
  assert.equal(body.includes('details'), false)
  assert.equal(/select|sqlite|secret|exception|stack/i.test(body), false)
}

test('recognizes the five read paths and their parameters', () => {
  const shops = recognizeReadRoute(`${origin}/api/v1/shops`)
  assert.deepEqual(shops, { kind: 'matched', route: { name: 'shops' } })

  const shop = recognizeReadRoute(`${origin}/api/v1/shops/dev-shop-01`)
  assert.deepEqual(shop, { kind: 'matched', route: { name: 'shop', shopId: 'dev-shop-01' } })

  const discounts = recognizeReadRoute(`${origin}/api/v1/discounts`)
  assert.deepEqual(discounts, { kind: 'matched', route: { name: 'discounts' } })

  const discount = recognizeReadRoute(`${origin}/api/v1/discounts/discount_example_01`)
  assert.deepEqual(discount, {
    kind: 'matched',
    route: { name: 'discount', discountId: 'discount_example_01' },
  })

  const nested = recognizeReadRoute(`${origin}/api/v1/shops/shop_example_01/discounts`)
  assert.deepEqual(nested, {
    kind: 'matched',
    route: { name: 'shop-discounts', shopId: 'shop_example_01' },
  })
})

test('does not require shop or discount ids to be UUIDs', () => {
  const shop = recognizeReadRoute(`${origin}/api/v1/shops/${encodeURIComponent('店 01')}`)
  assert.equal(shop.kind, 'matched')
  if (shop.kind === 'matched' && shop.route.name === 'shop') {
    assert.equal(shop.route.shopId, '店 01')
  } else {
    assert.fail('shop id was not decoded')
  }
})

test('rejects paths that are not the five read routes', () => {
  assert.equal(recognizeReadRoute(`${origin}/api/v1`).kind, 'unmatched')
  assert.equal(recognizeReadRoute(`${origin}/api/v1/shop`).kind, 'unmatched')
  assert.equal(recognizeReadRoute(`${origin}/api/v1/shops/`).kind, 'unmatched')
  assert.equal(recognizeReadRoute(`${origin}/api/v1/shops/a/b`).kind, 'unmatched')
  assert.equal(recognizeReadRoute(`${origin}/api/v1/discounts/a/extra`).kind, 'unmatched')
  assert.equal(recognizeReadRoute(`${origin}/api/v1/Shops`).kind, 'unmatched')
  assert.equal(recognizeReadRoute(`${origin}/shops`).kind, 'outside')
  assert.equal(recognizeReadRoute(`${origin}/api/v2/shops`).kind, 'outside')
  assert.equal(recognizeReadRoute(`${origin}/__health`).kind, 'outside')
})

test('treats a shop id of discounts as a shop detail path', () => {
  assert.deepEqual(recognizeReadRoute(`${origin}/api/v1/shops/discounts`), {
    kind: 'matched',
    route: { name: 'shop', shopId: 'discounts' },
  })
})

test('invalid path encoding is not a missing resource', () => {
  assert.equal(recognizeReadRoute(`${origin}/api/v1/shops/%ZZ`).kind, 'invalid_encoding')
})

test('unsupported methods on the five paths are method_not_allowed', () => {
  const paths = [
    '/api/v1/shops',
    '/api/v1/shops/dev-shop-01',
    '/api/v1/discounts',
    '/api/v1/discounts/discount_example_01',
    '/api/v1/shops/dev-shop-01/discounts',
  ]
  for (const path of paths) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
      const plan = planReadApi(request(path, method))
      assert.equal(plan.type, 'method_not_allowed', `${method} ${path}`)
    }
  }
})

test('method_not_allowed uses the public error JSON', async () => {
  const response = await respondToReadApi(request('/api/v1/shops', 'POST'))
  assert.ok(response)
  assert.equal(response?.status, 405)
  assert.equal(response?.headers.get('allow'), 'GET')
  assertPublicError(await response.text(), 'method_not_allowed')
})

test('unmatched API paths are not_found and do not fall through', async () => {
  const response = await respondToReadApi(request('/api/v1/unknown'))
  assert.ok(response)
  assert.equal(response?.status, 404)
  assertPublicError(await response.text(), 'not_found')
})

test('paths outside /api/v1 are left to static assets', async () => {
  assert.equal(await respondToReadApi(request('/shops')), null)
  assert.equal(await respondToReadApi(request('/discounts')), null)
})

test('list queries use the specified limit and offset defaults and bounds', () => {
  const route: ReadRoute = { name: 'shops' }
  const absent = parseReadQuery(`${origin}/api/v1/shops`, route)
  assert.deepEqual(absent, { ok: true, query: { scope: 'list', limit: 20, offset: 0, q: null } })

  const upper = parseReadQuery(`${origin}/api/v1/shops?limit=100&offset=0`, route)
  assert.deepEqual(upper, { ok: true, query: { scope: 'list', limit: 100, offset: 0, q: null } })

  const offsetOnly = parseReadQuery(`${origin}/api/v1/shops?offset=5`, route)
  assert.deepEqual(offsetOnly, { ok: true, query: { scope: 'list', limit: 20, offset: 5, q: null } })

  for (const raw of ['0', '101', '-1', '1.5', '01', '', 'true', '+20', ' 20']) {
    const parsed = parseReadQuery(`${origin}/api/v1/shops?limit=${encodeURIComponent(raw)}`, route)
    assert.deepEqual(parsed, { ok: false, reason: 'invalid_request', field: 'limit' }, raw)
  }

  for (const raw of ['-1', '1.0', '00', '+0']) {
    const parsed = parseReadQuery(`${origin}/api/v1/shops?offset=${encodeURIComponent(raw)}`, route)
    assert.deepEqual(parsed, { ok: false, reason: 'invalid_request', field: 'offset' }, raw)
  }
})

test('offset above the safe integer range is not silently rounded', () => {
  const parsed = parseReadQuery(`${origin}/api/v1/shops?offset=9007199254740993`, { name: 'shops' })
  assert.equal(parsed.ok, false)
})

test('shop list reads q and normalizes it', () => {
  const route: ReadRoute = { name: 'shops' }
  const query = parseReadQuery(`${origin}/api/v1/shops?q=${encodeURIComponent('紙屋町')}`, route)
  assert.deepEqual(query, { ok: true, query: { scope: 'list', limit: 20, offset: 0, q: '紙屋町' } })

  const folded = parseReadQuery(`${origin}/api/v1/shops?q=${encodeURIComponent(' Ａ ')}`, route)
  assert.deepEqual(folded, { ok: true, query: { scope: 'list', limit: 20, offset: 0, q: 'a' } })

  const blank = parseReadQuery(`${origin}/api/v1/shops?q=${encodeURIComponent('   ')}`, route)
  assert.deepEqual(blank, { ok: true, query: { scope: 'list', limit: 20, offset: 0, q: null } })

  const max = parseReadQuery(`${origin}/api/v1/shops?q=${'a'.repeat(200)}`, route)
  assert.equal(max.ok, true)

  const tooLong = parseReadQuery(`${origin}/api/v1/shops?q=${'a'.repeat(201)}`, route)
  assert.deepEqual(tooLong, { ok: false, reason: 'invalid_request', field: 'q' })
})

test('duplicate q and unknown query parameters are invalid_request', async () => {
  assert.equal(parseReadQuery(`${origin}/api/v1/shops?q=a&q=b`, { name: 'shops' }).ok, false)
  const duplicateQ = parseReadQuery(`${origin}/api/v1/shops?q=a&q=b`, { name: 'shops' })
  assert.deepEqual(duplicateQ, { ok: false, reason: 'invalid_request', field: 'q' })
  const sameQ = parseReadQuery(`${origin}/api/v1/shops?q=a&q=a`, { name: 'shops' })
  assert.deepEqual(sameQ, { ok: false, reason: 'invalid_request', field: 'q' })
  const duplicateResponse = await respondToReadApi(request('/api/v1/shops?q=a&q=b'))
  assert.equal(duplicateResponse?.status, 400)
  assertPublicError(await duplicateResponse!.text(), 'invalid_request')

  assert.deepEqual(parseReadQuery(`${origin}/api/v1/shops?cursor=1`, { name: 'shops' }), {
    ok: false,
    reason: 'invalid_request',
    field: 'unknown',
  })
  assert.deepEqual(parseReadQuery(`${origin}/api/v1/discounts?q=a`, { name: 'discounts' }), {
    ok: false,
    reason: 'invalid_request',
    field: 'unknown',
  })
  assert.deepEqual(parseReadQuery(`${origin}/api/v1/discounts?shopId=dev-shop-01`, { name: 'discounts' }), {
    ok: false,
    reason: 'invalid_request',
    field: 'unknown',
  })
  assert.deepEqual(parseReadQuery(`${origin}/api/v1/discounts?includeEnded=1`, { name: 'discounts' }), {
    ok: false,
    reason: 'invalid_request',
    field: 'unknown',
  })
  assert.deepEqual(
    parseReadQuery(`${origin}/api/v1/shops/dev-shop-01/discounts?q=a`, {
      name: 'shop-discounts',
      shopId: 'dev-shop-01',
    }),
    { ok: false, reason: 'invalid_request', field: 'unknown' },
  )
  assert.deepEqual(parseReadQuery(`${origin}/api/v1/shops/dev-shop-01?limit=20`, {
    name: 'shop',
    shopId: 'dev-shop-01',
  }), { ok: false, reason: 'invalid_request', field: 'unknown' })
})

test('duplicate limit or offset is invalid_request even when the values match', async () => {
  const shops: ReadRoute = { name: 'shops' }
  const duplicates: Array<[string, 'limit' | 'offset']> = [
    ['/api/v1/shops?limit=20&limit=50', 'limit'],
    ['/api/v1/shops?limit=20&limit=20', 'limit'],
    ['/api/v1/shops?offset=0&offset=10', 'offset'],
    ['/api/v1/shops?offset=0&offset=0', 'offset'],
    ['/api/v1/discounts?limit=20&limit=20', 'limit'],
    ['/api/v1/shops/dev-shop-01/discounts?offset=0&offset=0', 'offset'],
  ]
  for (const [path, field] of duplicates) {
    const route = recognizeReadRoute(`${origin}${path}`)
    assert.equal(route.kind, 'matched', path)
    if (route.kind !== 'matched') {
      continue
    }
    assert.deepEqual(parseReadQuery(`${origin}${path}`, route.route), {
      ok: false,
      reason: 'invalid_request',
      field,
    }, path)
    const plan = planReadApi(request(path))
    assert.equal(plan.type, 'invalid_request', path)
    const response = await respondToReadApi(request(path))
    assert.equal(response?.status, 400, path)
    assertPublicError(await response!.text(), 'invalid_request')
  }

  assert.deepEqual(parseReadQuery(`${origin}/api/v1/shops?limit=20`, shops), {
    ok: true,
    query: { scope: 'list', limit: 20, offset: 0, q: null },
  })
  assert.deepEqual(parseReadQuery(`${origin}/api/v1/shops?offset=0`, shops), {
    ok: true,
    query: { scope: 'list', limit: 20, offset: 0, q: null },
  })
})

test('invalid percent-encoding and invalid UTF-8 in the query are invalid_request', async () => {
  const route: ReadRoute = { name: 'shops' }
  for (const raw of ['q=%ZZ', 'q=%', 'q=%FF', 'q=%80', 'q=%C3%28', 'q=%E7%B4']) {
    assert.deepEqual(parseReadQuery(`${origin}/api/v1/shops?${raw}`, route), {
      ok: false,
      reason: 'invalid_request',
      field: 'encoding',
    }, raw)
    const response = await respondToReadApi(request(`/api/v1/shops?${raw}`))
    assert.equal(response?.status, 400, raw)
    const body = await response!.text()
    assertPublicError(body, 'invalid_request')
    assert.equal(body.includes('\uFFFD'), false, raw)
  }

  const literal = parseReadQuery(`${origin}/api/v1/shops?q=${encodeURIComponent('紙屋町')}`, route)
  assert.deepEqual(literal, { ok: true, query: { scope: 'list', limit: 20, offset: 0, q: '紙屋町' } })

  const encoded = parseReadQuery(`${origin}/api/v1/shops?q=%E7%B4%99%E5%B1%8B%E7%94%BA&limit=20`, route)
  assert.deepEqual(encoded, { ok: true, query: { scope: 'list', limit: 20, offset: 0, q: '紙屋町' } })

  const ascii = parseReadQuery(`${origin}/api/v1/shops?q=Kamiya`, route)
  assert.deepEqual(ascii, { ok: true, query: { scope: 'list', limit: 20, offset: 0, q: 'kamiya' } })
})

test('a validated read without a database binding is internal_error', async () => {
  const plan = planReadApi(request('/api/v1/shops?q=%E7%B4%99%E5%B1%8B%E7%94%BA'))
  assert.equal(plan.type, 'ready')
  if (plan.type === 'ready' && plan.query.scope === 'list') {
    assert.equal(plan.query.q, '紙屋町')
    assert.equal(plan.query.limit, 20)
    assert.equal(plan.query.offset, 0)
  } else {
    assert.fail('shop list was not planned')
  }

  const response = await respondToReadApi(request('/api/v1/shops'))
  assert.ok(response)
  assert.equal(response?.status === 200, false)
  assert.equal(response?.status === 404, false)
  assert.equal(response?.status === 503, false)
  const body = await response.text()
  assert.equal(body.includes('"items"'), false)
  assertPublicError(body, 'internal_error')
  assert.equal(response?.status, 500)
})

test('detail parameters are available before the database read', () => {
  const shop = planReadApi(request('/api/v1/shops/dev-shop-01'))
  assert.equal(shop.type, 'ready')
  if (shop.type === 'ready') {
    assert.deepEqual(shop.route, { name: 'shop', shopId: 'dev-shop-01' })
    assert.deepEqual(shop.query, { scope: 'detail' })
  }
  const discount = planReadApi(request('/api/v1/discounts/discount_example_01'))
  if (discount.type === 'ready') {
    assert.deepEqual(discount.route, { name: 'discount', discountId: 'discount_example_01' })
  } else {
    assert.fail('discount detail was not planned')
  }
})

test('error JSON does not echo thrown internal text', async () => {
  const response = await respondToReadApi(request('/api/v1/shops'), {
    plan: () => {
      throw new Error('SELECT password FROM secrets; sqlite D1 stack')
    },
  })
  assert.ok(response)
  assert.equal(response?.status, 500)
  const body = await response.text()
  assertPublicError(body, 'internal_error')
  assert.equal(body.includes('password'), false)
  assert.equal(body.includes('secrets'), false)
  assert.equal(body.includes('D1'), false)
})

test('service_unavailable keeps the same public shape', async () => {
  const response = errorResponse('service_unavailable')
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('content-type') ?? '', /application\/json/)
  assertPublicError(await response.text(), 'service_unavailable')
})

test('routing modules do not query D1', () => {
  const files = [
    'percentEncoding.ts',
    'errors.ts',
    'recognizeRoute.ts',
    'parseQuery.ts',
    'handleReadApi.ts',
  ]
  for (const file of files) {
    const source = readFileSync(new URL(`../src/readApi/${file}`, import.meta.url), 'utf8')
    assert.equal(/\bSELECT\b|prepare\(/.test(source), false, file)
  }
  const reader = readFileSync(new URL('../src/readApi/d1Read.ts', import.meta.url), 'utf8')
  assert.equal(reader.includes('SELECT'), true)
  assert.equal(reader.includes('.bind('), true)
  assert.equal(/\$\{[^}]*q/.test(reader), false)
})

test('static assets still receive paths outside the read API', async () => {
  let seen = ''
  const env = {
    ASSETS: {
      fetch(input: RequestInfo | URL) {
        seen = input instanceof Request ? new URL(input.url).pathname : String(input)
        return Promise.resolve(new Response('home', { status: 200, headers: { 'content-type': 'text/html' } }))
      },
    },
  } as unknown as Env
  const response = await handleRequest(request('/'), env)
  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'home')
  assert.equal(seen, '/')
})

test('a read API request does not call static assets', async () => {
  let called = false
  const env = {
    ASSETS: {
      fetch() {
        called = true
        return Promise.resolve(new Response('asset'))
      },
    },
  } as unknown as Env
  const response = await handleRequest(request('/api/v1/discounts'), env)
  assert.equal(called, false)
  assert.notEqual(response.status, 200)
})

test('health stays on its own path', async () => {
  const response = await handleRequest(request('/__health'), {})
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { status: 'error', database: 'unavailable' })
})
