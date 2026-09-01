import { detectFace, type FaceLandmarkSet } from './adapters/faceLandmarkerAdapter'
import {
  applyChannelGain,
  applyGainToColor,
  estimateNeutralReference,
  estimateWhiteBalanceGain,
} from './color/whiteBalance'
import { combineGain, estimateExposureGain, luma } from './color/exposure'
import { judgeFaceShape } from './rules/faceShape'
import { judgePersonalColor } from './rules/personalColor'
import { sampleSkinLab } from './sampling/skinSampling'
import type { AnalysisResult, ImageLike, LightingCorrection, Point } from './types'

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
 * 피부색을 재기 전에 조명을 두 축으로 걷어낸다 — **색**(whiteBalance)과
 * **밝기**(exposure)다. 둘 다 눈 흰자를 기준자로 쓴다.
 *
 * 기준을 찾지 못하면(눈 감음·안경 반사·과노출) 보정 없이 원본으로 진행한다 —
 * 보정 실패가 분석 실패가 되지는 않는다. 억지로 보정하느니 원본이 덜 틀린다.
 */
function correctLighting(
  image: ImageLike,
  neutralRegions: readonly Point[][],
): { image: ImageLike; correction: LightingCorrection } {
  const reference = estimateNeutralReference(image, neutralRegions)

  if (reference === null) {
    return { image, correction: { applied: false, referenceLuma: null } }
  }

  const colorGain = estimateWhiteBalanceGain(reference)
  // 노출 배율은 **색 보정을 거친** 기준으로 잰다. 색 보정이 기준의 밝기를 바꾸므로
  // 원본 기준으로 재면 목표 밝기가 체계적으로 어긋난다.
  const neutralReference = applyGainToColor(reference, colorGain)
  const exposure = estimateExposureGain(neutralReference)

  return {
    image: applyChannelGain(image, combineGain(colorGain, exposure)),
    // 목표 밝기와 **같은 척도의 값**을 남긴다 — 배율이 아니라 잰 값이라야
    // 실사용 분포로 목표를 다시 그을 수 있다.
    correction: { applied: true, referenceLuma: luma(neutralReference) },
  }
}

export function analyzeFromFace(image: ImageLike, face: FaceLandmarkSet): AnalysisResult {
  const corrected = correctLighting(image, face.neutralRegions)
  const skin = sampleSkinLab(corrected.image, face.skinPoints, face.sampleRadius)

  if (skin === null) {
    return { ok: false, reason: 'too-few-skin-pixels' }
  }

  return {
    ok: true,
    personalColor: judgePersonalColor(skin.lab),
    faceShape: judgeFaceShape(face.metrics),
    // 잘림은 보정을 적용한 **뒤에** 생기므로 표본을 뽑고 나서야 알 수 있다.
    // 그래서 보정 사실과 잘림 비율을 여기서 합친다.
    lighting: { ...corrected.correction, clippedRatio: skin.clippedRatio },
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
