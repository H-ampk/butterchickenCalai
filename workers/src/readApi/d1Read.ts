import { errorResponse } from './errors.ts'
import { toContainsLikePattern, LIKE_ESCAPE } from './likePattern.ts'
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
 * 店舗の q だけ、name_search と address_search の LIKE で候補を減らす。
 */

const SHOP_COLUMNS = 'id, name, address, latitude, longitude, created_at'

/** LIKE の ESCAPE 句。LIKE_ESCAPE と同じ 1 文字を SQL リテラルにする。 */
const LIKE_ESCAPE_SQL = `ESCAPE '${LIKE_ESCAPE}'`

const SHOP_LIST_SQL = `
SELECT ${SHOP_COLUMNS}
FROM shops
WHERE (? = 0 OR name_search LIKE ? ${LIKE_ESCAPE_SQL} OR address_search LIKE ? ${LIKE_ESCAPE_SQL})
`

const SHOP_BY_ID_SQL = `
SELECT ${SHOP_COLUMNS}
FROM shops
WHERE id = ?
`

const DISCOUNT_COLUMNS = 'id, shop_id, subject, content, starts_at, ends_at, created_at'

const DISCOUNT_LIST_SQL = `
SELECT ${DISCOUNT_COLUMNS}
FROM discounts
`

const DISCOUNT_BY_ID_SQL = `
SELECT ${DISCOUNT_COLUMNS}
FROM discounts
WHERE id = ?
`

const DISCOUNTS_BY_SHOP_SQL = `
SELECT ${DISCOUNT_COLUMNS}
FROM discounts
WHERE shop_id = ?
`

const SHOPS_BY_IDS_SQL_PREFIX = `
SELECT ${SHOP_COLUMNS}
FROM shops
WHERE id IN (
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
 * 一時的な接続障害だけを 503 にする。
 * テーブル不在、SQL の不具合、想定外の例外は 500。
 * 判定に使う文字列は応答へ出さない。
 */
export function classifyDatabaseError(error: unknown): 'internal_error' | 'service_unavailable' {
  const message = error instanceof Error ? error.message : ''
  if (
    /network connection|connection lost|timed out|timeout|temporarily unavailable|overloaded|ECONNRESET|ECONNREFUSED|ENOTFOUND|database is locked|D1_RESET/i.test(
      message,
    )
  ) {
    return 'service_unavailable'
  }
  return 'internal_error'
}

async function selectAll<T>(database: ReadDatabase, sql: string, params: readonly unknown[]): Promise<T[]> {
  const result = await database.prepare(sql).bind(...params).all<T>()
  if (result.success === false || !Array.isArray(result.results)) {
    throw new Error('query failed')
  }
  return result.results
}

function shopSearchBinds(q: string | null): [number, string, string] {
  if (q === null) {
    return [0, '', '']
  }
  const pattern = toContainsLikePattern(q)
  if (pattern.kind === 'none') {
    return [0, '', '']
  }
  return [1, pattern.pattern, pattern.pattern]
}

async function loadShopsForDiscounts(
  database: ReadDatabase,
  discounts: readonly DiscountSourceRow[],
): Promise<ShopSourceRow[]> {
  const ids = [...new Set(discounts.map((row) => row.shop_id).filter((id): id is string => typeof id === 'string' && id.length > 0))]
  if (ids.length === 0) {
    return []
  }
  const placeholders = ids.map(() => '?').join(', ')
  return selectAll<ShopSourceRow>(database, `${SHOPS_BY_IDS_SQL_PREFIX}${placeholders})`, ids)
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
        const rows = await selectAll<ShopSourceRow>(database, SHOP_LIST_SQL, shopSearchBinds(plan.query.q))
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
        const discounts = await selectAll<DiscountSourceRow>(database, DISCOUNT_LIST_SQL, [])
        const shops = await loadShopsForDiscounts(database, discounts)
        return jsonOk(
          listPublicDiscounts(discounts, shops, { limit: plan.query.limit, offset: plan.query.offset }, now),
        )
      }
      case 'discount': {
        const discounts = await selectAll<DiscountSourceRow>(database, DISCOUNT_BY_ID_SQL, [plan.route.discountId])
        const row = discounts[0] ?? null
        const shops = row === null ? [] : await loadShopsForDiscounts(database, [row])
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
