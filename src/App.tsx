import { useState } from 'react'
import { Landing } from './components/landing/Landing'
import { PhotoCapture, type CapturedPhoto } from './components/capture/PhotoCapture'
import { useAnalysis } from './hooks/useAnalysis'
import './App.css'

type Screen = 'landing' | 'capture' | 'result'

/**
 * 화면 전환: 랜딩(고지) → 사진 입력 → 결과.
 * 결과 화면은 Phase 4에서 카드 형태로 다듬는다 — 지금은 판정값 확인용이다.
 */
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

      {state.status === 'failed' && <p className="error">{state.message}</p>}

      {state.status === 'done' && (
        <section className="result">
          <p className="tone">{state.result.personalColor.tone12}</p>
          <p className="lead">얼굴형: {state.result.faceShape.shape}</p>

          {state.result.personalColor.undertone === 'neutral' && (
            <p className="notice">
              웜과 쿨의 경계에 가깝습니다. 진단사에 따라 다르게 볼 수 있는 유형입니다.
            </p>
          )}

          <dl className="evidence">
            <dt>피부 밝기 (L*)</dt>
            <dd>{state.result.personalColor.evidence.skinLab.l.toFixed(1)}</dd>
            <dt>색상각 (h°)</dt>
            <dd>{state.result.personalColor.evidence.hue.toFixed(1)}</dd>
            <dt>채도 (C*)</dt>
            <dd>{state.result.personalColor.evidence.chroma.toFixed(1)}</dd>
            <dt>얼굴 세로/가로</dt>
            <dd>{state.result.faceShape.evidence.lengthRatio.toFixed(2)}</dd>
          </dl>
        </section>
      )}

      <button type="button" className="primary" onClick={handleRetry}>
        다시 찍기
      </button>
    </main>
  )
}

export default App
