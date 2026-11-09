import { classifyDiscountVisibility, isDetailDiscount, isNormalListDiscount } from './discountVisibility.ts'
import { shopMatchesSearch } from './likePattern.ts'
import {
  toPublicDiscount,
  toPublicShop,
  type DiscountSourceRow,
  type PublicDiscount,
  type PublicShop,
  type ShopSourceRow,
  type SortablePublic,
} from './publicJson.ts'
import { hasValidShopCoordinates } from './shopVisibility.ts'
import { instantMs } from './utcInstant.ts'

/**
 * 公開条件と検索のあとで数を確定し、そのあとで offset ページングする。
 * limit と offset は parseReadQuery を通過した値を受け取る。ここでは範囲を検証し直さない。
 */

export type PublicPage<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
}

export type ListWindow = {
  limit: number
  offset: number
}

export type ShopListWindow = ListWindow & {
  /** parseReadQuery と同じく、検索しないときは null。 */
  q: string | null
}

export type ResourceDecision<T> = { status: 'ok'; body: T } | { status: 'not_found' }

export type ShopDiscountPage = { status: 'not_found' } | { status: 'ok'; page: PublicPage<PublicDiscount> }

/** created_at の降順、同じ時刻は id の昇順。文字列として比較する。 */
export function compareCreatedAtDescIdAsc(
  a: { created_at: string; id: string },
  b: { created_at: string; id: string },
): number {
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? 1 : -1
  }
  if (a.id !== b.id) {
    return a.id < b.id ? -1 : 1
  }
  return 0
}

function pageSorted<T>(rows: readonly SortablePublic<T>[], window: ListWindow): PublicPage<T> {
  const ordered = rows.slice().sort(compareCreatedAtDescIdAsc)
  const total = ordered.length
  const items =
    window.offset >= total ? [] : ordered.slice(window.offset, window.offset + window.limit).map((row) => row.body)
  return { items, total, limit: window.limit, offset: window.offset }
}

function indexShops(shops: readonly ShopSourceRow[]): Map<string, ShopSourceRow> {
  const indexed = new Map<string, ShopSourceRow>()
  for (const shop of shops) {
    if (typeof shop.id === 'string' && shop.id.length > 0 && !indexed.has(shop.id)) {
      indexed.set(shop.id, shop)
    }
  }
  return indexed
}

/**
 * 候補、公開条件、検索、並び順、total、limit と offset の順。
 * 公開できない行は total に含めない。
 */
export function listPublicShops(rows: readonly ShopSourceRow[], window: ShopListWindow): PublicPage<PublicShop> {
  const visible: SortablePublic<PublicShop>[] = []
  for (const row of rows) {
    const mapped = toPublicShop(row)
    if (mapped === null) {
      continue
    }
    if (!shopMatchesSearch(mapped.body.name, mapped.body.address, window.q)) {
      continue
    }
    visible.push(mapped)
  }
  return pageSorted(visible, window)
}

/**
 * 通常の割引一覧。販売中だけを残してから total とページングを行う。
 * now の getTime はこの関数の中で 1 回だけ読む。
 */
export function listPublicDiscounts(
  discounts: readonly DiscountSourceRow[],
  shops: readonly ShopSourceRow[],
  window: ListWindow,
  now: Date,
): PublicPage<PublicDiscount> {
  const nowMs = instantMs(now)
  const shopsById = indexShops(shops)
  const visible: SortablePublic<PublicDiscount>[] = []
  for (const row of discounts) {
    const shop = typeof row.shop_id === 'string' ? (shopsById.get(row.shop_id) ?? null) : null
    const kind = classifyDiscountVisibility(
      {
        subject: row.subject,
        content: row.content,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        shop,
      },
      nowMs,
    )
    if (!isNormalListDiscount(kind)) {
      continue
    }
    const mapped = toPublicDiscount(row)
    if (mapped === null) {
      continue
    }
    visible.push(mapped)
  }
  return pageSorted(visible, window)
}

/** 店舗詳細。公開条件を満たさない行と、行が無い場合は not_found。 */
export function decideShopDetail(row: ShopSourceRow | null): ResourceDecision<PublicShop> {
  if (row === null) {
    return { status: 'not_found' }
  }
  const mapped = toPublicShop(row)
  if (mapped === null) {
    return { status: 'not_found' }
  }
  return { status: 'ok', body: mapped.body }
}

/**
 * 割引詳細。開始前、不正な保存値、非公開店舗、行が無い場合は not_found。
 * 終了済みでも、他の公開条件を満たせば ok。
 */
export function decideDiscountDetail(
  row: DiscountSourceRow | null,
  shops: readonly ShopSourceRow[],
  now: Date,
): ResourceDecision<PublicDiscount> {
  if (row === null) {
    return { status: 'not_found' }
  }
  const nowMs = instantMs(now)
  const shopsById = indexShops(shops)
  const shop = typeof row.shop_id === 'string' ? (shopsById.get(row.shop_id) ?? null) : null
  const kind = classifyDiscountVisibility(
    {
      subject: row.subject,
      content: row.content,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      shop,
    },
    nowMs,
  )
  if (!isDetailDiscount(kind)) {
    return { status: 'not_found' }
  }
  const mapped = toPublicDiscount(row)
  if (mapped === null) {
    return { status: 'not_found' }
  }
  return { status: 'ok', body: mapped.body }
}

/**
 * 店舗別割引一覧。店舗自体が公開できなければ空一覧にせず not_found。
 * 公開できる店舗に販売中の割引が無いときは、total 0 のページ。
 */
export function pageShopDiscounts(
  discounts: readonly DiscountSourceRow[],
  shops: readonly ShopSourceRow[],
  shopId: string,
  window: ListWindow,
  now: Date,
): ShopDiscountPage {
  const shop = indexShops(shops).get(shopId) ?? null
  if (shop === null || !hasValidShopCoordinates(shop.latitude, shop.longitude) || toPublicShop(shop) === null) {
    return { status: 'not_found' }
  }
  const owned = discounts.filter((row) => row.shop_id === shopId)
  return {
    status: 'ok',
    page: listPublicDiscounts(owned, shops, window, now),
  }
}
