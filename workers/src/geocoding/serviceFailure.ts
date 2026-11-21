import type { ServiceFailure } from './types.ts'

/**
 * ライブラリ自身が取得失敗を再試行する。ここでは追加の再試行をしない。
 * 408、425、429、5xx は再試行可能。404 と判別できない失敗は再試行しない。
 */
export function describeServiceFailure(error: unknown): ServiceFailure {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (name === 'TimeoutError' || name === 'AbortError' || /timeout/i.test(message)) {
    return { kind: 'timeout', retryable: true }
  }
  if (/network|connection lost|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return { kind: 'network', retryable: true }
  }
  if (/\b(408|425|429|500|502|503|504)\b/.test(message)) {
    return { kind: 'upstream', retryable: true }
  }
  return { kind: 'upstream', retryable: false }
}
