import { describe, expect, test } from 'vitest'
import { judgePersonalColor } from './personalColor'
import { srgbToLab } from '../color/lab'
import type { Lab, Season } from '../types'

/**
 * 두 층으로 검증한다:
 *   1. 축 의미 테스트 — 합성 Lab으로 언더톤·명도·채도 축이 정의대로 동작하는지
 *   2. 분포 테스트 — 대표 피부색 sRGB 표본을 실제 변환 경로(srgbToLab)로 넣어
 *      판정이 특정 계절로 쏠리지 않고 도메인 상식과 맞는지
 * v0 테스트는 임계값을 역산한 입력만 써서 자기충족적이었다 — 2층이 그 보완이다.
 */

// 합성 Lab — 각 축의 대표 조합 (h°와 C*는 a·b에서 파생: h=atan2(b,a), C=√(a²+b²))
const warmLight: Lab = { l: 72, a: 11, b: 24 } // h≈65 웜 · 밝음 · 잔차 중간
const warmVeryLight: Lab = { l: 82, a: 8, b: 18 } // 웜 · 매우 밝음
const warmLightVivid: Lab = { l: 72, a: 13, b: 29 } // 웜 · 밝음 · 기대선보다 선명
const warmDeep: Lab = { l: 45, a: 15, b: 28 } // 웜 · 매우 어두움
const warmDarkSoft: Lab = { l: 60, a: 10, b: 20 } // 웜 · 어두움 · 기대선보다 탁함
const warmDarkMid: Lab = { l: 60, a: 13, b: 25 } // 웜 · 어두움 · 잔차 중간
const coolLight: Lab = { l: 70, a: 22, b: 14 } // h≈32 쿨 · 밝음 · 잔차 중간
const coolVeryLight: Lab = { l: 82, a: 14, b: 8 } // 쿨 · 매우 밝음
const coolLightSoft: Lab = { l: 70, a: 15, b: 10 } // 쿨 · 밝음 · 기대선보다 탁함
const coolDeep: Lab = { l: 45, a: 20, b: 12 } // 쿨 · 매우 어두움
const coolDarkVivid: Lab = { l: 60, a: 28, b: 18 } // 쿨 · 어두움 · 기대선보다 선명
const coolDarkMid: Lab = { l: 60, a: 23, b: 14 } // 쿨 · 어두움 · 잔차 중간

describe('언더톤 판정', () => {
  test('노란 기가 강하면 웜으로 본다', () => {
    expect(judgePersonalColor(warmLight).undertone).toBe('warm')
  })

  test('붉은 기가 강하면 쿨로 본다', () => {
    expect(judgePersonalColor(coolLight).undertone).toBe('cool')
  })

  test('경계 구간은 뉴트럴로 표기한다 — 어느 쪽으로도 판정될 수 있는 유형', () => {
    const borderline: Lab = { l: 68, a: 14, b: 17 } // h≈50.5, 뉴트럴 구간(48~58)

    expect(judgePersonalColor(borderline).undertone).toBe('neutral')
  })

  test('뉴트럴이어도 12타입은 반드시 하나로 정해진다', () => {
    const borderline: Lab = { l: 68, a: 14, b: 17 }
    const result = judgePersonalColor(borderline)

    expect(result.tone12).toBeTruthy()
    expect(result.season).toBeTruthy()
  })
})

describe('계절 판정 — 언더톤 × 명도', () => {
  test('웜 + 밝음 = 봄', () => {
    expect(judgePersonalColor(warmLight).season).toBe('봄')
  })

  test('웜 + 어두움 = 가을', () => {
    expect(judgePersonalColor(warmDeep).season).toBe('가을')
  })

  test('쿨 + 밝음 = 여름', () => {
    expect(judgePersonalColor(coolLight).season).toBe('여름')
  })

  test('쿨 + 어두움 = 겨울', () => {
    expect(judgePersonalColor(coolDeep).season).toBe('겨울')
  })
})

