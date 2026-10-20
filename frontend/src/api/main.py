from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI()

# 【超重要】1人目（画面）や2人目（検索）のHTML/JavaScriptから通信を許可する設定（CORS設定）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発時は全アクセスを許可
    allow_methods=["*"],
    allow_headers=["*"],
)

# チームで共有するサンプル割引データ（メモリ上に保持）
sample_discounts = [
    {
        "id": 1,
        "shop_name": "学食カフェ",
        "content": "日替わりランチ 10%OFF",
        "tags": ["#学生割", "#ランチ"],
        "latitude": 35.6812,
        "longitude": 139.7671
    },
    {
        "id": 2,
        "shop_name": "居酒屋キャンパス",
        "content": "ドリンク1杯無料",
        "tags": ["#学生割", "#ディナー"],
        "latitude": 35.6820,
        "longitude": 139.7680
    }
]

# 投稿されるデータの型（形式）を定義
class DiscountCreate(BaseModel):
    shop_name: str
    content: str
    tags: List[str]
    latitude: float
    longitude: float


@app.get("/")
def read_root():
    return {"message": "FastAPIサーバーが起動しています！"}


# 1. 割引情報一覧を取得するAPI（GET）
@app.get("/discounts")
def get_discounts():
    return sample_discounts


# 2. 新しい割引情報を追加・投稿するAPI（POST）
@app.post("/discounts")
def create_discount(discount: DiscountCreate):
    # 新しいデータにIDを自動で割り振る（1ずつ増やす）
    new_id = len(sample_discounts) + 1
    
    # 届いたデータを辞書形式に変換してIDを付与
    new_discount = {
        "id": new_id,
        "shop_name": discount.shop_name,
        "content": discount.content,
        "tags": discount.tags,
        "latitude": discount.latitude,
        "longitude": discount.longitude
    }
    
    # リストに追加
    sample_discounts.append(new_discount)
    
    return {"message": "割引情報を登録しました！", "data": new_discount}