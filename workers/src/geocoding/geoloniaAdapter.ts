import { normalize, type NormalizeResult } from '@geolonia/normalize-japanese-addresses'
import { cityName, machiAzaName } from '@geolonia/japanese-addresses-v2'
import type { NormalizedAddress } from './types.ts'

function text(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') {
    return null
  }
  return value
}

/** Geolonia の返却を判定用の形へ移す。判定規則は持たない。 */
export function toNormalizedAddress(result: NormalizeResult): NormalizedAddress {
  const point = result.point
  return {
    pref: text(result.pref),
    city: text(result.city),
    town: text(result.town),
    addr: text(result.addr),
    other: result.other,
    level: result.level,
    point: point
      ? { latitude: point.lat, longitude: point.lng, pointLevel: point.level }
      : null,
    prefectureName: text(result.metadata.prefecture?.pref),
    municipalityName: result.metadata.city ? cityName(result.metadata.city) : null,
    townName: result.metadata.machiAza ? machiAzaName(result.metadata.machiAza) : null,
  }
}

export async function normalizeWithGeolonia(input: string): Promise<NormalizedAddress> {
  return toNormalizedAddress(await normalize(input))
}
