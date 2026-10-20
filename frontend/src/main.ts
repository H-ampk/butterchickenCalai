import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('描画先 #app が見つかりません。')
}

app.innerHTML = `
  <main class="home">
    <h1>地域割引SNSアプリ</h1>
    <p class="concept">近くのお得を、SNS感覚で見つけよう</p>
    <p class="status">現在、開発準備中です。</p>
  </main>
`
