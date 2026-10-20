export function renderMap(root: HTMLElement, onBackHome: () => void): void {
  root.innerHTML = `
    <main class="page">
      <h1>近くの割引を探す</h1>
      <p class="status">地図ライブラリは未導入です。この領域に後から地図を描画します。</p>
      <div class="map-container" data-map-container>
        <p class="map-placeholder">地図は開発中です。まだ描画していません。</p>
      </div>
      <button type="button" class="button" data-action="back-home">ホームへ戻る</button>
    </main>
  `

  const button = root.querySelector<HTMLButtonElement>('[data-action="back-home"]')
  if (!button) {
    throw new Error('ホームへ戻るボタンが見つかりません。')
  }
  button.addEventListener('click', onBackHome)
}
