/**
 * 住所変換結果の分類。店舗の公開可否は決めない。
 * Geolonia の本番採用は未確定。
 */

export type GeocodeStatus =
  | 'accepted_candidate'
  | 'needs_review'
  | 'invalid_address'
  | 'service_error'

export type ServiceFailureKind = 'timeout' | 'network' | 'upstream'

/** 外部取得の失敗。ライブラリのメッセージは含めない。 */
export type ServiceFailure = {
  kind: ServiceFailureKind
  retryable: boolean
}

/** 手動確認用の参考座標。保存や公開に使う値ではない。 */
export type ReferencePoint = {
  latitude: number
  longitude: number
  pointLevel: number
}

/** 自動採用候補の座標。公開確定ではない。 */
export type AcceptedPoint = {
  latitude: number
  longitude: number
}

/** アダプターがライブラリ形式から移した正規化結果。 */
export type NormalizedAddress = {
  pref: string | null
  city: string | null
  town: string | null
  addr: string | null
  other: string
  level: number
  point: ReferencePoint | null
  prefectureName: string | null
  /** `cityName` が返す郡・市区町村・区を含む名前 */
  municipalityName: string | null
  /** `machiAzaName` が返す町字 */
  townName: string | null
}

export type GeocodeAssessment = {
  status: GeocodeStatus
  acceptedPoint: AcceptedPoint | null
  referencePoint: ReferencePoint | null
  normalized: {
    pref: string | null
    city: string | null
    town: string | null
    addr: string | null
    other: string
    level: number
    pointLevel: number | null
  } | null
  failure: ServiceFailure | null
}

export type AddressNormalizer = (input: string) => Promise<NormalizedAddress>
