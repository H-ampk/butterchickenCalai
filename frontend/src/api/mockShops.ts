import type { Shop } from '../types/shop.ts'

/**
 * 開発専用の架空データ。
 * 店名・住所・位置は広島市内に散らした架空の地点であり、実在店舗の割引情報ではない。
 */
export const mockShops: readonly Shop[] = [
  {
    id: 'dev-shop-01',
    name: '架空商店 紙屋町',
    address: '広島県広島市中区紙屋町1丁目（架空）',
    latitude: 34.3955,
    longitude: 132.4553,
  },
  {
    id: 'dev-shop-02',
    name: '架空食堂 八丁堀',
    address: '広島県広島市中区八丁堀（架空）',
    latitude: 34.3942,
    longitude: 132.4638,
  },
  {
    id: 'dev-shop-03',
    name: '架空菓子 比治山',
    address: '広島県広島市南区比治山町（架空）',
    latitude: 34.3836,
    longitude: 132.4702,
  },
  {
    id: 'dev-shop-04',
    name: '架空弁当 横川',
    address: '広島県広島市西区横川町（架空）',
    latitude: 34.4098,
    longitude: 132.4501,
  },
  {
    id: 'dev-shop-05',
    name: '架空カフェ 己斐',
    address: '広島県広島市西区己斐本町（架空）',
    latitude: 34.3931,
    longitude: 132.4264,
  },
]
