/**
 * 店舗名と住所の検索列に使う正規化。
 * 順序は NFKC、trim、小文字化。フロントエンドの店舗検索もこの関数を使う。
 * 変えたときは、保存済みの name_search と address_search をこの関数で作り直す。
 * SQLite の lower() では Unicode の正規化をしない。
 */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase()
}
