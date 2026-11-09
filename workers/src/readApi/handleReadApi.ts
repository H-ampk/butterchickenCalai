import { errorResponse, internalErrorResponse } from './errors.ts'
import { parseReadQuery, type ParsedQuery } from './parseQuery.ts'
import { recognizeReadRoute, type ReadRoute } from './recognizeRoute.ts'

export type ReadPlan =
  | { type: 'outside' }
  | { type: 'invalid_request' }
  | { type: 'not_found' }
  | { type: 'method_not_allowed' }
  | { type: 'unspecified' }
  | { type: 'not_implemented'; route: ReadRoute; query: ParsedQuery }

/**
 * D1 は呼ばない。
 * 検証を通過した参照は未実装であり、空一覧や 404 や 503 には分類しない。
 */
export function planReadApi(request: Request): ReadPlan {
  const recognized = recognizeReadRoute(request.url)
  if (recognized.kind === 'outside') {
    return { type: 'outside' }
  }
  if (recognized.kind === 'invalid_encoding') {
    return { type: 'invalid_request' }
  }
  if (recognized.kind === 'unmatched') {
    return { type: 'not_found' }
  }
  if (request.method !== 'GET') {
    return { type: 'method_not_allowed' }
  }

  const parsed = parseReadQuery(request.url, recognized.route)
  if (!parsed.ok && parsed.reason === 'unspecified') {
    return { type: 'unspecified' }
  }
  if (!parsed.ok) {
    return { type: 'invalid_request' }
  }
  return { type: 'not_implemented', route: recognized.route, query: parsed.query }
}

/**
 * 仕様に「未実装」と「limit / offset の重複」のステータスが無い。
 * 空の items、404、503 にはしない。完成した参照の成功応答でもない。
 * 本文は共通の internal_error に留め、重複規則や SQL は出さない。
 */
export function provisionalHoldResponse(): Response {
  return errorResponse('internal_error')
}

export function responseForReadPlan(plan: ReadPlan): Response | null {
  switch (plan.type) {
    case 'outside':
      return null
    case 'invalid_request':
      return errorResponse('invalid_request')
    case 'not_found':
      return errorResponse('not_found')
    case 'method_not_allowed':
      return errorResponse('method_not_allowed', { allow: 'GET' })
    case 'unspecified':
    case 'not_implemented':
      return provisionalHoldResponse()
    default: {
      const unreachable: never = plan
      return unreachable
    }
  }
}

export function respondToReadApi(
  request: Request,
  plan: (request: Request) => ReadPlan = planReadApi,
): Response | null {
  try {
    return responseForReadPlan(plan(request))
  } catch {
    return internalErrorResponse()
  }
}
