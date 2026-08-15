import type { FaceMetrics, FaceShape, FaceShapeResult } from '../types'

/**
 * 얼굴형 5분류 판정 규칙 v0 — context.md §3.
 *
 * 경계값은 **v0 휴리스틱이며 보정 대상**이다(PRD Open Questions).
 * 미용 현장에서 얼굴형이 쓰이는 방식은 "부족한 방향을 시각적으로 보완"이므로,
 * 분류 자체보다 그 뒤에 붙는 제안이 실제 가치를 만든다.
 *
 * 판정 순서가 곧 우선순위다 — 위쪽 조건이 더 뚜렷한 특징이다.
 */

/** 세로/가로 비율이 이 값 이상이면 긴형 */
const LONG_FACE_MIN_RATIO = 1.5
/** 턱 ÷ 이마가 이 값 이하면 역삼각형 (턱이 이마보다 뚜렷하게 좁다) */
const INVERTED_TRIANGLE_MAX_JAW_RATIO = 0.72
/** 턱 ÷ 광대가 이 값 이상이면 턱선이 각지게 보인다 */
const SQUARE_MIN_JAW_RATIO = 0.9
/** 세로/가로 비율이 이 값 이하면 짧은 얼굴 (둥근형·각진형 후보) */
const SHORT_FACE_MAX_RATIO = 1.35

function classify(
  lengthRatio: number,
  jawToForehead: number,
  jawToCheekbone: number,
): FaceShape {
  if (lengthRatio >= LONG_FACE_MIN_RATIO) {
    return '긴형'
  }

  if (jawToForehead <= INVERTED_TRIANGLE_MAX_JAW_RATIO) {
    return '역삼각형'
  }

  if (lengthRatio <= SHORT_FACE_MAX_RATIO) {
    return jawToCheekbone >= SQUARE_MIN_JAW_RATIO ? '각진형' : '둥근형'
  }

  return '계란형'
}

/** landmark에서 뽑은 얼굴 비율로 얼굴형을 판정한다 */
export function judgeFaceShape(metrics: FaceMetrics): FaceShapeResult {
  if (metrics.cheekboneWidth <= 0 || metrics.foreheadWidth <= 0) {
    throw new Error('judgeFaceShape: 얼굴 너비가 0이면 비율을 계산할 수 없다')
  }

  const lengthRatio = metrics.faceLength / metrics.cheekboneWidth
  const jawToForehead = metrics.jawWidth / metrics.foreheadWidth
  const jawToCheekbone = metrics.jawWidth / metrics.cheekboneWidth

  return {
    shape: classify(lengthRatio, jawToForehead, jawToCheekbone),
    evidence: { lengthRatio, jawToForehead, jawToCheekbone },
  }
}
