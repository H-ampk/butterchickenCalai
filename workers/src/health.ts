/** ローカル開発用。店舗・割引 API の契約パスではない。 */
export const HEALTH_PATH = '/__health'

/** スキーマを必要としない読み取り。店舗・割引テーブルは参照しない。 */
export const HEALTH_CHECK_SQL = 'SELECT 1 AS ok'

export interface HealthStatement {
  first<T>(): Promise<T | null>
}

export interface HealthDatabase {
  prepare(query: string): HealthStatement
}

type HealthSuccess = {
  status: 'ok'
  database: 'connected'
}

type HealthFailure = {
  status: 'error'
  database: 'unavailable'
}

function json(body: HealthSuccess | HealthFailure | { status: 'error' }, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * D1 へ `SELECT 1` を送り、接続の成否だけを返す。
 * 失敗時の本文に SQL と例外の詳細は含めない。
 */
export async function handleHealth(request: Request, database: HealthDatabase | undefined): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ status: 'error' }, 405)
  }

  if (!database) {
    return json({ status: 'error', database: 'unavailable' }, 503)
  }

  try {
    const row = await database.prepare(HEALTH_CHECK_SQL).first<{ ok: number }>()
    if (row === null || Number(row.ok) !== 1) {
      return json({ status: 'error', database: 'unavailable' }, 503)
    }
    return json({ status: 'ok', database: 'connected' }, 200)
  } catch {
    return json({ status: 'error', database: 'unavailable' }, 503)
  }
}
