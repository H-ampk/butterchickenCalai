# システム構成

この文書は、地域割引SNSアプリの構成方針です。現行の実装、旧設計、採用予定を分けて書きます。ローカルの Workers 手順は [workers-local.md](workers-local.md) です。本番の Cloudflare アカウント、デプロイ、大学側の利用許可は終わっていません。

| 区分 | 意味 |
| --- | --- |
| 現行の実装 | `main` に入っているもの |
| 旧設計 | 文書と Issue が前提にしていた Python / FastAPI と PostgreSQL。`main` にあるのはメモリ上の FastAPI 試作のみで、PostgreSQL は未実装 |
| 採用予定 | 一般公開と初期の無料運用を見据えた Cloudflare の方針。ローカルの Wrangler はある。本番のアカウント、リモート D1、デプロイは未了 |

## 現行の実装

```text
Browser
   |
   v
frontend/
Vite + React + TypeScript
（開発サーバー、または vite build の静的ファイル）

GitHub Actions
   |
   v
Frontend CI
型チェックと Vite のビルドのみ
```

ブラウザ向けには、ホームと地図の画面枠があります。地図ライブラリは未導入で、地図領域はプレースホルダです。店舗一覧の既定は開発用のモックデータで、API へは通信しません。`VITE_DATA_SOURCE=api` のとき、現行の地図画面は `getShops()` を通し、仮パス `GET /shops` へだけ通信します。`GET /discounts` は [frontend/src/api/discounts.ts](../frontend/src/api/discounts.ts) の取得口にありますが、現行の画面からは呼ばれていません。通信に失敗してもモックへは戻りません。これらの仮パスは、設計検討で採用した `/api/v1` ではありません。読み取り方針は [api-contract.md](api-contract.md) にあり、コードの定数はこの文書では変えていません。IndexedDB と Cloudflare へのデプロイは、`main` にはありません。Frontend CI の定義は [.github/workflows/frontend-ci.yml](../.github/workflows/frontend-ci.yml) です。この CI は TypeScript の型チェックと Vite のビルドだけを行い、Python は実行しません。

`main` には、これとは別に FastAPI の試作が [frontend/src/api/main.py](../frontend/src/api/main.py) にあります。`GET /` は起動メッセージを返し、`GET /discounts` はメモリ上のサンプル割引を返し、`POST /discounts` は受け取った割引をその配列へ追加します。PostgreSQL にも D1 にも接続せず、認証もありません。CORS は全オリジンを許可しています。Python の依存関係を定義するファイルは無く、フロントエンドの `main.tsx` からも呼ばれていません。採用予定の Workers API ではありません。

```text
frontend/src/api/main.py
FastAPI（試作）
   |
   v
プロセス内の配列
（再起動で消える。D1 でも PostgreSQL でもない）
```

## 全体アーキテクチャ

採用予定の構成です。本番の Cloudflare アカウント、リモート D1、デプロイは未構築です。ローカルの Wrangler は [workers-local.md](workers-local.md) です。

```text
User Browser
    |
    | HTTPS
    v
Cloudflare Workers
    |
    +-- Static Assets
    |      |
    |      +-- HTML / CSS / TypeScript
    |      +-- Vite Build
    |
    +-- API
           |
           v
      Cloudflare D1

Browser
    |
    +-- IndexedDB
           |
           +-- Favorite Shop IDs
```

利用者のブラウザは、HTTPS で Cloudflare Workers に接続します。Workers は、Vite のビルド結果（HTML、CSS、React と TypeScript から生成した JavaScript）と、API を配信します。店舗や割引情報などの共有データは、API の先にある Cloudflare D1 で管理します。お気に入りの店舗 ID は、ブラウザ内の IndexedDB に置きます。

## 旧設計

これまでの文書が示していた構成です。`main` にある FastAPI は上記の試作であり、PostgreSQL へは接続していません。`backend/` の基本環境は未実装です。

