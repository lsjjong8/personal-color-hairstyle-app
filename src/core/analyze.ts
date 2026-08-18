import { detectFace, type FaceLandmarkSet } from './adapters/faceLandmarkerAdapter'
import { applyWhiteBalance, estimateNeutralReference } from './color/whiteBalance'
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
 * 얼굴 좌표가 이미 있을 때의 판정 — 외부 의존이 없다.
 *
 * 피부색을 재기 전에 조명 색을 걷어낸다. 눈 흰자를 무채색 기준으로 삼으며,
 * 기준을 찾지 못하면(눈 감음·안경 반사·과노출) 보정 없이 원본으로 진행한다 —
 * 보정 실패가 분석 실패가 되지는 않는다.
 */
export function analyzeFromFace(image: ImageLike, face: FaceLandmarkSet): AnalysisResult {
  const reference = estimateNeutralReference(image, face.neutralRegions)
  const balanced = reference === null ? image : applyWhiteBalance(image, reference)
  const skinLab = sampleSkinLab(balanced, face.skinPoints, face.sampleRadius)

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
