import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('描画先 #app が見つかりません。')
}

createRoot(app).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
