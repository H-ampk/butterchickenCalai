/**
 * 地図開発用の暫定店舗型。
 * Issue #4 で API・DB の仕様が合意されたら、その仕様に合わせて変更する。
 */
export interface Shop {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}
