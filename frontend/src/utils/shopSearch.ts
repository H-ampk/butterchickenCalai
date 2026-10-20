import type { Shop } from '../types/shop.ts'

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

export function filterShops(shops: readonly Shop[], filter: ShopFilter): Shop[] {
  const matched =
    filter.query === undefined ? shops.slice() : searchShops(shops, filter.query)

  if (filter.hasCoordinates === undefined) {
    return matched
  }

  return matched.filter((shop) => hasValidCoordinates(shop) === filter.hasCoordinates)
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase()
}

function hasValidCoordinates(shop: Shop): boolean {
  return isValidLatitude(shop.latitude) && isValidLongitude(shop.longitude)
}

function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}
