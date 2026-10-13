# システム構成

この文書は、地域割引SNSアプリの構成方針です。バックエンド、データベース、地図、AIは未実装です。

## 全体構成

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

ブラウザはフロントエンドを表示します。フロントエンドは HTTP と JSON でバックエンドのAPIを呼び出します。バックエンドは PostgreSQL にデータを保存します。

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

地図は店舗の位置を画面上に示すために使います。Leaflet と OpenStreetMap は地図機能の実装時に導入します。現時点のフロントエンドには地図ライブラリを入れていません。

## AI（将来）

AIは将来追加する構成です。投稿文章から割引情報を抽出する処理を、バックエンドから AI API へ問い合わせる形で追加する想定です。APIキーなどの秘密情報はフロントエンドの `VITE_` 環境変数に置きません。

## 責務

- フロントエンド: 画面表示、ユーザー操作、API通信
- バックエンド: 認証、権限確認、業務処理、API提供
- データベース: ユーザー、店舗、投稿、割引データの管理
- 地図: 店舗位置の可視化
- AI: 投稿文章からの情報抽出（将来）
