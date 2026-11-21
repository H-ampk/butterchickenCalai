import { normalize, type NormalizeResult } from '@geolonia/normalize-japanese-addresses'
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
    municipalityName: municipalityName(result),
    townName: townName(result),
  }
}

/**
 * `@geolonia/japanese-addresses-v2` の `cityName` と同じ結合。
 * normalize 3.1.3 は 0.0.5 を内部依存にするが、公開 API は `cityName` を出さない。
 * 正規化結果に郡・市区町村・区が分かれて入るので、ここでは直接依存にしない。
 */
function municipalityName(result: NormalizeResult): string | null {
  const city = result.metadata.city
  if (!city) {
    return null
  }
  return `${city.county ?? ''}${city.city}${city.ward ?? ''}`
}

/** `machiAzaName` と同じ結合。大字、丁目、小字の順。 */
function townName(result: NormalizeResult): string | null {
  const town = result.metadata.machiAza
  if (!town) {
    return null
  }
  return `${town.oaza_cho ?? ''}${town.chome ?? ''}${town.koaza ?? ''}`
}

/**
 * 3.1.3 の公開設定には取得関数の差し替えが無い。
 * 住居表示・地番の非2xx本文は、ライブラリが空のCSVとして町字単位にキャッシュし得る。
 * 全体の fetch は差し替えない。
 */
export async function normalizeWithGeolonia(input: string): Promise<NormalizedAddress> {
  return toNormalizedAddress(await normalize(input))
}
