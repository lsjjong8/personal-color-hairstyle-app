import { useCallback, useEffect, useRef, useState } from 'react'
import { preloadLandmarker } from '../../core/adapters/faceLandmarkerAdapter'

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
}

/** 분석에 충분한 해상도. 너무 크면 느리고, 너무 작으면 피부 표본이 부족해진다 */
const MAX_EDGE = 720

function drawToCanvas(
  source: HTMLVideoElement | ImageBitmap,
  sourceWidth: number,
  sourceHeight: number,
): CapturedPhoto | null {
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
export function PhotoCapture({ onCapture, onBack }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
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
          setCameraError('카메라를 열지 못했습니다. 아래에서 사진을 골라 주세요.')
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
      setCameraError('사진을 만드는 데 실패했습니다. 파일 선택을 이용해 주세요.')
      return
    }

    stopCamera()
    setCameraReady(false)
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
      setCameraError('사진을 읽지 못했습니다. 다른 파일로 시도해 주세요.')
      return
    }

    stopCamera()
    onCapture(photo)
  }

  return (
    <main className="screen">
      <h1>사진 준비</h1>
      <p className="lead">
        얼굴이 화면에 정면으로 들어오게 하고, 앞머리로 이마를 가리지 않으면 더 잘
        잡힙니다.
      </p>

      <div className="camera">
        <video ref={videoRef} playsInline autoPlay muted aria-label="카메라 미리보기" />
      </div>

      {cameraError !== null && <p className="error">{cameraError}</p>}

      <button
        type="button"
        className="primary"
        onClick={handleShoot}
        disabled={!cameraReady}
      >
        지금 촬영
      </button>

      <label className="file-pick">
        갖고 있는 사진 고르기
        <input type="file" accept="image/*" onChange={handleFile} />
      </label>

      <button type="button" className="ghost" onClick={onBack}>
        뒤로
      </button>
    </main>
  )
}
