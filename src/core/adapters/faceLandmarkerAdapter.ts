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
  /** 피부색을 뽑을 지점 (양 볼 여러 곳) — 픽셀 좌표 */
  skinPoints: Point[]
  /** 조명 색 보정의 무채색 기준을 찾을 영역들 (왼눈·오른눈 각각) — 픽셀 좌표 */
  neutralRegions: Point[][]
  /** 표본 반경(픽셀). 얼굴 크기에 비례한다 — 고정값이면 얼굴이 작을 때 표본이 몇 픽셀뿐이다 */
  sampleRadius: number
  /** 얼굴형 판정용 비율 측정값 — 픽셀 단위 */
  metrics: FaceMetrics
}

/** MediaPipe Face Mesh 표준 인덱스 */
const LANDMARK_INDEX = {
  leftCheek: 234,
  rightCheek: 454,
  forehead: 10,
  chin: 152,
  leftJaw: 172,
  rightJaw: 397,
  leftForehead: 21,
  rightForehead: 251,
} as const

/**
 * 피부색 표본 지점 — 볼을 안쪽·가운데·아래쪽으로 넓게 훑는다.
 * 지점이 적으면 한 곳의 그림자·잡티가 판정을 통째로 바꾼다
 * (2026-08-18 실측: 같은 사진에서 표본 지점만 바꿔 네 계절이 모두 나왔다).
 * 이마는 앞머리 오염 때문에 제외한다(ADR-004).
 */
const SKIN_SAMPLE_INDEXES = [50, 280, 205, 425, 116, 345, 118, 347] as const

/**
 * 눈 영역 — 이 안의 가장 밝은 픽셀이 흰자이며 조명 보정의 기준이 된다.
 * **좌우를 따로 둔다.** 하나로 묶으면 두 눈 사이 콧대가 영역에 들어와
 * 흰자 대신 피부를 기준으로 잡는다(whiteBalance.ts 주석 참조).
 */
const LEFT_EYE_INDEXES = [33, 133, 159, 145] as const
const RIGHT_EYE_INDEXES = [263, 362, 386, 374] as const

/** 표본 반경을 얼굴 너비의 이 비율로 잡는다 — 8지점과 곱해 충분한 픽셀이 모이는 값 */
const SAMPLE_RADIUS_RATIO = 0.04
/** 얼굴이 작게 잡혀도 최소 이만큼은 훑는다 */
const MIN_SAMPLE_RADIUS = 4

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

  const cheekboneWidth = distance(at(LANDMARK_INDEX.leftCheek), at(LANDMARK_INDEX.rightCheek))

  return {
    skinPoints: SKIN_SAMPLE_INDEXES.map(at),
    neutralRegions: [LEFT_EYE_INDEXES.map(at), RIGHT_EYE_INDEXES.map(at)],
    sampleRadius: Math.max(MIN_SAMPLE_RADIUS, Math.round(cheekboneWidth * SAMPLE_RADIUS_RATIO)),
    metrics: {
      faceLength: distance(at(LANDMARK_INDEX.forehead), at(LANDMARK_INDEX.chin)),
      cheekboneWidth,
      jawWidth: distance(at(LANDMARK_INDEX.leftJaw), at(LANDMARK_INDEX.rightJaw)),
      foreheadWidth: distance(
        at(LANDMARK_INDEX.leftForehead),
        at(LANDMARK_INDEX.rightForehead),
      ),
    },
  }
}
