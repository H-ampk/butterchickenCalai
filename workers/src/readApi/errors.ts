/**
 * 読み取り API の共通エラー。
 * 本文は `error.code` と `error.message` だけにする。
 * 項目ごとの details、内部例外、SQL、接続情報は入れない。
 */
export type ReadErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'method_not_allowed'
  | 'internal_error'
  | 'service_unavailable'

const READ_ERROR_STATUS: Record<ReadErrorCode, number> = {
  invalid_request: 400,
  not_found: 404,
  method_not_allowed: 405,
  internal_error: 500,
  service_unavailable: 503,
}

const READ_ERROR_MESSAGE: Record<ReadErrorCode, string> = {
  invalid_request: 'リクエストの内容が不正です。',
  not_found: '対象のリソースが見つかりません。',
  method_not_allowed: 'このメソッドは許可されていません。',
  internal_error: 'サーバー内部で処理できませんでした。',
  service_unavailable: 'データベースに接続できません。',
}

/**
 * 共通エラー JSON を返す。
 * `code` に対応する HTTP ステータスと固定の `message` だけを載せる。追加ヘッダは `extraHeaders`。
 */
export function errorResponse(code: ReadErrorCode, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  return new Response(
    JSON.stringify({
      error: {
        code,
        message: READ_ERROR_MESSAGE[code],
      },
    }),
    { status: READ_ERROR_STATUS[code], headers },
  )
}

/** 捕捉した例外の message は捨てる。 */
export function internalErrorResponse(): Response {
  return errorResponse('internal_error')
}
