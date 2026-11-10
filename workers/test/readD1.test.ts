import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { handleRequest } from '../src/index.ts'
import { normalizeSearchText } from '../src/searchText.ts'
import type { ReadDatabase } from '../src/readApi/d1Read.ts'
import { classifyDatabaseError, D1_LIKE_PATTERN_MAX_BYTES, shopSearchStatement, utf8ByteLength } from '../src/readApi/d1Read.ts'
import { listPublicDiscounts, listPublicShops } from '../src/readApi/publicPage.ts'
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

  const messageOnly = await respondToReadApi(request('/api/v1/shops/any'), {
    database: failingDatabase(new Error('D1_ERROR: Network connection lost. timeout while reading secrets')),
    now: SEED_NOW,
  })
  assert.equal(messageOnly!.status, 500)
  const messageBody = await messageOnly!.text()
  assert.equal(messageBody.includes('Network'), false)
  assert.equal(messageBody.includes('timeout'), false)
  assert.equal(messageBody.includes('secrets'), false)
  assert.equal(classifyDatabaseError(new Error('Network connection lost')), 'internal_error')

  const busy = new Error('busy') as Error & { code: string }
  busy.code = 'SQLITE_BUSY'
  const down = await respondToReadApi(request('/api/v1/shops/any'), {
    database: failingDatabase(busy),
    now: SEED_NOW,
  })
  assert.equal(down!.status, 503)
  const downBody = await down!.text()
  assert.equal(downBody.includes('SQLITE_BUSY'), false)
  assert.equal(downBody.includes('busy'), false)
  const caused = new Error('wrapped')
  ;(caused as Error & { cause: { code: number } }).cause = { code: 5 }
  assert.equal(classifyDatabaseError(caused), 'service_unavailable')
  const retryable = new Error('again') as Error & { retryable: boolean }
  retryable.retryable = true
  assert.equal(classifyDatabaseError(retryable), 'service_unavailable')
  assert.equal(classifyDatabaseError(new Error('SQLITE_BUSY')), 'internal_error')
})

