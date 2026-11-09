import { canDecodePercentEncoded, hasInvalidPercentEncoding } from './percentEncoding.ts'

export type ReadRoute =
  | { name: 'shops' }
  | { name: 'shop'; shopId: string }
  | { name: 'discounts' }
  | { name: 'discount'; discountId: string }
  | { name: 'shop-discounts'; shopId: string }

export type RouteRecognition =
  | { kind: 'outside' }
  | { kind: 'invalid_encoding' }
  | { kind: 'unmatched' }
  | { kind: 'matched'; route: ReadRoute }

/**
 * 復号済みのパスセグメントを 5 本の読み取り経路へ対応させる。
 * 空の識別子や余分なセグメントは unmatched。識別子が UUID であることは要求しない。
 */
function matchDecoded(segments: readonly string[]): RouteRecognition {
  if (segments.length === 1 && segments[0] === 'shops') {
    return { kind: 'matched', route: { name: 'shops' } }
  }
  if (segments.length === 2 && segments[0] === 'shops' && segments[1]) {
    return { kind: 'matched', route: { name: 'shop', shopId: segments[1] } }
  }
  if (segments.length === 3 && segments[0] === 'shops' && segments[1] && segments[2] === 'discounts') {
    return { kind: 'matched', route: { name: 'shop-discounts', shopId: segments[1] } }
  }
  if (segments.length === 1 && segments[0] === 'discounts') {
    return { kind: 'matched', route: { name: 'discounts' } }
  }
  if (segments.length === 2 && segments[0] === 'discounts' && segments[1]) {
    return { kind: 'matched', route: { name: 'discount', discountId: segments[1] } }
  }
  return { kind: 'unmatched' }
}

/**
 * `/api/v1` の 5 本だけを読み取り対象にする。
 * 識別子の形式は空でない 1 セグメントに限る。UUID には固定しない。
 */
export function recognizeReadRoute(requestUrl: string): RouteRecognition {
  let pathname: string
  try {
    pathname = new URL(requestUrl).pathname
  } catch {
    return { kind: 'outside' }
  }

  if (pathname !== '/api/v1' && !pathname.startsWith('/api/v1/')) {
    return { kind: 'outside' }
  }

  const parts = pathname.split('/')
  const rest = parts.slice(3)
  if (rest.some((segment) => segment.length > 0 && (hasInvalidPercentEncoding(segment) || !canDecodePercentEncoded(segment)))) {
    return { kind: 'invalid_encoding' }
  }
  if (rest.some((segment) => segment.length === 0)) {
    return { kind: 'unmatched' }
  }

  const decoded = rest.map((segment) => decodeURIComponent(segment))
  return matchDecoded(decoded)
}
