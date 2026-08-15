import { describe, expect, test } from 'vitest'
import { judgeFaceShape } from './faceShape'
import type { FaceMetrics } from '../types'

/** 합성 측정값 — 단위는 픽셀이며 비율만 의미를 갖는다 */
const longFace: FaceMetrics = {
  faceLength: 160,
  cheekboneWidth: 100,
  jawWidth: 80,
  foreheadWidth: 92,
}

const roundFace: FaceMetrics = {
  faceLength: 115,
  cheekboneWidth: 100,
  jawWidth: 76,
  foreheadWidth: 90,
}

const squareFace: FaceMetrics = {
  faceLength: 120,
  cheekboneWidth: 100,
  jawWidth: 94,
  foreheadWidth: 96,
}

const invertedTriangleFace: FaceMetrics = {
  faceLength: 125,
  cheekboneWidth: 100,
  jawWidth: 65,
  foreheadWidth: 95,
}

const ovalFace: FaceMetrics = {
  faceLength: 142,
  cheekboneWidth: 100,
  jawWidth: 80,
  foreheadWidth: 94,
}

describe('judgeFaceShape', () => {
  test('세로가 가로보다 뚜렷하게 길면 긴형', () => {
    expect(judgeFaceShape(longFace).shape).toBe('긴형')
  })

  test('턱이 이마보다 크게 좁으면 역삼각형', () => {
    expect(judgeFaceShape(invertedTriangleFace).shape).toBe('역삼각형')
  })

  test('턱 너비가 광대에 육박하면서 얼굴이 짧으면 각진형', () => {
    expect(judgeFaceShape(squareFace).shape).toBe('각진형')
  })

  test('얼굴이 짧고 턱선이 좁아지면 둥근형', () => {
    expect(judgeFaceShape(roundFace).shape).toBe('둥근형')
  })

  test('어느 쪽으로도 치우치지 않으면 계란형', () => {
    expect(judgeFaceShape(ovalFace).shape).toBe('계란형')
  })
})

describe('판정 근거', () => {
  test('세로/가로 비율과 턱 대비 비율을 함께 담는다', () => {
    const result = judgeFaceShape(ovalFace)

    expect(result.evidence.lengthRatio).toBeCloseTo(1.42, 2)
    expect(result.evidence.jawToForehead).toBeCloseTo(80 / 94, 3)
    expect(result.evidence.jawToCheekbone).toBeCloseTo(0.8, 3)
  })
})

describe('경계 입력', () => {
  test('가로 폭이 0이면 계산이 불가능하므로 예외를 던진다', () => {
    const degenerate: FaceMetrics = {
      faceLength: 100,
      cheekboneWidth: 0,
      jawWidth: 0,
      foreheadWidth: 0,
    }

    expect(() => judgeFaceShape(degenerate)).toThrow()
  })
})
