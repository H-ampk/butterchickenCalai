import { classifyNormalizedAddress } from './classify.ts'
import { normalizeWithGeolonia } from './geoloniaAdapter.ts'
import { describeServiceFailure } from './serviceFailure.ts'
import type { AddressNormalizer, GeocodeAssessment } from './types.ts'

function invalidInput(): GeocodeAssessment {
  return {
    status: 'invalid_address',
    acceptedPoint: null,
    referencePoint: null,
    normalized: null,
    failure: null,
  }
}

function serviceError(error: unknown): GeocodeAssessment {
  return {
    status: 'service_error',
    acceptedPoint: null,
    referencePoint: null,
    normalized: null,
    failure: describeServiceFailure(error),
  }
}

/**
 * 日本語住所を正規化し、座標候補を分類する。
 * 空欄は外部へ問い合わせない。失敗時に座標は作らない。
 */
export async function geocodeAddress(
  input: string,
  normalizer: AddressNormalizer = normalizeWithGeolonia,
): Promise<GeocodeAssessment> {
  if (input.trim() === '') {
    return invalidInput()
  }
  try {
    return classifyNormalizedAddress(await normalizer(input))
  } catch (error) {
    return serviceError(error)
  }
}
