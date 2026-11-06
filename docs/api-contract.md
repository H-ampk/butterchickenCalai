# API連携方針

フロントエンドとバックエンドの連携方針です。API仕様は未確定です。この文書は実装済みの契約ではありません。

この改訂は [Issue #42](https://github.com/H-ampk/butterchickenCalai/issues/42) の採用候補の整理です。店舗と割引の読み取りを、TypeScript、Cloudflare Workers の API、Cloudflare D1 で揃えられる状態に近づけるための候補を含みます。候補は、チームが合意する前の案です。この改訂は仕様の最終合意ではなく、Workers API、D1 の migration、フロントエンドの実装は変えていません。

[Issue #4](https://github.com/H-ampk/butterchickenCalai/issues/4) は、この仕様作業の再編成前の Issue です。仕様の合意が終わったという意味では扱いません。読み取りの実装は、合意のあと [Issue #45](https://github.com/H-ampk/butterchickenCalai/issues/45) の範囲です。

## 文書の区分

| 区分 | 意味 | この文書での置き場所 |
| --- | --- | --- |
| 現行の実装 | `main` にあるもの | 「現行の実装」 |
| 既に合意された方針 | 構成や販売終了の扱いとして、すでに文書へ採用しているもの。環境も実装も未了のものを含む | 「既に合意された方針」 |
| 今回の採用候補 | この改訂で読み取り実装の前に揃えたい案。合意前 | 「今回の採用候補」 |
| 学科長・企業側への確認事項 | 商品の中身や公開の業務判断。開発チームだけで必須項目にしない | 「学科長・企業側への確認事項」 |
| 開発チーム内での未決定事項 | 業務判断のあと、またはそれと並行して実装側が決める項目 | 「開発チーム内での未決定事項」 |
| 将来の拡張機能 | 今回の店舗・割引の必須項目にしないもの | 「将来の拡張機能」 |

店舗・割引の Workers API と、そのデータを置く D1 のスキーマは未実装です。ローカルの Wrangler と `GET /__health` は [workers-local.md](workers-local.md) にあり、店舗・割引 API でも契約の確定でもありません。未実装の処理を、実装済みの契約としては書きません。採用候補を、確定した仕様としては書きません。

## 現行の実装

### 店舗の型

現行の店舗型は [frontend/src/types/shop.ts](../frontend/src/types/shop.ts) です。次の 5 項目はすべて必須です。

```typescript
export interface Shop {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}
```

| 項目 | 現行の型 | 用途 |
| --- | --- | --- |
| `id` | `string` | 店舗の識別子。モックでは `dev-shop-01` のような文字列 |
| `name` | `string` | 店舗名。検索の対象 |
| `address` | `string` | 住所。検索の対象 |
| `latitude` | `number` | 緯度。地図と座標の有効判定 |
| `longitude` | `number` | 経度。地図と座標の有効判定 |

### 割引の暫定型

[frontend/src/types/discount.ts](../frontend/src/types/discount.ts) に、前回草案へ合わせた暫定の `Discount` があります。合意済みの型ではありません。`subject` と `content` という名前、`startsAt` が `null` のときの意味は、型コメントのとおり未合意です。画面の一覧はこの型を表示していません。

### モックと取得

[frontend/src/api/mockShops.ts](../frontend/src/api/mockShops.ts) は、広島市内に散らした架空の店舗を 5 件持っています。店名、住所、位置は実在の割引情報ではありません。各要素は上の 5 項目だけです。

[frontend/src/api/mockDiscounts.ts](../frontend/src/api/mockDiscounts.ts) は、架空の割引を持っています。販売終了後の行も残しています。

[frontend/src/api/shops.ts](../frontend/src/api/shops.ts) の `getShops()` の戻り値の型は `Promise<Shop[]>` です。画面は `getShops()` だけを使い、モック配列を直接参照しません。既定はモックで、API へ通信しません。`VITE_DATA_SOURCE=api` のときだけ、Workers の仮パスへ通信します。通信に失敗してもモックへは戻しません。

前回のこの節は、`getShops()` が API へ通信しないと書いていました。[#81](https://github.com/H-ampk/butterchickenCalai/pull/81) のあと、既定のモックに加えて API モードがあります。この改訂でその記述を、実装に合わせています。

地図画面 [frontend/src/pages/MapPage.tsx](../frontend/src/pages/MapPage.tsx) は、`name`、`address`、`latitude`、`longitude` を表示します。

### 仮の一覧取得

[frontend/src/api/workersApi.ts](../frontend/src/api/workersApi.ts) のパスは、合意前の仮の値です。

| 定数 | 現行の仮パス |
| --- | --- |
| `PROVISIONAL_SHOP_LIST_PATH` | `GET /shops` |
| `PROVISIONAL_DISCOUNT_LIST_PATH` | `GET /discounts` |

仮のクライアントは、一覧の JSON が `items` 配列を持つオブジェクトであることを要求します。配列そのものを返す応答は形式不一致にします。`limit` と `offset` は付けません。コメントは、既定値が未合意であるためです。`total` は読みません。

店舗の要素は、`id`、`name`、`address` が文字列であり、`latitude` と `longitude` が有限な数であることを要求します。`createdAt` と `updatedAt` は要求しません。割引の要素は、暫定の `Discount` の各項目を要求します。`startsAt` と `endsAt` の項目が無い応答を `null` には置き換えません。省略と明示的な `null` を同じに扱うかは、未決定のままです。

この仮パスは、下の採用候補である `/api/v1` 付きのパスではありません。この改訂では定数を変えていません。

### 検索が参照する項目

[frontend/src/utils/shopSearch.ts](../frontend/src/utils/shopSearch.ts) の参照範囲は次のとおりです。

- `searchShops` は `name` と `address` だけを見ます。比較の前に NFKC 正規化、前後の空白除去、`toLowerCase` を行います。
- `filterShops` は、検索に加えて `hasCoordinates` を選べます。有効な座標は、有限数であり、緯度が -90 以上 90 以下、経度が -180 以上 180 以下です。境界値は有効です。`NaN` と `Infinity` は無効です。
- 割引の項目は見ていません。

検索はクライアント側です。この改訂でも、サーバー側の検索クエリは足していません。

### 販売期間の既存判定

[frontend/src/api/discountPeriod.ts](../frontend/src/api/discountPeriod.ts) の `classifyDiscountForNormalList` は、通常一覧へ含めるかを判定します。画面からは呼ばれていません。決定済みとして扱っているのは、開始より前の除外、終了日時を過ぎたあとの除外、開始時刻ちょうどは開始前ではない、という範囲です。次は未決定として、含めも除外もしていません。

- `endsAt` と現在時刻が同時
- `startsAt` が `null`
- タイムゾーンの無い日時、実在しない暦日、解釈できない現在時刻

`endsAt` が `null` で `startsAt` に時刻がある場合は、終了による除外をしません。`startsAt` が `null` の場合は、終了による除外に該当しなければ `undecided` を返します。この関数は、この改訂では変更していません。採用候補との差は「既存の期間判定との差」に書きます。

### 割引の試作

[frontend/src/api/main.py](../frontend/src/api/main.py) は、FastAPI の試作です。割引の配列をプロセスのメモリに持っています。D1 にも PostgreSQL にも接続せず、認証もありません。フロントエンドの `main.tsx` からは呼ばれていません。採用予定の Workers API ではありません。

試作が持つ項目は、数値の `id`、`shop_name`、`content`、`tags`、`latitude`、`longitude` です。`GET /discounts` と `POST /discounts` があります。このパスと項目は、合意済みの仕様ではありません。採用候補と形が似ていても、試作を仕様として採用しません。

### 店舗型を変えるときの影響

この改訂では TypeScript を変えません。合意後に必須項目を増やす、名前を変える、型を変える場合は、少なくとも次を見直します。

- `frontend/src/types/shop.ts`
- `frontend/src/types/discount.ts`
- `frontend/src/api/mockShops.ts`
- `frontend/src/api/mockDiscounts.ts`
- `frontend/src/api/shops.ts`
- `frontend/src/api/discounts.ts`
- `frontend/src/api/workersApi.ts`
- `frontend/src/api/discountPeriod.ts`
- `frontend/src/utils/shopSearch.ts`
- `frontend/src/pages/MapPage.tsx`
- `frontend/scripts/check-shops.ts`
- `frontend/scripts/check-shop-search.ts`
- `frontend/scripts/check-api-source.ts`

レスポンスへ項目を足すだけなら、現行の画面は知っている 5 項目だけを読めます。`getShops()` の戻り値を配列以外にする場合は、この関数の利用者を合わせます。仮のクライアントは、通信の応答では `items` を読み、関数の戻り値では配列に戻しています。

## 既に合意された方針

次は、この改訂より前に方針として採用しているものです。採用候補の節にある案は、ここに含めません。

- データ交換形式は JSON。通信の方式としては HTTP を使う。公開時の通信は HTTPS。詳細は [architecture.md](architecture.md)
- API 設計には OpenAPI を使う。パスとデータ構造の合意まで、OpenAPI の定義ファイルはリポジトリに追加しない。合意後に、決定事項から定義ファイルを起こす
- 合意した仕様で、TypeScript の型、Cloudflare Workers の API、Cloudflare D1 の列を揃える。FastAPI の試作はその仕様ではない
- 共有する店舗と割引は、Workers の API を経由して D1 に保存する。ブラウザから D1 を直接更新しない。ローカルの Wrangler と `GET /__health` は [workers-local.md](workers-local.md) にある。これは店舗・割引 API ではなく、契約の確定でもない。リモート D1、店舗・割引のエンドポイント、デプロイは未作成。構成の詳細は [architecture.md](architecture.md)
- D1 は SQLite 系である。PostgreSQL の専用の型や関数は使わない
- 登録、更新、削除の権限を持つ人は [Issue #58](https://github.com/H-ampk/butterchickenCalai/issues/58) で決める。認証方式はこの文書では決めない。書き込みに認証と認可を付ける方針は architecture.md にある
- データベースのテーブル、制約、migration の具体化は [Issue #63](https://github.com/H-ampk/butterchickenCalai/issues/63) が行う。[database/README.md](../database/README.md) のテーブル名は検討中の名前であり、確定したスキーマではない
- `endsAt` が `null` の割引は期限なしとする。販売終了後の割引は通常の一覧から外し、D1 の行は削除しない。比較の実装は [Issue #50](https://github.com/H-ampk/butterchickenCalai/issues/50)
- 店舗を物理削除する場合に限り、その店舗を参照する割引も外部キーの `ON DELETE CASCADE` で削除する。D1 で外部キーを有効にする手順は #63 が書く。店舗を削除できる人は #58
- 読み取り API の実装 Issue #45 では、登録、更新、削除を作らない
- API を変更するときは、フロントエンド、バックエンド、データベース、全体管理の関係担当者に共有する
- エンドポイントのパスは、チームの合意があるまで、この文書の候補も含めて確定しない

文字コードは UTF-8 を、前回草案から引き続き候補に残します。合意済みの方針には上げていません。

### この文書が定義しないリソース

入出力の候補を書くのは、Shops と Discounts だけです。

| リソース | 扱い |
| --- | --- |
| Shops | 読み取りの採用候補を書く。現行の `Shop` を公開応答の基本項目にする |
| Discounts | 読み取りの採用候補を書く。暫定の `Discount` は合意済みの型ではない |
| Users | 定義しない。登録と更新の主体は #58 |
| Posts | 定義しない。割引と投稿を同じリソースにするかは未決定 |
| Hashtags | 定義しない。12月末の必須にするかは未決定。#63 の表は TS-01 のあと |
| Favorites | 定義しない。お気に入り、レビュー、取り置き、通知の API とテーブルは、この文書では決めない |

お気に入りの保存方針は、ブラウザ内の IndexedDB に店舗 ID などの最小情報を置く、という [architecture.md](architecture.md) の記載です。処理は未実装です。[Issue #19](https://github.com/H-ampk/butterchickenCalai/issues/19) のサーバー側の投稿お気に入りとは未調整です。

## 今回の採用候補

この節は採用候補です。合意された仕様ではありません。実装の Issue は、この節が合意されるまで、パスと列を独自に確定して完了にしません。

### 前回草案からの変更

前回草案は [#77](https://github.com/H-ampk/butterchickenCalai/pull/77) です。矛盾する箇所は、候補の中身を変えた理由とともに残します。

| 項目 | 前回草案 | 今回の採用候補 | 理由 |
| --- | --- | --- | --- |
| 読み取りパス | `GET /shops` のように版が無い | `GET /api/v1/...` の 5 本 | 将来の API バージョンをパスで分ける。現行コードの仮パスは `/shops` と `/discounts` のまま |
| 書き込みパス | `POST`、`PATCH`、`DELETE` の例を候補にしていた | 今回はパスを候補にしない | 読み取りを先に揃える。メソッドの選択は未決定のまま |
| サーバー検索 `q` | 店舗一覧の任意クエリとして提案 | 初期実装では持たない | 現行の検索はクライアント側。正規化を SQLite の `LIKE` へどう落とすかは未決定 |
| `includeEnded` | 終了済みを返すクエリ名の候補 | 初期実装では持たない | 通常一覧からの除外は販売期間の規則で行う。クエリで上書きしない |
| ページ | 既定 20、上限 100 は未合意の候補。並び順は未決定 | 既定 20、上限 100、`offset` 既定 0。`created_at DESC, id ASC` | 同一データ集合の中での順序を決定的にする。取得中の追加や削除による重複と取りこぼしは防がない |
| `total` | 例に含まれ、意味は未記載 | フィルタ適用後、ページ分割前の総件数 | 画面が総数を誤らないようにする |
| エラー | `validation_error` と `details`、409、422 を提案 | `invalid_request` にまとめる。405 と 503 を足す | 読み取りに必要なコードを先に揃える。検証項目の配列は、登録 API のときに再検討する |
| D1 の失敗 | 500 を提案。503 は無い | 一時的な利用不能を 503、内部エラーを 500 に分ける | クエリ失敗をすべて 503 にしない |
| 座標 | `REAL NOT NULL` の必須 | 両方の `NULL` を許す。片方だけは許さない。未確定と不正は公開しない | [#84](https://github.com/H-ampk/butterchickenCalai/issues/84) と [#86](https://github.com/H-ampk/butterchickenCalai/issues/86) が、座標の確定前に店舗を保存する余地を必要とする |
| 日時の保存 | `TEXT` と Unix 秒の `INTEGER` が未決。比較用の文字列は一形に揃える | UTC に正規化した ISO 8601 文字列の `TEXT` | 前回草案が禁止している、形式の混在を避ける。列定義そのものは #63 |
| `endsAt` ちょうど | 販売中に含めるかは未決定。式の候補は `now < endsAt` | `startsAt <= now < endsAt`。同時刻は販売終了 | 半開区間に揃える。既存関数は同時刻を `undecided` のままにする |
| `startsAt` が `null` | 意味は未決定 | 開始制限なし | 両方 `null` を期間制限なしにできるようにする。既存関数は `undecided` のまま |
| 終了後の ID 取得 | 200 と 404 が未決定 | 公開できるデータなら 200 | 販売終了と非公開を混ぜない |
| 価格と在庫 | 将来の拡張として必須にしない | 将来の拡張から外し、確認事項へ移す | [#42 のコメント](https://github.com/H-ampk/butterchickenCalai/issues/42#issuecomment-6636896873) と [#87](https://github.com/H-ampk/butterchickenCalai/issues/87) が検討を求めている。必須項目としての合意ではない |

### エンドポイント

読み取りは、次の 5 本を採用候補にします。

| メソッド | パス | 用途 |
| --- | --- | --- |
| GET | `/api/v1/shops` | 店舗一覧 |
| GET | `/api/v1/shops/{shopId}` | 店舗詳細 |
| GET | `/api/v1/discounts` | 割引一覧 |
| GET | `/api/v1/discounts/{discountId}` | 割引詳細 |
| GET | `/api/v1/shops/{shopId}/discounts` | 店舗別割引一覧 |

`/api/v1` は、将来のバージョンを分けるための接頭辞です。現行の仮パス `GET /shops` と `GET /discounts`、試作の `GET /discounts` と `POST /discounts` は、この候補ではありません。

POST、PATCH、PUT、DELETE のパスは、今回は決めません。前回草案にあった次の例は、履歴として残し、この改訂の採用候補からは外します。

| 前回草案の例 | この改訂での扱い |
| --- | --- |
| `POST /shops` | 採用候補にしない |
| `PATCH /shops/{shopId}` | 採用候補にしない。`PUT` との選択は未決定 |
| `DELETE /shops/{shopId}` | 採用候補にしない。物理削除時の `ON DELETE CASCADE` は、上の合意済み方針のまま |
| `GET /shops/{shopId}/discounts` | パスだけ `/api/v1` 付きで読み取り候補に残す |
| `POST /shops/{shopId}/discounts` と、本文に `shopId` を置く `POST /discounts` | どちらも採用候補にしない |
| `PATCH /discounts/{discountId}` | 採用候補にしない |
| `DELETE /discounts/{discountId}` | 採用候補にしない |

登録、更新、削除の成功ステータス（201、200、204 など）も、今回は候補にしません。

### JSON と日時

- JSON の項目名は `camelCase`
- D1 の列名は `snake_case`
- Workers が両者を変換する
- 日時はタイムゾーン付きの ISO 8601
- 成功レスポンスの日時は UTC に統一する
- オフセットの無い日時と、日付だけは受け取らない、という前回草案の提案は候補として維持する
- 成功レスポンスの形の候補は、秒までの `YYYY-MM-DDTHH:mm:ssZ`。小数秒は付けない。桁をこれ以外に固定するかは、未決定のまま #63 と確認する
- D1 には、UTC に正規化した ISO 8601 文字列を `TEXT` で保存する候補とする。Unix 秒の `INTEGER` は、今回の候補から外す
- 日本標準時は表示用である。UTC+9 で、夏時間は無い。保存形式にはしない
- 時刻の比較は UTC で行う
- SQLite の `datetime('now')` は `YYYY-MM-DD HH:MM:SS` であり、`T` と `Z` が無い。この形式と ISO 8601 を混ぜて大小比較しない

入力が `2026-10-27T00:00:00+09:00` のとき、同じ時刻は `2026-10-26T15:00:00Z` です。成功レスポンスでは後者の形を返す候補です。

### 一覧レスポンス

一覧は次の形を採用候補にします。

```json
{
  "items": [],
  "total": 0,
  "limit": 20,
  "offset": 0
}
```

| 規則 | 採用候補 |
| --- | --- |
| `limit` の既定値 | 20 |
| `limit` の上限 | 100 |
| `offset` の既定値 | 0 |
| 一覧が 0 件 | HTTP 200。空の `items`。404 にはしない |
| `offset` が総件数以上 | HTTP 200。空の `items` |
| 単体取得 | リソースそのものを返す。`shop` や `discount` で包まない |
| 並び順 | `created_at DESC, id ASC` |
| `total` | フィルタ適用後、ページ分割前の総件数 |
| 応答の `limit` と `offset` | 適用した値を返す |

並び順 `created_at DESC, id ASC` が保証するのは、同一のデータ集合を同じ条件で読んだときの順序が決まっていることだけです。第 2 キーの `id ASC` は、`created_at` が同じ行の相対順を決めるために置きます。比較に使う日時文字列は、上の UTC の一形に揃えます。

この並びは、ページ取得の途中で起きた追加や削除から、結果を守りません。`offset` はリクエストのたびに、その時点の集合を先頭から数えます。次のページを取るまでに行が増えると、すでに返した行が再び出ることがあります。行が減ると、まだ返していない行を飛ばすことがあります。カーソル方式と、取得開始時の集合を固定するスナップショット方式は、今回の採用候補には含めません。

`limit` が整数でない、1 未満、101 以上、または `offset` が 0 未満の整数でない場合は、HTTP 400 `invalid_request` とする候補です。

店舗一覧の形の例です。パスは候補です。

`GET /api/v1/shops?limit=20&offset=0`

```json
{
  "items": [
    {
      "id": "shop_example_01",
      "name": "架空商店 紙屋町",
      "address": "広島県広島市中区紙屋町1丁目（架空）",
      "latitude": 34.3955,
      "longitude": 132.4553,
      "createdAt": "2026-10-26T06:00:00Z",
      "updatedAt": "2026-10-26T06:00:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

単体取得の例です。

`GET /api/v1/shops/shop_example_01`

```json
{
  "id": "shop_example_01",
  "name": "架空商店 紙屋町",
  "address": "広島県広島市中区紙屋町1丁目（架空）",
  "latitude": 34.3955,
  "longitude": 132.4553,
  "createdAt": "2026-10-26T06:00:00Z",
  "updatedAt": "2026-10-26T06:00:00Z"
}
```

`createdAt` と `updatedAt` を公開応答へ含めることは、引き続き候補です。現行の `Shop` 型は要求していません。この改訂では型を変えません。

### 初期実装で持たないクエリ

初期実装では、サーバー側の検索クエリ `q` と、終了済みを含める `includeEnded` を実装しない候補とします。

既存のフロントエンド検索は、これまでどおりクライアント側の `searchShops` で行います。

ページ分割された 1 ページだけでは、全店舗を検索できません。次のどちらにするかは、開発チームの検討事項として残します。この改訂では選びません。

- フロントエンドが全ページを取得してから、現行のクライアント検索をかける
- 将来、サーバー側の検索を追加する

全ページを順に取得する案を選んでも、各リクエストの `offset` は、その時点の集合を先頭から数えます。取得の途中で行が増減すると、集めた結果に重複や取りこぼしがあり得ます。二者のどちらにするかは、この制限とは別に、開発チームの検討事項のままです。

割引一覧の `shopId` クエリも、初期実装の候補にはしません。店舗を指定する取得は `GET /api/v1/shops/{shopId}/discounts` を使います。

### HTTP エラー

エラー応答は次の形に統一する候補です。

```json
{
  "error": {
    "code": "not_found",
    "message": "対象のリソースが見つかりません。"
  }
}
```

`message` は利用者が読める文です。内部の例外、SQL、接続情報、秘密情報は返しません。

| HTTP | code | 内容 |
| --- | --- | --- |
| 400 | `invalid_request` | 不正なリクエスト |
| 404 | `not_found` | 対象が存在しない、または公開対象外 |
| 405 | `method_not_allowed` | 許可されていない HTTP メソッド |
| 500 | `internal_error` | サーバー内部のエラー |
| 503 | `service_unavailable` | 一時的なサービス利用不能 |

404 は、行が無い場合と、公開対象外の場合の両方に使います。クライアントは、存在と非公開を応答だけでは区別できません。

D1 のクエリ失敗を、すべて 503 にはしません。一時的にデータベースへ到達できない場合は 503、想定外の内部失敗は 500 に分ける候補です。どちらも、失敗の内部文はクライアントへ返しません。個々の D1 エラーコードの振り分けは #45 の実装時に、この区別を守って書きます。

前回草案の `details`、`validation_error`、409、422 は、今回の読み取り候補には含めません。登録 API で項目ごとの検証文が必要になったときに、改めて候補にします。

401 と 403 を使う認証・認可は、#58 で決めます。この節では、そのコードを候補に追加しません。読み取りを認証なしで許すかも、未決定のままです。

### 公開応答の項目

公開する店舗の項目候補は、現行の `Shop` に作成日時と更新日時を足したものです。座標が有効な店舗だけを公開します。座標の保存規則は次の節です。

| JSON | 採用候補での公開 | 型の候補 | D1 の列名候補 |
| --- | --- | --- | --- |
| `id` | 応答に含める。採番はサーバー | `string` | `id` `TEXT PRIMARY KEY` |
| `name` | 含める | `string` | `name` |
| `address` | 含める | `string` | `address` |
| `latitude` | 公開時は数。未確定の店舗は応答に出さない | `number` | `latitude`。`NULL` を許す |
| `longitude` | 公開時は数。未確定の店舗は応答に出さない | `number` | `longitude`。`NULL` を許す |
| `createdAt` | 応答に含める候補。入力には含めない | `string` | `created_at` |
| `updatedAt` | 応答に含める候補。入力には含めない | `string` | `updated_at` |

店舗名の一意制約は、前回草案と同じく提案しません。同名を許すかは未決定です。文字列の最大長も未決定です。

割引の公開応答では、期間判定と店舗への参照に必要な次を候補にします。`subject` と `content` は前回草案の名前であり、暫定の TypeScript が読んでいます。商品名、定価、割引価格、在庫数の採用ではありません。名前をこのまま必須にするかは、未決定事項に残します。

| JSON | 採用候補 | 型の候補 | D1 の列名候補 |
| --- | --- | --- | --- |
| `id` | 応答に含める | `string` | `id` `TEXT PRIMARY KEY` |
| `shopId` | 店舗別一覧を成立させる参照として含める | `string` | `shop_id`。`shops.id` への外部キー |
| `startsAt` | 任意。`null` は開始制限なし | `string` または `null` | `starts_at`。`NULL` を許す |
| `endsAt` | 任意。`null` は終了制限なし。これは合意済みの方針 | `string` または `null` | `ends_at`。`NULL` を許す |
| `createdAt` | 応答に含める候補 | `string` | `created_at` |
| `updatedAt` | 応答に含める候補 | `string` | `updated_at` |
| `subject` | 前回草案の名前を残す。必須とは決めない | `string` | `subject` |
| `content` | 前回草案の名前を残す。必須とは決めない | `string` | `content` |

`subject` の別名候補は `productName` と `target` です。`content` の別名候補は `offer` と `description` です。どれも未合意です。

`status` のような新しい応答項目は、今回追加しません。販売中かどうかは、開始と終了の日時から計算する候補です。

識別子の採番は、Workers が空でない文字列を作る候補です。API に SQLite の `rowid` は出しません。UUID にするかは未決定です。PostgreSQL の UUID 型は使いません。

### D1 のデータ構造

テーブル名の候補は `shops` と `discounts` です。主キーは `TEXT PRIMARY KEY` を候補にします。

割引の `shop_id` は店舗を参照する外部キーとし、店舗の物理削除時には `ON DELETE CASCADE` を使います。この連鎖削除は、合意済みの方針です。

日時列は、UTC に正規化した ISO 8601 文字列の `TEXT` を候補にします。

具体的な列定義、`NOT NULL`、チェック制約、インデックス、migration ファイルは #63 の責務です。この改訂では作りません。#63 への入力として、次の制約の意図だけを残します。

| 候補 | #63 へ渡す意図 |
| --- | --- |
| `shops.id`、`discounts.id` | `TEXT` の主キー。API の `id` と同じ文字列 |
| `discounts.shop_id` | `TEXT NOT NULL`。`shops.id` を参照。削除時は `ON DELETE CASCADE` |
| `latitude`、`longitude` | 両方 `NULL` を許す。ちょうど片方だけが `NULL` の状態は許さない |
| 座標の範囲 | 緯度は -90 以上 90 以下。経度は -180 以上 180 以下。両方とも数があるときだけ適用する |
| `starts_at`、`ends_at` | `NULL` を許す。両方に値がある行は `starts_at < ends_at` |
| 終了フラグ列 | 作らない |

インデックスの要否は #63 が判断します。前回草案の候補は、`discounts(shop_id)`、`discounts(ends_at)`、`discounts(shop_id, ends_at)` です。この一覧は、インデックスの作成まで決めたものではありません。

ユーザーテーブルは #58 のあと、という #63 の未決定事項のままです。この文書はユーザーへの外部キーを足しません。

### 座標が未確定の店舗

次を採用候補にします。

- 緯度と経度が未確定の店舗も D1 に保存できる
- `latitude` と `longitude` は、両方とも `NULL` を許す
- 片方だけ `NULL` の状態は認めない
- 緯度は -90 以上 90 以下、経度は -180 以上 180 以下
- 無効な座標、または座標が未確定の店舗は、公開 API から返さない
- 店舗詳細も同様に公開しない。HTTP 404 `not_found`
- 住所のジオコーディングが終わったあとで、座標を更新できる構造を想定する

座標が揃って範囲内であることが、公開の必要条件の候補です。座標の有無だけで公開可否のすべてを決めません。承認の要否など、その他の公開条件は確認事項に残します。有効な座標があっても、別の公開条件で出さないことはあり得ます。その条件が決まるまでは、座標以外の公開ゲートをこの文書で追加しません。

現行の `Shop` 型と仮のパーサは、公開応答と同じく、有限な緯度と経度を要求します。D1 にだけ存在する座標未確定の行は、公開一覧へ出ません。この改訂ではパーサを変えていません。

### Workers の設定

次を採用候補にします。

| 項目 | 候補 |
| --- | --- |
| D1 バインディング名 | `DB` |
| migration ディレクトリ | `database/migrations/` |
| ローカル開発 | Wrangler を使う |
| 本番公開 | この候補の範囲では実施しない |

[#43](https://github.com/H-ampk/butterchickenCalai/issues/43) の本文は、PG-01 と同じバインディング名でローカル D1 へ接続する、と書いています。名前そのものは #43 の本文に無いため、この候補で `DB` と呼ぶことにします。ローカルの Wrangler 設定は [../workers/wrangler.jsonc](../workers/wrangler.jsonc) にあり、バインディング名 `DB` でローカル D1 へ接続します。手順と `GET /__health` は [workers-local.md](workers-local.md) です。これは店舗・割引 API ではなく、上の表を契約として確定するものでもありません。migration の中身は #63 が実装します。この改訂では migration を作りません。本番のアカウント、URL、大学の利用許可は未了のままです。

### 販売期間

販売期間の境界は、次で統一する候補です。

```text
startsAt <= now < endsAt
```

`null` のときは、対応する境界を適用しません。比較は UTC です。

| 条件 | 意味 |
| --- | --- |
| `startsAt` と同時刻 | 販売開始。通常一覧に含める |
| `endsAt` と同時刻 | 販売終了。通常一覧から外す |
| `startsAt: null` | 開始制限なし |
| `endsAt: null` | 終了制限なし。これは合意済みの方針 |
| 両方 `null` | 期間制限なし |

開始と終了の両方が指定されている場合、`startsAt < endsAt` を必要条件とします。同じ時刻、または開始が終了以降の値は、保存しない候補です。読み取り時にそのような行があった場合の HTTP ステータスは、未決定です。

日時の省略と、明示的な `null` を同一視するかは、登録・更新 API の入力仕様として検討事項に残します。現行の割引パーサは、項目の省略を `null` にせず形式不一致にします。

### 既存の期間判定との差

`classifyDiscountForNormalList` と、上の候補の差は次のとおりです。ソースは変更していません。

| 入力 | 現行の関数 | 今回の採用候補 |
| --- | --- | --- |
| `startsAt` ちょうどで、終了より前 | `include` | 販売開始。一致 |
| `startsAt` より前 | `exclude` / `not-started` | 一覧から外す。一致 |
| `endsAt` より後 | `exclude` / `ended` | 一覧から外す。一致 |
| `endsAt` ちょうど | `undecided` / `ends-at-boundary` | 販売終了として一覧から外す。不一致 |
| `startsAt` が `null` で、終了条件には掛かっていない | `undecided` / `starts-at-null` | 開始制限なしとして、終了条件だけを見る。両方 `null` なら期間制限なし。不一致 |
| `endsAt` が `null` で、`startsAt` は時刻があり開始済み | 終了では除外しない | 終了制限なし。一致 |
| タイムゾーンが無い、または暦として無い日時 | `undecided` / `invalid-datetime` | 公開応答では返さない方向が自然。ステータスは未決定 |

候補が合意されるまで、この関数の `undecided` を除外や採用へ置き換えません。通常一覧から外す実装の主体は #50 です。#45 は、合意後の読み取りで同じ規則を使います。

### 販売終了後の取得

次を採用候補にします。

| 取得方法 | 終了済み割引 |
| --- | --- |
| 通常の割引一覧 `GET /api/v1/discounts` | 除外 |
| 店舗別割引一覧 `GET /api/v1/shops/{shopId}/discounts` | 除外 |
| 割引 ID による詳細 `GET /api/v1/discounts/{discountId}` | 公開できるデータなら HTTP 200 |
| D1 の内部 | 行を残す |

終了した割引も、公開できるデータであれば ID 指定で取得できます。非公開のデータ、または無効な座標や座標未確定の店舗に属する割引は、ID 指定でも公開しません。その場合は HTTP 404 `not_found` です。

販売終了と非公開は別の状態です。終了済みであることを理由に行を消したり、非公開用の列を必須にしたりしません。`status` は足しません。

開始前の割引は、境界式を満たさないため、通常の一覧と店舗別一覧からは外す候補です。ID 指定の詳細で開始前を 200 で返すかは、この表では決めていません。終了後の 200 は、販売が終わったあとも公開できるデータを残すための候補です。

販売期間による通常一覧からの除外実装は、#50 と次のように分けます。これは責務の整理案であり、Issue 本文の書き換えではありません。

| Issue | 範囲 |
| --- | --- |
| #42 | 境界と、一覧から外すこと、ID 取得は残すことの候補をこの文書に書く |
| #50 | 終了済みを一覧、検索、地図の通常結果から外す。行は削除しない。境界のテストを足す。管理用の表示は、#58 で必要と合意した場合だけ |
| #45 | 合意後のパスで一覧と詳細を読む。一覧の除外は #50 の規則に接続する。詳細は終了済みでも、公開条件を満たせば 200。0 件と取得失敗を区別する |
| #63 | 期間列と制約を migration にする。終了フラグ列は作らない |

### 読み取りの応答例

店舗別の割引一覧の例です。`subject` と `content` は前回草案の名前を例示しているだけで、必須項目の決定ではありません。

`GET /api/v1/shops/shop_example_01/discounts?limit=20&offset=0`

```json
{
  "items": [
    {
      "id": "discount_example_01",
      "shopId": "shop_example_01",
      "subject": "日替わりランチ",
      "content": "10%OFF",
      "startsAt": "2026-10-26T15:00:00Z",
      "endsAt": "2026-10-27T06:00:00Z",
      "createdAt": "2026-10-26T06:00:00Z",
      "updatedAt": "2026-10-26T06:00:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

この例の期間は、`startsAt` 以上かつ `endsAt` 未満です。`endsAt` の `2026-10-27T06:00:00Z` ちょうどは販売終了です。

## 学科長・企業側への確認事項

次は、開発チームだけで必須項目や公開条件にしません。Gmail の件名 `SDGS` で確認できているコマンドは、学科長側の既存形式の記録です。12月末の必須承認でも、公開 API の項目決定でもありません。

確認できている店舗コマンドは `表追加,店舗,店舗名,緯度,経度` です。確認できている商品コマンドは `表追加,商品,店舗ID,商品名,定価,割引価格,在庫数,年月日,開始時間,終了時間` です。住所形式のコマンド構文は未決定です。決まるまで住所パーサは確定しません。根拠は [#82](https://github.com/H-ampk/butterchickenCalai/issues/82)、[#86](https://github.com/H-ampk/butterchickenCalai/issues/86)、[#87](https://github.com/H-ampk/butterchickenCalai/issues/87)、および #42 のコメントです。

| 確認したいこと | いまの位置づけ | 関連 |
| --- | --- | --- |
| 商品名を公開 API の必須項目にするか | コマンドには含まれる。必須とは扱わない | #82、#87 |
| 定価を持つか。割引価格との関係を不正とする条件を公開ルールにするか | #87 は割引価格が定価を超える値の拒否を作業に含めている。API の必須項目にはしない | #87 |
| 割引価格を公開するか | 同上 | #87 |
| 在庫数を公開するか。在庫の単位をどう扱うか | #87 の未決定。取り置きは対象外 | #87、[#57](https://github.com/H-ampk/butterchickenCalai/issues/57) |
| 販売開始日時と販売終了日時を、すべての商品に必須にするか | 値があるときの境界は採用候補。必須にはしない。`null` は制限なし | #42、#50、#87 |
| 商品が常に 1 店舗に属するか | 店舗別一覧と `shopId` は、その前提の採用候補。業務上の関連は未確認 | #86、#87 |
| 商品と割引を、利用者から見て同一の情報として扱うか | #87 は商品コマンドを割引情報として保存する前提。同一リソースにする最終判断は未確認 | #87 |
| 商品情報の公開条件 | 座標が有効であることは店舗公開の必要条件の候補にすぎない | #84、#86 |
| 在庫切れの商品を表示するか | 未確認。0 を登録するか拒否するかも #87 の未決定 | #87 |
| Gmail で登録された情報を、即公開するか承認制にするか | #58 のコメントと [#90](https://github.com/H-ampk/butterchickenCalai/issues/90) は未決定。承認必須とは書かない | #58、#85、#86、#87、#90 |
| 住所形式のコマンド構文 | 未決定。緯度・経度形式の廃止はしない | #82、#84、#86 |
| 12月末に必須とする機能の範囲 | 各 Issue の `deadline:candidate` は、学科長の必須承認ではない | #42、#82 以降 |
| 誰が店舗と割引を登録してよいか。メールの送信者を許すか | #58。無許可の送信者は登録しない、は #86 の作業範囲。方式は未確定 | #58、#86 |

価格、在庫、商品名を、この表の確認が終わる前に `Discount` の必須項目や D1 の必須列としては足しません。#63 は、確認前にそれらの列を必須の migration として確定しません。

## 開発チーム内での未決定事項

次は、実装の詳細として残っているものです。業務上の要否が上の表にある項目は、ここだけで決めません。

### 入出力

- 読み取り 5 本と、この節の候補を、チームが採用するか
- 書き込みのパス。`PATCH` と `PUT` のどちらを使うか。割引登録の URL に店舗を含めるか
- 登録を 201 にするか。削除を 204 にするか。`Location` を付けるか
- 未知の項目を拒むか、無視するか
- 日時の省略と明示的な `null` を、登録・更新で同一視するか
- 小数秒の有無を、秒までの UTC 以外に変えるか
- 文字列の最大長。店舗名を一意にするか
- `subject` と `content` を残すか、別名にするか、一つの文字列に戻すか
- ページ分割に対し、全ページ取得と将来のサーバー検索のどちらで現行の検索を成立させるか。正規化をサーバーで NFKC と `toLowerCase` に揃えるか
- 開始前の割引を、ID 指定で 200 にする候補を採用するか
- 範囲外の期間行を読んだときのステータス
- 割引単体の削除を物理削除にするか。論理削除の列は、今回の必須項目にまだ足さない
- 更新の競合を `updatedAt` で検出するか。409 を使うか
- 読み取りに認証が要るか。401 と 403 の条件は #58

### 保存と関連 Issue

- 識別子の生成方法。`TEXT` の主キー候補は上に書いた
- 外部キーを D1 で有効にする手順と、どのインデックスを作るか。手順は #63
- 座標未確定を表す列を、両方 `NULL` 以外に持つか。住所原文を残すか。変換状態の列を持つか。#63 と #84
- ジオコーディングのサービス。Geolonia は #84 の第一候補であり、採用確定ではない
- 商品の再送を追加とみなすか更新とみなすか。一致キー。#88。決定前に更新処理を有効にしない
- 処理済みメッセージ ID の保存先。#63 と #85、#88
- 画像の保存先
- お気に入りの対象を店舗と投稿のどちらに揃えるか。architecture.md と #19 は未調整
- OpenAPI 定義ファイルの置き場所と、追加する時期
- 仮パス `/shops` と `/discounts` を、合意後に `/api/v1` へ差し替える作業。差し替えは #45 の実装時。この改訂では定数を変えない

### Gmail のコマンドとこの文書の関係

コマンドの解析、受信、D1 への登録は、公開の読み取り API とは別の Issue です。

| Issue | この文書との関係 |
| --- | --- |
| [#82](https://github.com/H-ampk/butterchickenCalai/issues/82) | 件名 `SDGS` の店舗コマンドと商品コマンドを解析する。D1 には書かない。住所構文が未決定のコマンドは確定しない。日時の入力タイムゾーンは、この文書の保存候補（UTC の ISO 8601）と揃える対象であり、入力の解釈は未決定 |
| [#85](https://github.com/H-ampk/butterchickenCalai/issues/85) | 新着の取得。解析と登録はしない。即公開か承認制かは未決定 |
| [#84](https://github.com/H-ampk/butterchickenCalai/issues/84) | 住所から座標への変換を調査する。失敗した住所は公開しない、という作業範囲が、座標未確定を公開しない候補と合う。変換できた座標だけを保存する完了条件は、未確定の両方 `NULL` を許す候補と並べて #63 が列を決める。この改訂ではジオコーダを採用済みにしない |
| [#86](https://github.com/H-ampk/butterchickenCalai/issues/86) | 店舗コマンドを D1 へ反映する経路。公開の登録 API には吸収しない。無許可の送信者は登録しない。座標が不正な店舗は公開しない |
| [#87](https://github.com/H-ampk/butterchickenCalai/issues/87) | 商品コマンドを割引情報として保存したい、という作業範囲。価格、在庫、商品名は、上の確認が終わるまで必須列にしない。販売終了後の除外は #50。行は削除しない |
| [#88](https://github.com/H-ampk/butterchickenCalai/issues/88) | 二重登録の防止。再送を追加にするか更新にするかは未決定 |
| [#89](https://github.com/H-ampk/butterchickenCalai/issues/89) | 結合確認。未決定の承認制や住所構文を、テストの都合で決定しない |

禁止コマンド（`直接`、`再作成`、`全自動`、その他の SQL 実行）は #82 が拒否する対象です。この文書の API パスにはしません。

## 将来の拡張機能

確認が無い限り、次を店舗と割引の必須項目やエンドポイントに足しません。価格、在庫、商品名は、将来の拡張へ戻したのではありません。上の確認事項です。

- ユーザー登録とログインのリソース。方式は #58
- 投稿、ハッシュタグ、いいね、コメント
- お気に入り API。現行の方針はブラウザ内の IndexedDB
- レビュー、取り置き、予約
- 通知。[Issue #28](https://github.com/H-ampk/butterchickenCalai/issues/28) の範囲であり、アプリ内通知も Web Push も採用済みにしない
- 画像、カテゴリ、営業時間
- AI による投稿文章からの割引抽出
- サーバー側のテキスト検索と、終了済みを一覧へ戻すクエリ

## 接続先

フロントエンドが API の基底 URL を参照する環境変数は `VITE_API_BASE_URL` です。値の例は [frontend/.env.example](../frontend/.env.example) にあります。実際の `.env` は Git の管理対象外です。

例の値は `http://localhost:8000` のままです。旧設計のローカル待受を想定しています。Workers の URL へは、この改訂では変えていません。
