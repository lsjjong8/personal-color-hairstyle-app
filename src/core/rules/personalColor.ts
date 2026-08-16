import { chroma, hueAngle, ita } from '../color/lab'
import type { Lab, PersonalColorResult, Season, Tone12, Undertone } from '../types'

/**
 * 퍼스널 컬러 12타입 판정 규칙 v1.
 *
 * 경계값은 대표 피부색 표본 12종(밝음~어두움 × 웜~쿨)의 Lab 분포에서 뽑았다.
 * 이 도메인에는 표준 진단 절차도 국가 공인 자격도 없고 진단사끼리도 결과가
 * 갈린다(context.md §1). "정답"이 목표가 아니라 일관되고 재미있는 판정이 목표다.
 *
 * v0 → v1 변경 (세션 재점검 결과):
 *   1. 명도 기준 상향(62→68) — 실제 피부 L*은 대부분 62를 넘어 판정이
 *      봄·여름으로 쏠렸다. 표본 분포의 중앙 부근으로 옮겼다.
 *   2. 채도를 절대값이 아니라 명도 기대선과의 잔차로 본다 — 피부색은
 *      어두울수록 채도가 오르는 역상관이라(표본 회귀 C* ≈ 39.4 − 0.174·L*)
 *      절대 임계값으로는 어두운 피부가 전부 "선명"이 된다.
 *   3. '라이트'와 '딥'은 채도가 아니라 명도 극단으로 정의한다 — v0은 딥을
 *      가을에서는 고채도, 겨울에서는 저채도에 배정해 서로 모순이었다.
 *
 * 판정 축 3개:
 *   1. 언더톤 — 색상각 h°(노란 기 ↔ 붉은 기)
 *   2. 명도 — L* (계절 분기 + 계절 안의 라이트/딥)
 *   3. 채도 — C*의 명도 기대선 잔차 (계절 안의 브라이트/뮤트)
 */

/** 색상각이 이 값 이상이면 노란 기가 우세 → 웜 */
const WARM_HUE_MIN = 58
/** 색상각이 이 값 이하면 붉은 기가 우세 → 쿨 */
const COOL_HUE_MAX = 48
/** 두 값 사이는 뉴트럴 — 웜/쿨 어느 쪽으로도 판정될 수 있는 구간 */
const NEUTRAL_HUE_MID = (WARM_HUE_MIN + COOL_HUE_MAX) / 2

/** L*가 이 값 이상이면 밝은 쪽(봄·여름), 미만이면 어두운 쪽(가을·겨울) */
const LIGHT_VALUE_MIN = 68
/** 밝은 계절 안에서 이 값 이상이면 '라이트' */
const VERY_LIGHT_MIN = 78
/** 어두운 계절 안에서 이 값 이하면 '딥' */
const VERY_DEEP_MAX = 55

/**
 * 명도에 따른 채도 기대선 — 대표 표본 12종의 선형 회귀.
 * 기대선보다 충분히 높으면 선명(vivid), 충분히 낮으면 탁함(soft).
 */
const CHROMA_BASE = 39.4
const CHROMA_SLOPE_PER_L = 0.174
const VIVID_RESIDUAL_MIN = 3
const SOFT_RESIDUAL_MAX = -3

/** 채도 3구간 라벨 */
type ChromaLevel = 'vivid' | 'mid' | 'soft'

function classifyUndertone(hue: number): Undertone {
  if (hue >= WARM_HUE_MIN) {
    return 'warm'
  }

  if (hue <= COOL_HUE_MAX) {
    return 'cool'
  }

  return 'neutral'
}

/** 이 명도의 피부라면 통상 이 정도 채도를 가진다 — 잔차 판정의 기준선 */
function expectedChroma(lightness: number): number {
  return CHROMA_BASE - CHROMA_SLOPE_PER_L * lightness
}

function classifyChroma(value: number, lightness: number): ChromaLevel {
  const residual = value - expectedChroma(lightness)

  if (residual >= VIVID_RESIDUAL_MIN) {
    return 'vivid'
  }

  if (residual <= SOFT_RESIDUAL_MAX) {
    return 'soft'
  }

  return 'mid'
}

/**
 * 뉴트럴도 12타입 중 하나로 떨어져야 하므로, 경계 구간의 중앙을 기준으로
 * 가까운 쪽에 붙인다. 언더톤 필드에는 'neutral'을 그대로 남겨 결과 화면이
 * "경계에 가깝다"고 알릴 수 있게 한다.
 */
function resolveWarmSide(undertone: Undertone, hue: number): boolean {
  if (undertone === 'warm') {
    return true
  }

  if (undertone === 'cool') {
    return false
  }

  return hue >= NEUTRAL_HUE_MID
}

function toSeason(isWarm: boolean, isLight: boolean): Season {
  if (isWarm) {
    return isLight ? '봄' : '가을'
  }

  return isLight ? '여름' : '겨울'
}

/**
 * 계절 안의 세부 타입. 명도 극단(라이트/딥)을 먼저 보고, 그다음 채도
 * 잔차(브라이트/뮤트)를 본다 — 라이트/딥은 명도로, 브라이트/뮤트는 채도로
 * 정의되는 것이 12타입의 통상 구분이다.
 */
function toTone12(season: Season, level: ChromaLevel, lightness: number): Tone12 {
  switch (season) {
    case '봄':
      if (lightness >= VERY_LIGHT_MIN) return '봄 라이트'
      if (level === 'vivid') return '봄 브라이트'
      return '봄 웜'
    case '여름':
      if (lightness >= VERY_LIGHT_MIN) return '여름 라이트'
      if (level === 'soft') return '여름 뮤트'
      return '여름 쿨'
    case '가을':
      if (lightness <= VERY_DEEP_MAX) return '가을 딥'
      if (level === 'soft') return '가을 뮤트'
      return '가을 웜'
    case '겨울':
      if (lightness <= VERY_DEEP_MAX) return '겨울 딥'
      if (level === 'vivid') return '겨울 브라이트'
      return '겨울 쿨'
  }
}

/** 피부 평균 Lab에서 퍼스널 컬러 12타입을 판정한다 */
export function judgePersonalColor(skinLab: Lab): PersonalColorResult {
  const hue = hueAngle(skinLab)
  const skinChroma = chroma(skinLab)
  const undertone = classifyUndertone(hue)
  const isWarm = resolveWarmSide(undertone, hue)
  const isLight = skinLab.l >= LIGHT_VALUE_MIN
  const season = toSeason(isWarm, isLight)

  return {
    tone12: toTone12(season, classifyChroma(skinChroma, skinLab.l), skinLab.l),
    season,
    undertone,
    evidence: {
      skinLab,
      hue,
      chroma: skinChroma,
      ita: ita(skinLab),
    },
  }
}
