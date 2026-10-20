# API連携方針

フロントエンドとバックエンドの連携方針です。API仕様は未確定です。この文書は実装済みの契約ではありません。

## 方針

- API設計には OpenAPI を利用する
- データ交換形式は JSON
- 通信には HTTP を使用する
- APIのエンドポイントと認証方式は今後決定する
- FastAPI 側のスキーマと TypeScript 側の型定義の整合性を維持する
- APIを変更するときは、フロントエンド、バックエンド、データベース、全体管理の関係担当者に共有する

エンドポイントのパスは、チームの合意があるまでこの文書でもコードでも確定させません。

## 検討対象のリソース

- Users
- Shops
- Posts
- Discounts
- Hashtags
- Favorites

## 接続先

フロントエンドがAPIの基底URLを参照する環境変数は `VITE_API_BASE_URL` です。値の例は [frontend/.env.example](../frontend/.env.example) にあります。実際の `.env` は Git の管理対象外です。
