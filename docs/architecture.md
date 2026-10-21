# システム構成

この文書は、地域割引SNSアプリの構成方針です。現行の実装、旧設計、採用予定を分けて書きます。Cloudflare の環境構築、デプロイ、大学側の利用許可は終わっていません。この文書の更新では、アプリケーションコード、API 仕様、DB スキーマ、GitHub Actions、既存 Issue は変更していません。

| 区分 | 意味 |
| --- | --- |
| 現行の実装 | `main` に入っているもの |
| 旧設計 | 文書と Issue が前提にしていた Python / FastAPI と PostgreSQL。`main` にあるのはメモリ上の FastAPI 試作のみで、PostgreSQL は未実装 |
| 採用予定 | 一般公開と初期の無料運用を見据えた Cloudflare の方針。環境は未構築 |

## 現行の実装

```text
Browser
   |
   v
frontend/
Vite + Vanilla TypeScript
（開発サーバー、または vite build の静的ファイル）

GitHub Actions
   |
   v
Frontend CI
型チェックと Vite のビルドのみ
```

ブラウザ向けには、ホームと地図の画面枠があります。地図ライブラリは未導入で、地図領域はプレースホルダです。店舗一覧は開発用のモックデータで、API へは通信しません。IndexedDB と Cloudflare へのデプロイは、`main` にはありません。Frontend CI の定義は [.github/workflows/frontend-ci.yml](../.github/workflows/frontend-ci.yml) です。この CI は TypeScript の型チェックと Vite のビルドだけを行い、Python は実行しません。

`main` には、これとは別に FastAPI の試作が [frontend/src/api/main.py](../frontend/src/api/main.py) にあります。`GET /` は起動メッセージを返し、`GET /discounts` はメモリ上のサンプル割引を返し、`POST /discounts` は受け取った割引をその配列へ追加します。PostgreSQL にも D1 にも接続せず、認証もありません。CORS は全オリジンを許可しています。Python の依存関係を定義するファイルは無く、フロントエンドの `main.ts` からも呼ばれていません。採用予定の Workers API ではありません。

```text
frontend/src/api/main.py
FastAPI（試作）
   |
   v
プロセス内の配列
（再起動で消える。D1 でも PostgreSQL でもない）
```

## 全体アーキテクチャ

採用予定の構成です。図の各要素は、まだ構築していません。

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

利用者のブラウザは、HTTPS で Cloudflare Workers に接続します。Workers は、Vite のビルド結果（HTML、CSS、TypeScript から生成した JavaScript）と、API を配信します。店舗や割引情報などの共有データは、API の先にある Cloudflare D1 で管理します。お気に入りの店舗 ID は、ブラウザ内の IndexedDB に置きます。

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
| HTML / CSS / TypeScript | 現行の実装を維持 | 画面表示と利用者の操作 |
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

次は採用予定の流れです。Workers の API も D1 も未実装であり、エンドポイントのパスはこの文書では決めません。パスは [api-contract.md](api-contract.md) のとおり、チームの合意まで確定しません。現行の `frontend/src/api/main.py` はメモリ上の配列を読み書きしており、この流れではありません。

1. ブラウザが HTTPS で Workers にアクセスする。
2. Workers が、Vite のビルド結果である静的ファイルを返す。
3. フロントエンドが、同じ Workers の API に店舗と割引情報を要求する。
4. API が Cloudflare D1 から共有データを読む。
5. フロントエンドが一覧や地図に表示する。

店舗情報の登録、編集、削除も API を経由します。D1 をブラウザから直接更新する方針にはしません。

## IndexedDB によるお気に入りの保存方針

お気に入りは、利用者のブラウザ内に保存します。保存先は IndexedDB です。処理は未実装です。

- 保存するのは、店舗 ID と登録日時などの最小限の情報とする
- お気に入りを使うために、ユーザー登録を必須としない
- 初期実装では、デバイス間で同期しない
- ブラウザのデータを削除すると、お気に入りは消える
- IndexedDB には、認証情報や秘密情報を保存しない

ユーザー認証そのものを廃止する決定は、この方針には含まれません。認証が必要な機能と、ブラウザ内のお気に入りは分けて扱います。

