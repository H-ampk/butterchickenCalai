/**
 * 店舗の公開条件。有効な緯度と経度が両方あることだけを見る。
 * 店舗名や住所が空でも、それだけでは非公開にしない。
 */

export function isValidLatitude(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidLongitude(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180
}

/** 境界値を含む。片側の欠落、範囲外、NaN、Infinity、数値でない保存値は不可。 */
export function hasValidShopCoordinates(latitude: unknown, longitude: unknown): boolean {
  return isValidLatitude(latitude) && isValidLongitude(longitude)
}
