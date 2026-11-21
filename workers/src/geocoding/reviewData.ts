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
  | 'input_mismatch'

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
 * 分類結果だけから言える理由。
 * 公式名が無いので、構成要素の不一致はここには含めない。
 */
export function reviewReasonsFromAssessment(assessment: GeocodeAssessment): ReviewReason[] {
  if (assessment.status === 'service_error') {
    const kind = assessment.failure?.kind ?? 'upstream'
    return [reason('service_error', `外部サービスで住所を変換できませんでした（${kind}）。`)]
  }
  const normalized = assessment.normalized
  if (!normalized) {
    if (assessment.status === 'invalid_address') {
      return [reason('invalid_address', '住所が空です。')]
    }
    return []
  }

  const reasons: ReviewReason[] = []
  const recognized = normalized.level === 3 || normalized.level === 8
  const pointLevel = normalized.pointLevel
  const droppedPoint = assessment.acceptedPoint === null && assessment.referencePoint === null

  if (!recognized) {
    reasons.push(reason('invalid_address', '住所として確定できるレベルまで認識できませんでした。'))
  }
  if (recognized && pointLevel !== null && droppedPoint) {
    reasons.push(reason('coordinates_out_of_range', '座標が緯度・経度の有効範囲外です。'))
  }
  if (normalized.level === 3) {
    reasons.push(reason('town_level_only', '町丁目までしか認識できていません。'))
  }
  if (normalized.level === 8 && assessment.referencePoint?.pointLevel === 3) {
    reasons.push(
      reason(
        'residential_point_is_town_representative',
        '番地まで認識していますが、座標は町字代表点（point.level 3）です。',
      ),
    )
  }
  const referenceLevel = assessment.referencePoint?.pointLevel
  if (
    normalized.level === 8 &&
    referenceLevel !== undefined &&
    referenceLevel !== 8 &&
    referenceLevel !== 3
  ) {
    reasons.push(
      reason(
        'point_level_not_residential',
        `点のレベルは ${referenceLevel} です。住居表示の 8 ではありません。`,
      ),
    )
  }
  if (recognized && pointLevel === null) {
    reasons.push(reason('missing_point', '座標が取得できていません。'))
  }
  if (normalized.other.trim() !== '') {
    reasons.push(reason('unresolved_remainder', '未解析の文字列が残っています。'))
  }
  if (normalized.level === 8 && !normalized.addr?.trim()) {
    reasons.push(reason('missing_block', '番地が不足しています。'))
  }
  return reasons
}

/**
 * 正規化結果から、観測できる事実だけを理由にする。
 * 構成要素の不一致は、公式名を持つ NormalizedAddress があるときだけ付ける。
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

function samePoint(
  point: ReferencePoint,
  latitude: number,
  longitude: number,
): boolean {
  return point.latitude === latitude && point.longitude === longitude
}

/** 分類結果に写った項目と正規化結果が同じか。公式名は分類結果に無いので比較しない。 */
function sourceMatchesAssessment(source: NormalizedAddress, assessment: GeocodeAssessment): boolean {
  const normalized = assessment.normalized
  if (!normalized) {
    return false
  }
  if (
    source.pref !== normalized.pref ||
    source.city !== normalized.city ||
    source.town !== normalized.town ||
    source.addr !== normalized.addr ||
    source.other !== normalized.other ||
    source.level !== normalized.level ||
    (source.point?.pointLevel ?? null) !== normalized.pointLevel
  ) {
    return false
  }
  const point = source.point
  if (assessment.acceptedPoint) {
    return (
      assessment.referencePoint === null &&
      point !== null &&
      inRange(point) &&
      samePoint(point, assessment.acceptedPoint.latitude, assessment.acceptedPoint.longitude)
    )
  }
  if (assessment.referencePoint) {
    return (
      point !== null &&
      point.pointLevel === assessment.referencePoint.pointLevel &&
      samePoint(point, assessment.referencePoint.latitude, assessment.referencePoint.longitude)
    )
  }
  if (point === null || !inRange(point)) {
    return true
  }
  // レベルが 3 でも 8 でもないとき、分類は範囲内の点も参考座標に残さない。
  return normalized.level !== 3 && normalized.level !== 8
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
 * source を省いたときは、分類結果だけから言える理由に限る。
 * source が分類結果と食い違うときは、どちらの理由も付けず input_mismatch だけを返す。
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
    reasons = reviewReasonsFromAssessment(assessment)
  } else if (source && !sourceMatchesAssessment(source, assessment)) {
    reasons = [
      reason('input_mismatch', '分類結果と正規化結果が一致しないため、確認理由を付けていません。'),
    ]
  } else if (source) {
    reasons = reviewReasonsFromNormalized(source)
  } else {
    reasons = reviewReasonsFromAssessment(assessment)
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
