import { normalizeQueryText } from './parseQuery.ts'

/**
 * 店舗一覧の q を、将来の D1 でパラメータバインドする LIKE パターンにする。
 * SQL 文は組み立てない。ESCAPE 句には LIKE_ESCAPE と同じ 1 文字を使う。
 */

/** LIKE の ESCAPE 句とパターン内の接頭辞で共有する 1 文字。 */
export const LIKE_ESCAPE = '\\'

export type ShopLikePattern =
  | { kind: 'none' }
  | { kind: 'contains'; pattern: string; escape: typeof LIKE_ESCAPE }

/**
 * 正規化後に空なら検索条件なし。
 * それ以外は `%`、`_`、エスケープ文字をリテラルにしてから、前後に `%` を付ける。
 */
export function toContainsLikePattern(query: string): ShopLikePattern {
  const normalized = normalizeQueryText(query)
  if (normalized === '') {
    return { kind: 'none' }
  }
  const escaped = normalized
    .replaceAll(LIKE_ESCAPE, LIKE_ESCAPE + LIKE_ESCAPE)
    .replaceAll('%', LIKE_ESCAPE + '%')
    .replaceAll('_', LIKE_ESCAPE + '_')
  return {
    kind: 'contains',
    pattern: `%${escaped}%`,
    escape: LIKE_ESCAPE,
  }
}

/**
 * 正規化後の店舗名または住所に、正規化後の q が部分一致するか。
 * q が null、または正規化後に空なら検索条件を適用しない。
 * 一致はリテラルであり、`%` と `_` をワイルドカードにしない。
 */
export function shopMatchesSearch(name: string, address: string, q: string | null): boolean {
  if (q === null) {
    return true
  }
  const needle = normalizeQueryText(q)
  if (needle === '') {
    return true
  }
  return normalizeQueryText(name).includes(needle) || normalizeQueryText(address).includes(needle)
}
