import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { getPlatformProxy } from 'wrangler'
import { DEVELOPMENT_SEED_STORED_AT, developmentDiscounts, developmentShops } from '../src/developmentSeed.ts'
import { normalizeSearchText } from '../src/searchText.ts'

const workersDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wranglerJs = path.join(workersDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const storedAt = '2026-01-15T00:00:00Z'

interface WranglerResult {
  status: number
  output: string
}

function runWrangler(persistTo: string, args: string[]): WranglerResult {
  assert.equal(args.includes('--remote'), false)
  const result = spawnSync(process.execPath, [wranglerJs, ...args, '--persist-to', persistTo], {
    cwd: workersDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: '1',
      WRANGLER_SEND_METRICS: 'false',
    },
    timeout: 120_000,
  })
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  }
}

function executeJson(persistTo: string, sql: string): Array<{ results: Array<Record<string, unknown>> }> {
  const result = runWrangler(persistTo, ['d1', 'execute', 'DB', '--local', '--json', '--command', sql])
  assert.equal(result.status, 0, result.output)
  const start = result.output.indexOf('[')
  assert.equal(start >= 0, true, result.output)
  return JSON.parse(result.output.slice(start)) as Array<{ results: Array<Record<string, unknown>> }>
}

async function rejects(run: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    assert.match(message, pattern)
    return
  }
  assert.fail(`制約で拒否される想定です: ${pattern}`)
}

