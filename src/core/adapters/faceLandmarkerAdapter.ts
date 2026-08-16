import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { FaceMetrics, Point } from '../types'

/**
 * MediaPipe 어댑터 — 코어에서 외부 라이브러리에 의존하는 **유일한** 파일이다(ADR-002).
 * 나머지 코어는 이 파일이 뽑아낸 좌표·측정값만 다루므로 순수 함수로 남는다.
 *
 * 모델과 wasm은 같은 출처에서 직접 서빙한다 — 실행 중 외부 요청이 없어야
 * "사진이 기기를 떠나지 않는다"는 고지가 성립한다(context.md §5).
 */

/** 얼굴 특징점 468개 중 이 앱이 쓰는 지점만 추린 결과 */
export interface FaceLandmarkSet {
  /** 피부색을 뽑을 지점 (양 볼) — 픽셀 좌표 */
  skinPoints: Point[]
  /** 얼굴형 판정용 비율 측정값 — 픽셀 단위 */
  metrics: FaceMetrics
}

/** MediaPipe Face Mesh 표준 인덱스 */
const LANDMARK_INDEX = {
  leftCheek: 234,
  rightCheek: 454,
  leftCheekInner: 50,
  rightCheekInner: 280,
  forehead: 10,
  chin: 152,
  leftJaw: 172,
  rightJaw: 397,
  leftForehead: 21,
  rightForehead: 251,
} as const

const MODEL_PATH = 'models/face_landmarker.task'
const WASM_PATH = 'wasm'

let landmarkerPromise: Promise<FaceLandmarker> | null = null

/** Vite base 경로를 붙여 GitHub Pages 하위 경로에서도 자산을 찾게 한다 */
function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL

  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`
}

/** 모델은 무거우므로 최초 1회만 초기화하고 재사용한다 */
function getLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerPromise === null) {
    const created = FilesetResolver.forVisionTasks(assetUrl(WASM_PATH)).then((fileset) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: assetUrl(MODEL_PATH) },
        runningMode: 'IMAGE',
        numFaces: 1,
      }),
    )

    // 실패한 초기화를 캐시에 남기지 않는다 — 일시적 네트워크 오류라면 다음 호출이 다시 시도한다
    void created.catch(() => {
      if (landmarkerPromise === created) {
        landmarkerPromise = null
      }
    })

    landmarkerPromise = created
  }

  return landmarkerPromise
}

/**
 * 촬영 화면에 들어온 시점에 모델 다운로드·초기화를 미리 시작한다 — 사용자가
 * 얼굴 위치를 맞추는 동안 받아 두면 첫 분석의 대기가 사라진다.
 * 실패는 여기서 조용히 삼킨다: 분석 시점에 다시 시도되고 그때 실패로 보고된다.
 */
export function preloadLandmarker(): void {
  void getLandmarker().catch(() => undefined)
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

/**
 * 사진에서 얼굴을 찾아 이 앱이 쓰는 좌표·측정값으로 옮긴다.
 * 얼굴이 없으면 null.
 */
export async function detectFace(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  width: number,
  height: number,
): Promise<FaceLandmarkSet | null> {
  const landmarker = await getLandmarker()
  const detection = landmarker.detect(source)
  const landmarks = detection.faceLandmarks.at(0)

  if (landmarks === undefined) {
    return null
  }

  // MediaPipe는 0~1로 정규화된 좌표를 주므로 픽셀 좌표로 되돌린다
  const at = (index: number): Point => ({
    x: landmarks[index].x * width,
    y: landmarks[index].y * height,
  })

  return {
    // 이마 지점은 피부 표본에서 뺀다 — 앞머리가 있으면 표본의 1/3이 머리카락이
    // 되는데 절사 평균(20%)으로는 걷어낼 수 없다. 이마 인덱스는 얼굴 길이
    // 측정에만 쓴다.
    skinPoints: [at(LANDMARK_INDEX.leftCheekInner), at(LANDMARK_INDEX.rightCheekInner)],
    metrics: {
      faceLength: distance(at(LANDMARK_INDEX.forehead), at(LANDMARK_INDEX.chin)),
      cheekboneWidth: distance(at(LANDMARK_INDEX.leftCheek), at(LANDMARK_INDEX.rightCheek)),
      jawWidth: distance(at(LANDMARK_INDEX.leftJaw), at(LANDMARK_INDEX.rightJaw)),
      foreheadWidth: distance(
        at(LANDMARK_INDEX.leftForehead),
        at(LANDMARK_INDEX.rightForehead),
      ),
    },
  }
}
