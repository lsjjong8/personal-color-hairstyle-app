import { describe, expect, test } from 'vitest'
import { analyzeFromFace } from './analyze'
import type { FaceLandmarkSet } from './adapters/faceLandmarkerAdapter'
import type { ImageLike, Rgb } from './types'

function solidImage(width: number, height: number, color: Rgb): ImageLike {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = color.r
    data[i * 4 + 1] = color.g
    data[i * 4 + 2] = color.b
    data[i * 4 + 3] = 255
  }

  return { width, height, data }
}

const face: FaceLandmarkSet = {
  // 어댑터가 실제로 반환하는 형태와 같은 양 볼 2점
  skinPoints: [
    { x: 40, y: 60 },
    { x: 80, y: 60 },
  ],
  metrics: {
    faceLength: 142,
    cheekboneWidth: 100,
    jawWidth: 80,
    foreheadWidth: 94,
  },
}

describe('analyzeFromFace', () => {
  test('피부색과 얼굴 비율에서 두 판정을 함께 낸다', () => {
    const image = solidImage(120, 120, { r: 225, g: 180, b: 150 })

    const result = analyzeFromFace(image, face)

    expect(result.ok).toBe(true)

    if (result.ok) {
      expect(result.personalColor.tone12).toBeTruthy()
      expect(result.faceShape.shape).toBe('계란형')
      expect(result.personalColor.evidence.skinLab.l).toBeGreaterThan(0)
    }
  })

  test('표본 픽셀이 부족하면 실패 사유를 돌려준다 — 예외를 던지지 않는다', () => {
    const image = solidImage(120, 120, { r: 225, g: 180, b: 150 })
    const offscreen: FaceLandmarkSet = {
      ...face,
      skinPoints: [{ x: -500, y: -500 }],
    }

    const result = analyzeFromFace(image, offscreen)

    expect(result).toEqual({ ok: false, reason: 'too-few-skin-pixels' })
  })
})
