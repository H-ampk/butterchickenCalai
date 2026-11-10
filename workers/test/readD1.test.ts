import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { handleRequest } from '../src/index.ts'
import type { ReadDatabase } from '../src/readApi/d1Read.ts'
import { classifyDatabaseError } from '../src/readApi/d1Read.ts'
import { respondToReadApi } from '../src/readApi/handleReadApi.ts'

const workersDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const origin = 'http://127.0.0.1'
const SEED_NOW = new Date('2026-06-15T12:00:00Z')
const PUBLIC_SHOP = '11111111-1111-4111-8111-111111111111'
const WIDE_SHOP = '22222222-2222-4222-8222-222222222222'
const EMPTY_ADDRESS_SHOP = '33333333-3333-4333-8333-333333333333'
const NULL_COORD_SHOP = '44444444-4444-4444-8444-444444444444'
const ENDED = '55555555-5555-4555-8555-555555555505'
const BEFORE = '55555555-5555-4555-8555-555555555503'
const DURING = '55555555-5555-4555-8555-555555555504'
const BLANK = '55555555-5555-4555-8555-555555555508'

function openSeededDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(readFileSync(path.join(workersDir, 'migrations', '0001_initial.sql'), 'utf8'))
  db.exec(readFileSync(path.join(workersDir, 'seeds', 'development.sql'), 'utf8'))
  db.exec(`
    INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, created_at, updated_at)
    VALUES ('like-shop', '100%_off', 'a''b', 10, 10, '100%_off', 'a''b', '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z');
  `)
  return db
}

function asReadDatabase(db: DatabaseSync): ReadDatabase {
  return {
    prepare(sql: string) {
      const statement = db.prepare(sql)
      return {
        bind(...values: unknown[]) {
          return {
            async all<T>() {
              const results = statement.all(...(values as never[])) as T[]
              return { success: true, results }
            },
          }
        },
      }
    },
  }
}

