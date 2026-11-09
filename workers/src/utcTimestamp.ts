const UTC_SECOND = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/

/**
 * 保存形式 YYYY-MM-DDTHH:mm:ssZ を、プロレプティック・グレゴリオ暦の UTC ミリ秒にする。
 * 年は4桁の数値のまま使う。Date.UTC は 0〜99 を 1900〜1999 と読むため使わない。
 * 形式が違う、または暦として存在しないときは null。
 */
export function utcSecondTimestampMs(value: string): number | null {
  if (value.length !== 20) {
    return null
  }
  const match = UTC_SECOND.exec(value)
  if (match === null) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return null
  }
  const parsed = new Date(0)
  parsed.setUTCHours(0, 0, 0, 0)
  parsed.setUTCFullYear(year, month - 1, day)
  parsed.setUTCHours(hour, minute, second, 0)
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second
  ) {
    return null
  }
  const ms = parsed.getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * 保存形式 YYYY-MM-DDTHH:mm:ssZ であり、かつ暦として存在する日時か。
 * D1 の CHECK は桁と月日時刻の範囲だけを見る。2月31日のような日付は CHECK を通り、この関数は拒否する。
 * 0000〜0099 年も、入力された4桁の年のまま判定する。
 */
export function isUtcSecondTimestamp(value: string): boolean {
  return utcSecondTimestampMs(value) !== null
}
