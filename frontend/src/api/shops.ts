import type { Shop } from '../types/shop.ts'
import { readFetchedOrigin, tagFetchedRecords, type ListOrigin } from './listOrigin.ts'
import { mockShops } from './mockShops.ts'
import {
  ApiResponseShapeError,
  PROVISIONAL_SHOP_LIST_PATH,
  fetchProvisionalList,
  isRecord,
  resolveDataSource,
} from './workersApi.ts'

/**
 * 画面はこの関数だけを使う。戻り値はこれまで通り Shop[]。
 * 既定はモック。VITE_DATA_SOURCE=api のときだけ Workers の仮パスへ通信する。
 * 通信に失敗してもモックへは切り替えない。
 */
export async function getShops(): Promise<Shop[]> {
  const source = resolveDataSource()
  if (source === 'mock') {
    return tagFetchedRecords(
      mockShops.map((shop) => ({ ...shop })),
      'mock',
    )
  }

  const items = await fetchProvisionalList(PROVISIONAL_SHOP_LIST_PATH)
  return tagFetchedRecords(items.map((item) => parseShop(item)), 'api')
}

export function getShopListOrigin(shops: readonly Shop[]): ListOrigin | undefined {
  return readFetchedOrigin(shops)
}

export function getShopOrigin(shop: Shop): ListOrigin | undefined {
  return readFetchedOrigin(shop)
}

/**
 * 現行の Shop 型だけを取り出す。
 * createdAt と updatedAt をレスポンスの必須にするかは Issue #42 で未決定のため、要求しない。
 */
function parseShop(value: unknown): Shop {
  if (!isRecord(value)) {
    throw new ApiResponseShapeError('店舗の要素がオブジェクトではありません。')
  }
  const { id, name, address, latitude, longitude } = value
  if (typeof id !== 'string' || typeof name !== 'string' || typeof address !== 'string') {
    throw new ApiResponseShapeError('店舗の id、name、address は文字列である必要があります。')
  }
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude)
  ) {
    throw new ApiResponseShapeError('店舗の latitude と longitude は有限な数である必要があります。')
  }
  return { id, name, address, latitude, longitude }
}