function request(path: string, method = 'GET'): Request {
  return new Request(`${origin}${path}`, { method })
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

test('seeded reads use the fixed sale clock and hide internal columns', async () => {
  const database = asReadDatabase(openSeededDatabase())
  const shops = await respondToReadApi(request('/api/v1/shops'), { database, now: SEED_NOW })
  assert.ok(shops)
  assert.equal(shops.status, 200)
  const shopBody = await readJson(shops)
  const shopItems = shopBody.items as Array<{ id: string }>
  assert.deepEqual(
    shopItems.map((item) => item.id),
    ['like-shop', PUBLIC_SHOP, WIDE_SHOP, EMPTY_ADDRESS_SHOP],
  )
  assert.equal(shopBody.total, 4)
  assert.equal(shopBody.limit, 20)
  assert.equal(shopBody.offset, 0)
  assert.equal(JSON.stringify(shopBody).includes('name_search'), false)
  assert.equal(JSON.stringify(shopBody).includes('address_search'), false)
  assert.equal(JSON.stringify(shopBody).includes('rowid'), false)
  assert.equal(JSON.stringify(shopBody).includes('created_at'), false)

  const page = await respondToReadApi(request('/api/v1/shops?limit=1&offset=1'), { database, now: SEED_NOW })
  const pageBody = await readJson(page!)
  assert.equal((pageBody.items as Array<{ id: string }>)[0]?.id, PUBLIC_SHOP)
  assert.equal(pageBody.total, 4)
  assert.equal(pageBody.limit, 1)
  assert.equal(pageBody.offset, 1)

  const past = await respondToReadApi(request('/api/v1/shops?offset=20'), { database, now: SEED_NOW })
  const pastBody = await readJson(past!)
  assert.deepEqual(pastBody.items, [])
  assert.equal(pastBody.total, 4)
  assert.equal(past!.status, 200)

  const wide = await respondToReadApi(request(`/api/v1/shops?q=${encodeURIComponent('ＣＡＦＥ')}`), {
    database,
    now: SEED_NOW,
  })
  const wideBody = await readJson(wide!)
  assert.deepEqual(
    (wideBody.items as Array<{ id: string }>).map((item) => item.id),
    [WIDE_SHOP],
  )

  const literal = await respondToReadApi(request(`/api/v1/shops?q=${encodeURIComponent('%')}`), {
    database,
    now: SEED_NOW,
  })
  const literalBody = await readJson(literal!)
  assert.deepEqual(
    (literalBody.items as Array<{ id: string }>).map((item) => item.id),
    ['like-shop'],
  )

  const injected = await respondToReadApi(request(`/api/v1/shops?q=${encodeURIComponent("' OR 1=1 --")}`), {
    database,
    now: SEED_NOW,
  })
  const injectedBody = await readJson(injected!)
  assert.equal(injected!.status, 200)
  assert.deepEqual(injectedBody.items, [])
  assert.equal(injectedBody.total, 0)

  const detail = await respondToReadApi(request(`/api/v1/shops/${PUBLIC_SHOP}`), { database, now: SEED_NOW })
  const detailBody = await readJson(detail!)
  assert.equal(detail!.status, 200)
  assert.equal(detailBody.id, PUBLIC_SHOP)
  assert.equal(detailBody.name, '架空食堂 北口')
  assert.equal(Object.hasOwn(detailBody, 'name_search'), false)

  const hidden = await respondToReadApi(request(`/api/v1/shops/${NULL_COORD_SHOP}`), { database, now: SEED_NOW })
  assert.equal(hidden!.status, 404)

  const missing = await respondToReadApi(request('/api/v1/shops/missing-shop'), { database, now: SEED_NOW })
  assert.equal(missing!.status, 404)

  const discounts = await respondToReadApi(request('/api/v1/discounts'), { database, now: SEED_NOW })
  const discountBody = await readJson(discounts!)
  const discountIds = (discountBody.items as Array<{ id: string; subject: string | null; content: string | null }>).map(
    (item) => item.id,
  )
  assert.deepEqual(discountIds, [
    '55555555-5555-4555-8555-555555555501',
    '55555555-5555-4555-8555-555555555502',
    DURING,
    '55555555-5555-4555-8555-555555555506',
    '55555555-5555-4555-8555-555555555507',
  ])
  assert.equal(discountIds.includes(BEFORE), false)
  assert.equal(discountIds.includes(ENDED), false)
  assert.equal(discountIds.includes(BLANK), false)
  const contentOnly = (discountBody.items as Array<{ id: string; subject: string | null }>).find(
    (item) => item.id === '55555555-5555-4555-8555-555555555507',
  )
  assert.equal(contentOnly?.subject, null)
  assert.equal(JSON.stringify(discountBody).includes('createdAt'), false)
  assert.equal(JSON.stringify(discountBody).includes('updated_at'), false)

  const ended = await respondToReadApi(request(`/api/v1/discounts/${ENDED}`), { database, now: SEED_NOW })
  assert.equal(ended!.status, 200)
  assert.equal((await readJson(ended!)).id, ENDED)

  const before = await respondToReadApi(request(`/api/v1/discounts/${BEFORE}`), { database, now: SEED_NOW })
  assert.equal(before!.status, 404)

  const blank = await respondToReadApi(request(`/api/v1/discounts/${BLANK}`), { database, now: SEED_NOW })
  assert.equal(blank!.status, 404)

  const atStart = new Date('2026-06-01T00:00:00Z')
  const started = await respondToReadApi(request(`/api/v1/discounts/${DURING}`), { database, now: atStart })
  assert.equal(started!.status, 200)
  const atEnd = new Date('2026-07-01T00:00:00Z')
  const endedList = await respondToReadApi(request('/api/v1/discounts'), { database, now: atEnd })
  const endedIds = ((await readJson(endedList!)).items as Array<{ id: string }>).map((item) => item.id)
  assert.equal(endedIds.includes(DURING), false)
  const endedDetail = await respondToReadApi(request(`/api/v1/discounts/${DURING}`), { database, now: atEnd })
  assert.equal(endedDetail!.status, 200)

  const nested = await respondToReadApi(request(`/api/v1/shops/${PUBLIC_SHOP}/discounts`), { database, now: SEED_NOW })
  assert.equal(nested!.status, 200)
  assert.equal((await readJson(nested!)).total, 5)

  const emptyNested = await respondToReadApi(request(`/api/v1/shops/${EMPTY_ADDRESS_SHOP}/discounts`), {
    database,
    now: SEED_NOW,
  })
  const emptyBody = await readJson(emptyNested!)
  assert.equal(emptyNested!.status, 200)
  assert.deepEqual(emptyBody.items, [])
  assert.equal(emptyBody.total, 0)

  const hiddenNested = await respondToReadApi(request(`/api/v1/shops/${NULL_COORD_SHOP}/discounts`), {
    database,
    now: SEED_NOW,
  })
  assert.equal(hiddenNested!.status, 404)

  const denied = await respondToReadApi(request('/api/v1/shops', 'DELETE'), { database, now: SEED_NOW })
  assert.equal(denied!.status, 405)
  assert.equal(denied!.headers.get('allow'), 'GET')
})

test('coordinate boundaries are applied to rows returned by the database', async () => {
  const rows = [
    shop('edge', -90, -180, '2026-03-01T00:00:00Z'),
    shop('other-edge', 90, 180, '2026-02-01T00:00:00Z'),
    shop('high', 90.0001, 0, '2026-04-01T00:00:00Z'),
    shop('nan', Number.NaN, 0, '2026-05-01T00:00:00Z'),
    { ...shop('nulls', 0, 0, '2026-01-01T00:00:00Z'), latitude: null, longitude: null },
  ]
  const database = scriptedDatabase(rows, [])
  const response = await respondToReadApi(request('/api/v1/shops'), { database, now: SEED_NOW })
  const body = await readJson(response!)
  assert.deepEqual(
    (body.items as Array<{ id: string }>).map((item) => item.id),
    ['edge', 'other-edge'],
  )
})

test('database failures stay distinct and do not echo SQL', async () => {
  const missing = await respondToReadApi(request('/api/v1/discounts'))
  assert.equal(missing!.status, 500)
  assert.equal((await missing!.text()).includes('SELECT'), false)

  const sql = await respondToReadApi(request('/api/v1/shops'), {
    database: failingDatabase(new Error('D1_ERROR: no such table: shops: SELECT * FROM secrets')),
    now: SEED_NOW,
  })
  assert.equal(sql!.status, 500)
  const sqlBody = await sql!.text()
  assert.equal(sqlBody.includes('secrets'), false)
  assert.equal(sqlBody.includes('SELECT'), false)
  assert.equal(classifyDatabaseError(new Error('no such table')), 'internal_error')

  const down = await respondToReadApi(request('/api/v1/shops/any'), {
    database: failingDatabase(new Error('D1_ERROR: Network connection lost')),
    now: SEED_NOW,
  })
  assert.equal(down!.status, 503)
  const downBody = await down!.text()
  assert.equal(downBody.includes('Network'), false)
  assert.equal(classifyDatabaseError(new Error('Network connection lost')), 'service_unavailable')
})

test('handleRequest reads the five paths from the bound database', async () => {
  const database = asReadDatabase(openSeededDatabase())
  const response = await handleRequest(request('/api/v1/shops/like-shop'), { DB: database as never })
  assert.equal(response.status, 200)
  const body = await readJson(response)
  assert.equal(body.name, '100%_off')
  assert.equal(Object.hasOwn(body, 'address_search'), false)
})

function shop(id: string, latitude: number, longitude: number, createdAt: string) {
  return {
    id,
    name: id,
    address: '住所',
    latitude,
    longitude,
    created_at: createdAt,
  }
}

function scriptedDatabase(shops: unknown[], discounts: unknown[]): ReadDatabase {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async all() {
              if (sql.includes('FROM discounts')) {
                return { success: true, results: discounts }
              }
              return { success: true, results: shops }
            },
          }
        },
      }
    },
  } as ReadDatabase
}

function failingDatabase(error: Error): ReadDatabase {
  return {
    prepare() {
      return {
        bind() {
          return {
            async all() {
              throw error
            },
          }
        },
      }
    },
  }
}
