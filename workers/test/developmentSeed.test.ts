import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  DEVELOPMENT_SEED_REFERENCE_INSTANT,
  DEVELOPMENT_SEED_STORED_AT,
  developmentDiscounts,
  developmentShops,
  renderDevelopmentSeedSql,
} from '../src/developmentSeed.ts'
import { normalizeSearchText } from '../src/searchText.ts'

const workersDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

test('committed development seed matches the shared renderer', () => {
  const committed = readFileSync(path.join(workersDir, 'seeds', 'development.sql'), 'utf8')
  assert.equal(committed.replaceAll('\r\n', '\n'), renderDevelopmentSeedSql())
})

test('seed search columns are the shared normalizer output', () => {
  const sql = renderDevelopmentSeedSql()
  for (const shop of developmentShops) {
    assert.equal(sql.includes(`'${normalizeSearchText(shop.name)}'`), true)
    assert.equal(sql.includes(`'${normalizeSearchText(shop.address)}'`), true)
  }
  assert.equal(sql.includes("'架空cafe12'"), true)
  assert.equal(sql.includes("'example-town'"), true)
})

/** 行コメントを除いた SQL。改行は LF にそろえる。 */
function statementsOf(sql: string): string {
  return sql
    .replaceAll('\r\n', '\n')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

test('seed does not replace rows and uses fixed UUID v4 values', () => {
  const sql = statementsOf(renderDevelopmentSeedSql())
  assert.equal(/INSERT\s+OR\s+(REPLACE|IGNORE)/i.test(sql), false)
  assert.equal(/sqlite\s+lower/i.test(sql), false)
  const ids = [...developmentShops, ...developmentDiscounts].map((row) => row.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) {
    assert.match(id, uuidV4)
  }
})

test('seed covers the required shop and discount cases', () => {
  assert.deepEqual(
    developmentShops.map((shop) => shop.caseId),
    ['normal', 'fullwidth-name', 'empty-address', 'null-coordinates'],
  )
  assert.deepEqual(
    developmentDiscounts.map((discount) => discount.caseId),
    [
      'no-start',
      'no-end',
      'before-start',
      'during',
      'ended',
      'subject-only',
      'content-only',
      'subject-and-content-null',
    ],
  )
  const normalShop = developmentShops.find((shop) => shop.caseId === 'normal')
  assert.ok(normalShop)
  assert.equal(
    developmentDiscounts.filter((discount) => discount.shopId === normalShop.id).length,
    developmentDiscounts.length,
  )
  const shopIds = new Set(developmentShops.map((shop) => shop.id))
  for (const discount of developmentDiscounts) {
    assert.equal(shopIds.has(discount.shopId), true)
  }
})

test('period samples keep their meaning at the fixed reference instant', () => {
  const now = DEVELOPMENT_SEED_REFERENCE_INSTANT
  for (const discount of developmentDiscounts) {
    if (discount.caseId === 'no-start') {
      assert.equal(discount.startsAt, null)
      assert.ok(discount.endsAt)
    }
    if (discount.caseId === 'no-end') {
      assert.ok(discount.startsAt)
      assert.equal(discount.endsAt, null)
    }
    if (discount.caseId === 'before-start') {
      assert.ok(discount.startsAt)
      assert.ok(discount.endsAt)
      assert.equal(discount.startsAt > now, true)
      assert.equal(discount.startsAt < discount.endsAt, true)
    }
    if (discount.caseId === 'during') {
      assert.ok(discount.startsAt)
      assert.ok(discount.endsAt)
      assert.equal(discount.startsAt <= now && now < discount.endsAt, true)
    }
    if (discount.caseId === 'ended') {
      assert.ok(discount.endsAt)
      assert.equal(discount.endsAt <= now, true)
    }
    if (discount.caseId === 'subject-only') {
      assert.equal(discount.subject, '件名のみ')
      assert.equal(discount.content, null)
    }
    if (discount.caseId === 'content-only') {
      assert.equal(discount.subject, null)
      assert.equal(discount.content, '本文のみ')
    }
    if (discount.caseId === 'subject-and-content-null') {
      assert.equal(discount.subject, null)
      assert.equal(discount.content, null)
    }
  }
  assert.equal(DEVELOPMENT_SEED_STORED_AT < now, true)
})

test('initial migration has no seed rows and no foreign-key pragma', () => {
  const source = readFileSync(path.join(workersDir, 'migrations', '0001_initial.sql'), 'utf8')
  const sql = statementsOf(source)
  assert.equal(/PRAGMA/i.test(sql), false)
  assert.equal(/INSERT/i.test(sql), false)
  assert.equal((sql.match(/CREATE INDEX/g) ?? []).length, 1)
  assert.match(sql, /CREATE INDEX idx_discounts_shop_id\s+ON discounts\(shop_id\)/)
  assert.equal(sql.includes("GLOB '[0-9][0-9][0-9][0-9]"), false)
  assert.match(sql, /printf\('%04d'/)
  assert.equal(/CREATE INDEX[^;]*name_search/i.test(sql), false)
  assert.equal(/CREATE INDEX[^;]*address_search/i.test(sql), false)
  assert.equal(/CREATE INDEX[^;]*created_at/i.test(sql), false)
})
