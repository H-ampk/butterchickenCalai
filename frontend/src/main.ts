import './style.css'
import { renderHome } from './pages/home.ts'
import { renderMap } from './pages/map.ts'

type Page = 'home' | 'map'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('描画先 #app が見つかりません。')
}

const root: HTMLDivElement = app

function show(page: Page): void {
  if (page === 'home') {
    renderHome(root, () => show('map'))
    return
  }
  renderMap(root, () => show('home'))
}

show('home')
