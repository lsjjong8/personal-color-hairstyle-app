/**
 * 분석 코어의 공개 타입 계약 (ADR-002).
 * UI 계층과 코어가 공유하는 유일한 접점이며, React 등 UI 의존을 갖지 않는다.
 */

/** CIELAB 색좌표. L*: 밝기, a*: 빨강↔초록, b*: 노랑↔파랑 */
export interface Lab {
  l: number
  a: number
  b: number
}

/** sRGB 8비트 색 */
export interface Rgb {
  r: number
  g: number
  b: number
}

/** 이미지 위 한 점 (픽셀 좌표) */
export interface Point {
  x: number
  y: number
}

/** ImageData의 최소 형태 — 브라우저 전역 타입에 의존하지 않기 위해 별도 선언 */
export interface ImageLike {
  width: number
  height: number
  /** RGBA 4채널 연속 배열 */
  data: Uint8ClampedArray | number[]
}

/** 피부 언더톤 — 뉴트럴은 웜/쿨 경계에 있어 어느 쪽으로도 판정될 수 있는 유형 */
export type Undertone = 'warm' | 'cool' | 'neutral'

export type Season = '봄' | '여름' | '가을' | '겨울'

/** 12타입 — context.md §1의 대중 표준 분류 */
export type Tone12 =
  | '봄 라이트'
  | '봄 브라이트'
  | '봄 웜'
  | '여름 라이트'
  | '여름 뮤트'
  | '여름 쿨'
  | '가을 뮤트'
  | '가을 딥'
  | '가을 웜'
  | '겨울 브라이트'
  | '겨울 딥'
  | '겨울 쿨'

/** 얼굴형 5분류 — context.md §3 */
export type FaceShape = '계란형' | '둥근형' | '각진형' | '긴형' | '역삼각형'

/** 퍼스널 컬러 판정 결과와 그 근거 수치 */
export interface PersonalColorResult {
  tone12: Tone12
  season: Season
  undertone: Undertone
  /** 판정 근거 — 결과 화면에서 "왜 이렇게 나왔는지" 설명에 쓴다 */
  evidence: {
    skinLab: Lab
    /** 색상각 h° = atan2(b*, a*) — 언더톤 판정 축 */
    hue: number
    /** 채도 C* = sqrt(a*² + b*²) */
    chroma: number
    /** 개인 피부톤 유형각 (context.md §2). 조명 민감·a* 미반영이라 보조 지표로만 쓴다 */
    ita: number
  }
}

/** 얼굴 비율 측정값 — landmark에서 파생된 값만 담아 코어를 MediaPipe로부터 분리한다 */
export interface FaceMetrics {
  /** 이마 위쪽부터 턱 끝까지 */
  faceLength: number
  /** 광대 최대 너비 */
  cheekboneWidth: number
  /** 턱선 너비 */
  jawWidth: number
  /** 이마 너비 */
  foreheadWidth: number
}

export interface FaceShapeResult {
  shape: FaceShape
  evidence: {
    /** 세로/가로 비율 */
    lengthRatio: number
    /** 턱 너비 ÷ 이마 너비 */
    jawToForehead: number
    /** 턱 너비 ÷ 광대 너비 */
    jawToCheekbone: number
  }
}

/**
 * 조명 보정이 어떻게 걸렸는지 — 판정값만으로는 알 수 없는 두 가지를 남긴다.
 *
 * 판정 결과가 아니라 **판정에 이르는 과정**의 사실이라 `PersonalColorResult`가
 * 아니라 분석 결과 최상위에 둔다.
 */
/**
 * 조명 보정이 걸렸는지와, 걸렸다면 무엇을 기준으로 삼았는지.
 *
 * 두 값을 union으로 묶은 이유: 따로 두면 `applied: false`인데 기준 밝기가
 * 있는 것 같은 앞뒤 안 맞는 값을 만들 수 있다.
 */
export type LightingCorrection =
  | {
      /** 보정이 적용됐다 */
      applied: true
      /**
       * 노출 정규화가 잰 기준 밝기(0~255). 색 보정을 거친 눈 흰자의 밝기이며
       * `TARGET_REFERENCE_LUMA`와 같은 척도다 — 이 값의 실사용 분포가 그
       * 목표값을 다시 긋는 근거가 된다.
       */
      referenceLuma: number
    }
  | {
      /**
       * 기준(눈 흰자)을 쓸 수 없어 원본 그대로 판정했다. 사유는 넷이다 —
       * 저채도 픽셀 부족·기준이 너무 어두움·너무 밝음·채널 클리핑.
       * 이 사진의 수치는 보정된 사진과 척도가 달라, 기준선을 다시 그을 때
       * 섞으면 안 된다.
       */
      applied: false
      referenceLuma: null
    }

export type LightingEvidence = LightingCorrection & {
  /**
   * 판정에 쓴 피부 표본 중 채널이 255에서 잘린 비율(0~1).
   *
   * 0보다 크면 그 수치는 다른 사진과 같은 척도가 아니다 — 보정이 적용됐어도
   * 마찬가지다. 잘림은 보정 배율이 1을 넘을 때 생기므로 `applied: true`인
   * 사진에서 오히려 잘 난다.
   */
  clippedRatio: number
}

export interface AnalysisSuccess {
  ok: true
  personalColor: PersonalColorResult
  faceShape: FaceShapeResult
  lighting: LightingEvidence
}

/** 실패 사유 — UI가 사용자 문구로 번역한다 */
export type AnalysisFailureReason =
  | 'no-face-detected'
  | 'too-few-skin-pixels'
  | 'model-load-failed'

export interface AnalysisFailure {
  ok: false
  reason: AnalysisFailureReason
}

export type AnalysisResult = AnalysisSuccess | AnalysisFailure
