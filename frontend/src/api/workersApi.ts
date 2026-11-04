/**
 * Cloudflare Workers への参照通信。
 *
 * パスは Issue #42 で未合意。次の定数は草案の候補であり、確定した仕様ではない。
 * 合意後は定数だけを差し替える。
 * クエリの limit と offset は既定値が未合意のため、ここでは付けない。
 */
export const PROVISIONAL_SHOP_LIST_PATH = '/shops'
export const PROVISIONAL_DISCOUNT_LIST_PATH = '/discounts'

export type DataSourceMode = 'mock' | 'api'

export class DataSourceConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataSourceConfigError'
  }
}

export class ApiHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Workers APIが HTTP ${status} を返しました。`)
    this.name = 'ApiHttpError'
    this.status = status
  }
}

export class ApiNetworkError extends Error {
  constructor(cause: unknown) {
    super('Workers APIへの通信に失敗しました。', { cause })
    this.name = 'ApiNetworkError'
  }
}

export class ApiJsonError extends Error {
  constructor(cause: unknown) {
    super('Workers APIの応答を JSON として読めませんでした。', { cause })
    this.name = 'ApiJsonError'
  }
}

export class ApiResponseShapeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiResponseShapeError'
  }
}

/** 未設定はモック。mock と api 以外はエラーにし、失敗時にモックへは戻さない。 */
export function resolveDataSource(): DataSourceMode {
  const raw = readSetting('VITE_DATA_SOURCE')
  if (raw === undefined) {
    return 'mock'
  }
  if (raw === 'mock' || raw === 'api') {
    return raw
  }
  throw new DataSourceConfigError(
    `VITE_DATA_SOURCE の値「${raw}」は不正です。mock または api を指定してください。`,
  )
}

/** APIモードのときだけ呼ぶ。本番URLは埋め込まない。 */
export function resolveApiBaseUrl(): string {
  const raw = readSetting('VITE_API_BASE_URL')
  if (raw === undefined || raw.trim() === '') {
    throw new DataSourceConfigError(
      'VITE_API_BASE_URL が空です。APIモードでは Workers の基底URLが必要です。',
    )
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new DataSourceConfigError('VITE_API_BASE_URL を URL として解釈できません。')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new DataSourceConfigError('VITE_API_BASE_URL は http または https である必要があります。')
  }
  return raw
}

/**
 * 草案の一覧オブジェクトから items を取り出す。
 * 配列をそのまま返す形は Issue #42 で未合意のため、その応答は形式不一致にする。
 * 通信失敗を空配列にはしない。
 */
export async function fetchProvisionalList(path: string): Promise<unknown[]> {
  const url = joinApiUrl(resolveApiBaseUrl(), path)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  } catch (cause) {
    throw new ApiNetworkError(cause)
  }

  if (!response.ok) {
    throw new ApiHttpError(response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (cause) {
    throw new ApiJsonError(cause)
  }

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new ApiResponseShapeError(
      '一覧レスポンスには items 配列が必要です。',
    )
  }

  return payload.items
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function joinApiUrl(base: string, path: string): string {
  const url = new URL(base)
  const suffix = path.replace(/^\/+/, '')
  const prefix = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
  url.pathname = `${prefix}${suffix}`
  return url.toString()
}

function readSetting(name: 'VITE_DATA_SOURCE' | 'VITE_API_BASE_URL'): string | undefined {
  const fromVite = readVite(name)
  if (fromVite !== undefined) {
    return fromVite
  }
  return readProcess(name)
}

function readVite(name: 'VITE_DATA_SOURCE' | 'VITE_API_BASE_URL'): string | undefined {
  try {
    // プロパティアクセスは静的なままにする。Vite がビルド時に値へ置き換える。
    // Node のテストでは import.meta.env が無く、ここは失敗して process.env へ進む。
    const value =
      name === 'VITE_DATA_SOURCE'
        ? import.meta.env.VITE_DATA_SOURCE
        : import.meta.env.VITE_API_BASE_URL
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

function readProcess(name: 'VITE_DATA_SOURCE' | 'VITE_API_BASE_URL'): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  const value = proc?.env?.[name]
  return typeof value === 'string' ? value : undefined
}
