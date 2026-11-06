import assert from 'node:assert/strict'
import test from 'node:test'
import { handleHealth, HEALTH_CHECK_SQL, type HealthDatabase } from '../src/health.ts'

function database(row: { ok: number } | null, options?: { throwOnPrepare?: boolean }): HealthDatabase {
  return {
    prepare(query: string) {
      assert.equal(query, HEALTH_CHECK_SQL)
      return {
        async first<T>(): Promise<T | null> {
          if (options?.throwOnPrepare) {
            throw new Error('SELECT shops FROM discounts; secret detail')
          }
          return row as T | null
        },
      }
    },
  }
}

async function bodyOf(response: Response): Promise<string> {
  return response.text()
}

test('HEALTH_CHECK_SQL does not read shop or discount tables', () => {
  assert.equal(HEALTH_CHECK_SQL, 'SELECT 1 AS ok')
  assert.equal(/shop|discount/i.test(HEALTH_CHECK_SQL), false)
})

test('GET /__health reports a connected local database', async () => {
  const response = await handleHealth(new Request('http://127.0.0.1/__health'), database({ ok: 1 }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(JSON.parse(await bodyOf(response)), {
    status: 'ok',
    database: 'connected',
  })
})

test('missing D1 binding is an HTTP error and not a success', async () => {
  const response = await handleHealth(new Request('http://127.0.0.1/__health'), undefined)
  assert.equal(response.status, 503)
  const body = await bodyOf(response)
  assert.deepEqual(JSON.parse(body), { status: 'error', database: 'unavailable' })
  assert.equal(body.includes('connected'), false)
})

test('D1 failure is an HTTP error without SQL or exception text', async () => {
  const response = await handleHealth(
    new Request('http://127.0.0.1/__health'),
    database(null, { throwOnPrepare: true }),
  )
  assert.equal(response.status, 503)
  const body = await bodyOf(response)
  assert.deepEqual(JSON.parse(body), { status: 'error', database: 'unavailable' })
  assert.equal(body.includes('shops'), false)
  assert.equal(body.includes('secret'), false)
  assert.equal(body.includes('SELECT'), false)
})

test('unexpected query result is not treated as connected', async () => {
  const response = await handleHealth(new Request('http://127.0.0.1/__health'), database({ ok: 0 }))
  assert.equal(response.status, 503)
  assert.deepEqual(JSON.parse(await bodyOf(response)), {
    status: 'error',
    database: 'unavailable',
  })
})

test('null query result is not treated as connected', async () => {
  const response = await handleHealth(new Request('http://127.0.0.1/__health'), database(null))
  assert.equal(response.status, 503)
})

test('non-GET is an HTTP error', async () => {
  const response = await handleHealth(
    new Request('http://127.0.0.1/__health', { method: 'POST' }),
    database({ ok: 1 }),
  )
  assert.equal(response.status, 405)
  assert.deepEqual(JSON.parse(await bodyOf(response)), { status: 'error' })
})
