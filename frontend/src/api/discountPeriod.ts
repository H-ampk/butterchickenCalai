import type { Discount } from '../types/discount.ts'

/**
 * 通常一覧に出すかの判定。
 * 決定済みの方針だけを使う。次は Issue #42 で未決定なので、含めも除外もしない。
 * - endsAt ちょうどを販売中に含めるか
 * - startsAt が null のときの意味
 * 開始ちょうどは「開始前ではない」ため通常一覧に含める。この境界は未決定事項に書かれていない。
 */
export type NormalDiscountListDecision =
  | { kind: 'include' }
  | { kind: 'exclude'; reason: 'not-started' | 'ended' }
  | { kind: 'undecided'; reason: 'starts-at-null' | 'ends-at-boundary' | 'invalid-datetime' }

export function classifyDiscountForNormalList(
  discount: Discount,
  now: Date,
): NormalDiscountListDecision {
  const nowMs = now.getTime()
  if (!Number.isFinite(nowMs)) {
    return { kind: 'undecided', reason: 'invalid-datetime' }
  }

  const ends = readInstant(discount.endsAt)
  if (ends.kind === 'invalid') {
    return { kind: 'undecided', reason: 'invalid-datetime' }
  }
  if (ends.kind === 'instant' && ends.ms < nowMs) {
    return { kind: 'exclude', reason: 'ended' }
  }
  if (ends.kind === 'instant' && ends.ms === nowMs) {
    return { kind: 'undecided', reason: 'ends-at-boundary' }
  }

  const starts = readInstant(discount.startsAt)
  if (starts.kind === 'missing') {
    return { kind: 'undecided', reason: 'starts-at-null' }
  }
  if (starts.kind === 'invalid') {
    return { kind: 'undecided', reason: 'invalid-datetime' }
  }
  if (starts.ms > nowMs) {
    return { kind: 'exclude', reason: 'not-started' }
  }

  return { kind: 'include' }
}

type InstantRead =
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'instant'; ms: number }

function readInstant(value: string | null): InstantRead {
  if (value === null) {
    return { kind: 'missing' }
  }
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return { kind: 'invalid' }
  }
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) {
    return { kind: 'invalid' }
  }
  return { kind: 'instant', ms }
}
