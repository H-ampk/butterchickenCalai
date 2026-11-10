import { errorResponse } from './errors.ts'
import { toContainsLikePattern, LIKE_ESCAPE } from './likePattern.ts'
import { normalizeQueryText } from './parseQuery.ts'
import type { ParsedQuery } from './parseQuery.ts'
import {
  decideDiscountDetail,
  decideShopDetail,
  listPublicDiscounts,
  listPublicShops,
  pageShopDiscounts,
} from './publicPage.ts'
import type { DiscountSourceRow, ShopSourceRow } from './publicJson.ts'
import type { ReadRoute } from './recognizeRoute.ts'

/**
 * 検証済みの参照をローカル D1 から読む。
 * 公開条件、販売期間、並び、total、ページングは publicPage の関数に渡す。
 * SQL の LIMIT と OFFSET は、公開条件の前には掛けない。
 * 店舗の q は name_search と address_search で候補を減らす。
 * D1 の LIKE パターンは 50 バイトまでなので、それを超える検索語は instr で部分一致させる。
 * 割引一覧の店舗は JOIN で読む。IN 句のバインドは D1 の上限 100 個を超えないようにしない。
 */

const SHOP_COLUMNS = 'id, name, address, latitude, longitude, created_at'

/** D1 が受け付ける LIKE / GLOB パターンの上限。超えたパターンは渡さない。 */
export const D1_LIKE_PATTERN_MAX_BYTES = 50

/** LIKE の ESCAPE 句。LIKE_ESCAPE と同じ 1 文字を SQL リテラルにする。 */
const LIKE_ESCAPE_SQL = `ESCAPE '${LIKE_ESCAPE}'`

const SHOP_LIST_ALL_SQL = `
SELECT ${SHOP_COLUMNS}
FROM shops
`

const SHOP_LIST_LIKE_SQL = `
SELECT ${SHOP_COLUMNS}
FROM shops
WHERE name_search LIKE ? ${LIKE_ESCAPE_SQL} OR address_search LIKE ? ${LIKE_ESCAPE_SQL}
`

const SHOP_LIST_INSTR_SQL = `
SELECT ${SHOP_COLUMNS}
FROM shops
WHERE instr(name_search, ?) > 0 OR instr(address_search, ?) > 0
`

const SHOP_BY_ID_SQL = `
SELECT ${SHOP_COLUMNS}
FROM shops
WHERE id = ?
`

const DISCOUNT_COLUMNS = 'd.id AS id, d.shop_id AS shop_id, d.subject AS subject, d.content AS content, d.starts_at AS starts_at, d.ends_at AS ends_at, d.created_at AS created_at'

const SHOP_JOIN_COLUMNS = `
s.id AS shop_id_joined,
s.name AS shop_name,
s.address AS shop_address,
s.latitude AS shop_latitude,
s.longitude AS shop_longitude,
s.created_at AS shop_created_at
`

const DISCOUNT_LIST_SQL = `
SELECT ${DISCOUNT_COLUMNS}, ${SHOP_JOIN_COLUMNS}
FROM discounts d
LEFT JOIN shops s ON s.id = d.shop_id
`

const DISCOUNT_BY_ID_SQL = `
SELECT ${DISCOUNT_COLUMNS}, ${SHOP_JOIN_COLUMNS}
FROM discounts d
LEFT JOIN shops s ON s.id = d.shop_id
WHERE d.id = ?
`

const DISCOUNTS_BY_SHOP_SQL = `
SELECT id, shop_id, subject, content, starts_at, ends_at, created_at
FROM discounts
WHERE shop_id = ?
`

export type ReadDatabase = {
  prepare(query: string): ReadStatement
}

export type ReadStatement = {
  bind(...values: unknown[]): ReadBoundStatement
}

export type ReadBoundStatement = {
  all<T>(): Promise<{ results?: T[]; success?: boolean }>
}

type ReadyPlan = {
  type: 'ready'
  route: ReadRoute
  query: ParsedQuery
}

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * 構造化された一時障害コードだけを 503 にする。
 * メッセージ文では分類しない。コードが無い、または未知の例外は 500。
 * 判定に使った値は応答へ出さない。
 */
const TRANSIENT_DATABASE_CODES = new Set<string>([
  'SQLITE_BUSY',
  'SQLITE_LOCKED',
  'SQLITE_IOERR',
  'SQLITE_CANTOPEN',
  '5',
  '6',
  '10',
  '14',
])

function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null
  }
  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && code.length > 0) {
    return code
  }
  if (typeof code === 'number' && Number.isFinite(code)) {
    return String(code)
  }
  return null
}

function isTransientDatabaseError(error: unknown, seen: Set<unknown>): boolean {
  if (typeof error !== 'object' || error === null || seen.has(error)) {
    return false
  }
  seen.add(error)
  const code = readErrorCode(error)
  if (code !== null && TRANSIENT_DATABASE_CODES.has(code)) {
    return true
  }
  if ('retryable' in error && (error as { retryable?: unknown }).retryable === true) {
    return true
  }
  if ('cause' in error) {
    return isTransientDatabaseError((error as { cause?: unknown }).cause, seen)
  }
  return false
}

