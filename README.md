# 地域割引SNSアプリ

近くのお得を、SNS感覚で見つけられるWebアプリケーションです。

地域の店舗が割引情報を投稿し、一般ユーザーが投稿、検索、地図を通じて割引情報を発見できます。チーム開発を始めるための初期構成です。ホームと地図の画面枠、開発用のモック店舗一覧は入っています。割引投稿などの機能と、地図ライブラリの導入はこれからです。割引情報をメモリ上で扱う FastAPI の試作が [frontend/src/api/main.py](frontend/src/api/main.py) にあります。データベースへの保存は未実装です。

想定する利用者は、割引情報を探す一般ユーザーと、割引情報を発信する地域の店舗です。将来の一般公開を見据え、ホスティング、API、共有データのデータベースは Cloudflare を採用する方針です。Cloudflare の環境構築、デプロイ、大学側の利用許可は終わっていません。

## 主要機能

### MVP

1. ユーザー登録・ログイン
2. 店舗登録
3. 割引情報の投稿
4. 投稿一覧表示
5. 投稿詳細表示
6. 地図表示
7. 店舗位置表示
8. 割引情報検索
9. ハッシュタグ検索
10. お気に入り登録

ユーザー登録・ログインは MVP の項目として残しています。認証そのものを廃止する決定はしていません。お気に入りの保存方針は [IndexedDB のお気に入り](#indexeddb-のお気に入り) に書いています。

### 将来実装

- いいね・コメント
- AIによる割引情報抽出
- 割引率・カテゴリ・期限検索
- おすすめ表示
- 通知機能

通知機能はお気に入りとは別です。実装方式は未決定です。詳細は [通知機能](#通知機能) に書いています。

## 使用技術

フロントエンドの現行構成は Vite と Vanilla TypeScript です。UIフレームワーク（React、Vue、Next.js など）は未選定です。チームで合意するまで、この構成を維持します。

次の表は、採用予定と、リポジトリ上の状態を分けたものです。Cloudflare の行は方針であり、アカウント、Workers、D1 は作成していません。

| 分野 | 技術 | 状態 |
| --- | --- | --- |
| フロントエンド | HTML / CSS / TypeScript | 現行。Vite の Vanilla TypeScript |
| ビルド | Vite | 現行。`frontend/package.json` の `build` は `tsc` と `vite build` |
| ホスティング | Cloudflare Workers（Static Assets） | 採用予定。環境未構築 |
| API | Cloudflare Workers | 採用予定。未実装 |
| データベース | Cloudflare D1 | 採用予定。データベース未作成 |
| ブラウザ内保存 | IndexedDB | 採用予定。お気に入りの最小情報のみ。未実装 |
| 地図 | Leaflet / OpenStreetMap | 採用予定。`frontend/package.json` に地図ライブラリは無い |
| バージョン管理 | Git / GitHub | 現行 |
| CI | GitHub Actions | 現行は Frontend CI のみ。Cloudflare への自動デプロイは未実装 |
| AI | AI API | 将来実装 |

### 旧設計

これまで文書と Issue が前提にしていた構成は、次のとおりです。`main` にある FastAPI は [frontend/src/api/main.py](frontend/src/api/main.py) の試作です。割引データはプロセスのメモリ上にあり、PostgreSQL には接続しません。Python の依存関係を定義するファイルは無く、[backend/README.md](backend/README.md) が示す `backend/` の基本環境は未実装です。

| 分野 | 技術 | 状態 |
| --- | --- | --- |
| バックエンド | Python / FastAPI | 旧設計。`frontend/src/api/main.py` にメモリ上の試作がある。`backend/` の基本環境は未実装。Workers への置き換えは未実施 |
| データベース | PostgreSQL | 旧設計。未実装。置き場は [database/README.md](database/README.md) |

採用予定の API は Cloudflare Workers、共有データのデータベースは Cloudflare D1 です。D1 は SQLite 系です。PostgreSQL 向けの設計や migration を、そのまま D1 で使えるとは限りません。

[Issue #4](https://github.com/H-ampk/butterchickenCalai/issues/4)、[Issue #5](https://github.com/H-ampk/butterchickenCalai/issues/5)、[Issue #6](https://github.com/H-ampk/butterchickenCalai/issues/6) は FastAPI と PostgreSQL を前提にしています。この文書の更新では、Issue の本文、状態、担当者は変更していません。担当範囲の調整が必要です。

## インフラとデプロイの方針

将来の一般公開を想定します。初期の運用は、Cloudflare の無料枠の範囲に収めることを目標にします。大学サーバーのポート開放には依存しません。

採用予定の配信とデータの置き場所は次のとおりです。

- 静的ファイルと API は、Cloudflare Workers で配信する
- 店舗や割引情報などの共有データは、Cloudflare D1 で管理する
- お気に入りは共有データに含めず、利用者のブラウザ内に置く。詳細は [IndexedDB のお気に入り](#indexeddb-のお気に入り)

GitHub Actions による Cloudflare への自動デプロイは、今後整備します。現在のワークフローにデプロイジョブはありません。詳細は [継続的インテグレーション](#継続的インテグレーション) を参照してください。

正式公開の前に、無料枠の制限、Cloudflare の利用規約、運用責任、大学側の利用許可を確認します。利用許可は未了です。

## IndexedDB のお気に入り

お気に入りは、利用者のブラウザ内に保存する方針です。保存には IndexedDB を使います。この保存処理は未実装です。

- 保存対象は、店舗 ID と登録日時など、最小限の情報とする
- お気に入りを使うために、ユーザー登録を必須としない
- デバイス間の同期は、初期実装の対象外とする
- ブラウザのデータを削除すると、お気に入りは消える
- IndexedDB には、認証情報や秘密情報を保存しない

[Issue #19](https://github.com/H-ampk/butterchickenCalai/issues/19) の本文は、ログインした利用者の投稿お気に入りを API で保存する内容です。コメントでは、店舗お気に入りをサーバー側に置く案が挙がっていますが、未採用です。店舗 ID を IndexedDB に保存するこの方針とは揃っていません。Issue は変更していません。

## 通知機能

通知機能は、お気に入りの保存とは別の機能です。将来的に Web Push を検討します。次の事項は未決定であり、実装方式は確定していません。

- Push 購読情報の管理
- 通知対象の店舗との関連付け
- 通知の送信処理
- 通知の解除処理
- 利用者の同意取得とプライバシー対策

[Issue #28](https://github.com/H-ampk/butterchickenCalai/issues/28) は、お気に入り店舗の新着をアプリ内通知する API を候補にし、ブラウザプッシュはその Issue では実装しない、と書いています。この README は、アプリ内通知と Web Push のどちらも採用済みにはしません。

## ディレクトリ構成

```text
.
├── README.md
├── .gitignore
├── .editorconfig
├── frontend/                 フロントエンド（TypeScript / Vite）
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── index.html
│   ├── .env.example
│   ├── .gitignore
│   ├── public/
│   └── src/
│       ├── main.ts
│       ├── style.css
│       ├── components/       再利用するUI部品
│       ├── pages/            ホーム、地図、検索などの画面
│       ├── api/              クライアント通信用の予定だった置き場。main.py は FastAPI の試作
│       ├── types/            TypeScriptの型定義
│       ├── utils/            共通関数
│       └── assets/           画像などの静的リソース
├── backend/                  旧設計の FastAPI 用ディレクトリ（未実装）
│   └── README.md
├── database/                 旧設計の PostgreSQL 用ディレクトリ（未実装）
│   └── README.md
└── docs/                     設計と共同開発の文書
    ├── architecture.md
    ├── api-contract.md
    └── development-guide.md
```

中身のないディレクトリには、Gitで追跡するための `.gitkeep` があります。ディレクトリ名は旧設計のままです。Cloudflare Workers と D1 用のディレクトリは、まだ追加していません。

## 開発環境のセットアップ

現在のフロントエンドを起動するために必要な環境:

- Git
- Node.js 20.19.0 以上、または 22.12.0 以上（Vite 8 の要件）
- npm

フロントエンドの起動:

```bash
cd frontend
npm install
npm run dev
```

開発サーバーは `http://localhost:5173` で開きます。本番向けの確認は次のコマンドです。

```bash
npm run build
npm run preview
```

APIの基底URLは `frontend/.env.example` の `VITE_API_BASE_URL` を参照します。ローカルで使う場合は、このファイルを `frontend/.env` にコピーしてください。`.env` は Git に含めません。例の値は `http://localhost:8000` であり、旧設計のローカル待受を想定したままです。Workers の URL へは変更していません。

旧設計の Python / FastAPI と PostgreSQL は、バックエンド担当とデータベース担当の作業範囲として [backend/README.md](backend/README.md) と [database/README.md](database/README.md) に残っています。[frontend/src/api/main.py](frontend/src/api/main.py) は FastAPI の試作ですが、依存パッケージの定義と PostgreSQL 接続は無く、[Issue #6](https://github.com/H-ampk/butterchickenCalai/issues/6) の完了条件は満たしていません。Cloudflare Workers と D1 の環境も未構築です。Wrangler などの導入は、このリポジトリでは行っていません。

## チーム開発

担当者名は未確定です。担当領域は次のとおりです。バックエンドとデータベースの行は、旧設計の担当内容と、採用予定の担当内容を併記しています。Issue と担当範囲の書き換えは、別途調整します。

| 担当領域 | 内容 |
| --- | --- |
| 全体管理・GitHub管理・統合 | リポジトリ運用、Issue と Pull Request の進行、各担当の統合 |
| フロントエンド・UI | 画面、スタイル、利用者の操作。TypeScript担当がフロントエンドの TypeScript 開発を担当する |
| バックエンド・API | 旧設計は FastAPI による API と認証。採用予定は Cloudflare Workers の API。調整が必要 |
| データベース | 旧設計は PostgreSQL のテーブル設計と migration。採用予定は Cloudflare D1。調整が必要 |
| 地図・AI | Leaflet による地図表示と、将来の AI 連携。地図ライブラリは未導入 |

## Git運用

1. `main` は動作確認済みのコードを保持する。
2. 原則として `main` に直接 push しない。
3. 作業は Issue 単位で管理する。
4. Issue ごとに作業ブランチを作る。
5. 変更は Pull Request で統合する。
6. 原則として担当者以外がレビューする。
7. マージ前に必要なテストを実行する。`main` 向けの Pull Request では、Frontend CI（TypeScript の型チェックと Vite のビルド）の成功を確認する。CI の成功は全機能の動作保証ではない。
8. Issue は [機能追加・改善](.github/ISSUE_TEMPLATE/feature_request.md) または [バグ報告](.github/ISSUE_TEMPLATE/bug_report.md) のテンプレートを使う。当てはまらない作業は空白の Issue で作成する。
9. Pull Request は [テンプレート](.github/pull_request_template.md) に沿って書く。

ブランチ名の例:

```text
feat/home-page
feat/shop-registration
feat/post-api
feat/map-view
fix/login-error
docs/update-readme
```

手順の詳細は [docs/development-guide.md](docs/development-guide.md) を参照してください。

## 継続的インテグレーション

実装済みのワークフローは [Frontend CI](.github/workflows/frontend-ci.yml) です。動作は次のとおりです。

- `main` 向けの Pull Request、`main` への push、GitHub Actions 画面からの手動実行で起動する
- ジョブは `Frontend Build & Typecheck` の 1 つである
- `frontend` ディレクトリで、`frontend/package-lock.json` を使った `npm ci` のあと、`npm run build` を実行する
- `npm run build` は TypeScript の型チェック（`tsc`）と Vite の本番ビルドである
- Node.js のバージョンは 22 である

CI の成功は、型チェックとビルドが通ったことだけを示します。アプリの全機能が動作することの保証ではありません。バックエンド、データベース、自動テスト、デプロイはこのワークフローの対象外です。

Cloudflare への自動デプロイは未実装です。既存の GitHub Actions は、この方針の文書化では変更していません。

## セキュリティ方針

次は設計方針です。対策の実装はまだありません。

- APIキーや秘密情報をフロントエンドに埋め込まない
- 機密情報は Cloudflare の Secrets などで管理する
- D1 への更新処理では、サーバー側で認証と認可を行う
- 店舗情報の不正な登録、編集、削除を防ぐ
- 入力値の検証と XSS 対策を行う
- 取り置きと予約の整合性はサーバー側で確保する
- 通信は HTTPS を前提とする

詳細は [docs/architecture.md](docs/architecture.md) を参照してください。

## 開発状況

`main` にあるのは、フロントエンドの TypeScript 開発環境、ホームと地図の画面枠、開発用のモック店舗一覧、メモリ上の割引データを返す FastAPI の試作（[frontend/src/api/main.py](frontend/src/api/main.py)）、Frontend CI、共同開発用の文書です。地図ライブラリは未導入です。店舗一覧は API へ通信せず、モックデータを返します。この試作 API は Cloudflare Workers でも Cloudflare D1 でもありません。PostgreSQL、IndexedDB、Cloudflare へのデプロイは未実装です。

Cloudflare は採用方針です。Workers、D1、デプロイ、大学側の利用許可は未了です。

## ドキュメント

- [システム構成](docs/architecture.md)
- [API連携方針](docs/api-contract.md)
- [共同開発ガイド](docs/development-guide.md)
