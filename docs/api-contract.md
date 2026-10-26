# API連携方針

フロントエンドとバックエンドの連携方針です。API仕様は未確定です。この文書は実装済みの契約ではありません。

この改訂は [Issue #42](https://github.com/H-ampk/butterchickenCalai/issues/42) のレビュー用草案です。店舗と割引の入出力を、TypeScript、Cloudflare Workers の API、Cloudflare D1 で揃えるための提案を含みます。サンプルのパスと項目名は、チームが合意する前の候補です。

[Issue #4](https://github.com/H-ampk/butterchickenCalai/issues/4) は、この仕様作業の再編成前の Issue です。仕様の合意が終わったという意味では扱いません。実装は、合意のあと [Issue #45](https://github.com/H-ampk/butterchickenCalai/issues/45) の範囲です。この文書の更新では、API、データベース、TypeScript の実装は変えていません。

## 文書の区分

| 区分 | 意味 | この文書での置き場所 |
| --- | --- | --- |
| 現行の実装 | `main` にあるもの | 「現行の実装」 |
| 採用予定 | 構成の方針は決まっている。環境も実装も未了 | 「採用予定のアーキテクチャ」 |
| API仕様の提案 | レビュー用の候補。合意前 | 「API仕様の提案」 |
| チーム合意が必要な事項 | この草案では決めていない項目 | 「チーム合意が必要な事項」 |
| 将来の拡張機能 | 今回の店舗・割引の必須項目にしないもの | 「将来の拡張機能」 |

Workers API と D1 は未実装です。未実装の処理を、実装済みの契約としては書きません。

## 方針

- API設計には OpenAPI を利用する
- データ交換形式は JSON
- 通信には HTTP を使用する
- APIのエンドポイントと認証方式は今後決定する
- 合意した仕様で、TypeScript の型、Cloudflare Workers の API、Cloudflare D1 の列を揃える。`frontend/src/api/main.py` の FastAPI 試作は、その仕様ではない
- APIを変更するときは、フロントエンド、バックエンド、データベース、全体管理の関係担当者に共有する

エンドポイントのパスは、チームの合意があるまでこの文書でもコードでも確定させません。

OpenAPI の方針は維持します。パスとデータ構造が合意されるまで、OpenAPI の定義ファイルはこのリポジトリに追加しません。合意後に、この文書の決定事項から定義ファイルを起こします。

公開時の通信は HTTPS です。詳細は [architecture.md](architecture.md) にあります。上の「通信には HTTP を使用する」は、データの交換方式として残しています。

## 現行の実装

### 店舗の型

現行の店舗型は [frontend/src/types/shop.ts](../frontend/src/types/shop.ts) です。次の 5 項目はすべて必須です。割引の型は、TypeScript にはありません。

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

### モックと取得

[frontend/src/api/mockShops.ts](../frontend/src/api/mockShops.ts) は、広島市内に散らした架空の店舗を 5 件持っています。店名、住所、位置は実在の割引情報ではありません。各要素は上の 5 項目だけです。

[frontend/src/api/shops.ts](../frontend/src/api/shops.ts) の `getShops()` は、このモックのコピーを返します。戻り値の型は `Promise<Shop[]>` です。画面は `getShops()` だけを使い、モック配列を直接参照しません。この関数は API へ通信しません。切り替えは、仕様の合意後にこの関数の内部で行います。この草案では、そのコードを変えません。

地図画面 [frontend/src/pages/map.ts](../frontend/src/pages/map.ts) は、`name`、`address`、`latitude`、`longitude` を表示します。

### 検索が参照する項目

[frontend/src/utils/shopSearch.ts](../frontend/src/utils/shopSearch.ts) の参照範囲は次のとおりです。

- `searchShops` は `name` と `address` だけを見ます。比較の前に NFKC 正規化、前後の空白除去、`toLowerCase` を行います。
- `filterShops` は、検索に加えて `hasCoordinates` を選べます。有効な座標は、有限数であり、緯度が -90 以上 90 以下、経度が -180 以上 180 以下です。境界値は有効です。`NaN` と `Infinity` は無効です。
- 割引の項目は見ていません。

### 割引の試作

[frontend/src/api/main.py](../frontend/src/api/main.py) は、FastAPI の試作です。割引の配列をプロセスのメモリに持っています。D1 にも PostgreSQL にも接続せず、認証もありません。フロントエンドの `main.ts` からは呼ばれていません。採用予定の Workers API ではありません。

試作が持つ項目は、数値の `id`、`shop_name`、`content`、`tags`、`latitude`、`longitude` です。`GET /discounts` と `POST /discounts` があります。このパスと項目は、合意済みの仕様ではありません。この草案の候補と形が似ていても、試作を仕様として採用しません。

### 店舗型を変えるときの影響

この草案では TypeScript を変えません。合意後に必須項目を増やす、名前を変える、型を変える場合は、少なくとも次を見直します。

- `frontend/src/types/shop.ts`
- `frontend/src/api/mockShops.ts`
- `frontend/src/api/shops.ts`
- `frontend/src/utils/shopSearch.ts`
- `frontend/src/pages/map.ts`
- `frontend/scripts/check-shops.ts`
- `frontend/scripts/check-shop-search.ts`

レスポンスへ項目を足すだけなら、現行の画面は知っている 5 項目だけを読めます。`getShops()` の戻り値を配列以外にする場合は、この関数の利用者を合わせます。

## 採用予定のアーキテクチャ

共有する店舗と割引は、Cloudflare Workers の API を経由して Cloudflare D1 に保存します。ブラウザから D1 を直接更新しません。詳細は [architecture.md](architecture.md) にあります。Workers、D1、デプロイは未作成です。

- データ交換は JSON です。文字コードは UTF-8 を提案します。
- D1 は SQLite 系です。PostgreSQL の専用の型や関数は使いません。
- 登録、更新、削除の権限を持つ人は [Issue #58](https://github.com/H-ampk/butterchickenCalai/issues/58) で決めます。この文書では認証方式を決めません。
- データベースのテーブル、制約、migration は [Issue #63](https://github.com/H-ampk/butterchickenCalai/issues/63) が決めます。[database/README.md](../database/README.md) のテーブル名は、検討中の名前であり、確定したスキーマではありません。

## 検討対象のリソース

既存の検討対象は残します。この草案が入出力を提案するのは、Shops と Discounts だけです。

| リソース | この草案での扱い |
| --- | --- |
| Shops | 提案する。現行の `Shop` を基本項目にする |
| Discounts | 提案する。現行の TypeScript に型は無い |
| Users | 定義しない。登録と更新の主体は #58 |
| Posts | 定義しない。割引と投稿を同じリソースにするかは未決定 |
| Hashtags | 定義しない。12月末の必須にするかは #42 の未決定事項。表は #63 では TS-01 のあと |
| Favorites | 定義しない。お気に入り、レビュー、取り置き、通知の API とテーブルは、この草案では決めない |

お気に入りの保存方針は、ブラウザ内の IndexedDB に店舗 ID などの最小情報を置く、という [architecture.md](architecture.md) の記載です。処理は未実装です。[Issue #19](https://github.com/H-ampk/butterchickenCalai/issues/19) のサーバー側の投稿お気に入りとは未調整です。

## API仕様の提案

この節は提案です。表の「区分」が「提案」の行は、合意された必須項目ではありません。パスは候補です。

### 店舗の項目

基本項目は、現行の `Shop` と同じ 5 つを提案します。作成日時と更新日時は、割引と D1 の監査用にレスポンスへ足す提案です。現行の型にはまだありません。画面が無視できる追加項目であり、この変更では型を変えません。

JSON の名前は camelCase を提案します。現行の TypeScript と揃えるためです。D1 の列名は snake_case を提案します。対応は Workers で行う想定です。両方の名前は未合意です。

| JSON（提案） | 区分 | 必須の提案 | TypeScript | 用途 | バリデーションの提案 | D1（提案） |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | 提案 | レスポンスでは必須。登録の入力には含めない | `string` | 識別子 | 空にしない。サーバーが採番する。生成方法は未決定 | `TEXT` 主キー。API には SQLite の `rowid` を出さない |
| `name` | 提案 | 必須 | `string` | 表示と検索 | 前後の空白を除いたあと空を拒む。最大長は未決定 | `TEXT NOT NULL`。列名候補 `name` |
| `address` | 提案 | 必須 | `string` | 表示と検索 | `name` と同じ。最大長は未決定 | `TEXT NOT NULL`。列名候補 `address` |
| `latitude` | 提案 | 必須 | `number` | 地図 | 有限数。-90 以上 90 以下。現行の `shopSearch` と同じ境界 | `REAL NOT NULL`。列名候補 `latitude` |
| `longitude` | 提案 | 必須 | `number` | 地図 | 有限数。-180 以上 180 以下 | `REAL NOT NULL`。列名候補 `longitude` |
| `createdAt` | 提案 | レスポンスでは必須。入力には含めない | `string` | 作成日時 | サーバーが付与する | `TEXT NOT NULL`。列名候補 `created_at`。保存形式は日時の節 |
| `updatedAt` | 提案 | レスポンスでは必須。入力には含めない | `string` | 更新日時 | サーバーが付与する | `TEXT NOT NULL`。列名候補 `updated_at` |

店舗名の一意制約は提案しません。同名の店舗を許す候補です。一意にするかは未決定です。

登録と更新の入力から外す項目は、`id`、`createdAt`、`updatedAt` です。

### 割引の項目

割引は `shopId` で店舗を参照する形を提案します。店名と座標は Shops 側の項目として扱います。試作のように割引へ店名と座標を複製する形は、未決定事項に残します。

商品名または割引対象と、割引内容は、別項目に分けることを提案します。試作の `content` は、対象と内容が一つの文字列に入っていました。一つの文字列に戻す候補は、未決定事項に残します。

| JSON（提案） | 区分 | 必須の提案 | TypeScript | 用途 | バリデーションの提案 | D1（提案） |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | 提案 | レスポンスでは必須。登録の入力には含めない | `string` | 識別子 | 店舗の `id` と同じ方針 | `TEXT` 主キー。列名候補 `id` |
| `shopId` | 提案 | 必須 | `string` | 対象の店舗 | 空にしない。存在する店舗を指す | `TEXT NOT NULL`。列名候補 `shop_id`。`shops.id` への外部キー候補 |
| `subject` | 提案 | 必須 | `string` | 商品名または割引対象 | 空白を除いたあと空を拒む。最大長は未決定 | `TEXT NOT NULL`。列名候補 `subject` |
| `content` | 提案 | 必須 | `string` | 割引内容。例は「10%OFF」 | `subject` と同じ | `TEXT NOT NULL`。列名候補 `content` |
| `startsAt` | 提案 | 任意 | `string` または `null` | 販売開始 | 値があるときは、タイムゾーン付きの ISO 8601。`endsAt` より前 | `TEXT`。NULL を許す候補。列名候補 `starts_at` |
| `endsAt` | 提案 | 任意 | `string` または `null` | 販売終了の判定 | 値があるときは、タイムゾーン付きの ISO 8601 | `TEXT`。NULL を許す候補。列名候補 `ends_at` |
| `createdAt` | 提案 | レスポンスでは必須。入力には含めない | `string` | 作成日時 | サーバーが付与する | `TEXT NOT NULL`。列名候補 `created_at` |
| `updatedAt` | 提案 | レスポンスでは必須。入力には含めない | `string` | 更新日時 | サーバーが付与する | `TEXT NOT NULL`。列名候補 `updated_at` |

`subject` の別名候補は `productName` と `target` です。`content` の別名候補は `offer` と `description` です。どれも未合意です。

NULL の意味の提案は、`startsAt` が無いときは開始済み、`endsAt` が無いときは終了予定なし、です。この意味も未合意です。

合意後のフロントエンドが受け取る候補は、次の形です。この変更ではファイルを追加しません。

```typescript
export interface Discount {
  id: string
  shopId: string
  subject: string
  content: string
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}
```

### 今回の必須項目にしないもの

次は、現行の画面、検索、#42 の基本項目に根拠が無いため、必須にしません。必要になったときに合意します。

| 項目 | 区分 | 見送りの理由 |
| --- | --- | --- |
| 画像 URL | 将来の拡張 | 保存先は #42 の未決定事項 |
| 在庫、取り置き、予約 | 将来の拡張 | #63 が今回作らないテーブル。API も未実装 |
| 通常価格、割引価格、割引率 | 将来の拡張 | 現行の型と検索に無い。README の割引率検索は将来実装 |
| 営業時間 | 将来の拡張 | 現行の `Shop` と検索に無い |
| ハッシュタグ | 将来の拡張 | 試作には `tags` がある。必須にするかは未決定。#63 の表は後回し |
| 投稿本文、いいね、コメント | 将来の拡張 | Posts との関係が未決定 |
| 論理削除の日時 | 未決定 | 販売終了と削除の区別は日時の節で提案する。必須列にはまだ足さない |

### 操作とメソッド

現行の画面が必要とする読み取りは、店舗一覧です。登録、更新、削除は、採用予定の構成では API を経由します。詳細の取得は、現行の画面にはありません。割引の取得関数は、現行の TypeScript にはありません。

| 操作 | 必要性 | メソッドの提案 | 区分 |
| --- | --- | --- | --- |
| 店舗一覧 | 地図画面の `getShops()` が一覧を必要とする | `GET` | 提案 |
| 店舗詳細 | 現行の画面は無い。単体取得の候補 | `GET` | 提案。要否は未決定 |
| 割引一覧 | 割引の表示と、店舗に紐づく一覧の候補 | `GET` | 提案 |
| 割引詳細 | 現行の画面は無い。単体取得の候補 | `GET` | 提案。要否は未決定 |
| 店舗の登録 | 採用予定では登録を API 経由にする | `POST` | 提案。実行できる人は #58 |
| 店舗の更新 | 一部の項目だけの更新を候補にする | `PATCH` | 提案。全体を置き換える `PUT` は代替案で未決定 |
| 店舗の削除 | API 経由の削除を候補にする | `DELETE` | 提案。物理削除にするかは未決定 |
| 割引の登録 | 割引の投稿を API 経由にする候補 | `POST` | 提案。実行できる人は #58 |
| 割引の更新 | 内容と期間の修正の候補 | `PATCH` | 提案。`PUT` は代替案 |
| 割引の削除 | 取り下げの候補。販売終了の自動処理には使わない | `DELETE` | 提案。物理削除にするかは未決定 |

読み取りを認証なしで許すかは、未決定です。書き込みに認証と認可を付ける方針は [architecture.md](architecture.md) にあります。方式と、誰が実行できるかは #58 です。

### 候補のパス

次のパスは候補です。合意されたエンドポイントではありません。試作の `GET /discounts` と `POST /discounts` も、確定したパスとしては扱いません。

| 操作 | 候補パス |
| --- | --- |
| 店舗一覧 | `GET /shops` |
| 店舗詳細 | `GET /shops/{shopId}` |
| 店舗の登録 | `POST /shops` |
| 店舗の更新 | `PATCH /shops/{shopId}` |
| 店舗の削除 | `DELETE /shops/{shopId}` |
| 割引一覧 | `GET /discounts` |
| 店舗に紐づく割引一覧 | `GET /shops/{shopId}/discounts` |
| 割引詳細 | `GET /discounts/{discountId}` |
| 割引の登録 | `POST /shops/{shopId}/discounts` |
| 割引の更新 | `PATCH /discounts/{discountId}` |
| 割引の削除 | `DELETE /discounts/{discountId}` |

割引の登録を `POST /discounts` にし、本文に `shopId` を置く候補もあります。どちらにするかは未決定です。このあとのサンプルは、上の表の候補パスで書きます。

### リクエストとレスポンス

成功時のステータスコードの提案は次のとおりです。

| 操作 | 提案するステータス | 本文 |
| --- | --- | --- |
| 一覧と詳細の取得 | 200 | 下の形 |
| 登録 | 201 | 作成されたリソース |
| 更新 | 200 | 更新されたリソース |
| 削除 | 204 | 本文なし |
| 一覧が 0 件 | 200 | 空の `items`。404 にはしない |

削除を 200 にして削除後のリソースを返す候補、登録時に `Location` を付ける候補は、未決定です。

単体の取得は、リソースそのものを返す提案です。`{ "shop": { ... } }` のように包む候補は未決定です。

一覧は、ページ情報を持つオブジェクトを返す提案です。現行の `getShops()` は `Shop[]` を返すため、API へ切り替えるときはこの関数の内側で合わせます。配列をそのまま返す候補、ページ情報をヘッダーに置く候補は未決定です。サンプルの `limit` の数値は、形を示す例です。既定値と上限は未合意です。候補は、既定 20、上限 100 です。

検索の提案は次のとおりです。

- 店舗一覧の `q` は任意です。現行の検索と同じく、`name` と `address` の部分一致を候補にします。
- 正規化をサーバーで現行の NFKC と `toLowerCase` に揃えるかは未決定です。SQLite の `LIKE` は、その正規化をそのまま行いません。
- `hasCoordinates` は現行のクライアント側の判定です。サーバーの検索条件にはまだ含めません。JSON に `NaN` は書けないため、無効な座標は主にモックとクライアントの話です。
- 割引一覧の `shopId` は任意です。指定した店舗の割引に絞る候補です。
- テキストの割引検索、並び順、カーソル方式のページ送りは未決定です。オフセットの `limit` と `offset` を候補にします。

販売中だけを返すクエリの候補は `includeEnded` です。既定で販売終了を隠すかは未決定です。サンプルは、フィルタの既定を決めずに 1 件を返しています。

#### 店舗一覧

`GET /shops?limit=20&offset=0&q=紙屋町`

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
  "limit": 20,
  "offset": 0,
  "total": 1
}
```

#### 店舗の登録

`POST /shops`

```json
{
  "name": "架空食堂 八丁堀",
  "address": "広島県広島市中区八丁堀（架空）",
  "latitude": 34.3942,
  "longitude": 132.4638
}
```

成功時の提案は 201 と、サーバーが `id` と日時を付けた店舗です。

```json
{
  "id": "shop_example_02",
  "name": "架空食堂 八丁堀",
  "address": "広島県広島市中区八丁堀（架空）",
  "latitude": 34.3942,
  "longitude": 132.4638,
  "createdAt": "2026-10-26T06:00:00Z",
  "updatedAt": "2026-10-26T06:00:00Z"
}
```

#### 店舗の更新

`PATCH /shops/shop_example_02`

指定した項目だけを変える提案です。

```json
{
  "address": "広島県広島市中区八丁堀2丁目（架空）"
}
```

#### 割引の登録

`POST /shops/shop_example_01/discounts`

```json
{
  "subject": "日替わりランチ",
  "content": "10%OFF",
  "startsAt": "2026-10-27T00:00:00+09:00",
  "endsAt": "2026-10-27T15:00:00+09:00"
}
```

この `startsAt` は `2026-10-26T15:00:00Z`、この `endsAt` は `2026-10-27T06:00:00Z` と同じ時刻です。成功時の本文は、保存した割引を UTC で返す提案です。

```json
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
```

終了を指定しない登録の提案では、`endsAt` を `null` にするか、項目を省略します。省略と `null` を同じ意味にするかも未決定です。

#### 割引一覧

`GET /shops/shop_example_01/discounts?limit=20&offset=0`

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
  "limit": 20,
  "offset": 0,
  "total": 1
}
```

#### 割引の更新

`PATCH /discounts/discount_example_01`

```json
{
  "content": "20%OFF",
  "endsAt": "2026-10-28T06:00:00Z"
}
```

### エラー形式

共通の本文を提案します。利用者が読める `message` を返します。スタックトレース、SQL、内部の例外文は返しません。`code` の文字列は候補です。

```json
{
  "error": {
    "code": "not_found",
    "message": "指定した店舗は存在しません。"
  }
}
```

入力の検証では、`details` を足す提案です。

```json
{
  "error": {
    "code": "validation_error",
    "message": "入力値が不正です。",
    "details": [
      {
        "field": "latitude",
        "message": "緯度は -90 以上 90 以下にしてください。"
      }
    ]
  }
}
```

| ステータス | 提案する場面 | 区分 |
| --- | --- | --- |
| 400 | JSON として読めない、型が違う | 提案。検証エラーを 400 にまとめる候補もある |
| 401 | 認証が必要な操作で、認証情報が無い | 本文の形は提案。いつ返すかは #58 |
| 403 | 認証済みで、その操作の権限が無い | 本文の形は提案。誰に権限があるかは #58 |
| 404 | URL の店舗または割引が無い | 提案。0 件の一覧には使わない |
| 409 | 参照が残る削除、一意制約、更新の競合 | 提案。どの条件で使うかは未決定 |
| 422 | JSON の形は正しく、値の検証に失敗した | 提案。400 との分担は未決定 |
| 500 | サーバー内部の失敗 | 提案。内部の詳細は返さない |

候補の例は次のとおりです。

- 緯度が 90 を超える登録は 422
- 存在しない `shopId` の詳細は 404
- 登録本文が存在しない店舗を指す場合は 422。これを 404 にする候補は未決定
- 割引が残っている店舗の削除は 409。データベースの `ON DELETE` でまとめて消す候補は採らない方向で提案し、決定は #63 とあわせて行う
- 未知の項目を拒むか無視するかは未決定
- 更新の競合を `updatedAt` で検出するかは未決定

認証方式が決まるまで、401 と 403 を返す実装は作りません。この節は、そのときの本文の形の提案です。

### 日時とタイムゾーン

日時の表現は、タイムゾーン付きの ISO 8601 文字列を提案します。内部の比較用の時刻は UTC に揃える提案です。保存列の型は、TEXT と INTEGER のどちらにするかを #63 と決めます。この文書では TEXT をサンプルに使います。

| 扱い | 提案 | 区分 |
| --- | --- | --- |
| API の日時 | `2026-10-27T15:00:00+09:00` や `2026-10-27T06:00:00Z` のように、時刻とオフセットを含む | 提案 |
| オフセットの無い日時 | `2026-10-27T15:00:00` や日付だけの `2026-10-27` は受け取らない | 提案 |
| API の成功レスポンス | UTC の `YYYY-MM-DDTHH:mm:ssZ`。小数秒は無し | 提案。桁を固定するかは未決定 |
| D1 | 正規化した UTC の文字列を `TEXT` に保存する | 提案。Unix 秒の `INTEGER` は代替案 |
| 日本標準時 | 表示用。UTC+9 で、夏時間は無い。保存形式にはしない | 提案。画面の変換はこの草案の範囲外 |
| 現在時刻 | 判定は UTC で行う | 提案 |

SQLite の `datetime('now')` は `YYYY-MM-DD HH:MM:SS` です。空白区切りで、`T` と `Z` がありません。この形式と ISO 8601 の文字列を混ぜて大小比較しません。比較に使う文字列は、一つの形に揃えます。

販売期間の判定候補は次のとおりです。

- `startsAt` が NULL のときは、開始済みとみなす
- `endsAt` が NULL のときは、終了予定なしとみなす
- 両方あるときの候補は、`startsAt <= now` かつ `now < endsAt` です
- `endsAt` ちょうどを販売中に含めるかは未決定です。上の不等号はその候補です

販売終了後の提案は、行を残すことです。終了した瞬間に削除する仕様は、既定にしません。

| 状態 | 提案 |
| --- | --- |
| 販売終了 | `endsAt` を過ぎた状態。行は残す。既定の一覧から外すかは未決定 |
| 非表示 | 販売終了とは別の状態。隠すための必須列は、この草案では足さない |
| 物理削除 | `DELETE` が成功したときの候補。販売終了の自動処理には使わない |
| 識別子での取得 | 終了後も 200 で返すか、404 にするかは未決定 |

終了した割引を残すことで、期間の監査と、誤った終了日時の修正ができます。一覧の既定から外すことと、行を消すことは、別の決定にします。

## D1 との対応

この節は [Issue #63](https://github.com/H-ampk/butterchickenCalai/issues/63) への入力案です。migration でも、確定したスキーマでもありません。#63 が主キー、外部キー、NULL、インデックス、日時の保存形式を決めます。

D1 で使う型の候補は、`TEXT`、`INTEGER`、`REAL`、`BLOB`、NULL です。この草案は、次の型と関数を要求しません。

- PostgreSQL の `TIMESTAMPTZ`、`UUID`、`JSONB`、`ENUM`、`ARRAY`、`BOOLEAN`、`SERIAL`、`NUMERIC`
- `gen_random_uuid()` などの PostgreSQL 関数

真偽値の列は提案しません。販売中かどうかは、開始と終了の日時から計算する候補です。状態列は必須にしません。

### 識別子、主キー、外部キー

| 確認項目 | 提案 |
| --- | --- |
| 店舗の識別子 | `shops.id` を `TEXT` の主キーにする。API の `id` と同じ文字列 |
| 割引の識別子 | `discounts.id` を `TEXT` の主キーにする |
| 割引から店舗への参照 | `discounts.shop_id` を `TEXT NOT NULL` にし、`shops.id` を参照する |
| 採番 | Workers が空でない文字列を作る。UUID にするかは未決定。PostgreSQL の UUID 型は使わない |
| 削除時の参照 | 割引が残る店舗の削除は API が 409 で拒む方向。`ON DELETE CASCADE` で割引を消す案は提案しない |
| 外部キーの有効化 | 外部キーは提案です。D1 での有効化の手順は #63 が確認して書きます |
| `rowid` | API の項目にしない |

ユーザーテーブルは #58 のあと、という #63 の未決定事項のままです。この草案はユーザーへの外部キーを足しません。

### NULL と日時

| 列の候補 | NULL | 用途 |
| --- | --- | --- |
| `shops` の `id`、`name`、`address`、`latitude`、`longitude` | 許さない | 現行の `Shop` に対応する |
| `shops.created_at`、`shops.updated_at` | 許さない | レスポンスの日時。列を持つかは未決定 |
| `discounts` の `id`、`shop_id`、`subject`、`content`、`created_at`、`updated_at` | 許さない | 割引の基本項目 |
| `discounts.starts_at`、`discounts.ends_at` | 許す | 販売開始と販売終了。NULL の意味は日時の節 |

販売終了の判定は、`ends_at` と現在時刻の比較を候補にします。終了フラグの列は提案しません。

### インデックスの候補

#63 が必要かを判断するための候補です。この一覧があることで、インデックスの作成まで決めたことにはしません。

| 候補 | 理由 |
| --- | --- |
| `discounts(shop_id)` | 店舗ごとの割引一覧と、参照の確認 |
| `discounts(ends_at)` | 終了日時での抽出。NULL の終了予定なしをどう含めるかは、索引だけでは決まらない |
| `discounts(shop_id, ends_at)` | 上の二つを一つにまとめる代替案 |

店舗名の部分一致は、`LIKE '%語%'` のような条件になります。通常の B-tree 索引は、先頭一致以外を速くしません。`shops(name)` の索引は必須の提案にしません。件数が小さいうちは、一覧を取得して現行の `searchShops` で絞り込む候補もあります。

## チーム合意が必要な事項

次が合意されるまで、この文書の提案は仕様ではありません。実装の Issue では、合意した項目だけを使います。

### リソースと項目

- 割引と Posts を、同じリソースにするか、別のままにするか
- 割引の項目名。`subject` と `content` に分ける提案と、一つの文字列にまとめる候補
- 割引が店舗 ID だけを持つか。試作のように店名と座標も割引へ持つか
- JSON を camelCase、D1 を snake_case にする対応
- 識別子を `TEXT` にする提案と、生成方法
- 店舗の `createdAt` と `updatedAt` をレスポンスの必須にするか
- `startsAt` と `endsAt` を NULL 許容にするか。NULL、省略の意味
- 文字列の最大長
- 店舗名を一意にするか
- ハッシュタグを割引の項目にするか

### 入出力

- 候補パスのうち、どれを採用するか。割引登録の URL に店舗を含めるか
- 店舗詳細、割引詳細、更新、削除を、最初の実装に含めるか
- `PATCH` と `PUT` のどちらを使うか
- 一覧をオブジェクトで包むか、配列のままにするか
- `limit` と `offset` の既定値と上限。並び順
- サーバー側の `q` を持つか。現行のクライアント検索のままにするか。正規化をどこまで揃えるか
- 販売終了を既定の一覧から外すか。終了後の単体取得を 200 と 404 のどちらにするか
- `endsAt` ちょうどを販売中に含めるか
- 未知の項目を拒むか
- 削除を物理削除にするか。論理削除の列を足すか
- 登録を 201 にするか。削除を 204 にするか
- 400 と 422 の分担
- 409 を、参照のある削除と更新競合のどちらに使うか

### 権限、保存、関連 Issue

- 認証方式、読み取りに認証が要るか、登録と更新ができる人。決定は #58
- 日時を D1 に `TEXT` で保存するか、Unix 秒の `INTEGER` で保存するか。小数秒の有無。決定には #63 が必要
- 外部キーを強制するか。`ON DELETE` の動作。インデックスをどれにするか。決定は #63
- 画像の保存先。#42 の未決定事項
- お気に入りの対象を店舗と投稿のどちらに揃えるか。architecture.md と #19 は未調整
- 通知、レビュー、取り置きの API。今回は決めない
- OpenAPI 定義ファイルの置き場所と、追加する時期

## 将来の拡張機能

合意が無い限り、次を店舗と割引の必須項目やエンドポイントに足しません。

- ユーザー登録とログインのリソース。方式は #58
- 投稿、ハッシュタグ、いいね、コメント
- お気に入り API。現行の方針はブラウザ内の IndexedDB
- レビュー、取り置き、予約、在庫
- 通知。[Issue #28](https://github.com/H-ampk/butterchickenCalai/issues/28) の範囲であり、この草案ではアプリ内通知も Web Push も採用済みにしない
- 画像、価格、割引率、カテゴリ、営業時間
- AI による投稿文章からの割引抽出

## 接続先

フロントエンドがAPIの基底URLを参照する環境変数は `VITE_API_BASE_URL` です。値の例は [frontend/.env.example](../frontend/.env.example) にあります。実際の `.env` は Git の管理対象外です。

例の値は `http://localhost:8000` のままです。旧設計のローカル待受を想定しています。Workers の URL へは、この草案では変えていません。
