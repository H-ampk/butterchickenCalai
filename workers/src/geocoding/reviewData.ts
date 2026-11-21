import type {
  AcceptedPoint,
  GeocodeAssessment,
  GeocodeStatus,
  NormalizedAddress,
  ReferencePoint,
  ServiceFailure,
} from './types.ts'

/**
 * 確認担当者向けの記録。
 * acceptedCandidate と referencePoint は確認用であり、店舗の確定座標ではない。
 * このモジュールは D1 にも公開 API にも書かない。
 */

export type ReviewReasonCode =
  | 'residential_point_is_town_representative'
  | 'town_level_only'
  | 'unresolved_remainder'
  | 'component_mismatch'
  | 'missing_block'
  | 'missing_point'
  | 'invalid_address'
  | 'coordinates_out_of_range'
  | 'point_level_not_residential'
  | 'service_error'

export type ReviewReason = {
  code: ReviewReasonCode
  message: string
}

export type ReviewAddressParts = {
  pref: string | null
  city: string | null
  town: string | null
  addr: string | null
  other: string
  level: number
  pointLevel: number | null
}

/** 確定済みの店舗座標ではない。 */
export type ReviewCoordinateRecord = {
  inputAddress: string
  status: GeocodeStatus
  normalized: ReviewAddressParts | null
  acceptedCandidate: AcceptedPoint | null
  referencePoint: ReferencePoint | null
  reasons: ReviewReason[]
  serviceFailure: ServiceFailure | null
}

const RANGE = {
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
} as const

function inRange(point: ReferencePoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= RANGE.latitude.min &&
    point.latitude <= RANGE.latitude.max &&
    point.longitude >= RANGE.longitude.min &&
    point.longitude <= RANGE.longitude.max
  )
}

function bothPresentAndDifferent(left: string | null, right: string | null): boolean {
  return left !== null && right !== null && left !== right
}

/** 県・市区町村・町字の名前が、両方あるのに一致しないときだけ。欠落は不一致にしない。 */
function componentMismatch(source: NormalizedAddress): boolean {
  return (
    bothPresentAndDifferent(source.pref, source.prefectureName) ||
    bothPresentAndDifferent(source.city, source.municipalityName) ||
    bothPresentAndDifferent(source.town, source.townName)
  )
}

function reason(code: ReviewReasonCode, message: string): ReviewReason {
  return { code, message }
}

/**
 * 正規化結果から、観測できる事実だけを理由にする。
 * GeocodeAssessment には県名・市区町村名・町字の公式名が無いので、ここは NormalizedAddress を使う。
 */
export function reviewReasonsFromNormalized(source: NormalizedAddress): ReviewReason[] {
  const reasons: ReviewReason[] = []
  const recognized = source.level === 3 || source.level === 8
  const point = source.point
  const pointInRange = point !== null && inRange(point)

  if (!recognized) {
    reasons.push(reason('invalid_address', '住所として確定できるレベルまで認識できませんでした。'))
  }
  if (point && !pointInRange) {
    reasons.push(reason('coordinates_out_of_range', '座標が緯度・経度の有効範囲外です。'))
  }
  if (source.level === 3) {
    reasons.push(reason('town_level_only', '町丁目までしか認識できていません。'))
  }
  if (source.level === 8 && pointInRange && point.pointLevel === 3) {
    reasons.push(
      reason(
        'residential_point_is_town_representative',
        '番地まで認識していますが、座標は町字代表点（point.level 3）です。',
      ),
    )
  }
  if (source.level === 8 && pointInRange && point.pointLevel !== 8 && point.pointLevel !== 3) {
    reasons.push(
      reason(
        'point_level_not_residential',
        `点のレベルは ${point.pointLevel} です。住居表示の 8 ではありません。`,
      ),
    )
  }
  if (recognized && point === null) {
    reasons.push(reason('missing_point', '座標が取得できていません。'))
  }
  if (source.other.trim() !== '') {
    reasons.push(reason('unresolved_remainder', '未解析の文字列が残っています。'))
  }
  if (componentMismatch(source)) {
    reasons.push(reason('component_mismatch', '住所の構成要素が、正規化元の名称と一致しません。'))
  }
  if (source.level === 8 && !source.addr?.trim()) {
    reasons.push(reason('missing_block', '番地が不足しています。'))
  }
  return reasons
}

function partsFromAssessment(assessment: GeocodeAssessment): ReviewAddressParts | null {
  if (!assessment.normalized) {
    return null
  }
  return {
    pref: assessment.normalized.pref,
    city: assessment.normalized.city,
    town: assessment.normalized.town,
    addr: assessment.normalized.addr,
    other: assessment.normalized.other,
    level: assessment.normalized.level,
    pointLevel: assessment.normalized.pointLevel,
  }
}

/**
 * 確認用記録を作る。外部へ通信しない。
 * 分類済みの結果で理由を分けるときは source に、分類前の NormalizedAddress を渡す。
 * source が無い needs_review / invalid_address では、理由を推測して埋めない。
 */
export function buildAddressReview(input: {
  inputAddress: string
  assessment: GeocodeAssessment
  source?: NormalizedAddress | null
}): ReviewCoordinateRecord {
  const { inputAddress, assessment } = input
  const source = input.source ?? null
  let reasons: ReviewReason[]
  if (assessment.status === 'service_error') {
    const kind = assessment.failure?.kind ?? 'upstream'
    reasons = [reason('service_error', `外部サービスで住所を変換できませんでした（${kind}）。`)]
  } else if (assessment.status === 'invalid_address' && assessment.normalized === null) {
    reasons = [reason('invalid_address', '住所が空です。')]
  } else if (source) {
    reasons = reviewReasonsFromNormalized(source)
  } else {
    reasons = []
  }

  return {
    inputAddress,
    status: assessment.status,
    normalized: partsFromAssessment(assessment),
    acceptedCandidate: assessment.acceptedPoint,
    referencePoint: assessment.referencePoint,
    reasons,
    serviceFailure: assessment.failure,
  }
}

/** 確認用 JSON。店舗の確定座標としては使わない。 */
export function addressReviewJson(record: ReviewCoordinateRecord): string {
  return JSON.stringify(record)
}