export function classifyDatabaseError(error: unknown): 'internal_error' | 'service_unavailable' {
  if (isTransientDatabaseError(error, new Set())) {
    return 'service_unavailable'
  }
  return 'internal_error'
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

/** 検索条件なし、LIKE、instr のどれで店舗候補を読むかを返す。長い LIKE パターンは作らない。 */
export function shopSearchStatement(q: string | null): { sql: string; params: readonly string[] } {
  if (q === null) {
    return { sql: SHOP_LIST_ALL_SQL, params: [] }
  }
  const pattern = toContainsLikePattern(q)
  if (pattern.kind === 'none') {
    return { sql: SHOP_LIST_ALL_SQL, params: [] }
  }
  if (utf8ByteLength(pattern.pattern) <= D1_LIKE_PATTERN_MAX_BYTES) {
    return { sql: SHOP_LIST_LIKE_SQL, params: [pattern.pattern, pattern.pattern] }
  }
  const needle = normalizeQueryText(q)
  return { sql: SHOP_LIST_INSTR_SQL, params: [needle, needle] }
}

async function selectAll<T>(database: ReadDatabase, sql: string, params: readonly unknown[]): Promise<T[]> {
  const result = await database.prepare(sql).bind(...params).all<T>()
  if (result.success === false || !Array.isArray(result.results)) {
    throw new Error('query failed')
  }
  return result.results
}

type DiscountJoinRow = DiscountSourceRow & {
  shop_id_joined?: unknown
  shop_name?: unknown
  shop_address?: unknown
  shop_latitude?: unknown
  shop_longitude?: unknown
  shop_created_at?: unknown
}

function splitDiscountJoin(rows: readonly DiscountJoinRow[]): {
  discounts: DiscountSourceRow[]
  shops: ShopSourceRow[]
} {
  const discounts: DiscountSourceRow[] = []
  const shops: ShopSourceRow[] = []
  for (const row of rows) {
    discounts.push({
      id: row.id,
      shop_id: row.shop_id,
      subject: row.subject,
      content: row.content,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      created_at: row.created_at,
    })
    if (typeof row.shop_id_joined === 'string' && row.shop_id_joined.length > 0) {
      shops.push({
        id: row.shop_id_joined,
        name: row.shop_name,
        address: row.shop_address,
        latitude: row.shop_latitude,
        longitude: row.shop_longitude,
        created_at: row.shop_created_at,
      })
    }
  }
  return { discounts, shops }
}

async function loadShop(database: ReadDatabase, shopId: string): Promise<ShopSourceRow | null> {
  const rows = await selectAll<ShopSourceRow>(database, SHOP_BY_ID_SQL, [shopId])
  return rows[0] ?? null
}

/**
 * 検証を通過した参照を実行する。
 * database が無いときはバインディング不足として 500。
 * now は販売期間の基準時刻。呼び出し側が注入する。
 */
export async function executeReadyRead(plan: ReadyPlan, database: ReadDatabase | undefined, now: Date): Promise<Response> {
  if (!database) {
    return errorResponse('internal_error')
  }

  try {
    switch (plan.route.name) {
      case 'shops': {
        if (plan.query.scope !== 'list') {
          return errorResponse('internal_error')
        }
        const search = shopSearchStatement(plan.query.q)
        const rows = await selectAll<ShopSourceRow>(database, search.sql, search.params)
        return jsonOk(
          listPublicShops(rows, { q: plan.query.q, limit: plan.query.limit, offset: plan.query.offset }),
        )
      }
      case 'shop': {
        const row = await loadShop(database, plan.route.shopId)
        const decision = decideShopDetail(row)
        if (decision.status === 'not_found') {
          return errorResponse('not_found')
        }
        return jsonOk(decision.body)
      }
      case 'discounts': {
        if (plan.query.scope !== 'list') {
          return errorResponse('internal_error')
        }
        const joined = splitDiscountJoin(await selectAll<DiscountJoinRow>(database, DISCOUNT_LIST_SQL, []))
        const discounts = joined.discounts
        const shops = joined.shops
        return jsonOk(
          listPublicDiscounts(discounts, shops, { limit: plan.query.limit, offset: plan.query.offset }, now),
        )
      }
      case 'discount': {
        const joined = splitDiscountJoin(
          await selectAll<DiscountJoinRow>(database, DISCOUNT_BY_ID_SQL, [plan.route.discountId]),
        )
        const row = joined.discounts[0] ?? null
        const shops = joined.shops
        const decision = decideDiscountDetail(row, shops, now)
        if (decision.status === 'not_found') {
          return errorResponse('not_found')
        }
        return jsonOk(decision.body)
      }
      case 'shop-discounts': {
        if (plan.query.scope !== 'list') {
          return errorResponse('internal_error')
        }
        const shop = await loadShop(database, plan.route.shopId)
        const discounts = await selectAll<DiscountSourceRow>(database, DISCOUNTS_BY_SHOP_SQL, [plan.route.shopId])
        const shops = shop === null ? [] : [shop]
        const page = pageShopDiscounts(
          discounts,
          shops,
          plan.route.shopId,
          { limit: plan.query.limit, offset: plan.query.offset },
          now,
        )
        if (page.status === 'not_found') {
          return errorResponse('not_found')
        }
        return jsonOk(page.page)
      }
      default: {
        const unreachable: never = plan.route
        return unreachable
      }
    }
  } catch (error) {
    return errorResponse(classifyDatabaseError(error))
  }
}
