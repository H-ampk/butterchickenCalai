# Workers とローカル D1

この手順は、Vite でビルドした React アプリをローカルの Cloudflare Workers から開き、ローカル D1 への接続を確認するためのものです。Cloudflare へのログイン、本番用 D1 の作成、デプロイ、大学の利用許可は不要です。いずれも未了のままにしてください。

設計方針は [Issue #42](https://github.com/H-ampk/butterchickenCalai/issues/42) の `docs/api-contract.md` にあります。店舗と割引の参照は [Issue #45](https://github.com/H-ampk/butterchickenCalai/issues/45) の Workers API で、ローカル D1 の `shops` と `discounts` を読みます。D1 のテーブル、migration、seed は [Issue #63](https://github.com/H-ampk/butterchickenCalai/issues/63) の範囲で、手順は [database/README.md](../database/README.md) です。migration を適用する前の GET 一覧は、テーブルが無いため HTTP 500 `internal_error` になります。これは空一覧の HTTP 200 とは違います。`GET /__health` は店舗・割引 API ではありません。

## ローカルと本番の違い

| 項目 | ローカル（この手順） | 本番 |
| --- | --- | --- |
| 実行 | 手元の Wrangler | 未デプロイ。GitHub Actions にもデプロイ権限はない |
| 静的ファイル | `frontend/dist` を Workers Static Assets で配信 | 未公開 |
| D1 | Wrangler が作るローカル専用の SQLite。`.wrangler/` にあり Git 管理しない | 作成しない。`database_id` も置かない |
| アカウント | ログイン不要 | Cloudflare アカウントの所有者は未決定 |
| 利用許可 | 不要 | 大学の利用許可は未了 |
| ヘルスチェック | `GET /__health`。開発用であり、店舗・割引 API ではない | 公開時の扱いは未決定 |

`workers/wrangler.jsonc` の `database_name` は `butterchicken-calai-local` です。これはローカル設定上の名前であり、Cloudflare 上のデータベースではありません。バインディング名 `DB` は、このローカル設定にあります。`migrations_dir` は `migrations` で、初期スキーマは `workers/migrations/0001_initial.sql` です。`shops` と `discounts`、座標が両方 NULL か両方とも範囲内であること、`discounts.shop_id` の外部キーは、この migration にあります。インデックスは `idx_discounts_shop_id` だけです。`name_search` と `address_search` のインデックス、および一覧の `created_at DESC, id ASC` 用の複合インデックスは未実装です。設計検討の記録は [api-contract.md](api-contract.md) にあり、[Pull Request #92](https://github.com/H-ampk/butterchickenCalai/pull/92) はマージ済みです。ローカルの `DB` があることは、チーム全体の正式レビューが完了したことではありません。

リモート D1 へつなぐ `"remote": true` と、`wrangler d1 execute` の `--remote` は使いません。`database_id` が無いため、リモート操作は失敗します。失敗したコマンドを、UUID を作って通さないでください。

## 必要な環境

- Git
- Node.js 22.18.0 以上。23 系を使う場合は 23.6.0 以上
- npm

この一覧は、Workers を起動するこの手順の要件です。フロントエンドだけを `frontend` で起動する要件は、Node.js 20.19.0 以上、または 22.12.0 以上のままです。両方を動かすときは、ここにある Workers の要件を満たすバージョンを使います。

Wrangler は `workers/package.json` の開発依存です。バージョンは 4.157.0 です。この版の `engines.node` と起動時の確認は、Node.js 22.0.0 以上です。同梱の workerd は 2026-11-03 です。`compatibility_date` はこの日付に合わせています。これより未来の日付にすると、ローカル起動は失敗します。

`workers` の `npm run dev` と `npm test` は、`node` で `.ts` を直接実行します。型除去のフラグは付けません。Node.js が型注釈を取り除いて `.ts` を実行する機能は、22.18.0 以降と 23.6.0 以降で既定です。22.17 以前と、23.0.0 以上 23.6.0 未満では、これらのスクリプトは実行できません。Wrangler の要件と合わせた最小バージョンは 22.18.0 です。`workers/package.json` の `engines` は `>=22.18.0 <23 || >=23.6.0` です。22.18.0 と 23.6.0 を、この環境で起動して確認してはいません。

Wrangler 4.61.1 以降は、ローカルの D1 操作で `database_id` を省略できます。公式の設定スキーマでも `database_id` は必須ではありません。

## インストール

PowerShell で実行します。このあとの各コードブロックは、先頭で作業ディレクトリをリポジトリのルートに戻します。ルート、`frontend`、`workers` のどれから始めても、ブロックを上から順に実行できます。これより深いディレクトリからでは失敗します。

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd frontend
npm ci
cd ..\workers
npm ci
```

依存関係を初めて入れる開発マシンでは、`npm ci` の代わりに `npm install` でも同じパッケージを入れられます。ロックファイルは `frontend/package-lock.json` と `workers/package-lock.json` です。

## Vite のビルド

既存の開発サーバーは、これまでどおり `frontend` で `npm run dev` です。待受は `http://localhost:5173` です。このコマンドは Workers を起動しません。

Workers から配信するファイルは、Vite の本番ビルド結果です。

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd frontend
npm run build
```

`npm run build` は `tsc` と `vite build` です。出力先は `frontend/dist` です。このディレクトリは Git 管理しません。

## Workers のローカル起動

`frontend/dist/index.html` が無い状態で Workers を起動すると、`workers` の `npm run dev` は止まるようにしてあります。

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd workers
npm run dev
```

待受は `http://127.0.0.1:8787` です。ブラウザでこの URL を開くと、ホーム画面が出ます。静的ファイルは Workers Static Assets が返します。`/__health` と `/api/v1` は Worker スクリプトを先に実行します。`/api/v1` の 5 本の GET は、ローカル D1 に migration を適用したあと、公開条件を満たす店舗と割引を返します。0 件の一覧は HTTP 200 です。テーブルが無い、またはバインディングが無いときは HTTP 500 `internal_error` です。D1 へ接続できない一時障害は HTTP 503 `service_unavailable` です。画面の URL ルーティングは使っていません。それ以外の未知のパスは、単一ページ向けの設定により `index.html` を返します。

停止は、その PowerShell で Ctrl+C です。停止したあとの作業ディレクトリは `workers` です。次のブロックは、先頭でルートへ戻します。

## ローカル D1

初回の `npm run dev` または次のコマンドで、ローカル D1 のファイルが `workers/.wrangler/` に作られます。この接続確認は `SELECT 1` だけであり、店舗テーブルと割引テーブルは作りません。テーブルと開発用データの手順は [database/README.md](../database/README.md) です。

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd workers
npm run d1:check
```

これは次と同じです。単独で実行する場合も、同じ先頭の移動から始めます。

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd workers
npx wrangler d1 execute DB --local --command "SELECT 1 AS ok;"
```

成功すると、実行結果に `ok` と `1` が出ます。このコマンドはリモートへ接続しません。

スキーマをローカル D1 に入れるときは、同じ `workers` で `npm run d1:migrations:apply` のあと、必要なら `npm run d1:seed` を実行します。`--remote` は付けません。seed は架空データで、再実行すると主キーで失敗します。入れ直すときは `npm run d1:seed:reset` を先に実行します。詳細は [database/README.md](../database/README.md) です。

Workers を止めて `workers/.wrangler` を削除すると、ローカル D1 を含む Wrangler のローカル状態が最初からになります。本番データは入っていません。削除したあとにテーブルが必要なら、migration を再度適用します。

## ヘルスチェック

Workers を起動した別の PowerShell で実行します。作業ディレクトリはどこでも構いません。

```powershell
Invoke-RestMethod http://127.0.0.1:8787/__health
```

接続できているときの応答は次です。HTTP ステータスは 200 です。

```json
{
  "status": "ok",
  "database": "connected"
}
```

バインディングが無い、またはクエリが失敗したときは、200 にはしません。HTTP 503 と、次の本文だけを返します。SQL と例外の文章は含めません。

```json
{
  "status": "error",
  "database": "unavailable"
}
```

`GET` 以外は HTTP 405 です。このパスはローカル確認用です。本番へ公開する場合の扱いは決めていません。

## テスト

```powershell
if (Test-Path -LiteralPath '.\frontend\package.json') { cd . }
elseif (Test-Path -LiteralPath '..\frontend\package.json') { cd .. }
else { throw 'リポジトリのルート、frontend、workers のいずれかで実行してください。' }
cd frontend
npm test
npm run build
cd ..\workers
npm run check
npm test
```

`workers` の `npm test` は、ヘルスチェックと参照 API 基盤の単体テスト、D1 のスキーマと seed のテスト、およびローカル Workers を起動する統合テストです。スキーマのテストは一時ディレクトリのローカル D1 だけを使い、`workers/.wrangler` は変更しません。統合テストの前に `frontend` の `npm run build` が必要です。Frontend CI は `frontend` の型チェックとビルドだけを実行し、Workers のテストは走らせません。

## よくあるエラー

| 現象 | 対処 |
| --- | --- |
| `frontend/dist/index.html がありません` | `frontend` で `npm run build` してから、`workers` で `npm run dev` する |
| `database_id` が無い、というリモート向けのエラー | `--remote` を外す。`npm run d1:check` は `--local` 付きである |
| ブラウザが Cloudflare のログインを求める、または本番 URL を作ろうとする | `wrangler deploy` と `wrangler login` は実行しない |
| `http://127.0.0.1:8787` に接続できない | 先に `workers` で `npm run dev` が動いているか確認する。ポート 8787 を他のプロセスが使っている場合は、そのプロセスを止める |
| `/__health` や `/api/v1` が HTML を返す | `workers/wrangler.jsonc` の `run_worker_first` に `/__health` と `/api/v1` があるか確認する。静的配信の単一ページ設定は、この指定が無いと未知のパスへ `index.html` を返す |
| `npm run dev` が `frontend` で Workers にならない | 想定どおり。Vite の開発サーバーは `frontend`、Workers は `workers` |

この手順で秘密情報は使いません。環境ファイルは新しく作りません。個人情報、API キー、Secrets は、ソース、`VITE_` で始まる環境変数、ログ、`.env` に置きません。ローカルの Workers だけで秘密情報が必要になった場合は、`workers/.dev.vars` に置きます。Wrangler がローカル起動時にこのファイルを読みます。`.gitignore` は `.dev.vars` と `.dev.vars.*` を除外しているため、Git 管理しません。`workers/.wrangler/` はローカル D1 などの状態であり、秘密情報の保存先にはしません。これも Git 管理しません。
