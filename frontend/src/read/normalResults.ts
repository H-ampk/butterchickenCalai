import type { Discount } from '../types/discount.ts'
import type { Shop } from '../types/shop.ts'
import { filterShops } from '../utils/shopSearch.ts'

/**
 * Issue #45 の Workers / D1 参照APIではない。
 * パス、HTTPステータス、D1の列名は未合意なので、公開APIにもD1にも接続しない。
 * 販売期間で割引を除く処理は Issue #50 の責務であり、ここでは行わない。
 */

export class CatalogReadFailure extends Error {
  constructor(cause: unknown) {
    super('参照データの読み取りに失敗しました。', { cause })
    this.name = 'CatalogReadFailure'
  }
}

export interface RowReader<T> {
  readRows(): Promise<readonly T[]>
}

/** 0件は空配列。読み取りの失敗は空配列にしない。 */
export async function readRowsOrFail<T extends object>(reader: RowReader<T>): Promise<T[]> {
  try {
    const rows = await reader.readRows()
    return rows.map((row) => ({ ...row }))
  } catch (cause) {
    throw new CatalogReadFailure(cause)
  }
}

/**
 * 通常結果に出す店舗。座標の有効判定は既存の filterShops を使う。
 * 登録経路は見ない。無効な座標は含めない。
 */
export function shopsForNormalResults(shops: readonly Shop[]): Shop[] {
  return filterShops(shops, { hasCoordinates: true }).map((shop) => ({ ...shop }))
}

export async function readNormalShops(reader: RowReader<Shop>): Promise<Shop[]> {
  const rows = await readRowsOrFail(reader)
  return shopsForNormalResults(rows)
}

/** 保存されている店舗をIDで探す。見つからなくても例外にはしない。HTTPステータスは未合意。 */
export function findStoredShop(shops: readonly Shop[], id: string): Shop | undefined {
  const found = shops.find((shop) => shop.id === id)
  if (found === undefined) {
    return undefined
  }
  return { ...found }
}

export interface StoredShopRecord {
  shop: Shop
  registrationChannel?: string
}

/** 登録経路がGmailかどうかでは通常結果を分けない。 */
export function shopsForNormalResultsIgnoringChannel(
  records: readonly StoredShopRecord[],
): Shop[] {
  return shopsForNormalResults(records.map((record) => record.shop))
}

/**
 * 店舗に紐づく割引を返す。終了済みも残す。
 * 通常一覧へ出すかの期間判定は classifyDiscountForNormalList と Issue #50 に任せる。
 */
export function discountsForShop(discounts: readonly Discount[], shopId: string): Discount[] {
  return discounts.filter((discount) => discount.shopId === shopId).map((discount) => ({ ...discount }))
}

export function findStoredDiscount(
  discounts: readonly Discount[],
  id: string,
): Discount | undefined {
  const found = discounts.find((discount) => discount.id === id)
  if (found === undefined) {
    return undefined
  }
  return { ...found }
}
