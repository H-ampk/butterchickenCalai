import { getShops } from '../api/shops.ts'
import type { Shop } from '../types/shop.ts'

export function renderMap(root: HTMLElement, onBackHome: () => void): void {
  const viewId = String(Date.now())
  root.dataset.mapView = viewId

  root.innerHTML = `
    <main class="page">
      <h1>近くの割引を探す</h1>
      <p class="status">地図ライブラリは未導入です。この領域に後から地図を描画します。</p>
      <div class="map-container" data-map-container>
        <p class="map-placeholder">地図は開発中です。まだ描画していません。</p>
      </div>
      <section class="shop-section" aria-live="polite">
        <h2>店舗一覧（開発用）</h2>
        <p class="status" data-shop-status>店舗データを読み込んでいます。</p>
        <ul class="shop-list" data-shop-list hidden></ul>
      </section>
      <button type="button" class="button" data-action="back-home">ホームへ戻る</button>
    </main>
  `

  const button = root.querySelector<HTMLButtonElement>('[data-action="back-home"]')
  if (!button) {
    throw new Error('ホームへ戻るボタンが見つかりません。')
  }
  button.addEventListener('click', () => {
    delete root.dataset.mapView
    onBackHome()
  })

  void loadShops(root, viewId)
}

function isCurrentView(root: HTMLElement, viewId: string): boolean {
  return root.dataset.mapView === viewId
}

async function loadShops(root: HTMLElement, viewId: string): Promise<void> {
  try {
    const shops = await getShops()
    if (!isCurrentView(root, viewId)) {
      return
    }
    if (shops.length === 0) {
      setStatus(root, '表示できる店舗はありません。')
      return
    }
    setStatus(root, `${shops.length}件の店舗を表示しています。`)
    renderShopList(root, shops)
  } catch {
    if (!isCurrentView(root, viewId)) {
      return
    }
    setStatus(root, '店舗データの取得に失敗しました。')
  }
}

function setStatus(root: HTMLElement, message: string): void {
  const status = root.querySelector<HTMLElement>('[data-shop-status]')
  if (!status) {
    return
  }
  status.textContent = message
}

function renderShopList(root: HTMLElement, shops: Shop[]): void {
  const list = root.querySelector<HTMLUListElement>('[data-shop-list]')
  if (!list) {
    return
  }
  list.hidden = false
  list.replaceChildren(
    ...shops.map((shop) => {
      const item = document.createElement('li')
      const name = document.createElement('p')
      name.className = 'shop-name'
      name.textContent = shop.name
      const address = document.createElement('p')
      address.className = 'shop-address'
      address.textContent = shop.address
      const position = document.createElement('p')
      position.className = 'shop-position'
      position.textContent = `緯度 ${shop.latitude} / 経度 ${shop.longitude}`
      item.append(name, address, position)
      return item
    }),
  )
}
