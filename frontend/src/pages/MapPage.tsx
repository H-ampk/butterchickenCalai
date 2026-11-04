import { useEffect, useState } from 'react'
import { getShops } from '../api/shops.ts'
import type { Shop } from '../types/shop.ts'

interface MapPageProps {
  onBackHome: () => void
}

type ShopLoadState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'ready'; shops: Shop[] }

export function MapPage({ onBackHome }: MapPageProps) {
  const [shopLoad, setShopLoad] = useState<ShopLoadState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    getShops()
      .then((shops) => {
        if (!active) {
          return
        }
        if (shops.length === 0) {
          setShopLoad({ status: 'empty' })
          return
        }
        setShopLoad({ status: 'ready', shops })
      })
      .catch(() => {
        if (!active) {
          return
        }
        setShopLoad({ status: 'error' })
      })

    return () => {
      active = false
    }
  }, [])

  const statusMessage = shopStatusMessage(shopLoad)

  return (
    <main className="page">
      <h1>近くの割引を探す</h1>
      <p className="status">地図ライブラリは未導入です。この領域に後から地図を描画します。</p>
      <div className="map-container" data-map-container>
        <p className="map-placeholder">地図は開発中です。まだ描画していません。</p>
      </div>
      <section className="shop-section" aria-live="polite">
        <h2>店舗一覧（開発用）</h2>
        <p className="status">{statusMessage}</p>
        <ul className="shop-list" hidden={shopLoad.status !== 'ready'}>
          {shopLoad.status === 'ready'
            ? shopLoad.shops.map((shop) => (
                <li key={shop.id}>
                  <p className="shop-name">{shop.name}</p>
                  <p className="shop-address">{shop.address}</p>
                  <p className="shop-position">
                    緯度 {shop.latitude} / 経度 {shop.longitude}
                  </p>
                </li>
              ))
            : null}
        </ul>
      </section>
      <button type="button" className="button" onClick={onBackHome}>
        ホームへ戻る
      </button>
    </main>
  )
}

function shopStatusMessage(shopLoad: ShopLoadState): string {
  if (shopLoad.status === 'loading') {
    return '店舗データを読み込んでいます。'
  }
  if (shopLoad.status === 'empty') {
    return '表示できる店舗はありません。'
  }
  if (shopLoad.status === 'error') {
    return '店舗データの取得に失敗しました。'
  }
  return `${shopLoad.shops.length}件の店舗を表示しています。`
}
