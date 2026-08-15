import { chroma, hueAngle, ita } from '../color/lab'
import type { Lab, PersonalColorResult, Season, Tone12, Undertone } from '../types'

/**
 * 퍼스널 컬러 12타입 판정 규칙 v0.
 *
 * 아래 경계값은 **v0 휴리스틱이며 보정 대상**이다. 이 도메인에는 표준 진단 절차도
 * 국가 공인 자격도 없고 진단사끼리도 결과가 갈린다(context.md §1). 따라서 "정답"에
 * 맞추는 것이 목표가 아니라, 일관된 기준으로 재미있게 판정하는 것이 목표다.
 * 실제 사진 표본이 쌓이면 동료 피드백으로 경계값을 조정한다(PRD Open Questions).
 *
 * 판정 축 3개:
 *   1. 언더톤 — 색상각 h°(노란 기 ↔ 붉은 기)
 *   2. 명도 — L*
 *   3. 채도 — C*
 */

/** 색상각이 이 값 이상이면 노란 기가 우세 → 웜 */
const WARM_HUE_MIN = 60
/** 색상각이 이 값 이하면 붉은 기가 우세 → 쿨 */
const COOL_HUE_MAX = 50
/** 두 값 사이는 뉴트럴 — 웜/쿨 어느 쪽으로도 판정될 수 있는 구간 */
const NEUTRAL_HUE_MID = (WARM_HUE_MIN + COOL_HUE_MAX) / 2

/** L*가 이 값 이상이면 밝은 쪽(봄·여름), 미만이면 어두운 쪽(가을·겨울) */
const LIGHT_VALUE_MIN = 62

/** C*가 이 값 이상이면 고채도(선명), 이하면 저채도(탁함) */
const VIVID_CHROMA_MIN = 22
const SOFT_CHROMA_MAX = 15

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

function classifyChroma(value: number): ChromaLevel {
  if (value >= VIVID_CHROMA_MIN) {
    return 'vivid'
  }

  if (value <= SOFT_CHROMA_MAX) {
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

/** 계절 안에서 채도로 세부 타입을 가른다 */
function toTone12(season: Season, level: ChromaLevel): Tone12 {
  switch (season) {
    case '봄':
      if (level === 'vivid') return '봄 브라이트'
      if (level === 'soft') return '봄 라이트'
      return '봄 웜'
    case '가을':
      if (level === 'vivid') return '가을 딥'
      if (level === 'soft') return '가을 뮤트'
      return '가을 웜'
    case '여름':
      if (level === 'vivid') return '여름 쿨'
      if (level === 'soft') return '여름 뮤트'
      return '여름 라이트'
    case '겨울':
      if (level === 'vivid') return '겨울 브라이트'
      if (level === 'soft') return '겨울 딥'
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
    tone12: toTone12(season, classifyChroma(skinChroma)),
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
