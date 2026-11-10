# database

店舗と割引の初期スキーマは、ローカルの Cloudflare D1 にあります。このディレクトリに SQL は置いていません。PostgreSQL 用のテーブルは作っていません。以前このファイルに書いていた `users` や `posts` などの名前は、検討中の一覧であり、作成したテーブルではありません。

本番の D1、`database_id`、`--remote` の実行、デプロイはしません。

## 配置

| ファイル | 役割 |
| --- | --- |
| `workers/migrations/0001_initial.sql` | `shops` と `discounts` の初期 migration。適用後は編集しない |
| `workers/seeds/development.sql` | ローカル開発専用の架空データ。migration ではない |
| `workers/seeds/reset-development.sql` | ローカルで `shops` と `discounts` の行を空にする |
| `workers/src/searchText.ts` | 検索列の正規化。フロントエンドの店舗検索もこれを使う |
| `workers/src/utcTimestamp.ts` | 暦として存在する UTC 秒精度日時かの判定 |
| `workers/src/developmentSeed.ts` | seed の生成元 |
| `workers/wrangler.jsonc` | バインディング `DB`。`migrations_dir` は `migrations` |

`migrations_dir` は `workers/wrangler.jsonc` からの相対パスです。実体は `workers/migrations/` です。

ローカル D1 のファイルは `workers/.wrangler/` にできます。Git 管理しません。テストは一時ディレクトリを `--persist-to` に渡し、この開発用ディレクトリは消しません。

## テーブル

`shops` と `discounts` だけを作ります。商品、価格、在庫、承認、ユーザーの列とテーブルは入れていません。

`shops` の列は `id`, `name`, `address`, `latitude`, `longitude`, `name_search`, `address_search`, `created_at`, `updated_at` です。`name` と `address` の既定値は空文字です。座標は両方 NULL か、両方とも範囲内の数値です。検索列に既定値はなく、INSERT で省略すると失敗します。

`discounts` の列は `id`, `shop_id`, `subject`, `content`, `starts_at`, `ends_at`, `created_at`, `updated_at` です。`subject` と `content` は両方 NULL でも保存できます。空文字も保存できます。

