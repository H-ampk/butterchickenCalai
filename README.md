# 地域割引SNSアプリ

近くのお得を、SNS感覚で見つけられるWebアプリケーションです。

地域の店舗が割引情報を投稿し、一般ユーザーが投稿、検索、地図を通じて割引情報を発見できます。チーム開発を始めるための初期構成です。画面やAPIなどの機能実装はこれからです。

想定する利用者は、割引情報を探す一般ユーザーと、割引情報を発信する地域の店舗です。

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

### 将来実装

- いいね・コメント
- AIによる割引情報抽出
- 割引率・カテゴリ・期限検索
- おすすめ表示
- 通知機能

## 使用技術

| 分野 | 技術 |
| --- | --- |
| フロントエンド | TypeScript / HTML / CSS |
| ビルド・開発環境 | Vite |
| バックエンド | Python / FastAPI |
| データベース | PostgreSQL |
| 地図 | Leaflet / OpenStreetMap |
| AI | AI API（将来実装） |
| バージョン管理 | Git / GitHub |

UIフレームワーク（React、Vue、Next.js など）は未選定です。チームで合意するまで、フロントエンドは Vite の Vanilla TypeScript で進めます。

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
│       ├── api/              バックエンドとの通信
│       ├── types/            TypeScriptの型定義
│       ├── utils/            共通関数
│       └── assets/           画像などの静的リソース
├── backend/                  FastAPIによるバックエンド（未実装）
│   └── README.md
├── database/                 PostgreSQLの管理（未実装）
│   └── README.md
└── docs/                     設計と共同開発の文書
    ├── architecture.md
    ├── api-contract.md
    └── development-guide.md
```

中身のないディレクトリには、Gitで追跡するための `.gitkeep` があります。

## 開発環境のセットアップ

必要な環境:

- Git
- Node.js 20.19.0 以上、または 22.12.0 以上（Vite 8 の要件）
- npm
- Python（バックエンド開発担当。バージョンは担当者が環境構築時に決める）
- PostgreSQL（データベース担当）

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

バックエンド（Python / FastAPI）とデータベース（PostgreSQL）の環境構築は、まだ担当者の作業が完了していません。ライブラリの導入、API、テーブル作成はそれぞれの担当者が行います。

APIの基底URLは `frontend/.env.example` の `VITE_API_BASE_URL` を参照します。ローカルで使う場合は、このファイルを `frontend/.env` にコピーしてください。`.env` は Git に含めません。

## チーム開発

担当者名は未確定です。担当領域は次のとおりです。

| 担当領域 | 内容 |
| --- | --- |
| 全体管理・GitHub管理・統合 | リポジトリ運用、Issue と Pull Request の進行、各担当の統合 |
| フロントエンド・UI | 画面、スタイル、利用者の操作。TypeScript担当がフロントエンドの TypeScript 開発を担当する |
| バックエンド・API | FastAPI による API と認証 |
| データベース | PostgreSQL のテーブル設計と migration |
| 地図・AI | Leaflet による地図表示と、将来の AI 連携 |

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

## 開発状況

初期段階です。機能開発は開始していません。フロントエンドの TypeScript 開発環境と、共同開発用の文書だけを用意しています。

## ドキュメント

- [システム構成](docs/architecture.md)
- [API連携方針](docs/api-contract.md)
- [共同開発ガイド](docs/development-guide.md)
