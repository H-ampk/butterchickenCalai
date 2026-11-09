import { canDecodeQueryString, hasInvalidPercentEncoding, rawQueryString } from './percentEncoding.ts'
import type { ReadRoute } from './recognizeRoute.ts'

/** 仕様の一覧。既定 20、上限 100。 */
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100
export const DEFAULT_OFFSET = 0
/** 正規化後の `q` の上限。 */
export const MAX_QUERY_LENGTH = 200

export type ParsedQuery =
  | { scope: 'list'; limit: number; offset: number; q: string | null }
  | { scope: 'detail' }

export type QueryField = 'limit' | 'offset' | 'q' | 'unknown' | 'encoding'

export type QueryParseResult =
  | { ok: true; query: ParsedQuery }
  | { ok: false; reason: 'invalid_request'; field: QueryField }

/**
 * 店舗検索と同じ順。NFKC、前後の空白除去、小文字化。
 * frontend の normalizeSearchText は export されていないため、ここへ同じ変換を置く。
 */
export function normalizeQueryText(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase()
}

/**
 * 十進の正規形だけを安全な整数として読む。
 * 先頭ゼロ、符号、小数、空白は拒否する。`Number` が丸めた値も拒否する。
 * 読めないときは null。
 */
function parseCanonicalInteger(raw: string): number | null {
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
    return null
  }
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || String(value) !== raw) {
    return null
  }
  return value
}

/**
 * 経路ごとに許すクエリ名を返す。
 * 店舗一覧だけ `q` を許す。詳細経路はクエリを許さない。
 */
function allowedKeys(route: ReadRoute): ReadonlySet<string> {
  if (route.name === 'shops') {
    return new Set(['limit', 'offset', 'q'])
  }
  if (route.name === 'discounts' || route.name === 'shop-discounts') {
    return new Set(['limit', 'offset'])
  }
  return new Set()
}

/**
 * `limit` または `offset` を 1 件だけ読む。
 * 未指定なら fallback を返す。範囲外、または正規形でない値は invalid_request。
 * 重複した値は呼び出し側で invalid_request にする。
 */
function readInteger(
  values: readonly string[],
  fallback: number,
  min: number,
  max: number | null,
  field: 'limit' | 'offset',
): { ok: true; value: number } | { ok: false; reason: 'invalid_request'; field: 'limit' | 'offset' } {
  if (values.length === 0) {
    return { ok: true, value: fallback }
  }
  const parsed = parseCanonicalInteger(values[0] ?? '')
  if (parsed === null || parsed < min || (max !== null && parsed > max)) {
    return { ok: false, reason: 'invalid_request', field }
  }
  return { ok: true, value: parsed }
}

/**
 * 一覧と詳細のクエリを検証する。
 * `limit`、`offset`、`q` の重複指定は、値が同一でも invalid_request。最初の値も最後の値も採用しない。
 * パーセント形式が不正、または UTF-8 として復号できないクエリも invalid_request。
 * 検証を通過しても D1 は読まない。
 */
export function parseReadQuery(requestUrl: string, route: ReadRoute): QueryParseResult {
  const rawQuery = rawQueryString(requestUrl)
  if (hasInvalidPercentEncoding(rawQuery) || !canDecodeQueryString(rawQuery)) {
    return { ok: false, reason: 'invalid_request', field: 'encoding' }
  }

  const params = new URL(requestUrl).searchParams
  const limitValues = params.getAll('limit')
  const offsetValues = params.getAll('offset')
  if (limitValues.length > 1) {
    return { ok: false, reason: 'invalid_request', field: 'limit' }
  }
  if (offsetValues.length > 1) {
    return { ok: false, reason: 'invalid_request', field: 'offset' }
  }

  const allowed = allowedKeys(route)
  for (const key of params.keys()) {
    if (!allowed.has(key)) {
      return { ok: false, reason: 'invalid_request', field: 'unknown' }
    }
  }

  if (route.name === 'shop' || route.name === 'discount') {
    return { ok: true, query: { scope: 'detail' } }
  }

  const limit = readInteger(limitValues, DEFAULT_LIMIT, 1, MAX_LIMIT, 'limit')
  if (!limit.ok) {
    return limit
  }
  const offset = readInteger(offsetValues, DEFAULT_OFFSET, 0, null, 'offset')
  if (!offset.ok) {
    return offset
  }

  let q: string | null = null
  if (route.name === 'shops') {
    const qValues = params.getAll('q')
    if (qValues.length > 1) {
      return { ok: false, reason: 'invalid_request', field: 'q' }
    }
    if (qValues.length === 1) {
      const normalized = normalizeQueryText(qValues[0] ?? '')
      if (Array.from(normalized).length > MAX_QUERY_LENGTH) {
        return { ok: false, reason: 'invalid_request', field: 'q' }
      }
      q = normalized === '' ? null : normalized
    }
  }

  return {
    ok: true,
    query: { scope: 'list', limit: limit.value, offset: offset.value, q },
  }
}
