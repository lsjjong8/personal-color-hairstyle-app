import { detectFace, type FaceLandmarkSet } from './adapters/faceLandmarkerAdapter'
import { judgeFaceShape } from './rules/faceShape'
import { judgePersonalColor } from './rules/personalColor'
import { sampleSkinLab } from './sampling/skinSampling'
import type { AnalysisResult, ImageLike } from './types'

/**
 * 분석 오케스트레이터 — 사진 한 장에서 판정 결과까지.
 *
 * 두 층으로 나눈다:
 *   - analyzeFromFace: 얼굴 좌표가 주어졌을 때의 순수 로직 (테스트 대상)
 *   - analyzePhoto: 위 함수에 MediaPipe 검출을 붙인 것 (브라우저 전용)
 */

/**
 * 피부색을 모을 때 각 지점 주변에서 훑는 반경(픽셀).
 * 표본 지점이 3(볼 2 + 이마)에서 2(볼만)로 줄면서 반경을 6→8로 올려
 * 픽셀 수를 보전했다 (3×13² = 507 ≈ 2×17² = 578).
 */
const SKIN_SAMPLE_RADIUS = 8

/** 얼굴 좌표가 이미 있을 때의 판정 — 외부 의존이 없다 */
export function analyzeFromFace(image: ImageLike, face: FaceLandmarkSet): AnalysisResult {
  const skinLab = sampleSkinLab(image, face.skinPoints, SKIN_SAMPLE_RADIUS)

  if (skinLab === null) {
    return { ok: false, reason: 'too-few-skin-pixels' }
  }

  return {
    ok: true,
    personalColor: judgePersonalColor(skinLab),
    faceShape: judgeFaceShape(face.metrics),
  }
}

/**
 * 사진에서 얼굴을 찾아 판정까지 수행한다.
 * 이미지 픽셀과 표시용 소스를 함께 받는다 — 검출은 원본 엘리먼트에서,
 * 색 추출은 픽셀 배열에서 이뤄지기 때문이다.
 */
export async function analyzePhoto(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  image: ImageLike,
): Promise<AnalysisResult> {
  let face: FaceLandmarkSet | null

  try {
    face = await detectFace(source, image.width, image.height)
  } catch {
    return { ok: false, reason: 'model-load-failed' }
  }

  if (face === null) {
    return { ok: false, reason: 'no-face-detected' }
  }

  return analyzeFromFace(image, face)
}