[Issue #19](https://github.com/H-ampk/butterchickenCalai/issues/19) の本文は、ログインした利用者の投稿お気に入りをサーバー側 API で保存する内容です。本文へのコメントでは、店舗お気に入りを同じ Issue に追加する案と、別 Issue に分ける案が挙がっています。どちらも未採用で、保存先はサーバー側の想定です。店舗 ID を IndexedDB に保存するこの方針は、そのコメントの案には入っていません。Issue は変更していません。

## 将来の通知機能の検討事項

通知は、お気に入りの保存とは別の機能です。将来的に Web Push を検討します。実装方式は確定していません。未決定の事項は次のとおりです。

- Push 購読情報をどこで管理するか
- 通知と対象店舗をどう関連付けるか
- 通知をどの処理で送るか
- 通知をどう解除するか
- 利用者の同意とプライバシー対策をどう行うか

[Issue #28](https://github.com/H-ampk/butterchickenCalai/issues/28) は、アプリ内通知を第一候補とし、ブラウザプッシュはその Issue の実装範囲外としています。この文書は、アプリ内通知を採用済みとは書きません。Web Push も採用済みとは書きません。

## 認証・認可に関する注意点

- ユーザー登録・ログインをやめる決定はしていない。認証方式は [Issue #4](https://github.com/H-ampk/butterchickenCalai/issues/4) の検討事項のままである
- お気に入りだけは、ユーザー登録を必須としない方針である
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
- 取り置きと予約は、サーバー側で在庫などの整合性を確保する。取り置き API は未実装である
- 公開時の通信は HTTPS を前提とする

パスワードを平文で保存しないこと、秘密情報を Git に含めないことは、[共同開発ガイド](development-guide.md) の既存の方針とあわせて維持します。現行の `frontend/src/api/main.py` は、認証なしで割引情報の追加を受けます。このファイルは、上記の方針を実装したものではありません。

## デプロイ方針

将来の一般公開を想定します。初期運用は Cloudflare の無料枠内を目標にします。大学サーバーのポートを開ける運用には依存しません。

- 静的ファイルと API は Cloudflare Workers で配信する方針とする
- 共有する店舗・割引情報は Cloudflare D1 で管理する方針とする
- GitHub Actions による自動デプロイは今後整備する。現行の Frontend CI は型チェックとビルドだけを行う
- 正式公開の前に、無料枠の制限、利用規約、運用責任、大学側の利用許可を確認する

Workers、D1、独自ドメイン、デプロイ用のワークフローは未作成です。

## 旧構成から変更する場合の影響範囲

採用予定へ移す場合、少なくとも次の調整が必要です。今回の更新では、調整先の本文は変えていません。

- [frontend/src/api/main.py](../frontend/src/api/main.py) は FastAPI の試作であり、`GET /discounts` と `POST /discounts` を定義している。[api-contract.md](api-contract.md) は、パスを合意まで確定しないと書いている。この試作のパスを、この文書では仕様として採用しない
- [backend/README.md](../backend/README.md) は、Python / FastAPI を予定し、現時点では未実装と書いている。`backend/` にはアプリケーションコードが無い。試作は `frontend/src/api/main.py` にあり、[Issue #6](https://github.com/H-ampk/butterchickenCalai/issues/6) の完了条件（依存関係、ルーター構成、環境変数、PostgreSQL 接続、起動手順）は満たしていない
- [database/README.md](../database/README.md) は、PostgreSQL と検討中のテーブル名を書いている。`favorites` を含む
- [docs/api-contract.md](api-contract.md) は、FastAPI のスキーマと TypeScript の型を揃えると書いている。エンドポイントと認証方式は未確定のままである
- [frontend/.env.example](../frontend/.env.example) の `VITE_API_BASE_URL` は `http://localhost:8000` である
- Issue テンプレートの対象領域は、Backend / FastAPI と Database / PostgreSQL である
- [Issue #4](https://github.com/H-ampk/butterchickenCalai/issues/4) は、FastAPI のスキーマと TypeScript の型を揃える前提で API 仕様を策定する
- [Issue #5](https://github.com/H-ampk/butterchickenCalai/issues/5) は、PostgreSQL のスキーマと migration を作る
- [Issue #6](https://github.com/H-ampk/butterchickenCalai/issues/6) は、FastAPI の基本環境と PostgreSQL への接続を作る
- [Issue #19](https://github.com/H-ampk/butterchickenCalai/issues/19) は、ログインユーザーの投稿お気に入り API である
- [Issue #28](https://github.com/H-ampk/butterchickenCalai/issues/28) は、サーバー側の通知 API を候補にしている

D1 は SQLite 系のデータベースです。PostgreSQL の型、拡張機能、migration ツールで作った手順を、D1 にそのまま適用できるとは限りません。#5 の成果を D1 へ移す場合は、スキーマの書き直しが必要になる可能性があります。

ディレクトリ構成は旧設計の名前のままです。FastAPI 用と PostgreSQL 用のディレクトリは残しています。

API のリソース名とパスは、この文書では変更していません。

## 未決定事項

- Cloudflare アカウント、Workers、D1、Secrets の作成時期と、大学の利用許可
- 無料枠で初期運用が収まるか、利用規約上の制約、運用責任の所在
- 自動デプロイのワークフローの内容と、本番用の URL
- ユーザー認証の方式。廃止は未決定
- お気に入りの対象。この文書の方針は店舗 ID。#19 は投稿。どちらに揃えるかは未調整
- 通知の実装方式と、上記「将来の通知機能の検討事項」の各項目
- D1 のテーブル定義と、旧設計の PostgreSQL 案をどう扱うか
- API のエンドポイント、エラー形式、日時、画像の扱い（#4 の範囲）
- 取り置き・予約の具体的な API（既存 Issue の範囲。この文書ではサーバー側で整合性を取る方針だけを書いている）

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
