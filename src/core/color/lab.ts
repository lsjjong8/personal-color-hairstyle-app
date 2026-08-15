import type { Lab, Rgb } from '../types'

/**
 * 색 계산 — sRGB → CIELAB 변환과 파생 지표.
 * 순수 함수만 두며 외부 의존이 없다 (ADR-002).
 * 근거: context.md §2 (CIELAB·ITA 지식과 그 한계)
 */

/** D65 표준광 기준 백색점 */
const WHITE_POINT_X = 95.047
const WHITE_POINT_Y = 100.0
const WHITE_POINT_Z = 108.883

/** sRGB 감마 해제 임계값과 계수 (IEC 61966-2-1) */
const GAMMA_THRESHOLD = 0.04045
const GAMMA_OFFSET = 0.055
const GAMMA_SCALE = 1.055
const GAMMA_EXPONENT = 2.4
const LINEAR_DIVISOR = 12.92

/** CIELAB f(t) 구간 상수 */
const LAB_EPSILON = 216 / 24389
const LAB_KAPPA = 24389 / 27

const DEG_PER_RAD = 180 / Math.PI

/** sRGB 채널값(0~255)을 선형 RGB(0~1)로 되돌린다 */
function toLinear(channel: number): number {
  const normalized = channel / 255

  if (normalized <= GAMMA_THRESHOLD) {
    return normalized / LINEAR_DIVISOR
  }

  return Math.pow((normalized + GAMMA_OFFSET) / GAMMA_SCALE, GAMMA_EXPONENT)
}

/** CIELAB 비선형 압축 함수 */
function labF(t: number): number {
  if (t > LAB_EPSILON) {
    return Math.cbrt(t)
  }

  return (LAB_KAPPA * t + 16) / 116
}

/**
 * sRGB → CIELAB (D65 기준).
 * RGB 값은 기기·조명에 따라 달라지므로 색 비교는 Lab에서 한다 (context.md §2).
 */
export function srgbToLab(rgb: Rgb): Lab {
  const r = toLinear(rgb.r)
  const g = toLinear(rgb.g)
  const b = toLinear(rgb.b)

  // 선형 RGB → XYZ (sRGB 원색 기준, 0~100 스케일)
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100

  const fx = labF(x / WHITE_POINT_X)
  const fy = labF(y / WHITE_POINT_Y)
  const fz = labF(z / WHITE_POINT_Z)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

/** 채도 C* = sqrt(a*² + b*²) — 색의 선명한 정도 */
export function chroma(lab: Lab): number {
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b)
}

/**
 * 색상각 h° = atan2(b*, a*).
 * 피부색은 대체로 40~70도 구간에 놓이며, 각이 클수록 노란 기(웜),
 * 작을수록 붉은 기(쿨) 쪽으로 기운다 — 언더톤 판정의 1차 축.
 */
export function hueAngle(lab: Lab): number {
  const degrees = Math.atan2(lab.b, lab.a) * DEG_PER_RAD

  return degrees < 0 ? degrees + 360 : degrees
}

/**
 * ITA (Individual Typology Angle) = arctan((L* − 50) / b*) × 180/π.
 * 피부톤을 1차원으로 표준화하는 지표지만 조명에 민감하고 붉은 기(a*)를
 * 반영하지 못한다 (context.md §2). 판정 주축이 아니라 참고값으로만 쓴다.
 */
export function ita(lab: Lab): number {
  if (lab.b === 0) {
    return lab.l >= 50 ? 90 : -90
  }

  return Math.atan((lab.l - 50) / lab.b) * DEG_PER_RAD
}

/** Lab 값들의 산술 평균 */
export function averageLab(values: readonly Lab[]): Lab {
  if (values.length === 0) {
    throw new Error('averageLab: 빈 배열은 평균을 낼 수 없다')
  }

  const sum = values.reduce(
    (acc, lab) => ({ l: acc.l + lab.l, a: acc.a + lab.a, b: acc.b + lab.b }),
    { l: 0, a: 0, b: 0 },
  )

  return {
    l: sum.l / values.length,
    a: sum.a / values.length,
    b: sum.b / values.length,
  }
}
