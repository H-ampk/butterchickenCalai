-- ローカル開発用。shops と discounts の行をすべて削除する。
-- 本番では実行しない。migration ではない。
-- 店舗の削除は外部キーの ON DELETE CASCADE で割引も消える。
-- ここでは CASCADE による削除に頼らず、割引を先に明示して空にする。
-- INSERT OR REPLACE は使わない。seed の再投入前にこのファイルを実行する。
DELETE FROM discounts;
DELETE FROM shops;
