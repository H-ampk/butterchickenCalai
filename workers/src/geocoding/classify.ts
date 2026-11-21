import { isValidLatitude, isValidLongitude } from '../readApi/shopVisibility.ts'
import type { GeocodeAssessment, NormalizedAddress, ReferencePoint } from './types.ts'

function summary(normalized: NormalizedAddress): GeocodeAssessment['normalized'] {
  return {
    pref: normalized.pref,
    city: normalized.city,
    town: normalized.town,
    addr: normalized.addr,
    other: normalized.other,
    level: normalized.level,
    pointLevel: normalized.point?.pointLevel ?? null,
  }
}

function invalid(normalized: NormalizedAddress): GeocodeAssessment {
  return {
    status: 'invalid_address',
    acceptedPoint: null,
    referencePoint: null,
    normalized: summary(normalized),
    failure: null,
  }
}

function review(normalized: NormalizedAddress, referencePoint: ReferencePoint | null): GeocodeAssessment {
  return {
    status: 'needs_review',
    acceptedPoint: null,
    referencePoint,
    normalized: summary(normalized),
    failure: null,
  }
}

function inRange(point: ReferencePoint): boolean {
  return isValidLatitude(point.latitude) && isValidLongitude(point.longitude)
}

/**
 * ライブラリが返した都道府県名と市区町村名が、分解結果の pref / city と一致するか。
 * 入力文字列への部分一致は使わない。県名を補完した住所を誤って落とさないため。
 */
function componentsMatch(normalized: NormalizedAddress): boolean {
  if (!normalized.pref || normalized.pref !== normalized.prefectureName) {
    return false
  }
  if (!normalized.city || normalized.city !== normalized.municipalityName) {
    return false
  }
  if (!normalized.town || normalized.town !== normalized.townName) {
    return false
  }
  return Boolean(normalized.addr?.trim())
}

/** 正規化済みの住所を4分類する。例外と空入力は呼び出し側で扱う。 */
export function classifyNormalizedAddress(normalized: NormalizedAddress): GeocodeAssessment {
  const recognized = normalized.level === 3 || normalized.level === 8
  if (!recognized) {
    return invalid(normalized)
  }

  const point = normalized.point
  if (point && !inRange(point)) {
    return invalid(normalized)
  }

  const referencePoint = point
  if (normalized.other.trim() !== '') {
    return review(normalized, referencePoint)
  }

  if (
    normalized.level === 8 &&
    point?.pointLevel === 8 &&
    componentsMatch(normalized)
  ) {
    return {
      status: 'accepted_candidate',
      acceptedPoint: { latitude: point.latitude, longitude: point.longitude },
      referencePoint: null,
      normalized: summary(normalized),
      failure: null,
    }
  }

  return review(normalized, referencePoint)
}
