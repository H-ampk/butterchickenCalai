import { executeReadyRead, type ReadDatabase } from './d1Read.ts'
import { errorResponse, internalErrorResponse } from './errors.ts'
import { parseReadQuery, type ParsedQuery } from './parseQuery.ts'
import { recognizeReadRoute, type ReadRoute } from './recognizeRoute.ts'

export type ReadPlan =
  | { type: 'outside' }
  | { type: 'invalid_request' }
  | { type: 'not_found' }
  | { type: 'method_not_allowed' }
  | { type: 'ready'; route: ReadRoute; query: ParsedQuery }

/**
 * D1 は呼ばない。
 * 検証を通過した参照は ready。実行は executeReadyRead が行う。
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
  if (!parsed.ok) {
    return { type: 'invalid_request' }
  }
  return { type: 'ready', route: recognized.route, query: parsed.query }
}

/**
 * 読み取りの計画を HTTP 応答にする。
 * `/api/v1` の外は null を返し、静的アセットへ渡す。
 * ready は D1 実行が必要なので、この関数では応答にしない。
 */
export function responseForReadPlan(plan: Exclude<ReadPlan, { type: 'ready' }>): Response | null {
  switch (plan.type) {
    case 'outside':
      return null
    case 'invalid_request':
      return errorResponse('invalid_request')
    case 'not_found':
      return errorResponse('not_found')
    case 'method_not_allowed':
      return errorResponse('method_not_allowed', { allow: 'GET' })
    default: {
      const unreachable: never = plan
      return unreachable
    }
  }
}

export type ReadApiOptions = {
  plan?: (request: Request) => ReadPlan
  database?: ReadDatabase
  /** 販売期間の基準時刻。未指定のときは現在時刻。 */
  now?: Date
}

/**
 * 参照 API の入口。経路外は null。
 * 計画の作成で例外が出たときは、例外文を含めない internal_error を返す。
 * 検証済みの GET は database から読む。バインディングが無いときは 500。
 */
export async function respondToReadApi(request: Request, options: ReadApiOptions = {}): Promise<Response | null> {
  try {
    const plan = (options.plan ?? planReadApi)(request)
    if (plan.type !== 'ready') {
      return responseForReadPlan(plan)
    }
    return await executeReadyRead(plan, options.database, options.now ?? new Date())
  } catch {
    return internalErrorResponse()
  }
}
