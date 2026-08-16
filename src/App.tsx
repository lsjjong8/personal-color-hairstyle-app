import { useState } from 'react'
import { Landing } from './components/landing/Landing'
import { PhotoCapture, type CapturedPhoto } from './components/capture/PhotoCapture'
import { ResultCard } from './components/result/ResultCard'
import { useAnalysis } from './hooks/useAnalysis'
import './App.css'

type Screen = 'landing' | 'capture' | 'result'

/** 화면 전환: 랜딩(고지) → 사진 입력 → 결과 카드 */
function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [preview, setPreview] = useState<string | null>(null)
  const { state, run, reset } = useAnalysis()

  function handleCapture(photo: CapturedPhoto): void {
    setPreview(photo.previewUrl)
    setScreen('result')
    void run(photo.canvas, photo.image)
  }

  function handleRetry(): void {
    reset()
    setPreview(null)
    setScreen('capture')
  }

  if (screen === 'landing') {
    return <Landing onStart={() => setScreen('capture')} />
  }

  if (screen === 'capture') {
    return <PhotoCapture onCapture={handleCapture} />
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

      <button type="button" className="ghost" onClick={handleRetry}>
        다시 찍기
      </button>
    </main>
  )
}

export default App
