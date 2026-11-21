import * as geolonia from '@geolonia/normalize-japanese-addresses'

type FetchOptions = {
  offset?: number
  length?: number
}

type HttpHandler = (fileURL: URL, options?: FetchOptions) => Promise<Response>

/**
 * Node 向けの公開入口だけが `requestHandlers` を出す。
 * Workers が読む入口には取得関数の差し替えが無い。
 */
function nodeHttpHandlers(): { http: HttpHandler } | null {
  const exported = geolonia as unknown as { requestHandlers?: { http?: HttpHandler } }
  const handlers = exported.requestHandlers
  if (!handlers?.http) {
    return null
  }
  return handlers as { http: HttpHandler }
}

function upstreamStatus(status: number): Error {
  return Object.assign(new Error(`住所データの取得に失敗しました: ${status}`), { status })
}

function invalidBody(expected: number, actual: number): Error {
  return new Error(`住所データが壊れています: 期待 ${expected} バイト、実際 ${actual} バイト`)
}

function byteLength(body: string): number {
  return new TextEncoder().encode(body).length
}

async function rejectBadAddressResponse(response: Response, expectedLength: number | null): Promise<Response> {
  if (!response.ok) {
    throw upstreamStatus(response.status)
  }
  if (expectedLength === null) {
    return response
  }
  const body = await response.text()
  const actual = byteLength(body)
  if (actual !== expectedLength) {
    throw invalidBody(expectedLength, actual)
  }
  return new Response(body, { status: response.status, headers: response.headers })
}

function rangeLength(init: RequestInit | undefined): number | null {
  const headers = new Headers(init?.headers)
  const range = headers.get('Range')
  const match = /^bytes=(\d+)-(\d+)$/.exec(range ?? '')
  if (!match) {
    return null
  }
  return Number(match[2]) - Number(match[1]) + 1
}

function isAddressRequest(input: RequestInfo | URL): boolean {
  const endpoint = geolonia.config.japaneseAddressesApi
  const url = input instanceof Request ? input.url : input.toString()
  return url.startsWith(endpoint)
}

let depth = 0
let restore: (() => void) | null = null

function install(): () => void {
  const originalFetch = globalThis.fetch
  const guardedFetch: typeof fetch = async (input, init) => {
    const response = await originalFetch(input, init)
    if (!isAddressRequest(input)) {
      return response
    }
    return rejectBadAddressResponse(response, rangeLength(init))
  }
  globalThis.fetch = guardedFetch

  const handlers = nodeHttpHandlers()
  const originalHttp = handlers?.http
  if (handlers && originalHttp) {
    handlers.http = async (fileURL, options) => {
      const response = await originalHttp(fileURL, options)
      const expected = typeof options?.length === 'number' ? options.length : null
      return rejectBadAddressResponse(response, expected)
    }
  }

  return () => {
    globalThis.fetch = originalFetch
    if (handlers && originalHttp) {
      handlers.http = originalHttp
    }
  }
}

/**
 * 住所データ取得のあいだだけ、設定された API の非2xxと長さの違う本文を失敗にする。
 * ライブラリが本文をキャッシュする前に例外へする。ほかの通信は渡す。
 */
export async function withGuardedAddressFetch<T>(action: () => Promise<T>): Promise<T> {
  if (depth === 0) {
    restore = install()
  }
  depth += 1
  try {
    return await action()
  } finally {
    depth -= 1
    if (depth === 0 && restore) {
      restore()
      restore = null
    }
  }
}
