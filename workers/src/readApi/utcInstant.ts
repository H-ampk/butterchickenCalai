/**
 * 保存された UTC 日時。形式は YYYY-MM-DDTHH:mm:ssZ だけを正当とする。
 * 現在時刻は引数でのみ受け取る。
 */

const UTC_SECOND = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/

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
 * オフセット、小数秒、タイムゾーン無し、存在しない暦日は invalid。
 */
export function readStoredUtcInstant(value: unknown): StoredUtcInstant {
  if (value === null) {
    return { kind: 'absent' }
  }
  if (typeof value !== 'string' || value.length !== 20) {
    return { kind: 'invalid' }
  }
  const match = UTC_SECOND.exec(value)
  if (match === null) {
    return { kind: 'invalid' }
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return { kind: 'invalid' }
  }
  const ms = Date.UTC(year, month - 1, day, hour, minute, second)
  const parsed = new Date(ms)
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second
  ) {
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