主キーは空でない `TEXT` です。UUID の形式は SQL では強制しません。seed は固定の UUID v4 です。書き込み API での採番方式は未実装で、識別子を UUID に限るかは、マージ済みの [Pull Request #92](https://github.com/H-ampk/butterchickenCalai/pull/92) が更新した `docs/api-contract.md` でも未決定です。このスキーマ作業では `docs/api-contract.md` を変更していません。

`discounts.shop_id` は `shops.id` を参照し、`ON DELETE CASCADE` です。存在しない店舗への割引は拒否します。店舗を物理削除すると、その割引も削除されます。非公開にするだけでは行を削除しません。初期 migration に `PRAGMA foreign_keys` は書いていません。migration へは追加しません。

## 外部キー

Cloudflare D1 は、外部キー制約を既定で強制します。各クエリでの挙動は、SQLite の `PRAGMA foreign_keys = on` と同じです。D1 はクエリと migration を暗黙のトランザクションで実行するため、その場で `PRAGMA foreign_keys = off` にして強制を切ることはできません。一時的に検査を遅らせる手段は `PRAGMA defer_foreign_keys` です。このスキーマでは使いません。

Wrangler 4.157.0 のローカル D1 も、バインディング `DB` では外部キーが有効です。確認は `workers` で行い、`workers/package.json` の `d1:check` と同じく `--local` を付けます。`--remote` は付けません。データベース名は `butterchicken-calai-local` です。先に `npm run d1:migrations:apply` でテーブルを作ります。

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd workers
npx wrangler d1 execute DB --local --command "PRAGMA foreign_keys;"
npx wrangler d1 execute DB --local --command "PRAGMA foreign_key_check;"
```

`PRAGMA foreign_keys` の結果が 1 なら、この接続では外部キーが有効です。`PRAGMA foreign_key_check` が行を返さなければ、既存の行に違反はありません。

外部キー違反は、存在しない `shop_id` への `INSERT` で確認します。有効な接続では拒否され、行は残りません。

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd workers
npx wrangler d1 execute DB --local --command "INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at) VALUES ('fk-missing', 'missing-shop', NULL, NULL, NULL, NULL, '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');"
```

`ON DELETE CASCADE` は、確認用の店舗と割引を入れてから、その店舗だけを削除して見ます。割引の行が残っていなければ、連鎖削除が働いています。この例は `fk-shop` と `fk-discount` だけを消し、他の開発用データは消しません。

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd workers
npx wrangler d1 execute DB --local --command "INSERT INTO shops (id, name, address, latitude, longitude, name_search, address_search, created_at, updated_at) VALUES ('fk-shop', '確認用', '', 1, 2, '確認用', '', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');"
npx wrangler d1 execute DB --local --command "INSERT INTO discounts (id, shop_id, subject, content, starts_at, ends_at, created_at, updated_at) VALUES ('fk-discount', 'fk-shop', NULL, NULL, NULL, NULL, '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');"
npx wrangler d1 execute DB --local --command "DELETE FROM shops WHERE id = 'fk-shop';"
npx wrangler d1 execute DB --local --command "SELECT COUNT(*) AS n FROM discounts WHERE id = 'fk-discount';"
```

最後の件数が 0 なら、CASCADE で割引も削除されています。続けて `PRAGMA foreign_key_check` を実行し、違反が残っていないことも見ます。同じ確認は、`workers` の `npm test` が一時ディレクトリのローカル D1 に対して行います。テストは `workers/.wrangler` を変更しません。

`workers/.wrangler` にある SQLite ファイルを、外部キーが無効な別のクライアントで直接開くと、`PRAGMA foreign_keys` は 0 のままのことがあります。その接続では、存在しない店舗への割引も、店舗削除時の CASCADE も働きません。確認と開発用の変更は、上の `wrangler d1 execute DB --local` で行います。

`updated_at` を進めるトリガーはありません。新規では `created_at` と `updated_at` に同じ日時を入れ、更新時は将来の Workers が `updated_at` を書き換えます。秒精度のため、同じ秒の複数回更新は区別しません。

## 日時

保存する形は `YYYY-MM-DDTHH:mm:ssZ` です。UTC、秒まで、20文字です。`created_at` と `updated_at` は NULL にできません。`starts_at` と `ends_at` は NULL にできます。両方あるときは `starts_at < ends_at` だけを許可します。同じ時刻と、開始が終了より後は拒否します。片方だけ NULL、両方 NULL は保存できます。

CHECK は区切り文字、各桁、月 1–12、日 1–31、時 0–23、分 0–59、秒 0–59 を見ます。小数秒、オフセット、小文字の `z`、空白区切りは拒否します。2月31日や、うるう年でない2月29日は、この CHECK では拒否しません。

時刻全体を一つの `GLOB` にすると、このローカル D1 は `LIKE or GLOB pattern too complex` を返し、正当な日時も保存できませんでした。そのため `GLOB` 一つにはせず、`substr` と `printf` と `CAST` に分けています。

暦の判定は `workers/src/utcTimestamp.ts` の `isUtcSecondTimestamp` です。公開 GET で不正な保存日時を除外する処理は [Issue #45](https://github.com/H-ampk/butterchickenCalai/issues/45) です。

## 検索列

`normalizeSearchText` は、NFKC、trim、小文字化の順です。店舗の INSERT と UPDATE では、`name` と `address` と二つの検索列を同じ操作で保存し、検索列はクライアント入力を信用しません。今回の変更に書き込み API はありません。seed の検索列は、この関数で SQL を生成しています。SQLite の `lower()` には任せていません。

関数を変えたときは、保存済みの `name_search` と `address_search` を同じ関数で作り直します。seed は `workers` で `npm run d1:seed:generate` を実行してから、生成された `workers/seeds/development.sql` を確認します。DB 側が検索列と元の文字列の一致を強制する制約はありません。

## インデックス

初期 migration のインデックスは `idx_discounts_shop_id` だけです。`created_at` の複合インデックスと、`name_search`、`address_search` のインデックスは作っていません。`LIKE '%...%'` に通常の B-tree が効くとは扱いません。

Wrangler 4.157.0 のローカル D1 で、空の `discounts` と seed 投入後の両方に対し、次の計画でした。

```text
EXPLAIN QUERY PLAN SELECT id FROM discounts WHERE shop_id = '11111111-1111-4111-8111-111111111111';
SEARCH discounts USING INDEX idx_discounts_shop_id (shop_id=?)
```

件数や SQLite の版が変わると、計画は変わり得ます。インデックスの存在と、計画で使われたことは分けて見ます。一覧の並び順に対する複合インデックスは、その SQL の `EXPLAIN QUERY PLAN` を見てから別の migration で検討します。

## 座標で確認したこと

- 両方 NULL は保存できる
- 片方だけ NULL は拒否する
- 緯度 -90 未満と 90 超、経度 -180 未満と 180 超は拒否する
- 境界の -90、90、-180、180 は保存できる
- 文字列 `north` のような数値でない値は拒否する
- `Infinity` は拒否する
- 数値に見える文字列 `12.5` は、REAL の型変換で数値になり、範囲内なら保存される
- JavaScript の `NaN` を両方にバインドすると、SQLite が保存前に NULL へ変換し、両方 NULL として保存される。CHECK は変換後の NULL を見るため、この組み合わせは拒否できない
- `NaN` と数値の組み合わせは、片側 NULL として拒否する

## ローカルでの適用

PowerShell で、リポジトリのルート、`frontend`、`workers` のいずれかから実行します。`--remote` は使いません。

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd workers
npm run d1:migrations:list
npm run d1:migrations:apply
npm run d1:seed
```

`npm run d1:check` は `SELECT 1` だけです。テーブルの有無は見ません。接続確認と migration は別です。

`npm run d1:migrations:apply` を重ねても、適用済みの `0001_initial.sql` は再実行しません。記録は `d1_migrations` です。

seed は普通の `INSERT` です。`INSERT OR REPLACE` は使いません。もう一度実行すると主キーで失敗し、既存の割引を CASCADE では消しません。入れ直すときは、先にリセットします。

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd workers
npm run d1:seed:reset
npm run d1:seed
```

リセットは `discounts` を先に削除し、そのあと `shops` を削除します。店舗削除の CASCADE だけには頼っていません。この SQL はローカルの全店舗と全割引を消します。本番用のスクリプトではありません。

Workers を止めて `workers/.wrangler` を削除すると、ローカル D1 を含む Wrangler のローカル状態が最初からになります。その後に migration と seed を再度適用します。本番データは入っていません。

## テスト

`workers` の `npm test` に、スキーマ、制約、seed のテストがあります。D1 は一時ディレクトリだけを使い、`workers/.wrangler` は変更しません。検索列と日時の単体テストも同じコマンドに含まれます。

## Issue #45 へ残すこと

公開 GET はこのスキーマを読みますが、公開判定は SQL の CHECK には入れていません。どの値を保存できるかは、この Issue #63 のスキーマの範囲です。どの行を公開するかは、Issue #45 の参照 API の範囲です。

- 店舗を公開する条件は、有効な緯度と経度の両方があることです。境界を含みます。店舗名が JavaScript の `trim()` 後に空でも、それだけでは公開対象から外しません。店舗名の空欄は、非公開条件に追加しません
- 座標が両方 NULL の店舗は保存できるが、公開 GET からは外す
- `subject` と `content` の少なくとも一方が `trim()` 後に空でないことを、公開 GET で要求する。両方空でも行は残す
- 不正な保存日時の除外と詳細の 404
- 販売期間の一覧判定は [Issue #50](https://github.com/H-ampk/butterchickenCalai/issues/50)
- 検索は `name_search` と `address_search` を使い、公開 JSON には出さない。`q` の `%` と `_` のエスケープは #45
- 並びの `created_at DESC, id ASC` 用インデックスは、まだ無い

## 未決定のまま残すこと

- 商品名、定価、割引価格、在庫
- 商品と割引の業務上の関係
- 外部公開時の承認方式
- Gmail 登録の権限
- 住所が空の店舗を公開するか
- 書き込み API のメソッドと応答
- 公開 JSON に `createdAt` と `updatedAt` を含めるか
- 12月末の必須機能
- 識別子を UUID に限るか。SQL は空でない TEXT だけを要求する

DB に日時を保存することと、API の JSON でその日時を返すことは別です。