describe('12타입 세부 판정 — 명도 극단 우선, 그다음 채도 잔차', () => {
  test('봄: 매우 밝으면 라이트, 기대선보다 선명하면 브라이트, 나머지는 웜', () => {
    expect(judgePersonalColor(warmVeryLight).tone12).toBe('봄 라이트')
    expect(judgePersonalColor(warmLightVivid).tone12).toBe('봄 브라이트')
    expect(judgePersonalColor(warmLight).tone12).toBe('봄 웜')
  })

  test('여름: 매우 밝으면 라이트, 기대선보다 탁하면 뮤트, 나머지는 쿨', () => {
    expect(judgePersonalColor(coolVeryLight).tone12).toBe('여름 라이트')
    expect(judgePersonalColor(coolLightSoft).tone12).toBe('여름 뮤트')
    expect(judgePersonalColor(coolLight).tone12).toBe('여름 쿨')
  })

  test('가을: 매우 어두우면 딥, 기대선보다 탁하면 뮤트, 나머지는 웜', () => {
    expect(judgePersonalColor(warmDeep).tone12).toBe('가을 딥')
    expect(judgePersonalColor(warmDarkSoft).tone12).toBe('가을 뮤트')
    expect(judgePersonalColor(warmDarkMid).tone12).toBe('가을 웜')
  })

  test('겨울: 매우 어두우면 딥, 기대선보다 선명하면 브라이트, 나머지는 쿨', () => {
    expect(judgePersonalColor(coolDeep).tone12).toBe('겨울 딥')
    expect(judgePersonalColor(coolDarkVivid).tone12).toBe('겨울 브라이트')
    expect(judgePersonalColor(coolDarkMid).tone12).toBe('겨울 쿨')
  })

  test("'딥'은 두 계절 모두 어두운 쪽이다 — v0의 가을·겨울 상반 배정 회귀 방지", () => {
    expect(judgePersonalColor(warmDeep).tone12).toBe('가을 딥')
    expect(judgePersonalColor(coolDeep).tone12).toBe('겨울 딥')
  })
})

describe('대표 피부색 분포 — 실제 변환 경로(sRGB → Lab)', () => {
  // 밝음~어두움 × 웜~쿨을 덮는 대표 표본. 임계값 역산이 아니라
  // 일반적인 피부색 팔레트에서 고른 sRGB 값이다.
  const samples = [
    { name: '매우 밝은 쿨(핑크 페어)', rgb: { r: 245, g: 213, b: 200 } },
    { name: '매우 밝은 웜(옐로 페어)', rgb: { r: 246, g: 216, b: 184 } },
    { name: '밝은 뉴트럴 베이지', rgb: { r: 239, g: 198, b: 169 } },
    { name: '밝은 웜 베이지', rgb: { r: 232, g: 190, b: 150 } },
    { name: '중간 쿨(로지 베이지)', rgb: { r: 217, g: 162, b: 143 } },
    { name: '중간 웜(골든 베이지)', rgb: { r: 210, g: 162, b: 114 } },
    { name: '중간 탠', rgb: { r: 198, g: 139, b: 89 } },
    { name: '어두운 웜(브론즈)', rgb: { r: 169, g: 124, b: 80 } },
    { name: '어두운 쿨(마호가니)', rgb: { r: 122, g: 74, b: 58 } },
    { name: '딥 브라운', rgb: { r: 141, g: 85, b: 36 } },
    { name: '매우 딥 브라운', rgb: { r: 92, g: 58, b: 33 } },
  ]

  const results = samples.map((s) => ({
    name: s.name,
    judged: judgePersonalColor(srgbToLab(s.rgb)),
  }))

  test('계절 4개가 모두 나온다 — 특정 계절 쏠림 방지', () => {
    const seasons = new Set(results.map((r) => r.judged.season))

    expect(seasons.size).toBe(4)
  })

  test('한 계절이 표본 과반을 가져가지 않는다', () => {
    const counts = new Map<Season, number>()

    for (const r of results) {
      counts.set(r.judged.season, (counts.get(r.judged.season) ?? 0) + 1)
    }

    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(Math.floor(samples.length / 2))
    }
  })

  test('어두운 표본은 딥 타입으로 떨어진다', () => {
    const byName = new Map(results.map((r) => [r.name, r.judged]))

    expect(byName.get('딥 브라운')?.tone12).toBe('가을 딥')
    expect(byName.get('매우 딥 브라운')?.tone12).toBe('가을 딥')
    expect(byName.get('어두운 쿨(마호가니)')?.tone12).toBe('겨울 딥')
  })

  test('매우 밝은 표본은 라이트 타입으로 떨어진다', () => {
    const byName = new Map(results.map((r) => [r.name, r.judged]))

    expect(byName.get('매우 밝은 웜(옐로 페어)')?.tone12).toBe('봄 라이트')
  })

  test('실사진 관측값(볼 평균)은 뉴트럴 경계의 봄으로 본다', () => {
    // 2026-08-15 실사진 스모크에서 관측: L* 74.2, h° 55.6, C* 29.1
    const observed: Lab = { l: 74.2, a: 16.4, b: 24.0 }
    const result = judgePersonalColor(observed)

    expect(result.season).toBe('봄')
    expect(result.undertone).toBe('neutral')
  })
})

describe('판정 근거', () => {
  test('결과에 색상각·채도·ITA와 입력 Lab을 함께 담는다', () => {
    const result = judgePersonalColor(warmLightVivid)

    expect(result.evidence.skinLab).toEqual(warmLightVivid)
    expect(result.evidence.hue).toBeGreaterThan(0)
    expect(result.evidence.chroma).toBeGreaterThan(0)
    expect(typeof result.evidence.ita).toBe('number')
  })
})
