import { useState } from 'react'
import { HomePage } from './pages/HomePage.tsx'
import { MapPage } from './pages/MapPage.tsx'

type Page = 'home' | 'map'

export function App() {
  const [page, setPage] = useState<Page>('home')

  if (page === 'home') {
    return <HomePage onOpenMap={() => setPage('map')} />
  }

  return <MapPage onBackHome={() => setPage('home')} />
}