```text
Browser
   |
   v
Frontend
TypeScript / Vite
   |
   | HTTP / JSON
   v
Backend
Python / FastAPI
   |
   v
Database
PostgreSQL
```

旧設計では、フロントエンドが HTTP と JSON で FastAPI を呼び出し、FastAPI が PostgreSQL にデータを保存する想定でした。説明は [backend/README.md](../backend/README.md) と [database/README.md](../database/README.md) に残しています。

## 各技術の責務

| 技術 | 区分 | 責務 |
| --- | --- | --- |
| HTML / CSS / TypeScript / React | 現行の実装を維持 | 画面表示と利用者の操作。画面遷移に React Router は未使用 |
| Vite | 現行の実装 | 開発サーバーと本番ビルド |
| Cloudflare Workers（Static Assets） | 採用予定 | ビルド済み静的ファイルの配信 |
| Cloudflare Workers（API） | 採用予定 | 共有データの参照と更新、認証・認可、入力検証 |
| Cloudflare D1 | 採用予定 | 店舗、割引情報など、利用者間で共有するデータの保存 |
| IndexedDB | 採用予定 | そのブラウザだけのお気に入り |
| Leaflet / OpenStreetMap | 採用予定 | 店舗位置の表示。ライブラリは未導入 |
| GitHub | 現行の実装 | ソースコードのバージョン管理 |
| GitHub Actions | 現行は Frontend CI のみ | 型チェックとビルド。デプロイは今後 |
| AI API | 将来 | 投稿文章からの割引情報の抽出 |

## 店舗・割引情報の取得フロー

次は採用予定の流れです。店舗・割引の D1 読み取りとスキーマは未実装です。Workers には [api-contract.md](api-contract.md) の `/api/v1` 5 本を識別する基盤があり、店舗と割引の実データは返しません。設計検討で採用した読み取りパスは同じ文書の `/api/v1` です。これは学科長・企業側の承認や、チーム全体の正式レビューの完了ではありません。フロントエンドの仮パスは `GET /shops` と `GET /discounts` のままです。ローカルの静的配信と接続確認は [workers-local.md](workers-local.md) です。現行の `frontend/src/api/main.py` はメモリ上の配列を読み書きしており、この流れではありません。

1. ブラウザが HTTPS で Workers にアクセスする。
2. Workers が、Vite のビルド結果である静的ファイルを返す。
3. フロントエンドが、同じ Workers の API に店舗と割引情報を要求する。
4. API が Cloudflare D1 から共有データを読む。
5. フロントエンドが一覧や地図に表示する。

店舗情報の登録、編集、削除も API を経由します。D1 をブラウザから直接更新する方針にはしません。

## IndexedDB によるお気に入りの保存方針

お気に入りは、利用者のブラウザ内に保存します。保存先は IndexedDB です。処理は未実装です。

- 保存するのは、店舗 ID と登録日時などの最小限の情報とする
- お気に入りに、一般利用者のログインやアカウントは要らない
- 初期実装では、デバイス間で同期しない
- ブラウザのデータを削除すると、お気に入りは消える
- IndexedDB には、認証情報や秘密情報を保存しない

