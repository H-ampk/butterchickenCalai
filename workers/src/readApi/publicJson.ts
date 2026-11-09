import { hasValidShopCoordinates } from './shopVisibility.ts'
import { readStoredUtcInstant } from './utcInstant.ts'

/**
 * D1 の snake_case 行を公開 JSON の形にする。
 * createdAt と updatedAt は公開するか未決定なので、ここには出さない。
 * name_search、address_search、SQL の情報も出さない。
 *
 * 列名は api-contract.md の snake_case に合わせた読み取り用の形。
 * 未マージの migration の全列には依存しない。余分な列は無視する。
 */

export type ShopSourceRow = {
  id: unknown
  name: unknown
  address: unknown
  latitude: unknown
  longitude: unknown
  created_at: unknown
  updated_at?: unknown
  name_search?: unknown
  address_search?: unknown
  [extra: string]: unknown
}

export type DiscountSourceRow = {
  id: unknown
  shop_id: unknown
  subject: unknown
  content: unknown
  starts_at: unknown
  ends_at: unknown
  created_at: unknown
  updated_at?: unknown
  [extra: string]: unknown
}

/** 公開店舗。並び順用の created_at は持たない。 */
export type PublicShop = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}

/**
 * 公開割引。販売期間の位置はこの形には含めない。
 * subject と content の null は保存値のまま残す。空文字へは置き換えない。
 */
export type PublicDiscount = {
  id: string
  shopId: string
  subject: string | null
  content: string | null
  startsAt: string | null
  endsAt: string | null
}

export type SortablePublic<T> = {
  id: string
  created_at: string
  body: T
}

function nonEmptyId(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }
  return value
}

/**
 * 公開 JSON の店舗名と住所は文字列。
 * null は空文字にする。座標が有効な店舗を、名前が空だからという理由で落とさないため。
 * 文字列でも null でもない値は、公開している例の形にできないので null を返す。
 */
function publicShopText(value: unknown): string | null {
  if (value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  return null
}

function sortCreatedAt(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 座標が無効、または公開 JSON にできない行は null。 */
export function toPublicShop(row: ShopSourceRow): SortablePublic<PublicShop> | null {
  if (!hasValidShopCoordinates(row.latitude, row.longitude)) {
    return null
  }
  const id = nonEmptyId(row.id)
  const name = publicShopText(row.name)
  const address = publicShopText(row.address)
  if (id === null || name === null || address === null) {
    return null
  }
  if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') {
    return null
  }
  return {
    id,
    created_at: sortCreatedAt(row.created_at),
    body: {
      id,
      name,
      address,
      latitude: row.latitude,
      longitude: row.longitude,
    },
  }
}

function publicDiscountText(value: unknown): string | null | undefined {
  if (value === null) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  return undefined
}

/**
 * 保存値を公開割引の JSON にする。
 * 店舗の公開と、いま一覧に出すかは見ない。呼び出し側が判定した行だけを渡す。
 * 本文が無い、日時が不正、開始が終了以降、識別子が空のときは null。
 * 開始前と終了済みは、ここでは落とさない。
 */
export function toPublicDiscount(row: DiscountSourceRow): SortablePublic<PublicDiscount> | null {
  const id = nonEmptyId(row.id)
  const shopId = nonEmptyId(row.shop_id)
  const subject = publicDiscountText(row.subject)
  const content = publicDiscountText(row.content)
  const starts = readStoredUtcInstant(row.starts_at)
  const ends = readStoredUtcInstant(row.ends_at)
  if (
    id === null ||
    shopId === null ||
    subject === undefined ||
    content === undefined ||
    starts.kind === 'invalid' ||
    ends.kind === 'invalid'
  ) {
    return null
  }
  if (starts.kind === 'instant' && ends.kind === 'instant' && starts.ms >= ends.ms) {
    return null
  }
  const subjectText = subject === null ? '' : subject.trim()
  const contentText = content === null ? '' : content.trim()
  if (subjectText === '' && contentText === '') {
    return null
  }
  return {
    id,
    created_at: sortCreatedAt(row.created_at),
    body: {
      id,
      shopId,
      subject,
      content,
      startsAt: starts.kind === 'absent' ? null : starts.text,
      endsAt: ends.kind === 'absent' ? null : ends.text,
    },
  }
}
