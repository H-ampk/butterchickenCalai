/** 取得結果に付ける由来。Shop や Discount の項目には加えない。 */
export type ListOrigin = 'mock' | 'api'

const origins = new WeakMap<object, ListOrigin>()

/**
 * 返した配列と各要素に由来を付ける。
 * 要素をコピーすると由来は付かない。APIの項目としては存在しない。
 */
export function tagFetchedRecords<T extends object>(records: T[], origin: ListOrigin): T[] {
  origins.set(records, origin)
  for (const record of records) {
    origins.set(record, origin)
  }
  return records
}

export function readFetchedOrigin(value: object): ListOrigin | undefined {
  return origins.get(value)
}
