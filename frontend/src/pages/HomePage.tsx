interface HomePageProps {
  onOpenMap: () => void
}

export function HomePage({ onOpenMap }: HomePageProps) {
  return (
    <main className="page">
      <h1>地域割引SNSアプリ</h1>
      <p className="concept">近くのお得を、SNS感覚で見つけよう</p>
      <p className="status">現在、開発準備中です。地図は枠だけを表示します。</p>
      <button type="button" className="button" onClick={onOpenMap}>
        地図画面へ
      </button>
    </main>
  )
}
