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

/**
 * パーセントエンコードを UTF-8 として復号できるか。
 * `%FF` のように形式は正しくてもバイト列が UTF-8 でない場合は false。
 * 復号できないときは例外を外へ出さない。
 */
export function canDecodePercentEncoded(value: string): boolean {
  try {
    decodeURIComponent(value)
    return true
  } catch {
    return false
  }
}

/**
 * クエリ文字列を UTF-8 として復号できるか。
 * `+` は空白にしてから復号する。`URLSearchParams` が不正な UTF-8 を U+FFFD に置換しても、ここでは受理しない。
 */
export function canDecodeQueryString(raw: string): boolean {
  return canDecodePercentEncoded(raw.replace(/\+/g, ' '))
}

/** フラグメントを除いたクエリ文字列。`?` が無ければ空文字。 */
export function rawQueryString(requestUrl: string): string {
  const hash = requestUrl.indexOf('#')
  const withoutHash = hash === -1 ? requestUrl : requestUrl.slice(0, hash)
  const query = withoutHash.indexOf('?')
  return query === -1 ? '' : withoutHash.slice(query + 1)
}
