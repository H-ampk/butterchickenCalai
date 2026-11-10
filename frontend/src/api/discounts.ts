import type { Discount } from '../types/discount.ts'
import { classifyDiscountForNormalList } from './discountPeriod.ts'
import { readFetchedOrigin, tagFetchedRecords, type ListOrigin } from './listOrigin.ts'
import { mockDiscounts } from './mockDiscounts.ts'
import {
  ApiResponseShapeError,
  DISCOUNT_LIST_PATH,
  fetchProvisionalList,
  isRecord,
  resolveDataSource,
} from './workersApi.ts'

export { classifyDiscountForNormalList }
export type { NormalDiscountListDecision } from './discountPeriod.ts'

/**
 * 割引の取得口。画面の一覧は今回作らない。
 * API モードのパスは GET /api/v1/discounts。
 * 販売終了後の行は消さない。通常一覧に出すかは classifyDiscountForNormalList で判定する。
 */
export async function getDiscounts(): Promise<Discount[]> {
  const source = resolveDataSource()
  if (source === 'mock') {
    return tagFetchedRecords(
      mockDiscounts.map((discount) => ({ ...discount })),
      'mock',
    )
  }

  const items = await fetchProvisionalList(DISCOUNT_LIST_PATH)
  return tagFetchedRecords(items.map((item) => parseDiscount(item)), 'api')
}

export function getDiscountListOrigin(discounts: readonly Discount[]): ListOrigin | undefined {
  return readFetchedOrigin(discounts)
}

export function getDiscountOrigin(discount: Discount): ListOrigin | undefined {
  return readFetchedOrigin(discount)
}

/**
 * 草案の割引オブジェクトを読む。
 * 日時の省略と null を同じに扱うかは未決定のため、項目が無いものを null にはしない。
 */
function parseDiscount(value: unknown): Discount {
  if (!isRecord(value)) {
    throw new ApiResponseShapeError('割引の要素がオブジェクトではありません。')
  }
  const discount: Discount = {
    id: requiredString(value, 'id'),
    shopId: requiredString(value, 'shopId'),
    subject: requiredNullableString(value, 'subject'),
    content: requiredNullableString(value, 'content'),
    startsAt: requiredNullableString(value, 'startsAt'),
    endsAt: requiredNullableString(value, 'endsAt'),
  }
  const createdAt = optionalString(value, 'createdAt')
  const updatedAt = optionalString(value, 'updatedAt')
  if (createdAt !== undefined) {
    discount.createdAt = createdAt
  }
  if (updatedAt !== undefined) {
    discount.updatedAt = updatedAt
  }
  return discount
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  if (!Object.hasOwn(record, key)) {
    return undefined
  }
  const value = record[key]
  if (typeof value !== 'string') {
    throw new ApiResponseShapeError(`割引の ${key} が文字列ではありません。`)
  }
  return value
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new ApiResponseShapeError(`割引の ${key} が文字列ではありません。`)
  }
  return value
}

function requiredNullableString(record: Record<string, unknown>, key: string): string | null {
  if (!Object.hasOwn(record, key)) {
    throw new ApiResponseShapeError(
      `割引の ${key} がありません。省略と null を同じに扱うかは未決定のため、null には置き換えません。`,
    )
  }
  const value = record[key]
  if (value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new ApiResponseShapeError(`割引の ${key} が文字列または null ではありません。`)
  }
  return value
}
