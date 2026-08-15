import { describe, expect, test } from 'vitest'
import { chroma, hueAngle, ita, srgbToLab } from './lab'

describe('srgbToLab', () => {
  test('흰색은 L*=100, a*=b*=0에 수렴한다', () => {
    const lab = srgbToLab({ r: 255, g: 255, b: 255 })

    expect(lab.l).toBeCloseTo(100, 1)
    expect(lab.a).toBeCloseTo(0, 1)
    expect(lab.b).toBeCloseTo(0, 1)
  })

  test('검은색은 L*=0이다', () => {
    const lab = srgbToLab({ r: 0, g: 0, b: 0 })

    expect(lab.l).toBeCloseTo(0, 1)
  })

  test('중간 회색(119,119,119)은 L*가 약 50이고 무채색이다', () => {
    const lab = srgbToLab({ r: 119, g: 119, b: 119 })

    expect(lab.l).toBeCloseTo(50, 0)
    expect(lab.a).toBeCloseTo(0, 1)
    expect(lab.b).toBeCloseTo(0, 1)
  })

  test('전형적인 피부색은 a*와 b*가 모두 양수다 (붉은 기 + 노란 기)', () => {
    const lab = srgbToLab({ r: 225, g: 180, b: 150 })

    expect(lab.a).toBeGreaterThan(0)
    expect(lab.b).toBeGreaterThan(0)
    expect(lab.l).toBeGreaterThan(50)
  })

  test('순수 파랑은 b*가 크게 음수다', () => {
    const lab = srgbToLab({ r: 0, g: 0, b: 255 })

    expect(lab.b).toBeLessThan(-50)
  })
})

describe('chroma', () => {
  test('무채색의 채도는 0이다', () => {
    expect(chroma({ l: 50, a: 0, b: 0 })).toBeCloseTo(0, 5)
  })

  test('a*·b*의 유클리드 거리로 계산한다', () => {
    expect(chroma({ l: 50, a: 3, b: 4 })).toBeCloseTo(5, 5)
  })
})

describe('hueAngle', () => {
  test('b*축(노랑) 방향은 90도다', () => {
    expect(hueAngle({ l: 60, a: 0, b: 20 })).toBeCloseTo(90, 5)
  })

  test('a*축(빨강) 방향은 0도다', () => {
    expect(hueAngle({ l: 60, a: 20, b: 0 })).toBeCloseTo(0, 5)
  })

  test('노란 기가 강할수록 각도가 커진다 — 웜 방향', () => {
    const yellowish = hueAngle({ l: 65, a: 10, b: 25 })
    const reddish = hueAngle({ l: 65, a: 20, b: 12 })

    expect(yellowish).toBeGreaterThan(reddish)
  })
})

describe('ita', () => {
  test('공식 그대로 계산한다 — L*=50이면 0도', () => {
    expect(ita({ l: 50, a: 5, b: 20 })).toBeCloseTo(0, 5)
  })

  test('밝을수록 ITA가 커진다', () => {
    const light = ita({ l: 75, a: 8, b: 18 })
    const dark = ita({ l: 55, a: 8, b: 18 })

    expect(light).toBeGreaterThan(dark)
  })
})
