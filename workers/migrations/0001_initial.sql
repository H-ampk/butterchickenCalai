-- shops と discounts の初期スキーマ。
-- 一度適用したあとは、このファイルを編集しない。変更は次の番号の migration を追加する。
-- テスト用の INSERT は入れない。
--
-- 日時 CHECK は、20文字の YYYY-MM-DDTHH:mm:ssZ と、月 01-12、日 01-31、
-- 時 00-23、分 00-59、秒 00-59 を見る。実在する日付までは保証しない。
-- 2月31日のような暦として無い日付は、この CHECK では拒否しない。
-- 暦の判定は Workers の isUtcSecondTimestamp が行う。
-- 時刻全体を一つの GLOB にすると、この D1 の SQLite は
-- "LIKE or GLOB pattern too complex" で正当な値も拒否する。
-- そのため区切り文字、printf による桁、CAST による範囲に分けている。
-- printf('%04d', 負数) は符号を幅に含める。年の先頭が ASCII 数字であることも要求し、符号付きの年を拒否する。
-- CHECK の結果が NULL になると SQLite は制約を通過させる。
-- NOT NULL の日時は typeof が text であることを先に要求し、
-- NULL を許す日時は IS NULL を先に分けている。
-- 外部キーは D1 の標準の検証に任せる。PRAGMA foreign_keys は書かない。

CREATE TABLE shops (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  name_search TEXT NOT NULL,
  address_search TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT shops_id_not_blank CHECK (
    id IS NOT NULL
    AND length(trim(id)) > 0
  ),
  CONSTRAINT shops_coordinates CHECK (
    (
      latitude IS NULL
      AND longitude IS NULL
    )
    OR (
      latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND typeof(latitude) IN ('integer', 'real')
      AND typeof(longitude) IN ('integer', 'real')
      AND latitude >= -90
      AND latitude <= 90
      AND longitude >= -180
      AND longitude <= 180
    )
  ),
  CONSTRAINT shops_created_at_format CHECK (
    typeof(created_at) = 'text'
    AND length(created_at) = 20
    AND substr(created_at, 5, 1) = '-'
    AND substr(created_at, 8, 1) = '-'
    AND substr(created_at, 11, 1) = 'T'
    AND substr(created_at, 14, 1) = ':'
    AND substr(created_at, 17, 1) = ':'
    AND substr(created_at, 20, 1) = 'Z'
    AND substr(created_at, 1, 1) BETWEEN '0' AND '9'
    AND printf('%04d', CAST(substr(created_at, 1, 4) AS INTEGER)) = substr(created_at, 1, 4)
    AND printf('%02d', CAST(substr(created_at, 6, 2) AS INTEGER)) = substr(created_at, 6, 2)
    AND printf('%02d', CAST(substr(created_at, 9, 2) AS INTEGER)) = substr(created_at, 9, 2)
    AND printf('%02d', CAST(substr(created_at, 12, 2) AS INTEGER)) = substr(created_at, 12, 2)
    AND printf('%02d', CAST(substr(created_at, 15, 2) AS INTEGER)) = substr(created_at, 15, 2)
    AND printf('%02d', CAST(substr(created_at, 18, 2) AS INTEGER)) = substr(created_at, 18, 2)
    AND CAST(substr(created_at, 6, 2) AS INTEGER) BETWEEN 1 AND 12
    AND CAST(substr(created_at, 9, 2) AS INTEGER) BETWEEN 1 AND 31
    AND CAST(substr(created_at, 12, 2) AS INTEGER) BETWEEN 0 AND 23
    AND CAST(substr(created_at, 15, 2) AS INTEGER) BETWEEN 0 AND 59
    AND CAST(substr(created_at, 18, 2) AS INTEGER) BETWEEN 0 AND 59
  ),
  CONSTRAINT shops_updated_at_format CHECK (
    typeof(updated_at) = 'text'
    AND length(updated_at) = 20
    AND substr(updated_at, 5, 1) = '-'
    AND substr(updated_at, 8, 1) = '-'
    AND substr(updated_at, 11, 1) = 'T'
    AND substr(updated_at, 14, 1) = ':'
    AND substr(updated_at, 17, 1) = ':'
    AND substr(updated_at, 20, 1) = 'Z'
    AND substr(updated_at, 1, 1) BETWEEN '0' AND '9'
    AND printf('%04d', CAST(substr(updated_at, 1, 4) AS INTEGER)) = substr(updated_at, 1, 4)
    AND printf('%02d', CAST(substr(updated_at, 6, 2) AS INTEGER)) = substr(updated_at, 6, 2)
    AND printf('%02d', CAST(substr(updated_at, 9, 2) AS INTEGER)) = substr(updated_at, 9, 2)
    AND printf('%02d', CAST(substr(updated_at, 12, 2) AS INTEGER)) = substr(updated_at, 12, 2)
    AND printf('%02d', CAST(substr(updated_at, 15, 2) AS INTEGER)) = substr(updated_at, 15, 2)
    AND printf('%02d', CAST(substr(updated_at, 18, 2) AS INTEGER)) = substr(updated_at, 18, 2)
    AND CAST(substr(updated_at, 6, 2) AS INTEGER) BETWEEN 1 AND 12
    AND CAST(substr(updated_at, 9, 2) AS INTEGER) BETWEEN 1 AND 31
    AND CAST(substr(updated_at, 12, 2) AS INTEGER) BETWEEN 0 AND 23
    AND CAST(substr(updated_at, 15, 2) AS INTEGER) BETWEEN 0 AND 59
    AND CAST(substr(updated_at, 18, 2) AS INTEGER) BETWEEN 0 AND 59
  )
);