test('shop search keeps LIKE for short patterns and instr when the pattern exceeds 50 bytes', async () => {
  const database = new DatabaseSync(':memory:')
  database.exec(readFileSync(path.join(workersDir, 'migrations', '0001_initial.sql'), 'utf8'))
  const statements: string[] = []
  const recording = recordingDatabase(database, statements)

  const asciiLike = 'a'.repeat(D1_LIKE_PATTERN_MAX_BYTES - 2)
  const asciiInstr = 'b'.repeat(D1_LIKE_PATTERN_MAX_BYTES - 1)
  const kanjiLike = '店'.repeat(16)
  const kanjiInstr = '町'.repeat(17)
  const wideLike = 'Ｃ'.repeat(D1_LIKE_PATTERN_MAX_BYTES - 2)
  const wideInstr = 'Ｄ'.repeat(D1_LIKE_PATTERN_MAX_BYTES - 1)
  const percentLike = '%'.repeat(24)
  const percentInstr = '_'.repeat(25)
  assert.equal(utf8ByteLength(shopSearchStatement(asciiLike).params[0] ?? ''), D1_LIKE_PATTERN_MAX_BYTES)
  assert.equal(utf8ByteLength(`%${asciiInstr}%`), D1_LIKE_PATTERN_MAX_BYTES + 1)
  assert.equal(utf8ByteLength(shopSearchStatement(kanjiLike).params[0] ?? ''), D1_LIKE_PATTERN_MAX_BYTES)
  assert.ok(utf8ByteLength(`%${kanjiInstr}%`) > D1_LIKE_PATTERN_MAX_BYTES)
  assert.equal(shopSearchStatement(asciiLike).sql.includes('LIKE'), true)
  assert.equal(shopSearchStatement(asciiInstr).sql.includes('instr('), true)
  assert.equal(shopSearchStatement(kanjiLike).sql.includes('LIKE'), true)
  assert.equal(shopSearchStatement(kanjiInstr).sql.includes('instr('), true)
  assert.equal(shopSearchStatement(wideLike.normalize('NFKC')).sql.includes('LIKE'), true)
  assert.equal(shopSearchStatement(wideInstr.normalize('NFKC')).sql.includes('instr('), true)
  assert.equal(shopSearchStatement(percentLike).sql.includes('LIKE'), true)
  assert.equal(shopSearchStatement(percentInstr).sql.includes('instr('), true)
  assert.equal(shopSearchStatement(percentLike).params[0]?.includes('%'), true)
  assert.equal(shopSearchStatement(percentInstr).params[0]?.includes('%'), false)

  const samples = [
    ['ascii-like', asciiLike, asciiLike, 'like'],
    ['ascii-instr', asciiInstr, asciiInstr, 'instr'],
    ['kanji-like', kanjiLike, kanjiLike, 'like'],
    ['kanji-instr', kanjiInstr, kanjiInstr, 'instr'],
    ['wide-like', wideLike.normalize('NFKC'), wideLike, 'like'],
    ['wide-instr', wideInstr.normalize('NFKC'), wideInstr, 'instr'],
    ['percent-like', percentLike, percentLike, 'like'],
    ['percent-instr', percentInstr, percentInstr, 'instr'],
  ] as const
  for (const [id, stored] of samples) {
    database
      .prepare(
        `INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, created_at, updated_at)
         VALUES (?, ?, '', 1, 1, ?, '', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
      )
      .run(id, stored, normalizeSearchText(stored))
  }

  for (const [id, stored, query, mode] of samples) {
    statements.length = 0
    const response = await respondToReadApi(request(`/api/v1/shops?q=${encodeURIComponent(query)}`), {
      database: recording,
      now: SEED_NOW,
    })
    const body = await readJson(response!)
    const ids = (body.items as Array<{ id: string }>).map((item) => item.id)
    assert.deepEqual(ids, [id], query)
    const sql = statements.at(-1) ?? ''
    assert.equal(sql.includes(mode === 'like' ? 'LIKE' : 'instr('), true, query)
    assert.equal(sql.includes(mode === 'like' ? 'instr(' : 'LIKE'), false, query)
    const all = database.prepare('SELECT id, name, address, latitude, longitude, created_at FROM shops').all()
    const expected = listPublicShops(all as never[], { q: stored, limit: 20, offset: 0 })
    assert.deepEqual(body.items, expected.items, query)
    assert.equal(body.total, expected.total, query)
  }
})

test('discount reads join shops past the 100 bind limit without changing the page', async () => {
  const database = new DatabaseSync(':memory:')
  database.exec('PRAGMA foreign_keys = ON')
  database.exec(readFileSync(path.join(workersDir, 'migrations', '0001_initial.sql'), 'utf8'))
  const statements: Array<{ sql: string; binds: number }> = []
  const recording = {
    prepare(sql: string) {
      const statement = database.prepare(sql)
      return {
        bind(...values: unknown[]) {
          return {
            async all<T>() {
              statements.push({ sql, binds: values.length })
              return { success: true, results: statement.all(...(values as never[])) as T[] }
            },
          }
        },
      }
    },
  }
  for (const count of [100, 101]) {
    database.exec('DELETE FROM discounts')
    database.exec('DELETE FROM shops')
    statements.length = 0
    for (let index = 0; index < count; index += 1) {
      const shopId = `shop-${String(index).padStart(3, '0')}`
      const createdAt = `2026-01-01T00:00:${String(index % 60).padStart(2, '0')}Z`
      database
        .prepare(
          `INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, created_at, updated_at)
           VALUES (?, ?, '', 35, 135, ?, '', ?, ?)`,
        )
        .run(shopId, shopId, shopId, createdAt, createdAt)
      database
        .prepare(
          `INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at)
           VALUES (?, ?, ?, '本文', NULL, NULL, ?, ?)`,
        )
        .run(`discount-${String(index).padStart(3, '0')}`, shopId, shopId, createdAt, createdAt)
    }
    const response = await respondToReadApi(request('/api/v1/discounts?limit=20&offset=20'), {
      database: recording,
      now: SEED_NOW,
    })
    const body = await readJson(response!)
    const shops = database.prepare('SELECT id, name, address, latitude, longitude, created_at FROM shops').all()
    const discounts = database
      .prepare('SELECT id, shop_id, subject, content, starts_at, ends_at, created_at FROM discounts')
      .all()
    const expected = listPublicDiscounts(discounts as never[], shops as never[], { limit: 20, offset: 20 }, SEED_NOW)
    assert.equal(body.total, count)
    assert.deepEqual(body.items, expected.items, String(count))
    assert.equal(body.limit, 20)
    assert.equal(body.offset, 20)
    const listCall = statements.find((entry) => entry.sql.includes('FROM discounts'))
    assert.ok(listCall)
    assert.equal(listCall.sql.includes('JOIN shops'), true)
    assert.equal(listCall.sql.includes(' IN '), false)
    assert.equal(listCall.binds <= 100, true)
  }
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

function recordingDatabase(db: DatabaseSync, statements: string[]): ReadDatabase {
  return {
    prepare(sql: string) {
      const statement = db.prepare(sql)
      return {
        bind(...values: unknown[]) {
          return {
            async all<T>() {
              statements.push(sql)
              return { success: true, results: statement.all(...(values as never[])) as T[] }
            },
          }
        },
      }
    },
  }
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
