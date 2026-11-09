import { hasValidShopCoordinates } from './shopVisibility.ts'
import { classifySaleWindow } from './utcInstant.ts'

/**
 * 割引の公開判定。
 * 保存データとして読めること、紐づく店舗が公開できること、販売期間の位置を分けて返す。
 * 戻り値は内部の分類であり、外部 API の status や error.code には使わない。
 */

export type DiscountPhase = 'before' | 'during' | 'after'

export type DiscountVisibilityKind = 'invalid-stored' | 'unpublished-shop' | DiscountPhase

export type DiscountVisibilityInput = {
  subject: unknown
  content: unknown
  startsAt: unknown
  endsAt: unknown
  /** 店舗行が無いときは null。座標が無効な店舗も公開条件を満たさない。 */
  shop: { latitude: unknown; longitude: unknown } | null
}

/** 通常一覧と店舗別一覧に含めるか。販売中だけ。 */
export function isNormalListDiscount(kind: DiscountVisibilityKind): boolean {
  return kind === 'during'
}

/** 詳細で 200 にできるか。販売中と、他の公開条件を満たす終了済み。 */
export function isDetailDiscount(kind: DiscountVisibilityKind): boolean {
  return kind === 'during' || kind === 'after'
}

/**
 * 保存データとして公開条件を満たすか。
 * 開始前も、形式と店舗が正当ならここに含める。通常一覧に出すという意味ではない。
 */
export function isStoredDiscountPublishable(kind: DiscountVisibilityKind): boolean {
  return kind === 'before' || kind === 'during' || kind === 'after'
}

function isTextField(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

/** null と trim 後の空文字は本文なし。文字列以外は不正な保存値。 */
function hasPublishableText(subject: unknown, content: unknown): boolean {
  if (!isTextField(subject) || !isTextField(content)) {
    return false
  }
  const subjectText = subject === null ? '' : subject.trim()
  const contentText = content === null ? '' : content.trim()
  return subjectText !== '' || contentText !== ''
}

/**
 * 不正な保存値を、店舗非公開や販売期間より先に返す。
 * nowMs は一覧の処理全体で同じ値を渡す。
 */
export function classifyDiscountVisibility(
  input: DiscountVisibilityInput,
  nowMs: number,
): DiscountVisibilityKind {
  if (!Number.isFinite(nowMs)) {
    throw new TypeError('now must be a finite timestamp')
  }
  if (!hasPublishableText(input.subject, input.content)) {
    return 'invalid-stored'
  }
  const window = classifySaleWindow(input.startsAt, input.endsAt, nowMs)
  if (window === 'invalid') {
    return 'invalid-stored'
  }
  if (input.shop === null || !hasValidShopCoordinates(input.shop.latitude, input.shop.longitude)) {
    return 'unpublished-shop'
  }
  return window
}
