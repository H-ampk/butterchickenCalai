-- 店舗情報テーブル
CREATE TABLE shops (
    id SERIAL PRIMARY KEY, --店舗ID
    name VARCHAR(100) NOT NULL, --店舗名
    address VARCHAR(255), --住所
    latitude DECIMAL(9,6), --緯度
    longitude DECIMAL(9,6), --経度
    image_url TEXT --店舗写真のURL
);

-- 商品情報テーブル
CREATE TABLE products (
    id SERIAL PRIMARY KEY, --商品ID
    shop_id INTEGER REFERENCES shops(id), --店舗ID
    name VARCHAR(100) NOT NULL, --商品名
    description TEXT, --商品説明
    image_url TEXT --商品写真のURL
);

-- 割引情報
CREATE TABLE discounts (
    id SERIAL PRIMARY KEY, --割引ID
    product_id INTEGER REFERENCES products(id), --商品ID
    original_price INTEGER NOT NULL, --通常価格
    discounted_price INTEGER NOT NULL, --割引後価格
    start_time TIMESTAMP NOT NULL, --販売開始日時
    end_time TIMESTAMP NOT NULL --販売終了日時
);

SELECT * FROM shops;
SELECT * FROM products;
SELECT * FROM discounts;