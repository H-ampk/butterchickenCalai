# Issue #45 の着手メモ

この文書は API 仕様でも、D1 のスキーマでもありません。エンドポイント、JSON、エラー形式、テーブル定義は、ここでは決めません。開発責任者との設計検討で採用した読み取り方針は [api-contract.md](api-contract.md) にあります。それは学科長・企業側の承認や、チーム全体の正式レビューの完了ではありません。

[Issue #45](https://github.com/H-ampk/butterchickenCalai/issues/45) の参照 API は未実装です。完了条件の「ローカル D1 の店舗と割引が取得できる」は、まだ満たしていません。D1 の migration も未作成です。

## 依存の状態

| 項目 | 状態 | 根拠 |
| --- | --- | --- |
| API のパスと入出力 | 設計検討で採用した方針がある。実装は未完了 | [#42](https://github.com/H-ampk/butterchickenCalai/issues/42) は Open。[api-contract.md](api-contract.md) は `/api/v1` の読み取り 5 本を記録している。コードの仮パスは `GET /shops` と `GET /discounts` のままで、`/api/v1` ではない |
| エラーレスポンス | 設計検討で採用した方針がある。実装は未完了 | 同じ文書の統一 JSON と、400、404、405、500、503。この着手メモではルートを作っていない |
| D1 のテーブルと列 | 設計検討で表と主な列の方針がある。migration は未作成 | `shops` と `discounts`、TEXT 主キー、外部キー、日時 TEXT、検索列は api-contract.md。座標 NULL のチェック制約、インデックス、migration の配置は [#63](https://github.com/H-ampk/butterchickenCalai/issues/63)。[database/README.md](../database/README.md) は検討中の記述のまま |
| Workers と D1 のバインディング | ローカルの接続確認のみ | [#43](https://github.com/H-ampk/butterchickenCalai/issues/43)。バインディング名 `DB` はローカル設定。リモートの `database_id` は無い。店舗・割引の読み取りは未実装 |
| migration | 未実装 | `database/` に SQL は無い。Wrangler migrations を使い、ローカル seed とは分ける、という方針だけが api-contract.md にある |
| フロントの取得口 | 実装済み。パスは仮 | [#81](https://github.com/H-ampk/butterchickenCalai/pull/81)。`GET /shops` と `GET /discounts` は仮パスであり、設計検討の `/api/v1` ではない |
| 販売期間の通常一覧 | 境界は設計検討で採用。Workers への適用は未完了 | `startsAt <= now < endsAt`。`endsAt` ちょうどは終了。`startsAt` の NULL は開始制限なし。終了後に行を残して通常一覧から外すことは、以前からの方針。比較の実装は [#50](https://github.com/H-ampk/butterchickenCalai/issues/50)。現行の `classifyDiscountForNormalList` は、その境界の一部を未決定のままにしている |

以前から合意として扱う方針は次です。

- 共有データは Cloudflare Workers の API 経由で D1 に置く方針であり、ブラウザから D1 を直接更新しない
- FastAPI の試作は採用予定の API ではない
- `endsAt` が NULL の割引は期限なしとする
- 販売終了後の割引は通常一覧から外し、D1 の行は削除しない。比較の実装は [#50](https://github.com/H-ampk/butterchickenCalai/issues/50)
- 登録、更新、削除は #45 では作らない

上の表にあるパス、エラー、販売期間の境界は、設計検討の方針であり、この一覧の「以前からの合意」には含めません。

## この着手メモでは追加しない項目

設計検討の方針は api-contract.md にあります。#45 の実装と #63 の migration は未完了です。このファイルの更新では、次を Workers のルートや migration として追加しません。

- 店舗一覧、店舗詳細、割引一覧、店舗に紐づく割引一覧、割引詳細のルート
- D1 からの SELECT と、0 件、該当 ID なし、読み取り失敗の HTTP への対応
- バインディング名と migration の適用手順
- 販売期間の除外 SQL。これは #50 と重なるため、#45 の準備コードでは行わない
- ローカル D1 を使った統合テスト

## 今回置いたコード

[frontend/src/read/normalResults.ts](../frontend/src/read/normalResults.ts) は、画面と `getShops()` から呼ばない準備用の関数です。

- 座標の有効判定は既存の `filterShops` を使う
- 登録経路では店舗を分けない
- 割引の期間判定は既存の `classifyDiscountForNormalList` をテストから呼ぶだけで、ここでは行を除かない
- 読み取り失敗と 0 件を分け、HTTP ステータスには変換しない
