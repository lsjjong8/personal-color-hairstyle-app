import { chroma, hueAngle, ita } from '../color/lab'
import type { Lab, PersonalColorResult, Season, Tone12, Undertone } from '../types'

/**
 * 퍼스널 컬러 12타입 판정 규칙 v2.
 *
 * 이 도메인에는 표준 진단 절차도 국가 공인 자격도 없고 진단사끼리도 결과가
 * 갈린다(context.md §1). "정답"이 목표가 아니라 **일관되고 한쪽으로 쏠리지 않는
 * 판정**이 목표다 — 열 명이 찍어 여덟 명이 같은 타입이면 결과를 볼 이유가 없다.
 *
 * 판정값의 근거가 세대마다 바뀌었다:
 *   - v0: 세 축을 각각 절대 임계값으로. 채도가 명도와 역상관인 것을 놓쳤고,
 *     '딥'을 가을=고채도·겨울=저채도로 모순되게 배정했다.
 *   - v1: 대표 피부색 **팔레트 원색** 12종의 분포로 경계를 그었다(ADR-004).
 *   - v2: **실기기 사진 관측값**으로 다시 그었다. 팔레트 원색은 화면용 대표색이라
 *     실사진보다 채도가 두 배 가까이 높았고, 그 탓에 실사진은 무엇을 넣어도
 *     "탁함"으로 판정돼 **12타입 중 4종이 영영 나오지 않았다.**
 *
 * 판정 축 3개:
 *   1. 언더톤 — 색상각 h°(노란 기 ↔ 붉은 기)
 *   2. 명도 — L* (계절 분기 + 계절 안의 라이트/딥)
 *   3. 채도 — C*의 명도 기대선 잔차 (계절 안의 브라이트/뮤트)
 */

/**
 * 색상각이 이 값 이상이면 노란 기가 우세 → 웜.
 *
 * 조명 색 보정(ADR-006)이 h°를 위로 올린다 — 보정 전후를 잰 실측에서
 * 56.3→62.7, 41.6→71.3처럼 움직였다. 보정 전 기준(58·48)을 그대로 두면
 * 보정 후 분포의 아래쪽 끝에 걸려 **거의 전부 웜**으로 판정된다.
 * 실기기 4장의 h°가 56.9~88.9였고, 그 중앙 부근에 경계를 놓았다.
 */
const WARM_HUE_MIN = 68
/** 색상각이 이 값 이하면 붉은 기가 우세 → 쿨 */
const COOL_HUE_MAX = 58
/** 두 값 사이는 뉴트럴 — 웜/쿨 어느 쪽으로도 판정될 수 있는 구간 */
const NEUTRAL_HUE_MID = (WARM_HUE_MIN + COOL_HUE_MAX) / 2

/** L*가 이 값 이상이면 밝은 쪽(봄·여름), 미만이면 어두운 쪽(가을·겨울) */
const LIGHT_VALUE_MIN = 68
/** 밝은 계절 안에서 이 값 이상이면 '라이트' */
const VERY_LIGHT_MIN = 78
/** 어두운 계절 안에서 이 값 이하면 '딥' */
const VERY_DEEP_MAX = 55

/**
 * 명도에 따른 채도 기대선. 기대선보다 충분히 높으면 선명(vivid),
 * 충분히 낮으면 탁함(soft).
 *
 * **절편은 실사진 관측값으로 다시 그었다** (2026-08-22). 이전 값 39.4는
 * 팔레트 원색 12종에서 나온 것인데, 그 색들은 화면용 대표색이라 채도가
 * 실사진보다 두 배 가까이 높다. 실기기 4장의 잔차가 -12.5~-19.1로 **전부
 * 크게 음수**였고 — 우연이 아니라 계통 차이다 — 그 탓에 선명 판정이 아예
 * 불가능해져 **12타입 중 4종이 영영 나오지 않았다**(봄 브라이트·여름 쿨·
 * 가을 웜·겨울 브라이트). 평균 잔차 -15.4를 절편에 반영했다.
 *
 * **기울기는 그대로 둔다.** 실측 4점으로 직접 회귀하면 기울기가 +0.234로
 * 부호가 뒤집히는데, L* 범위가 9.2뿐이고 한 점이 지렛대라 추정이 성립하지
 * 않는다. 기존 값은 L* 27.9~88.0의 넓은 범위에서 나온 것이라 방향이 더 믿을 만하다.
 *
 * 표본이 4장뿐이라 **잠정값이다.** 동료 배포로 표본이 쌓이면 다시 긋는다.
 */
const CHROMA_BASE = 24.0
const CHROMA_SLOPE_PER_L = 0.174
/**
 * 선명/탁함 경계. 새 기준선에서 실측 4장의 잔차는 2.95·-3.71·-1.29·2.05이고
 * 표본 표준편차는 3.07(모집단 공식으로는 2.66)이다. ±3이면 대부분 중간에 몰린다.
 *
 * ⚠ **표본 4번의 잔차 2.05가 이 경계에서 0.05밖에 안 떨어져 있다.** 같은 사람을
 * 다시 찍기만 해도 넘나들 거리다. 경계를 이 4장에 맞춰 그은 결과이며,
 * 표본이 늘면 가장 먼저 흔들릴 값이다.
 */
const VIVID_RESIDUAL_MIN = 2
const SOFT_RESIDUAL_MAX = -2

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
