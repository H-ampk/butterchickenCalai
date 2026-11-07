const UTC_SECOND = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/

/**
 * 保存形式 YYYY-MM-DDTHH:mm:ssZ であり、かつ暦として存在する日時か。
 * D1 の CHECK は桁と月日時刻の範囲だけを見る。2月31日のような日付は CHECK を通り、この関数は拒否する。
 */
export function isUtcSecondTimestamp(value: string): boolean {
  if (value.length !== 20) {
    return false
  }
  const match = UTC_SECOND.exec(value)
  if (match === null) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false
  }
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second
  )
}