CREATE TABLE discounts (
  id TEXT PRIMARY KEY NOT NULL,
  shop_id TEXT NOT NULL,
  subject TEXT,
  content TEXT,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT discounts_id_not_blank CHECK (
    id IS NOT NULL
    AND length(trim(id)) > 0
  ),
  CONSTRAINT discounts_created_at_format CHECK (
    typeof(created_at) = 'text'
    AND length(created_at) = 20
    AND substr(created_at, 5, 1) = '-'
    AND substr(created_at, 8, 1) = '-'
    AND substr(created_at, 11, 1) = 'T'
    AND substr(created_at, 14, 1) = ':'
    AND substr(created_at, 17, 1) = ':'
    AND substr(created_at, 20, 1) = 'Z'
    AND substr(created_at, 1, 1) BETWEEN '0' AND '9'
    AND printf('%04d', CAST(substr(created_at, 1, 4) AS INTEGER)) = substr(created_at, 1, 4)
    AND printf('%02d', CAST(substr(created_at, 6, 2) AS INTEGER)) = substr(created_at, 6, 2)
    AND printf('%02d', CAST(substr(created_at, 9, 2) AS INTEGER)) = substr(created_at, 9, 2)
    AND printf('%02d', CAST(substr(created_at, 12, 2) AS INTEGER)) = substr(created_at, 12, 2)
    AND printf('%02d', CAST(substr(created_at, 15, 2) AS INTEGER)) = substr(created_at, 15, 2)
    AND printf('%02d', CAST(substr(created_at, 18, 2) AS INTEGER)) = substr(created_at, 18, 2)
    AND CAST(substr(created_at, 6, 2) AS INTEGER) BETWEEN 1 AND 12
    AND CAST(substr(created_at, 9, 2) AS INTEGER) BETWEEN 1 AND 31
    AND CAST(substr(created_at, 12, 2) AS INTEGER) BETWEEN 0 AND 23
    AND CAST(substr(created_at, 15, 2) AS INTEGER) BETWEEN 0 AND 59
    AND CAST(substr(created_at, 18, 2) AS INTEGER) BETWEEN 0 AND 59
  ),
  CONSTRAINT discounts_updated_at_format CHECK (
    typeof(updated_at) = 'text'
    AND length(updated_at) = 20
    AND substr(updated_at, 5, 1) = '-'
    AND substr(updated_at, 8, 1) = '-'
    AND substr(updated_at, 11, 1) = 'T'
    AND substr(updated_at, 14, 1) = ':'
    AND substr(updated_at, 17, 1) = ':'
    AND substr(updated_at, 20, 1) = 'Z'
    AND substr(updated_at, 1, 1) BETWEEN '0' AND '9'
    AND printf('%04d', CAST(substr(updated_at, 1, 4) AS INTEGER)) = substr(updated_at, 1, 4)
    AND printf('%02d', CAST(substr(updated_at, 6, 2) AS INTEGER)) = substr(updated_at, 6, 2)
    AND printf('%02d', CAST(substr(updated_at, 9, 2) AS INTEGER)) = substr(updated_at, 9, 2)
    AND printf('%02d', CAST(substr(updated_at, 12, 2) AS INTEGER)) = substr(updated_at, 12, 2)
    AND printf('%02d', CAST(substr(updated_at, 15, 2) AS INTEGER)) = substr(updated_at, 15, 2)
    AND printf('%02d', CAST(substr(updated_at, 18, 2) AS INTEGER)) = substr(updated_at, 18, 2)
    AND CAST(substr(updated_at, 6, 2) AS INTEGER) BETWEEN 1 AND 12
    AND CAST(substr(updated_at, 9, 2) AS INTEGER) BETWEEN 1 AND 31
    AND CAST(substr(updated_at, 12, 2) AS INTEGER) BETWEEN 0 AND 23
    AND CAST(substr(updated_at, 15, 2) AS INTEGER) BETWEEN 0 AND 59
    AND CAST(substr(updated_at, 18, 2) AS INTEGER) BETWEEN 0 AND 59
  ),
  CONSTRAINT discounts_starts_at_format CHECK (
    starts_at IS NULL
    OR (
      typeof(starts_at) = 'text'
      AND length(starts_at) = 20
      AND substr(starts_at, 5, 1) = '-'
      AND substr(starts_at, 8, 1) = '-'
      AND substr(starts_at, 11, 1) = 'T'
      AND substr(starts_at, 14, 1) = ':'
      AND substr(starts_at, 17, 1) = ':'
      AND substr(starts_at, 20, 1) = 'Z'
      AND substr(starts_at, 1, 1) BETWEEN '0' AND '9'
      AND printf('%04d', CAST(substr(starts_at, 1, 4) AS INTEGER)) = substr(starts_at, 1, 4)
      AND printf('%02d', CAST(substr(starts_at, 6, 2) AS INTEGER)) = substr(starts_at, 6, 2)
      AND printf('%02d', CAST(substr(starts_at, 9, 2) AS INTEGER)) = substr(starts_at, 9, 2)
      AND printf('%02d', CAST(substr(starts_at, 12, 2) AS INTEGER)) = substr(starts_at, 12, 2)
      AND printf('%02d', CAST(substr(starts_at, 15, 2) AS INTEGER)) = substr(starts_at, 15, 2)
      AND printf('%02d', CAST(substr(starts_at, 18, 2) AS INTEGER)) = substr(starts_at, 18, 2)
      AND CAST(substr(starts_at, 6, 2) AS INTEGER) BETWEEN 1 AND 12
      AND CAST(substr(starts_at, 9, 2) AS INTEGER) BETWEEN 1 AND 31
      AND CAST(substr(starts_at, 12, 2) AS INTEGER) BETWEEN 0 AND 23
      AND CAST(substr(starts_at, 15, 2) AS INTEGER) BETWEEN 0 AND 59
      AND CAST(substr(starts_at, 18, 2) AS INTEGER) BETWEEN 0 AND 59
    )
  ),
  CONSTRAINT discounts_ends_at_format CHECK (
    ends_at IS NULL
    OR (
      typeof(ends_at) = 'text'
      AND length(ends_at) = 20
      AND substr(ends_at, 5, 1) = '-'
      AND substr(ends_at, 8, 1) = '-'
      AND substr(ends_at, 11, 1) = 'T'
      AND substr(ends_at, 14, 1) = ':'
      AND substr(ends_at, 17, 1) = ':'
      AND substr(ends_at, 20, 1) = 'Z'
      AND substr(ends_at, 1, 1) BETWEEN '0' AND '9'
      AND printf('%04d', CAST(substr(ends_at, 1, 4) AS INTEGER)) = substr(ends_at, 1, 4)
      AND printf('%02d', CAST(substr(ends_at, 6, 2) AS INTEGER)) = substr(ends_at, 6, 2)
      AND printf('%02d', CAST(substr(ends_at, 9, 2) AS INTEGER)) = substr(ends_at, 9, 2)
      AND printf('%02d', CAST(substr(ends_at, 12, 2) AS INTEGER)) = substr(ends_at, 12, 2)
      AND printf('%02d', CAST(substr(ends_at, 15, 2) AS INTEGER)) = substr(ends_at, 15, 2)
      AND printf('%02d', CAST(substr(ends_at, 18, 2) AS INTEGER)) = substr(ends_at, 18, 2)
      AND CAST(substr(ends_at, 6, 2) AS INTEGER) BETWEEN 1 AND 12
      AND CAST(substr(ends_at, 9, 2) AS INTEGER) BETWEEN 1 AND 31
      AND CAST(substr(ends_at, 12, 2) AS INTEGER) BETWEEN 0 AND 23
      AND CAST(substr(ends_at, 15, 2) AS INTEGER) BETWEEN 0 AND 59
      AND CAST(substr(ends_at, 18, 2) AS INTEGER) BETWEEN 0 AND 59
    )
  ),
  CONSTRAINT discounts_period_order CHECK (
    starts_at IS NULL
    OR ends_at IS NULL
    OR starts_at < ends_at
  ),
  FOREIGN KEY (shop_id)
    REFERENCES shops(id)
    ON DELETE CASCADE
);

-- 店舗に紐づく割引の検索に使う。並び順の複合インデックスと検索列のインデックスは、
-- 実際の SQL と EXPLAIN QUERY PLAN を見てから別の migration で検討する。
CREATE INDEX idx_discounts_shop_id ON discounts(shop_id);