一般利用者のログインとアカウント管理は、開発対象外です。この方針は、管理者・店舗側の認証を廃止するものではありません。店舗・割引の登録、更新、削除の認証と認可は [Issue #58](https://github.com/H-ampk/butterchickenCalai/issues/58) に残します。お気に入りは、その認証とは別に、ブラウザ内だけで扱います。

[Issue #19](https://github.com/H-ampk/butterchickenCalai/issues/19) の本文は、ログインした利用者の投稿お気に入りをサーバー側 API で保存する内容です。本文へのコメントでは、店舗お気に入りを同じ Issue に追加する案と、別 Issue に分ける案が挙がっています。どちらも未採用で、保存先はサーバー側の想定です。店舗 ID を IndexedDB に保存するこの方針は、そのコメントの案には入っていません。Issue は変更していません。一般利用者のログインは開発対象外であり、この未調整を、ログイン機能を実装する理由にはしません。

## 通知

お気に入り店舗の新着通知と、アプリ内通知画面は、開発対象外です。2026年12月末のMVPにも、今後の完成版にも含めません。Web Push も実装候補にしません。[Issue #28](https://github.com/H-ampk/butterchickenCalai/issues/28) は not planned でクローズ済みであり、実装の依存先にしません。

お気に入り店舗の IndexedDB への保存と、Gmail からの店舗・商品情報の取得は、通知とは別であり、継続します。

## 認証・認可に関する注意点

- 一般利用者のログインとアカウント管理は開発対象外である。認証方式の未決定事項としては残さない
- 店舗・割引の登録、更新、削除の認証と認可は継続する。方式は [Issue #58](https://github.com/H-ampk/butterchickenCalai/issues/58) で決める。この文書では方式を確定しない
- お気に入りは、一般利用者のアカウントを前提にしない
- D1 の更新は、Workers の API で受け、サーバー側で認証と認可を行う方針である
- 画面上の表示を隠すだけでは、権限制御を完結させない
- 認証情報と API キーは、フロントエンドのソースと IndexedDB に置かない

これらは方針です。認証の実装はまだありません。

## セキュリティ方針

次も設計方針です。未実装の対策を、実装済みとしては扱いません。

- APIキーや秘密情報をフロントエンドに埋め込まない。`VITE_` 環境変数にも置かない
- 機密情報は Cloudflare の Secrets などで管理する。Secrets は未設定である
- D1 への更新処理では、サーバー側で認証と認可を行う
- 店舗情報の不正な登録、編集、削除を防ぐ
- 入力値の検証と XSS 対策を行う
- 取り置き予約と、取り置きに伴う在庫の増減は開発対象外である。商品情報としての在庫数は、この廃止には含めない
- 公開時の通信は HTTPS を前提とする

パスワードを平文で保存しないこと、秘密情報を Git に含めないことは、[共同開発ガイド](development-guide.md) の既存の方針とあわせて維持します。現行の `frontend/src/api/main.py` は、認証なしで割引情報の追加を受けます。このファイルは、上記の方針を実装したものではありません。

## デプロイ方針

将来の一般公開を想定します。初期運用は Cloudflare の無料枠内を目標にします。大学サーバーのポートを開ける運用には依存しません。

- 静的ファイルと API は Cloudflare Workers で配信する方針とする
- 共有する店舗・割引情報は Cloudflare D1 で管理する方針とする
- GitHub Actions による自動デプロイは今後整備する。現行の Frontend CI は型チェックとビルドだけを行う
- 正式公開の前に、無料枠の制限、利用規約、運用責任、大学側の利用許可を確認する

ローカル開発用の Wrangler 設定は [../workers/wrangler.jsonc](../workers/wrangler.jsonc) にあります。手順は [workers-local.md](workers-local.md) です。独自ドメイン、リモート D1、デプロイ用のワークフローは未作成です。GitHub Actions にデプロイ権限は追加していません。

## 旧構成から変更する場合の影響範囲

採用予定へ移す場合、少なくとも次の調整が必要です。次の文書と Issue は、旧設計の記述を残しています。

- [frontend/src/api/main.py](../frontend/src/api/main.py) は FastAPI の試作であり、`GET /discounts` と `POST /discounts` を定義している。[api-contract.md](api-contract.md) は、設計検討で `/api/v1` の読み取りを採用し、この試作のパスは仕様にしないと書いている。コード上の仮パスは残っている。この試作のパスを、この文書では仕様として採用しない
- [backend/README.md](../backend/README.md) は、Python / FastAPI を予定し、現時点では未実装と書いている。`backend/` にはアプリケーションコードが無い。試作は `frontend/src/api/main.py` にあり、[Issue #6](https://github.com/H-ampk/butterchickenCalai/issues/6) の完了条件（依存関係、ルーター構成、環境変数、PostgreSQL 接続、起動手順）は満たしていない
- [database/README.md](../database/README.md) は、PostgreSQL と検討中のテーブル名を書いている。`favorites` を含む
- [docs/api-contract.md](api-contract.md) は、TypeScript の型、Workers の API、D1 の列を揃えると書いている。公開 GET を認証不要とする方針は設計検討の記録であり、書き込みの認証方式は [Issue #58](https://github.com/H-ampk/butterchickenCalai/issues/58) のまま未確定である。チーム全体の正式レビューの完了ではない
- [frontend/.env.example](../frontend/.env.example) の `VITE_API_BASE_URL` は `http://localhost:8000` である
- Issue テンプレートの対象領域は、Backend / FastAPI と Database / PostgreSQL である
- [Issue #4](https://github.com/H-ampk/butterchickenCalai/issues/4) は、FastAPI のスキーマと TypeScript の型を揃える前提で API 仕様を策定する
- [Issue #5](https://github.com/H-ampk/butterchickenCalai/issues/5) は、PostgreSQL のスキーマと migration を作る
- [Issue #6](https://github.com/H-ampk/butterchickenCalai/issues/6) は、FastAPI の基本環境と PostgreSQL への接続を作る
- [Issue #19](https://github.com/H-ampk/butterchickenCalai/issues/19) は、ログインユーザーの投稿お気に入り API である
- [Issue #28](https://github.com/H-ampk/butterchickenCalai/issues/28) は、サーバー側の通知 API を候補にしていた。not planned でクローズ済みであり、採用予定の依存先にはしない

D1 は SQLite 系のデータベースです。PostgreSQL の型、拡張機能、migration ツールで作った手順を、D1 にそのまま適用できるとは限りません。#5 の成果を D1 へ移す場合は、スキーマの書き直しが必要になる可能性があります。

FastAPI 用の `backend/` と PostgreSQL 用の `database/` は残しています。ローカルの Workers は `workers/` です。

API のリソース名とパスは、この文書では変更していません。

## 未決定事項

- Cloudflare アカウント、Workers、D1、Secrets の作成時期と、大学の利用許可
- 無料枠で初期運用が収まるか、利用規約上の制約、運用責任の所在
- 自動デプロイのワークフローの内容と、本番用の URL
- 運営管理者・店舗側の認証方式。一般利用者のログインは開発対象外。方式は [Issue #58](https://github.com/H-ampk/butterchickenCalai/issues/58) で決める。この文書では確定しない
- お気に入りの対象。この文書の方針は店舗 ID。#19 は投稿。どちらに揃えるかは未調整
- D1 の migration 方式は Wrangler migrations を使う、という設計検討の記録が [api-contract.md](api-contract.md) にある。ファイルは未作成。配置先、座標 NULL のチェック制約、インデックスは未決定で [Issue #63](https://github.com/H-ampk/butterchickenCalai/issues/63)。旧設計の PostgreSQL 案をどう扱うかも未決定
- 画像の扱い。読み取りパス、エラー形式、日時の保存形式は api-contract.md の設計検討に記録がある。外部公開の承認方式は未決定。画像の保存方式も未決定

## 地図

```text
Frontend
   |
   v
Leaflet
   |
   v
OpenStreetMap
```

地図は店舗の位置を画面上に示すために使います。採用予定は Leaflet と OpenStreetMap です。`frontend/package.json` には地図ライブラリが無く、画面への組み込みも未実装です。導入は地図機能の実装時に行います。

## AI（将来）

AIは将来追加する構成です。投稿文章から割引情報を抽出する処理を、API の実行環境から AI API へ問い合わせる形で追加する想定です。旧設計では問い合わせ元を FastAPI としていました。採用予定では Workers の API から問い合わせる候補になります。どちらの実行環境で実装するかは、バックエンド方針の調整後に決めます。

APIキーなどの秘密情報は、フロントエンドの `VITE_` 環境変数に置きません。
