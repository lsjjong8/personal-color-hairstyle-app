import { useEffect, useState } from 'react'
import { LanguageToggle } from './components/LanguageToggle'
import { PhotoCapture, type CapturedPhoto } from './components/capture/PhotoCapture'
import { Landing } from './components/landing/Landing'
import { ResultCard } from './components/result/ResultCard'
import { useAnalysis } from './hooks/useAnalysis'
import { useLocale } from './hooks/useLocale'
import { useScreenHistory } from './hooks/useScreenHistory'
import './App.css'

/**
 * 화면 전환: 랜딩(고지) → 사진 입력 → 결과 카드.
 * 각 단계는 방문 기록에 남으므로 폰 뒤로가기로 되짚을 수 있다(useScreenHistory).
 *
 * 언어 전환은 화면 셋 어디서나 가능해야 해서 화면 위에 함께 그린다.
 * 언어는 화면 이동 단계가 아니므로 방문 기록에 쌓지 않는다(useLocale).
 */
function App() {
  const { screen, goTo, goBack } = useScreenHistory()
  const { locale, setLocale, t } = useLocale()
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

  const toggle = <LanguageToggle locale={locale} onChange={setLocale} t={t} />

  if (screen === 'landing') {
    return (
      <>
        {toggle}
        <Landing onStart={() => goTo('capture')} t={t} />
      </>
    )
  }

  if (screen === 'capture') {
    return (
      <>
        {toggle}
        <PhotoCapture onCapture={handleCapture} onBack={goBack} t={t} />
      </>
    )
  }

  return (
    <>
      {toggle}
      <main className="screen">
        <h1>{t.result.title}</h1>

        {preview !== null && (
          <img className="preview" src={preview} alt={t.result.previewAlt} />
        )}

        {state.status === 'running' && <p className="lead">{t.result.analyzing}</p>}

        {state.status === 'failed' && (
          <p className="error" role="alert">
            {t.failure[state.reason]}
          </p>
        )}

        {state.status === 'done' && (
          <ResultCard result={state.result} locale={locale} t={t} />
        )}

        <button type="button" className="ghost" onClick={goBack}>
          {t.result.retake}
        </button>
      </main>
    </>
  )
}

export default App
