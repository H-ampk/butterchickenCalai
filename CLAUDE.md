# AIコーディングエージェント向け開発規約

このファイルは、Cursor などの AI コーディングエージェントがこのリポジトリで作業するときの規約です。人間の手順の正本は [docs/development-guide.md](docs/development-guide.md) です。技術構成の正本は [README.md](README.md) と [docs/architecture.md](docs/architecture.md)、API の正本は [docs/api-contract.md](docs/api-contract.md)、レビュー基準の正本は [REVIEW.md](REVIEW.md) です。

ここには、エージェントが誤った実装や二重管理を避けるための判断基準を書きます。ブランチ手順、Issue の書き方、Frontend CI の起動条件は、共同開発ガイドと README を読んで従ってください。同じ手順をこのファイルへ詳しく複製しません。

文書同士で文言が食い違うときは、リポジトリ上の実装を確認し、食い違いを報告してください。未実装の機能を、実装済みと書き換えて解消しないでください。

## 1. プロジェクトの概要と目的

地域割引SNSアプリ「バターチキンカレー」は、近くのお得を SNS 感覚で見つける Web アプリケーションです。地域の店舗が割引情報を発信し、一般ユーザーが投稿、検索、地図から割引を見つける想定です。

現在の `main` は、チーム開発を始めるための初期構成です。入っているのは、Vite と Vanilla TypeScript のフロントエンド、ホームと地図の画面枠、開発用のモック店舗一覧、メモリ上の割引データを返す FastAPI の試作、Frontend CI、共同開発用の文書です。割引投稿の本実装、地図ライブラリ、ユーザー登録、データベースへの保存は、これからです。

想定する利用者は、割引情報を探す一般ユーザーと、割引情報を発信する地域の店舗です。一般公開を見据えています。初期の運用は、大学サーバーのポート開放に依存せず、Cloudflare の無料枠に収める方針です。Cloudflare の環境構築、デプロイ、大学側の利用許可は終わっていません。

## 2. 現在の技術構成と将来の構成

作業前に、変更対象がどの区分に属するかを確認してください。

| 区分 | 意味 | このリポジトリでの例 |
| --- | --- | --- |
| 現行の実装 | `main` に入っているもの | Vite、Vanilla TypeScript、モック店舗一覧、Frontend CI、`frontend/src/api/main.py` のメモリ上の試作 |
| 採用予定 | 方針は決まっている。環境も実装も未了 | Cloudflare Workers、Cloudflare D1、IndexedDB、Leaflet / OpenStreetMap、GitHub Actions からのデプロイ |
| 旧設計 | 文書と Issue が前提にしていた構成。本実装は未了 | `backend/` の FastAPI、PostgreSQL。Issue テンプレートの対象領域もこの区分の名称のまま |
| 将来実装 | 項目だけで、方式は未決定のものが多い | いいね、コメント、AI による割引情報抽出、割引率などの検索、おすすめ、通知 |
| 未決定 | 方針も方式も確定していない | 認証方式、API のパス、D1 のテーブル、通知方式、お気に入りの対象を店舗と投稿のどちらに揃えるか |

Cloudflare Workers と Cloudflare D1 は採用予定です。アカウント、Workers、D1、Secrets、デプロイは作成していません。実装済み、接続済み、デプロイ済みと書かないでください。

`frontend/src/api/main.py` は FastAPI の試作です。割引データはプロセス内の配列にあり、再起動で消えます。PostgreSQL にも D1 にも接続せず、認証もありません。採用予定の Workers API ではありません。`backend/` の基本環境と Python の依存関係定義は未実装です。

フロントエンドの UI フレームワークは未選定です。チームで合意するまで、Vite と Vanilla TypeScript を維持してください。React、Vue、Next.js などへ移す変更は、指示と合意がない限り行わないでください。

API のエンドポイント、認証方式、エラー形式は未確定です。[docs/api-contract.md](docs/api-contract.md) は、パスをチームの合意まで確定しないと定めています。`main.py` の `GET /discounts` と `POST /discounts` を、合意済みの仕様として扱わないでください。同文書にある「FastAPI のスキーマと TypeScript の型を揃える」は旧設計の記載です。Workers への移行が終わったという意味には読みません。