test('local D1 migration, constraints, and development seed', { timeout: 180_000 }, async () => {
  const persistTo = mkdtempSync(path.join(tmpdir(), 'd1-schema-'))
  try {
    const before = runWrangler(persistTo, ['d1', 'migrations', 'list', 'DB', '--local'])
    assert.equal(before.status, 0, before.output)
    assert.match(before.output, /0001_initial\.sql/)
    assert.match(before.output, /Migrations to be applied/)

    const applied = runWrangler(persistTo, ['d1', 'migrations', 'apply', 'DB', '--local'])
    assert.equal(applied.status, 0, applied.output)
    assert.match(applied.output, /0001_initial\.sql/)

    const after = runWrangler(persistTo, ['d1', 'migrations', 'list', 'DB', '--local'])
    assert.equal(after.status, 0, after.output)
    assert.match(after.output, /No migrations to apply/)

    const again = runWrangler(persistTo, ['d1', 'migrations', 'apply', 'DB', '--local'])
    assert.equal(again.status, 0, again.output)
    assert.match(again.output, /No migrations to apply/)

    const schema = executeJson(
      persistTo,
      [
        'PRAGMA table_info(shops);',
        'PRAGMA table_info(discounts);',
        'PRAGMA foreign_key_list(discounts);',
        'PRAGMA foreign_keys;',
        'PRAGMA foreign_key_check;',
        "SELECT name FROM d1_migrations ORDER BY name;",
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%' ORDER BY name;",
        "EXPLAIN QUERY PLAN SELECT id FROM discounts WHERE shop_id = '11111111-1111-4111-8111-111111111111';",
      ].join(' '),
    )
    assert.deepEqual(
      schema[0].results.map((column) => ({
        name: column.name,
        type: column.type,
        notnull: column.notnull,
        dflt_value: column.dflt_value,
        pk: column.pk,
      })),
      [
        { name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
        { name: 'name', type: 'TEXT', notnull: 1, dflt_value: "''", pk: 0 },
        { name: 'address', type: 'TEXT', notnull: 1, dflt_value: "''", pk: 0 },
        { name: 'latitude', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
        { name: 'longitude', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
        { name: 'name_search', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
        { name: 'address_search', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
        { name: 'created_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
        { name: 'updated_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      ],
    )
    assert.deepEqual(
      schema[1].results.map((column) => ({
        name: column.name,
        type: column.type,
        notnull: column.notnull,
        dflt_value: column.dflt_value,
        pk: column.pk,
      })),
      [
        { name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
        { name: 'shop_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
        { name: 'subject', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        { name: 'content', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        { name: 'starts_at', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        { name: 'ends_at', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        { name: 'created_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
        { name: 'updated_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      ],
    )
    assert.equal(schema[2].results[0]?.table, 'shops')
    assert.equal(schema[2].results[0]?.from, 'shop_id')
    assert.equal(schema[2].results[0]?.to, 'id')
    assert.equal(schema[2].results[0]?.on_delete, 'CASCADE')
    assert.equal(schema[3].results[0]?.foreign_keys, 1)
    assert.deepEqual(schema[4].results, [])
    assert.deepEqual(schema[5].results, [{ name: '0001_initial.sql' }])
    assert.deepEqual(schema[6].results, [{ name: 'idx_discounts_shop_id' }])
    const plan = String(schema[7].results[0]?.detail ?? '')
    assert.equal(plan.length > 0, true)
    console.log(`EXPLAIN QUERY PLAN (empty discounts): ${plan}`)

    const proxy = await getPlatformProxy<{ DB: D1Database }>({
      configPath: path.join(workersDir, 'wrangler.jsonc'),
      persist: { path: path.join(persistTo, 'v3') },
      remoteBindings: false,
    })
    try {
      const db = proxy.env.DB
      const foreignKeys = await db.prepare('PRAGMA foreign_keys').first<{ foreign_keys: number }>()
      assert.equal(foreignKeys?.foreign_keys, 1)

      const insertShop = `INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      const insertDiscount = `INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

      await db.prepare(insertShop).bind('t-ok', '店', '住所', 35, 135, '店', '住所', storedAt, storedAt).run()
      await db.prepare(insertShop).bind('t-null-coords', '店', '住所', null, null, '店', '住所', storedAt, storedAt).run()
      await db.prepare(insertShop).bind('t-boundary', '', '', -90, 180, '', '', storedAt, storedAt).run()
      await db.prepare(insertShop).bind('t-edge', '', '', 90, -180, '', '', storedAt, storedAt).run()
      await db.prepare(insertShop).bind('t-empty-text', '', '', 1, 2, '', '', storedAt, storedAt).run()
      await db.prepare(insertShop).bind('t-numeric-text', '', '', '12.5', '135', '', '', storedAt, storedAt).run()
      await db.prepare(insertShop).bind('t-feb31', '', '', 0, 0, '', '', '2026-02-31T00:00:00Z', '2026-02-31T00:00:00Z').run()
      await db.prepare(insertShop).bind('t-non-leap', '', '', 0, 0, '', '', '2026-02-29T00:00:00Z', '2026-02-29T00:00:00Z').run()
      await db.prepare(
        `INSERT INTO shops (id, latitude, longitude, name_search, address_search, created_at, updated_at) VALUES ('t-default', 1, 2, '', '', ?, ?)`,
      )
        .bind(storedAt, storedAt)
        .run()
      const defaults = await db.prepare('SELECT name, address FROM shops WHERE id = ?').bind('t-default').first<{ name: string; address: string }>()
      assert.deepEqual(defaults, { name: '', address: '' })
      const numericText = await db
        .prepare('SELECT typeof(latitude) AS lat_type, latitude FROM shops WHERE id = ?')
        .bind('t-numeric-text')
        .first<{ lat_type: string; latitude: number }>()
      assert.equal(numericText?.lat_type, 'real')
      assert.equal(numericText?.latitude, 12.5)

      await db.prepare(insertShop).bind('t-nan', '', '', Number.NaN, Number.NaN, '', '', storedAt, storedAt).run()
      const nanRow = await db
        .prepare('SELECT latitude, longitude FROM shops WHERE id = ?')
        .bind('t-nan')
        .first<{ latitude: number | null; longitude: number | null }>()
      assert.deepEqual(nanRow, { latitude: null, longitude: null })

      await rejects(
        () => db.prepare(insertShop).bind('t-north', '', '', 'north', 'east', '', '', storedAt, storedAt).run(),
        /shops_coordinates/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-lat-null', '', '', null, 135, '', '', storedAt, storedAt).run(),
        /shops_coordinates/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-lon-null', '', '', 35, null, '', '', storedAt, storedAt).run(),
        /shops_coordinates/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-nan-one', '', '', Number.NaN, 135, '', '', storedAt, storedAt).run(),
        /shops_coordinates/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-lat-low', '', '', -90.0001, 0, '', '', storedAt, storedAt).run(),
        /shops_coordinates/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-lat-high', '', '', 90.0001, 0, '', '', storedAt, storedAt).run(),
        /shops_coordinates/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-lon-low', '', '', 0, -180.0001, '', '', storedAt, storedAt).run(),
        /shops_coordinates/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-lon-high', '', '', 0, 180.0001, '', '', storedAt, storedAt).run(),
        /shops_coordinates/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-inf', '', '', Number.POSITIVE_INFINITY, 0, '', '', storedAt, storedAt).run(),
        /shops_coordinates/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('', '', '', 0, 0, '', '', storedAt, storedAt).run(),
        /shops_id_not_blank/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('   ', '', '', 0, 0, '', '', storedAt, storedAt).run(),
        /shops_id_not_blank/,
      )
      await rejects(
        () =>
          db
            .prepare(
              `INSERT INTO shops (id, name, address, latitude, longitude, created_at, updated_at) VALUES ('t-omit-search', '', '', 0, 0, ?, ?)`,
            )
            .bind(storedAt, storedAt)
            .run(),
        /NOT NULL/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-fraction', '', '', 0, 0, '', '', '2026-01-01T00:00:00.000Z', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-offset', '', '', 0, 0, '', '', '2026-01-01T00:00:00+09:00', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-offset-z', '', '', 0, 0, '', '', '2026-01-01T00:00:00+00:00', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-lower-z', '', '', 0, 0, '', '', '2026-01-01T00:00:00z', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-space', '', '', 0, 0, '', '', '2026-01-01 00:00:00Z', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-month0', '', '', 0, 0, '', '', '2026-00-01T00:00:00Z', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-month13', '', '', 0, 0, '', '', '2026-13-01T00:00:00Z', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-day0', '', '', 0, 0, '', '', '2026-01-00T00:00:00Z', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-day32', '', '', 0, 0, '', '', '2026-01-32T00:00:00Z', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-hour24', '', '', 0, 0, '', '', '2026-01-01T24:00:00Z', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-minute60', '', '', 0, 0, '', '', '2026-01-01T00:60:00Z', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-second60', '', '', 0, 0, '', '', '2026-01-01T00:00:60Z', storedAt).run(),
        /shops_created_at_format/,
      )
      await rejects(
        () => db.prepare(insertShop).bind('t-null-created', '', '', 0, 0, '', '', null, storedAt).run(),
        /NOT NULL|shops_created_at_format/,
      )
      await rejects(
        () =>
          db
            .prepare(
              `INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, updated_at) VALUES ('t-omit-created', '', '', 0, 0, '', '', ?)`,
            )
            .bind(storedAt)
            .run(),
        /NOT NULL/,
      )

      await db.prepare(insertDiscount).bind('t-discount', 't-ok', null, null, null, null, storedAt, storedAt).run()
      await db.prepare(insertDiscount).bind('t-subject', 't-ok', '件名', null, null, null, storedAt, storedAt).run()
      await db.prepare(insertDiscount).bind('t-content', 't-ok', null, '本文', null, null, storedAt, storedAt).run()
      await db.prepare(insertDiscount).bind('t-blank-text', 't-ok', '', '   ', null, null, storedAt, storedAt).run()
      await db.prepare(insertDiscount).bind('t-no-start', 't-ok', 'a', 'b', null, '2026-08-01T00:00:00Z', storedAt, storedAt).run()
      await db.prepare(insertDiscount).bind('t-no-end', 't-ok', 'a', 'b', '2026-06-01T00:00:00Z', null, storedAt, storedAt).run()
      await db.prepare(insertDiscount).bind('t-ordered', 't-ok', 'a', 'b', '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z', storedAt, storedAt).run()
      await rejects(
        () => db.prepare(insertDiscount).bind('t-missing-shop', 'missing-shop', null, null, null, null, storedAt, storedAt).run(),
        /FOREIGN KEY/,
      )
      await rejects(
        () => db.prepare(insertDiscount).bind('t-equal', 't-ok', null, null, storedAt, storedAt, storedAt, storedAt).run(),
        /discounts_period_order/,
      )
      await rejects(
        () =>
          db
            .prepare(insertDiscount)
            .bind('t-reversed', 't-ok', null, null, '2026-08-01T00:00:00Z', '2026-07-01T00:00:00Z', storedAt, storedAt)
            .run(),
        /discounts_period_order/,
      )

      await db.prepare(insertShop).bind('t-cascade', '', '', 1, 2, '', '', storedAt, storedAt).run()
      await db.prepare(insertDiscount).bind('t-cascade-discount', 't-cascade', null, null, null, null, storedAt, storedAt).run()
      await db.prepare('DELETE FROM shops WHERE id = ?').bind('t-cascade').run()
      const remaining = await db
        .prepare('SELECT COUNT(*) AS n FROM discounts WHERE id = ?')
        .bind('t-cascade-discount')
        .first<{ n: number }>()
      assert.equal(Number(remaining?.n), 0)
      const parent = await db.prepare('SELECT id FROM shops WHERE id = ?').bind('t-ok').first<{ id: string }>()
      assert.equal(parent?.id, 't-ok')
    } finally {
      await proxy.dispose()
    }

    const reset = runWrangler(persistTo, ['d1', 'execute', 'DB', '--local', '--file', 'seeds/reset-development.sql'])
    assert.equal(reset.status, 0, reset.output)
    const seeded = runWrangler(persistTo, ['d1', 'execute', 'DB', '--local', '--file', 'seeds/development.sql'])
    assert.equal(seeded.status, 0, seeded.output)
    const counts = executeJson(
      persistTo,
      'SELECT (SELECT COUNT(*) FROM shops) AS shops, (SELECT COUNT(*) FROM discounts) AS discounts;',
    )
    assert.deepEqual(counts[0].results, [{ shops: developmentShops.length, discounts: developmentDiscounts.length }])

    const duplicate = runWrangler(persistTo, ['d1', 'execute', 'DB', '--local', '--file', 'seeds/development.sql'])
    assert.equal(duplicate.status !== 0, true, duplicate.output)
    assert.match(duplicate.output, /UNIQUE|PRIMARY KEY|constraint/i)
    const countsAfterDuplicate = executeJson(
      persistTo,
      'SELECT (SELECT COUNT(*) FROM shops) AS shops, (SELECT COUNT(*) FROM discounts) AS discounts;',
    )
    assert.deepEqual(countsAfterDuplicate[0].results, counts[0].results)

    const seededPlan = executeJson(
      persistTo,
      "EXPLAIN QUERY PLAN SELECT id FROM discounts WHERE shop_id = '11111111-1111-4111-8111-111111111111';",
    )
    const seededDetail = String(seededPlan[0].results[0]?.detail ?? '')
    console.log(`EXPLAIN QUERY PLAN (seeded discounts): ${seededDetail}`)
    assert.equal(seededDetail.length > 0, true)

    const rows = executeJson(
      persistTo,
      'SELECT id, name, address, name_search, address_search, latitude, longitude, created_at, updated_at FROM shops ORDER BY id;',
    )
    assert.equal(rows[0].results.length, developmentShops.length)
    for (const shop of developmentShops) {
      const row = rows[0].results.find((item) => item.id === shop.id)
      assert.ok(row)
      assert.equal(row.name_search, normalizeSearchText(shop.name))
      assert.equal(row.address_search, normalizeSearchText(shop.address))
      assert.equal(row.created_at, DEVELOPMENT_SEED_STORED_AT)
      assert.equal(row.updated_at, DEVELOPMENT_SEED_STORED_AT)
      assert.equal(row.latitude, shop.latitude)
      assert.equal(row.longitude, shop.longitude)
    }
    const check = executeJson(persistTo, 'PRAGMA foreign_key_check;')
    assert.deepEqual(check[0].results, [])

    const resetAgain = runWrangler(persistTo, ['d1', 'execute', 'DB', '--local', '--file', 'seeds/reset-development.sql'])
    assert.equal(resetAgain.status, 0, resetAgain.output)
    const reseeded = runWrangler(persistTo, ['d1', 'execute', 'DB', '--local', '--file', 'seeds/development.sql'])
    assert.equal(reseeded.status, 0, reseeded.output)
    const reseededCounts = executeJson(
      persistTo,
      'SELECT (SELECT COUNT(*) FROM shops) AS shops, (SELECT COUNT(*) FROM discounts) AS discounts;',
    )
    assert.deepEqual(reseededCounts[0].results, [
      { shops: developmentShops.length, discounts: developmentDiscounts.length },
    ])
  } finally {
    rmSync(persistTo, { recursive: true, force: true })
  }
})
