# Issue #45 の着手メモ

この文書は API 仕様でも、D1 のスキーマでもありません。エンドポイント、JSON、エラー形式、テーブル定義は、ここでは決めません。開発責任者との設計検討で採用した読み取り方針は [api-contract.md](api-contract.md) にあります。それは学科長・企業側の承認や、チーム全体の正式レビューの完了ではありません。

[Issue #45](https://github.com/H-ampk/butterchickenCalai/issues/45) の参照 API は、ローカル D1 から店舗と割引を読む 5 本の GET を Workers に持っています。パスの識別、クエリの検証、公開条件、販売期間、ページング、共通のエラー JSON を使います。空の一覧は HTTP 200 です。バインディング不足と SQL の不具合は HTTP 500 `internal_error`、D1 へ接続できない一時障害は HTTP 503 `service_unavailable` です。リモート D1 と本番デプロイは未了です。書き込み API と認証は、この参照には含めていません。`createdAt` と `updatedAt` を公開 JSON に含めるかは未決定のままです。

## 依存の状態

| 項目 | 状態 | 根拠 |
| --- | --- | --- |
| API のパスと入出力 | 設計検討で採用した 5 本を Workers が読む。正式な承認は未完了 | [#42](https://github.com/H-ampk/butterchickenCalai/issues/42) は Open。[api-contract.md](api-contract.md) が正本。フロントの一覧は `GET /api/v1/shops` と `GET /api/v1/discounts` |
| エラーレスポンス | 参照 API が 400、404、405、500、503 を返す | 本文は `error.code` と `error.message`。500 と 503 は分けている |
| D1 のテーブルと列 | ローカルの migration にある。リモート D1 は未作成 | `workers/migrations/0001_initial.sql`。座標 NULL の扱いとインデックスの追加は [#63](https://github.com/H-ampk/butterchickenCalai/issues/63) |
| Workers と D1 のバインディング | ローカルの `DB` から参照 API が SELECT する | [#43](https://github.com/H-ampk/butterchickenCalai/issues/43)。リモートの `database_id` は無い |
| migration | ローカルの初期スキーマがある | `workers/migrations/0001_initial.sql`。seed は `workers/seeds/development.sql` |
| フロントの取得口 | 一覧 2 本を `/api/v1` に合わせた | `getShops()` と `getDiscounts()`。取得失敗時にモックへは戻さない |
| 販売期間の通常一覧 | 参照 API は `startsAt <= now < endsAt` を使う | `endsAt` ちょうどは終了。`startsAt` の NULL は開始制限なし。終了済みの詳細は HTTP 200。画面への適用は [#50](https://github.com/H-ampk/butterchickenCalai/issues/50)。`classifyDiscountForNormalList` は、その境界の一部を未決定のままにしている |

以前から合意として扱う方針は次です。

- 共有データは Cloudflare Workers の API 経由で D1 に置く方針であり、ブラウザから D1 を直接更新しない
- FastAPI の試作は採用予定の API ではない
- `endsAt` が NULL の割引は期限なしとする
- 販売終了後の割引は通常一覧から外し、D1 の行は削除しない。比較の実装は [#50](https://github.com/H-ampk/butterchickenCalai/issues/50)
- 登録、更新、削除は #45 では作らない

上の表にあるパス、エラー、販売期間の境界は、設計検討の方針であり、この一覧の「以前からの合意」には含めません。

## まだ追加していない項目

設計検討の方針は api-contract.md にあります。参照 API は、候補行を D1 から読んだあと、TypeScript の公開条件で `total` と `items` を決めています。販売期間の除外を SQL の `LIMIT` より先には掛けていません。次はまだありません。

- リモート D1、本番デプロイ、書き込み API、認証
- 公開 JSON の `createdAt` と `updatedAt`
- 販売期間を画面・検索・地図へ適用する処理。主体は #50
- 一覧が大量になったときの SQL 側の `COUNT` と `LIMIT`

## 今回置いたコード

[frontend/src/read/normalResults.ts](../frontend/src/read/normalResults.ts) は、画面と `getShops()` から呼ばない準備用の関数です。

- 座標の有効判定は既存の `filterShops` を使う
- 登録経路では店舗を分けない
- 割引の期間判定は既存の `classifyDiscountForNormalList` をテストから呼ぶだけで、ここでは行を除かない
- 読み取り失敗と 0 件を分け、HTTP ステータスには変換しない