公開時の通信は HTTPS を前提にします。データ交換は JSON です。[docs/api-contract.md](docs/api-contract.md) は通信に HTTP を使うと書いています。これはデータの交換方式であり、公開時の HTTPS と併記します。`frontend/.env.example` の `VITE_API_BASE_URL` は `http://localhost:8000` のままで、旧設計のローカル待受を想定しています。Workers の URL へは変更していません。この差を理由に、指示なく API 連携方針の通信方式を書き換えないでください。

お気に入りは、利用者のブラウザ内の IndexedDB に店舗 ID などの最小情報を置く方針です。処理は未実装です。ユーザー登録を必須にしません。デバイス間同期は初期実装の対象外です。認証そのものを廃止する決定はしていません。[Issue #19](https://github.com/H-ampk/butterchickenCalai/issues/19) はサーバー側の投稿お気に入り API を書いており、この方針とは未調整です。Issue の本文は、指示がない限り変更しません。

通知はお気に入りとは別機能です。Web Push は検討事項であり、アプリ内通知も Web Push も採用済みではありません。

## 3. ディレクトリ構成

詳細な図の正本は [README.md](README.md) の「ディレクトリ構成」です。次の図は、エージェントが扱いを誤りやすい場所を補ったものです。

```text
.
├── CLAUDE.md                 この規約。README の図には未掲載
├── REVIEW.md                 レビュー基準。README の図には未掲載
├── README.md
├── frontend/                 現行のフロントエンド（TypeScript / Vite）
│   ├── package.json
│   ├── scripts/              node:test。README の図には未掲載。Frontend CI は未実行
│   └── src/
│       ├── main.ts
│       ├── style.css
│       ├── components/       .gitkeep のみ
│       ├── pages/            ホームと地図の画面枠
│       ├── api/              モック店舗と、FastAPI 試作の main.py
│       ├── types/
│       ├── utils/
│       └── assets/           .gitkeep のみ
├── backend/                  旧設計の FastAPI 用（未実装。README のみ）
├── database/                 旧設計の PostgreSQL 用（未実装。README のみ）
├── docs/
│   ├── architecture.md
│   ├── api-contract.md
│   └── development-guide.md
└── .github/
    ├── pull_request_template.md
    ├── ISSUE_TEMPLATE/
    └── workflows/frontend-ci.yml
```

中身のないディレクトリには `.gitkeep` があります。`backend/` と `database/` の名前は旧設計のままです。Cloudflare Workers と D1 用のディレクトリは、まだ追加していません。ディレクトリの新設は、担当範囲の調整とセットで行い、この規約の追記だけでは行いません。README の図へ `CLAUDE.md`、`REVIEW.md`、`frontend/scripts/` を載せる作業は、この規約とは別です。

## 4. ブランチ運用

詳細な手順は [docs/development-guide.md](docs/development-guide.md) の「ブランチ」に従ってください。

- `main` は動作確認済みのコードを保持する。
- `main` への直接 push は禁止する。共同開発ガイドは「原則として直接 push しない」と定めている。AI エージェントは、この原則を例外なく守る。
- 作業は Issue 単位で行い、Issue ごとに作業ブランチを作る。
- ブランチ名の例は `feat/home-page`、`fix/login-error`、`docs/update-readme` である。
- 既存の同名ブランチがある場合は、状態を確認し、既存の作業を上書きしない。
- 変更の統合は Pull Request で行う。自動マージは禁止する。マージは人間が行い、AI エージェントはマージしない。

## 5. IssueとPRの運用

Issue の作り方、`Closes #番号` と `Refs #番号` の使い分け、レビュー前の確認は [docs/development-guide.md](docs/development-guide.md) を正とします。Pull Request の記入欄は [.github/pull_request_template.md](.github/pull_request_template.md) を正とします。

- マージ時に Issue を閉じる場合だけ `Closes #番号` を使う。閉じない場合は `Refs #番号` を使う。
- 既存 Issue の本文、担当者、状態の変更と Close は、その Issue を処理する指示があるときだけ行う。
- Issue テンプレートの対象領域には、Backend / FastAPI と Database / PostgreSQL が残っている。これは旧設計の名称です。採用予定は Cloudflare Workers と Cloudflare D1 であり、テンプレートの項目は移行が終わった証拠には使いません。
- 原則として担当者以外がレビューする。高リスクの変更では、担当者以外のレビューと関連テストを原則必須とする。基準は [REVIEW.md](REVIEW.md) です。
- Pull Request の自動マージは禁止する。AI のレビューコメントや CI の成功は、人間の承認を置き換えません。AI エージェントはマージしない。
- `main` 向けの Pull Request では、Frontend CI の成功を確認する。CI の成功は、型チェックと Vite のビルドが通ったことであり、全機能の動作保証ではない。
- 画面変更がない Pull Request に、スクリーンショットや E2E テストは不要です。

## 6. コーディング規約

書式は [.editorconfig](.editorconfig) に従います。

- 文字コードは UTF-8、改行は LF、ファイル末尾に改行を入れる。
- インデントはスペース。幅は 2。Python は 4。
- Markdown 以外では、行末の空白を残さない。

TypeScript は、`frontend/src` の既存ファイルに合わせます。UI フレームワークは足しません。地図ライブラリは、地図機能の実装指示があるまで `frontend/package.json` に足しません。

- 変更前に、関連する実装、README、`docs/` の該当箇所、関連 Issue を読む。
- 作業単位は小さくする。指示されていない大規模なリファクタリングは禁止する。
- 無関係な変更を同じ Pull Request に含めない。
- 他メンバーの担当領域を、無断で大きく変更しない。
- API 仕様と DB スキーマの独断変更は禁止する。変えるときは、フロントエンド、バックエンド、データベース、全体管理の関係担当者と調整し、[docs/api-contract.md](docs/api-contract.md) の手順に従う。D1 は SQLite 系です。PostgreSQL 向けの型や migration を、そのまま D1 で使えるとは限りません。
- 依存パッケージを追加するときは、理由、代替を採らなかった理由、影響する `package.json` と lockfile を Pull Request に書く。lockfile だけを別件で更新しない。
- 既存コードのコメントは日本語です。新規のコメントも日本語にします。
- エンドポイントのパス、テーブル定義、認証方式を、合意前にコードや文書で確定させない。

## 7. テスト・ビルドの実行方法

フロントエンドのディレクトリで実行します。必要な Node.js は 20.19.0 以上、または 22.12.0 以上です。Frontend CI は Node.js 22 を使います。

```bash
cd frontend
npm ci
npm run dev
npm run build
npm run preview
npm test
```

| コマンド | 内容 | 実行箇所 |
| --- | --- | --- |
| `npm ci` | `frontend/package-lock.json` から依存を入れる | ローカルと Frontend CI |
| `npm run dev` | Vite の開発サーバー。`http://localhost:5173` | ローカル |
| `npm run build` | `tsc` による型チェックと `vite build` | ローカルと Frontend CI |
| `npm run preview` | 本番ビルドの確認用サーバー | ローカル |
| `npm test` | `node --test scripts/*.ts` | ローカルのみ |

Frontend CI の定義は [.github/workflows/frontend-ci.yml](.github/workflows/frontend-ci.yml) です。`main` 向けの Pull Request、`main` への push、手動実行で起動し、`npm ci` のあと `npm run build` を実行します。`npm test`、バックエンド、データベース、デプロイはこのワークフローの対象外です。

変更後は、その変更に必要なテストを実行します。検索ユーティリティを変えた場合は `npm test`、画面や型を変えた場合は `npm run build` を候補にします。ドキュメントだけの変更で、アプリケーション、依存関係、ワークフローに差分がない場合は、ビルドとテストを省いてよいです。省いた場合は、対象外なのか未実施なのかを分け、理由を報告します。

失敗したテストを、通ったと報告しないでください。Frontend CI が失敗したままマージしません。

## 8. セキュリティ要件

実装状況の正本は [docs/architecture.md](docs/architecture.md) の「セキュリティ方針」と [docs/development-guide.md](docs/development-guide.md) の「セキュリティ」です。次は設計方針です。対策の実装はまだありません。未実装の対策を、実装済みと書かないでください。

- API キーや秘密情報を、ソース、フロントエンド、`VITE_` 環境変数、IndexedDB、ログ、Pull Request に出さない。
- `.env` は Git に含めない。例は `frontend/.env.example` だけを更新する。
- 機密情報は Cloudflare の Secrets などで管理する方針である。Secrets は未設定である。
- パスワードを平文で保存しない。
- D1 への更新は、ブラウザから直接行わず、Workers の API で受け、サーバー側で認証と認可を行う方針である。Workers も D1 も未実装である。
- 画面上の表示を隠すだけでは、権限制御を完結させない。
- 店舗情報の不正な登録、編集、削除を防ぐ。他店舗のデータへのアクセスは、所有権の確認を必要とする。
- 入力値の検証と XSS 対策を行う。利用者由来の文字列を HTML として挿入しない。
- 取り置きと予約の整合性は、サーバー側で確保する方針である。取り置き API は未実装である。
- 公開時の通信は HTTPS を前提とする。
- セキュリティ上の問題を見つけた場合は、隠さず報告する。指示された作業範囲の外であっても、現象、影響、再現に必要な条件を伝える。範囲外の修正を、同じ変更へ無断で混ぜない。

現行の `frontend/src/api/main.py` は、認証なしで割引の追加を受けます。このファイルは、上記の方針を実装したものではありません。

## 9. AIエージェントが守る禁止事項

次は、作業指示の範囲が広く見えても守る禁止事項です。

- `main` への直接 push は禁止する。
- Pull Request の自動マージは禁止する。マージは人間が行う。AI エージェントはマージしない。
- 指示されていない大規模なリファクタリングは禁止する。
- API 仕様と DB スキーマの独断変更は禁止する。
- 秘密情報を、コード、ログ、チャットの報告、テスト出力に出さない。
- 依存パッケージの追加は、理由を示さないまま行わない。
- 変更前の確認を省かない。関連コードと、README、`docs/`、関連 Issue を読む。
- 変更後に必要なテストを省いたまま、実施済みと報告しない。未実施の場合は理由を報告する。
- セキュリティ上の問題を、軽微に見せて隠さない。
- ユーザーの明示的な指示なしに、本番環境を変更しない。Cloudflare へのデプロイ、GitHub Rulesets、Secrets の変更も、対象と操作を明示されていない限り行わない。
- アプリケーションコード、lockfile、GitHub Actions を、ドキュメント作業のついでに変更しない。
- CodeRabbit の設定ファイルを、採用を指示されていない作業で追加しない。レビュー基準の正本は [REVIEW.md](REVIEW.md) であり、CodeRabbit がこのファイルを自動で読むとは扱わない。
- 既存 Issue を、指示なく削除、改変、Close しない。
- 未実装の Workers、D1、IndexedDB、Leaflet、認証、通知、デプロイを、実装済みとして文書やコードコメントに書かない。

## 10. 変更完了時の報告形式

作業の終わりに、次をこの順で報告します。作成や push が成功していない項目を、完了済みと書かないでください。

1. 作成・変更したファイル一覧
2. 各ファイルの主な内容
3. 既存規約との整合性確認結果
4. 検証結果。実施したコマンドと結果。未実施の場合は、対象外、未実施、未確認のどれかと、その理由
5. ブランチ名
6. コミットハッシュ。コミットしていない場合はその旨
7. PR 番号と URL。作成していない場合は、失敗の理由とローカルで完了した範囲
8. 未解決事項と注意点

GitHub への push や PR 作成が権限不足などで失敗した場合は、失敗の理由と、ローカルで完了した範囲を分けて書きます。
