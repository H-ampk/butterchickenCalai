-- このファイルは workers/scripts/generate-development-seed.ts が生成する。
-- 手で編集しない。workers で npm run d1:seed:generate を実行して作り直す。
-- ローカル開発専用の架空データ。本番では実行しない。migration ではない。
-- 期間サンプルの基準時刻は 2026-06-15T12:00:00Z。実行時の現在時刻には依存しない。
-- name_search と address_search は workers/src/searchText.ts の normalizeSearchText で作っている。
-- SQLite の lower() は使っていない。
-- 再実行すると主キー衝突で失敗する。INSERT OR REPLACE は使わない。
-- 入れ直すときは、先に seeds/reset-development.sql を実行する。

-- shop case: normal
INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, created_at, updated_at)
VALUES ('11111111-1111-4111-8111-111111111111', '架空食堂 北口', '架空県架空市北一丁目', 35, 135, '架空食堂 北口', '架空県架空市北一丁目', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- shop case: fullwidth-name
INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, created_at, updated_at)
VALUES ('22222222-2222-4222-8222-222222222222', '　架空ＣＡＦＥ１２　', '  Example-Town  ', 36, 136, '架空cafe12', 'example-town', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- shop case: empty-address
INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, created_at, updated_at)
VALUES ('33333333-3333-4333-8333-333333333333', '架空露店', '', 34, 134, '架空露店', '', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- shop case: null-coordinates
INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, created_at, updated_at)
VALUES ('44444444-4444-4444-8444-444444444444', '架空移動販売', '架空県架空市南', NULL, NULL, '架空移動販売', '架空県架空市南', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- discount case: no-start
INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at)
VALUES ('55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111111', '開始日時なし', '終了だけがある架空の割引', NULL, '2026-12-31T00:00:00Z', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- discount case: no-end
INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at)
VALUES ('55555555-5555-4555-8555-555555555502', '11111111-1111-4111-8111-111111111111', '終了日時なし', '開始だけがある架空の割引', '2026-06-01T00:00:00Z', NULL, '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- discount case: before-start
INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at)
VALUES ('55555555-5555-4555-8555-555555555503', '11111111-1111-4111-8111-111111111111', '開始前', '基準時刻より後に始まる架空の割引', '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- discount case: during
INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at)
VALUES ('55555555-5555-4555-8555-555555555504', '11111111-1111-4111-8111-111111111111', '販売期間中', '基準時刻が開始以上かつ終了未満の架空の割引', '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- discount case: ended
INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at)
VALUES ('55555555-5555-4555-8555-555555555505', '11111111-1111-4111-8111-111111111111', '終了済み', '基準時刻までに終わっている架空の割引', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- discount case: subject-only
INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at)
VALUES ('55555555-5555-4555-8555-555555555506', '11111111-1111-4111-8111-111111111111', '件名のみ', NULL, NULL, NULL, '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- discount case: content-only
INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at)
VALUES ('55555555-5555-4555-8555-555555555507', '11111111-1111-4111-8111-111111111111', NULL, '本文のみ', NULL, NULL, '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- discount case: subject-and-content-null
INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at)
VALUES ('55555555-5555-4555-8555-555555555508', '11111111-1111-4111-8111-111111111111', NULL, NULL, NULL, NULL, '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
