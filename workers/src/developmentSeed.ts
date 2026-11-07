import { normalizeSearchText } from './searchText.ts'

/** 開始前・販売期間中・終了済みを区別するときの固定時刻。実行時の現在時刻は使わない。 */
export const DEVELOPMENT_SEED_REFERENCE_INSTANT = '2026-06-15T12:00:00Z'

export const DEVELOPMENT_SEED_STORED_AT = '2026-01-15T00:00:00Z'

export interface SeedShop {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  caseId: 'normal' | 'fullwidth-name' | 'empty-address' | 'null-coordinates'
}

export interface SeedDiscount {
  id: string
  shopId: string
  subject: string | null
  content: string | null
  startsAt: string | null
  endsAt: string | null
  caseId:
    | 'no-start'
    | 'no-end'
    | 'before-start'
    | 'during'
    | 'ended'
    | 'subject-only'
    | 'content-only'
    | 'subject-and-content-null'
}

export const developmentShops: readonly SeedShop[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: '架空食堂 北口',
    address: '架空県架空市北一丁目',
    latitude: 35,
    longitude: 135,
    caseId: 'normal',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: '　架空ＣＡＦＥ１２　',
    address: '  Example-Town  ',
    latitude: 36,
    longitude: 136,
    caseId: 'fullwidth-name',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: '架空露店',
    address: '',
    latitude: 34,
    longitude: 134,
    caseId: 'empty-address',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: '架空移動販売',
    address: '架空県架空市南',
    latitude: null,
    longitude: null,
    caseId: 'null-coordinates',
  },
]

const normalShopId = developmentShops[0].id

export const developmentDiscounts: readonly SeedDiscount[] = [
  {
    id: '55555555-5555-4555-8555-555555555501',
    shopId: normalShopId,
    subject: '開始日時なし',
    content: '終了だけがある架空の割引',
    startsAt: null,
    endsAt: '2026-12-31T00:00:00Z',
    caseId: 'no-start',
  },
  {
    id: '55555555-5555-4555-8555-555555555502',
    shopId: normalShopId,
    subject: '終了日時なし',
    content: '開始だけがある架空の割引',
    startsAt: '2026-06-01T00:00:00Z',
    endsAt: null,
    caseId: 'no-end',
  },
  {
    id: '55555555-5555-4555-8555-555555555503',
    shopId: normalShopId,
    subject: '開始前',
    content: '基準時刻より後に始まる架空の割引',
    startsAt: '2026-07-01T00:00:00Z',
    endsAt: '2026-08-01T00:00:00Z',
    caseId: 'before-start',
  },
  {
    id: '55555555-5555-4555-8555-555555555504',
    shopId: normalShopId,
    subject: '販売期間中',
    content: '基準時刻が開始以上かつ終了未満の架空の割引',
    startsAt: '2026-06-01T00:00:00Z',
    endsAt: '2026-07-01T00:00:00Z',
    caseId: 'during',
  },
  {
    id: '55555555-5555-4555-8555-555555555505',
    shopId: normalShopId,
    subject: '終了済み',
    content: '基準時刻までに終わっている架空の割引',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-02-01T00:00:00Z',
    caseId: 'ended',
  },
  {
    id: '55555555-5555-4555-8555-555555555506',
    shopId: normalShopId,
    subject: '件名のみ',
    content: null,
    startsAt: null,
    endsAt: null,
    caseId: 'subject-only',
  },
  {
    id: '55555555-5555-4555-8555-555555555507',
    shopId: normalShopId,
    subject: null,
    content: '本文のみ',
    startsAt: null,
    endsAt: null,
    caseId: 'content-only',
  },
  {
    id: '55555555-5555-4555-8555-555555555508',
    shopId: normalShopId,
    subject: null,
    content: null,
    startsAt: null,
    endsAt: null,
    caseId: 'subject-and-content-null',
  },
]

function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function sqlNullableText(value: string | null): string {
  return value === null ? 'NULL' : sqlText(value)
}

function sqlNullableReal(value: number | null): string {
  if (value === null) {
    return 'NULL'
  }
  if (!Number.isFinite(value)) {
    throw new Error('seed の座標は有限数にしてください。')
  }
  return String(value)
}

/**
 * ローカル開発用 seed の SQL。検索列は normalizeSearchText の戻り値だけを書く。
 * 本番へ投入する用途には使わない。
 */
export function renderDevelopmentSeedSql(): string {
  const lines = [
    '-- このファイルは workers/scripts/generate-development-seed.ts が生成する。',
    '-- 手で編集しない。workers で npm run d1:seed:generate を実行して作り直す。',
    '-- ローカル開発専用の架空データ。本番では実行しない。migration ではない。',
    `-- 期間サンプルの基準時刻は ${DEVELOPMENT_SEED_REFERENCE_INSTANT}。実行時の現在時刻には依存しない。`,
    '-- name_search と address_search は workers/src/searchText.ts の normalizeSearchText で作っている。',
    '-- SQLite の lower() は使っていない。',
    '-- 再実行すると主キー衝突で失敗する。INSERT OR REPLACE は使わない。',
    '-- 入れ直すときは、先に seeds/reset-development.sql を実行する。',
    '',
  ]

  for (const shop of developmentShops) {
    const nameSearch = normalizeSearchText(shop.name)
    const addressSearch = normalizeSearchText(shop.address)
    lines.push(`-- shop case: ${shop.caseId}`)
    lines.push(
      'INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, created_at, updated_at)',
    )
    lines.push(
      `VALUES (${sqlText(shop.id)}, ${sqlText(shop.name)}, ${sqlText(shop.address)}, ${sqlNullableReal(shop.latitude)}, ${sqlNullableReal(shop.longitude)}, ${sqlText(nameSearch)}, ${sqlText(addressSearch)}, ${sqlText(DEVELOPMENT_SEED_STORED_AT)}, ${sqlText(DEVELOPMENT_SEED_STORED_AT)});`,
    )
    lines.push('')
  }

  for (const discount of developmentDiscounts) {
    lines.push(`-- discount case: ${discount.caseId}`)
    lines.push(
      'INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at)',
    )
    lines.push(
      `VALUES (${sqlText(discount.id)}, ${sqlText(discount.shopId)}, ${sqlNullableText(discount.subject)}, ${sqlNullableText(discount.content)}, ${sqlNullableText(discount.startsAt)}, ${sqlNullableText(discount.endsAt)}, ${sqlText(DEVELOPMENT_SEED_STORED_AT)}, ${sqlText(DEVELOPMENT_SEED_STORED_AT)});`,
    )
    lines.push('')
  }

  return lines.join('\n')
}
