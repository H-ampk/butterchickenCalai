import type { ServiceFailure } from './types.ts'

const RETRYABLE_CLIENT_STATUSES = new Set([408, 425, 429])

/**
 * ライブラリ自身が取得失敗を再試行する。ここでは追加の再試行をしない。
 * 5xx、408、425、429 は再試行可能。404 と、ステータスが分からない失敗は再試行しない。
 *
 * `status` が 100〜599 の整数ならそれを使う。無いときだけ、メッセージ末尾の
 * 「: 404」のように、このモジュールが扱う HTTP エラーの書き方だけを読む。
 * 「timeout after 300 ms」のような時間や住所中の数字はステータスにしない。
 */
export function describeServiceFailure(error: unknown): ServiceFailure {
  const status = structuredStatus(error)
  if (status !== null) {
    return failureForStatus(status)
  }
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (name === 'TimeoutError' || name === 'AbortError' || /timeout/i.test(message)) {
    return { kind: 'timeout', retryable: true }
  }
  if (/network|connection lost|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return { kind: 'network', retryable: true }
  }
  const messageStatus = statusInMessage(message)
  if (messageStatus !== null) {
    return failureForStatus(messageStatus)
  }
  return { kind: 'upstream', retryable: false }
}

function failureForStatus(status: number): ServiceFailure {
  const retryable = (status >= 500 && status <= 599) || RETRYABLE_CLIENT_STATUSES.has(status)
  return { kind: 'upstream', retryable }
}

function structuredStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return null
  }
  const status = error.status
  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) {
    return status
  }
  return null
}

function statusInMessage(message: string): number | null {
  const match = /:\s*(404|408|425|429|5\d{2})\s*$/.exec(message)
  if (!match) {
    return null
  }
  return Number(match[1])
}
