/** `%` の直後が 2 桁の 16 進数でない並びを、不正な URL エンコードとみなす。 */
export function hasInvalidPercentEncoding(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '%') {
      continue
    }
    const hex = value.slice(index + 1, index + 3)
    if (!/^[0-9A-Fa-f]{2}$/.test(hex)) {
      return true
    }
    // 16進数の2桁を消費する。for の加算と合わせて3文字進む。
    index += 2
  }
  return false
}

/** フラグメントを除いたクエリ文字列。`?` が無ければ空文字。 */
export function rawQueryString(requestUrl: string): string {
  const hash = requestUrl.indexOf('#')
  const withoutHash = hash === -1 ? requestUrl : requestUrl.slice(0, hash)
  const query = withoutHash.indexOf('?')
  return query === -1 ? '' : withoutHash.slice(query + 1)
}
