import { describe, expect, test } from 'vitest'
import { judgePersonalColor } from './personalColor'
import type { Lab } from '../types'

/**
 * 판정 축 3개: 언더톤(색상각) · 명도(L*) · 채도(C*).
 * 아래 입력값은 각 축의 대표 조합을 만들기 위한 합성값이다.
 */
const warmLightVivid: Lab = { l: 72, a: 11, b: 26 } // 노란 기 강함 · 밝음 · 채도 높음
const warmLightSoft: Lab = { l: 71, a: 7, b: 12 } // 노란 기 · 밝음 · 채도 낮음
const warmLightMid: Lab = { l: 70, a: 9, b: 18 } // 노란 기 · 밝음 · 채도 중간
const warmDeepVivid: Lab = { l: 52, a: 12, b: 28 } // 노란 기 · 어두움 · 채도 높음
const warmDeepSoft: Lab = { l: 51, a: 7, b: 12 } // 노란 기 · 어두움 · 채도 낮음
const coolLightVivid: Lab = { l: 72, a: 20, b: 13 } // 붉은 기 · 밝음 · 채도 높음
const coolLightSoft: Lab = { l: 71, a: 9, b: 6 } // 붉은 기 · 밝음 · 채도 낮음
const coolDeepVivid: Lab = { l: 52, a: 21, b: 14 } // 붉은 기 · 어두움 · 채도 높음
const coolDeepSoft: Lab = { l: 51, a: 9, b: 6 } // 붉은 기 · 어두움 · 채도 낮음

describe('언더톤 판정', () => {
  test('노란 기가 강하면 웜으로 본다', () => {
    expect(judgePersonalColor(warmLightVivid).undertone).toBe('warm')
  })

  test('붉은 기가 강하면 쿨로 본다', () => {
    expect(judgePersonalColor(coolLightVivid).undertone).toBe('cool')
  })

  test('경계 구간은 뉴트럴로 표기한다 — 어느 쪽으로도 판정될 수 있는 유형', () => {
    const borderline: Lab = { l: 68, a: 14, b: 17 }

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
    expect(judgePersonalColor(warmLightMid).season).toBe('봄')
  })

  test('웜 + 어두움 = 가을', () => {
    expect(judgePersonalColor(warmDeepVivid).season).toBe('가을')
  })

  test('쿨 + 밝음 = 여름', () => {
    expect(judgePersonalColor(coolLightVivid).season).toBe('여름')
  })

  test('쿨 + 어두움 = 겨울', () => {
    expect(judgePersonalColor(coolDeepVivid).season).toBe('겨울')
  })
})

describe('12타입 세부 판정 — 채도 축', () => {
  test('봄: 채도 높으면 브라이트, 낮으면 라이트, 중간이면 웜', () => {
    expect(judgePersonalColor(warmLightVivid).tone12).toBe('봄 브라이트')
    expect(judgePersonalColor(warmLightSoft).tone12).toBe('봄 라이트')
    expect(judgePersonalColor(warmLightMid).tone12).toBe('봄 웜')
  })

  test('가을: 채도 높으면 딥, 낮으면 뮤트', () => {
    expect(judgePersonalColor(warmDeepVivid).tone12).toBe('가을 딥')
    expect(judgePersonalColor(warmDeepSoft).tone12).toBe('가을 뮤트')
  })

  test('여름: 채도 높으면 쿨, 낮으면 뮤트', () => {
    expect(judgePersonalColor(coolLightVivid).tone12).toBe('여름 쿨')
    expect(judgePersonalColor(coolLightSoft).tone12).toBe('여름 뮤트')
  })

  test('겨울: 채도 높으면 브라이트, 낮으면 딥', () => {
    expect(judgePersonalColor(coolDeepVivid).tone12).toBe('겨울 브라이트')
    expect(judgePersonalColor(coolDeepSoft).tone12).toBe('겨울 딥')
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
