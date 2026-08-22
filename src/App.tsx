import { useEffect, useState } from 'react'
import { Landing } from './components/landing/Landing'
import { PhotoCapture, type CapturedPhoto } from './components/capture/PhotoCapture'
import { ResultCard } from './components/result/ResultCard'
import { useAnalysis } from './hooks/useAnalysis'
import { useScreenHistory } from './hooks/useScreenHistory'
import './App.css'

/**
 * 화면 전환: 랜딩(고지) → 사진 입력 → 결과 카드.
 * 각 단계는 방문 기록에 남으므로 폰 뒤로가기로 되짚을 수 있다(useScreenHistory).
 */
function App() {
  const { screen, goTo, goBack } = useScreenHistory()
  const [preview, setPreview] = useState<string | null>(null)
  const { state, run, reset } = useAnalysis()

  // 결과 화면을 벗어나면 이전 분석을 지운다. 화면 상태를 보고 정리하므로
  // 뒤로가기로 나가든 '다시 찍기'로 나가든 같은 경로를 탄다.
  useEffect(() => {
    if (screen !== 'result') {
      reset()
      setPreview(null)
    }
  }, [screen, reset])

  function handleCapture(photo: CapturedPhoto): void {
    setPreview(photo.previewUrl)
    goTo('result')
    void run(photo.canvas, photo.image)
  }

  if (screen === 'landing') {
    return <Landing onStart={() => goTo('capture')} />
  }

  if (screen === 'capture') {
    return <PhotoCapture onCapture={handleCapture} onBack={goBack} />
  }

  return (
    <main className="screen">
      <h1>결과</h1>

      {preview !== null && <img className="preview" src={preview} alt="분석한 사진" />}

      {state.status === 'running' && <p className="lead">분석하고 있습니다…</p>}

      {state.status === 'failed' && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}

      {state.status === 'done' && <ResultCard result={state.result} />}

      <button type="button" className="ghost" onClick={goBack}>
        다시 찍기
      </button>
    </main>
  )
}

export default App
