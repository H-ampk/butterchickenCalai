import type { Discount } from '../types/discount.ts'

/**
 * 開発専用の架空割引。実在店舗の割引ではない。
 * 販売終了後の行も残す。通常一覧へ出すかは discountPeriod で判定する。
 */
export const mockDiscounts: readonly Discount[] = [
  {
    id: 'dev-discount-01',
    shopId: 'dev-shop-01',
    subject: '架空の日替わり',
    content: '10%OFF',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-12-01T00:00:00Z',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'dev-discount-02',
    shopId: 'dev-shop-02',
    subject: '架空の定番',
    content: '50円引き',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'dev-discount-03',
    shopId: 'dev-shop-03',
    subject: '架空の予告',
    content: '開始前',
    startsAt: '2026-12-01T00:00:00Z',
    endsAt: '2026-12-31T00:00:00Z',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'dev-discount-04',
    shopId: 'dev-shop-04',
    subject: '架空の終了済み',
    content: '終了後も残す',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-02-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dev-discount-05',
    shopId: 'dev-shop-05',
    subject: '開始時刻が空の草案',
    content: 'startsAt は null',
    startsAt: null,
    endsAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
]
