import { utcSecondTimestampMs } from '../utcTimestamp.ts'

/**
 * 保存された UTC 日時。形式は YYYY-MM-DDTHH:mm:ssZ だけを正当とする。
 * 妥当性は utcSecondTimestampMs と同じ。現在時刻は引数でのみ受け取る。
 */

export type StoredUtcInstant =
  | { kind: 'absent' }
  | { kind: 'invalid' }
  | { kind: 'instant'; text: string; ms: number }

export type SaleWindow = 'invalid' | 'before' | 'during' | 'after'

/** 注入された現在時刻をミリ秒にする。有限でない時刻は呼び出し側の不備として拒否する。 */
export function instantMs(now: Date): number {
  const ms = now.getTime()
  if (!Number.isFinite(ms)) {
    throw new TypeError('now must be a finite timestamp')
  }
  return ms
}

/**
 * null は開始・終了の制限なし。文字列だけを保存形式として読む。
 * オフセット、小数秒、タイムゾーン無し、符号付きの年、存在しない暦日は invalid。
 */
export function readStoredUtcInstant(value: unknown): StoredUtcInstant {
  if (value === null) {
    return { kind: 'absent' }
  }
  if (typeof value !== 'string') {
    return { kind: 'invalid' }
  }
  const ms = utcSecondTimestampMs(value)
  if (ms === null) {
    return { kind: 'invalid' }
  }
  return { kind: 'instant', text: value, ms }
}

/**
 * 販売期間。startsAt <= now < endsAt。
 * null の境界は適用しない。両方が値を持ち startsAt >= endsAt なら不正な保存データ。
 */
export function classifySaleWindow(startsAt: unknown, endsAt: unknown, nowMs: number): SaleWindow {
  if (!Number.isFinite(nowMs)) {
    throw new TypeError('now must be a finite timestamp')
  }
  const starts = readStoredUtcInstant(startsAt)
  const ends = readStoredUtcInstant(endsAt)
  if (starts.kind === 'invalid' || ends.kind === 'invalid') {
    return 'invalid'
  }
  if (starts.kind === 'instant' && ends.kind === 'instant' && starts.ms >= ends.ms) {
    return 'invalid'
  }
  if (starts.kind === 'instant' && nowMs < starts.ms) {
    return 'before'
  }
  if (ends.kind === 'instant' && nowMs >= ends.ms) {
    return 'after'
  }
  return 'during'
}
