import type { Shop } from '../types/shop.ts'
import { normalizeSearchText } from '../../../workers/src/searchText.ts'

/**
 * 店舗名と住所の部分一致。
 * 条件は後から ShopFilter に足せるように、座標判定とは分けている。
 */
export function searchShops(shops: readonly Shop[], query: string): Shop[] {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === '') {
    return shops.slice()
  }

  return shops.filter((shop) => {
    const name = normalizeSearchText(shop.name)
    const address = normalizeSearchText(shop.address)
    return name.includes(normalizedQuery) || address.includes(normalizedQuery)
  })
}

export interface ShopFilter {
  query?: string
  hasCoordinates?: boolean
}

/**
 * 店舗名と住所の検索と、座標の有無を組み合わせる。
 * query や hasCoordinates が無い条件は適用しない。複数の条件は両方を満たす店舗だけを残す。
 */
export function filterShops(shops: readonly Shop[], filter: ShopFilter): Shop[] {
  const matched =
    filter.query === undefined ? shops.slice() : searchShops(shops, filter.query)

  if (filter.hasCoordinates === undefined) {
    return matched
  }

  return matched.filter((shop) => hasValidCoordinates(shop) === filter.hasCoordinates)
}

/** 緯度と経度がどちらも有限で、それぞれの範囲内のときだけ真。 */
function hasValidCoordinates(shop: Shop): boolean {
  return isValidLatitude(shop.latitude) && isValidLongitude(shop.longitude)
}

/** 有限な数であり、-90 以上 90 以下か。 */
function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

/** 有限な数であり、-180 以上 180 以下か。 */
function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}
