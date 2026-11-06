# Issue #45 の着手メモ

この文書は API 仕様でも、D1 のスキーマでもありません。エンドポイント、JSON、エラー形式、テーブル定義は、ここでは決めません。

[Issue #45](https://github.com/H-ampk/butterchickenCalai/issues/45) の参照 API は未実装です。完了条件の「ローカル D1 の店舗と割引が取得できる」は、まだ満たしていません。

## 依存の状態

| 項目 | 状態 | 根拠 |
| --- | --- | --- |
| API のパスと入出力 | 未決定 | [#42](https://github.com/H-ampk/butterchickenCalai/issues/42) は Open。[api-contract.md](api-contract.md) はレビュー用草案で、サンプルのパスは候補 |
| エラーレスポンス | 未決定 | 同じ草案の未合意事項。HTTP ステータスも確定していない |
| D1 のテーブルと列 | 未決定 | [#63](https://github.com/H-ampk/butterchickenCalai/issues/63) は Open。`database/README.md` の表名は検討中 |
| Workers と D1 のバインディング | ローカルの接続確認のみ | [#43](https://github.com/H-ampk/butterchickenCalai/issues/43)。バインディング名 `DB` はローカル設定。リモートの `database_id` は無い。店舗・割引の読み取りは未実装 |
| migration | 未実装 | `database/` に SQL は無い |
| フロントの取得口 | 実装済み。パスは仮 | [#81](https://github.com/H-ampk/butterchickenCalai/pull/81)。`GET /shops` と `GET /discounts` は仮パス |
| 販売期間の通常一覧 | 方針はあり、Workers への適用は #50 | 終了後は通常一覧から外し、行は削除しない。境界時刻などは未決定 |

合意として扱える方針は次だけです。

- 共有データは Cloudflare Workers の API 経由で D1 に置く方針であり、ブラウザから D1 を直接更新しない
- FastAPI の試作は採用予定の API ではない
- `endsAt` が NULL の割引は期限なしとする
- 販売終了後の割引は通常一覧から外し、D1 の行は削除しない。比較の実装は [#50](https://github.com/H-ampk/butterchickenCalai/issues/50)
- 登録、更新、削除は #45 では作らない

## 契約が確定してから実装する項目

パスと列名が合意されるまで、次を Workers のルートや migration として追加しません。

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
