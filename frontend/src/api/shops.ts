import type { Shop } from '../types/shop.ts'
import { mockShops } from './mockShops.ts'

/**
 * 開発中はモックを返す。
 * 画面はこの関数だけを使い、モック配列を直接参照しない。
 * エンドポイントは Issue #4 の合意前なので、ここでは通信しない。
 */
export async function getShops(): Promise<Shop[]> {
  return mockShops.map((shop) => ({ ...shop }))
}
