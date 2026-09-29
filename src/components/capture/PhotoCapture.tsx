import { useCallback, useEffect, useRef, useState } from 'react'
import { preloadLandmarker } from '../../core/adapters/faceLandmarkerAdapter'
import type { UiText } from '../../i18n/uiText'

export interface CapturedPhoto {
  /** 얼굴 검출에 넘길 원본 소스 */
  canvas: HTMLCanvasElement
  /** 색 추출용 픽셀 데이터 */
  image: ImageData
  /** 미리보기용 */
  previewUrl: string
}

interface PhotoCaptureProps {
  onCapture: (photo: CapturedPhoto) => void
  /** 앞 화면으로 돌아간다 — 폰 뒤로가기가 없는 환경을 위한 눈에 보이는 통로 */
  onBack: () => void
  t: UiText
}

/**
 * 실패를 **사유 키로** 들고 있는다 — 문구로 바꾸지 않는다.
 *
 * ★문구를 상태에 담으면 그것을 만드는 `t`가 effect 의존성에 들어가고, 언어를
 * 바꿀 때마다 **카메라 effect가 통째로 다시 돈다.** 재취득 중에는
 * `video.videoWidth`가 0이라 그 창에서 촬영하면 0 크기 canvas가 만들어지고
 * `getImageData(0,0,0,0)`이 예외를 던진다 — 에러 경계가 없어 흰 화면이 된다.
 * 사유만 들고 있으면 그 연쇄가 통째로 사라지고, 덤으로 **이미 떠 있는 실패
 * 문구도 언어를 따라간다.**
 */
type CaptureError = 'cameraFailed' | 'shootFailed' | 'readFailed'

/** 분석에 충분한 해상도. 너무 크면 느리고, 너무 작으면 피부 표본이 부족해진다 */
const MAX_EDGE = 720

function drawToCanvas(
  source: HTMLVideoElement | ImageBitmap,
  sourceWidth: number,
  sourceHeight: number,
): CapturedPhoto | null {
  // 카메라를 다시 얻는 중이면 0이 온다. 0으로 canvas를 만들면
  // getImageData가 IndexSizeError를 던진다 — 여기서 막는다
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return null
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sourceWidth * scale)
  canvas.height = Math.round(sourceHeight * scale)

  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (context === null) {
    return null
  }

  context.drawImage(source, 0, 0, canvas.width, canvas.height)

  return {
    canvas,
    image: context.getImageData(0, 0, canvas.width, canvas.height),
    previewUrl: canvas.toDataURL('image/jpeg', 0.85),
  }
}

/**
 * 사진 입력 — 카메라 촬영과 파일 업로드 두 경로를 함께 제공한다.
 * iOS Safari처럼 카메라 제약이 있는 환경에서도 업로드로 끝까지 갈 수 있도록
 * 폴백을 숨기지 않고 항상 노출한다(PRD 기술 리스크 완화책).
 */
export function PhotoCapture({ onCapture, onBack, t }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [captureError, setCaptureError] = useState<CaptureError | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    // 스트림이 끊겼으면 촬영 버튼도 함께 잠근다 — 안 잠그면 끊긴 카메라로
    // 찍으려 들고, 그 경로가 0 크기 canvas로 이어진다
    setCameraReady(false)
  }, [])

  // 사용자가 얼굴 위치를 맞추는 동안 모델(약 15MB)을 미리 받아 둔다
  useEffect(() => {
    preloadLandmarker()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function startCamera(): Promise<void> {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current !== null) {
          videoRef.current.srcObject = stream
          setCameraReady(true)
        }
      } catch {
        if (!cancelled) {
          setCaptureError('cameraFailed')
        }
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [stopCamera])

  function handleShoot(): void {
    const video = videoRef.current

    if (video === null) {
      return
    }

    const photo = drawToCanvas(video, video.videoWidth, video.videoHeight)

    if (photo === null) {
      setCaptureError('shootFailed')
      return
    }

    stopCamera()
    onCapture(photo)
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]

    if (file === undefined) {
      return
    }

    const bitmap = await createImageBitmap(file)
    const photo = drawToCanvas(bitmap, bitmap.width, bitmap.height)
    bitmap.close()

    if (photo === null) {
      setCaptureError('readFailed')
      return
    }

    stopCamera()
    onCapture(photo)
  }

  return (
    <main className="screen">
      <h1>{t.capture.title}</h1>
      <p className="lead">{t.capture.lead}</p>

      <div className="camera">
        <video ref={videoRef} playsInline autoPlay muted aria-label={t.capture.previewLabel} />
      </div>

      {captureError !== null && <p className="error">{t.capture[captureError]}</p>}

      <button
        type="button"
        className="primary"
        onClick={handleShoot}
        disabled={!cameraReady}
      >
        {t.capture.shoot}
      </button>

      <label className="file-pick">
        {t.capture.pickFile}
        <input type="file" accept="image/*" onChange={handleFile} />
      </label>

      <button type="button" className="ghost" onClick={onBack}>
        {t.capture.back}
      </button>
    </main>
  )
}
