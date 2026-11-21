import type { ServiceFailure } from './types.ts'

const RETRYABLE_STATUSES = new Set([408, 425, 429])

/**
 * ライブラリ自身が取得失敗を再試行する。ここでは追加の再試行をしない。
 * 5xx、408、425、429 は再試行可能。404 と、ステータスが分からない失敗は再試行しない。
 *
 * ライブラリの例外に HTTP ステータス用のプロパティは無い。`status` がある場合だけそれを使い、
 * 無い場合はメッセージ中の独立した3桁を見る。住所やファイル名に同じ数字があると誤る。
 * 複数あるときは最初の一つだけを見る。
 */
export function describeServiceFailure(error: unknown): ServiceFailure {
  const status = structuredStatus(error) ?? statusInMessage(error)
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
  return { kind: 'upstream', retryable: false }
}

function failureForStatus(status: number): ServiceFailure {
  const retryable = (status >= 500 && status <= 599) || RETRYABLE_STATUSES.has(status)
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

function statusInMessage(error: unknown): number | null {
  if (!(error instanceof Error)) {
    return null
  }
  const match = /\b([1-5]\d{2})\b/.exec(error.message)
  if (!match) {
    return null
  }
  return Number(match[1])
}
