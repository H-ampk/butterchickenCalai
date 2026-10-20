export function renderHome(root: HTMLElement, onOpenMap: () => void): void {
  root.innerHTML = `
    <main class="page">
      <h1>地域割引SNSアプリ</h1>
      <p class="concept">近くのお得を、SNS感覚で見つけよう</p>
      <p class="status">現在、開発準備中です。地図は枠だけを表示します。</p>
      <button type="button" class="button" data-action="open-map">地図画面へ</button>
    </main>
  `

  const button = root.querySelector<HTMLButtonElement>('[data-action="open-map"]')
  if (!button) {
    throw new Error('地図画面へのボタンが見つかりません。')
  }
  button.addEventListener('click', onOpenMap)
}
