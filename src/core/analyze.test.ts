import { describe, expect, test } from 'vitest'
import { analyzeFromFace } from './analyze'
import type { FaceLandmarkSet } from './adapters/faceLandmarkerAdapter'
import { srgbToLab } from './color/lab'
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
  // 어댑터가 실제로 반환하는 형태 — 볼 여러 점
  skinPoints: [
    { x: 40, y: 60 },
    { x: 80, y: 60 },
    { x: 45, y: 70 },
    { x: 75, y: 70 },
  ],
  // 눈 영역(좌·우): 단색 피부색뿐이라 채도 상한에 걸려 보정이 건너뛰어진다
  neutralRegions: [
    [{ x: 45, y: 45 }, { x: 55, y: 50 }],
    [{ x: 65, y: 45 }, { x: 75, y: 50 }],
  ],
  sampleRadius: 6,
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

/**
 * 통합 경로 — 눈 흰자가 실제로 잡히는 사진에서 색 보정과 노출 보정이 함께 도는지.
 *
 * 위 두 테스트는 단색 이미지라 기준을 못 찾아 **보정이 건너뛰어지는 경로**만 탄다.
 * 보정이 걸리는 쪽은 여기서 본다 — 두 보정을 엮는 것이 이 파일의 책임이라
 * 각 모듈의 단위 테스트로는 대체되지 않는다.
 */
function faceImage(skin: Rgb, sclera: Rgb): ImageLike {
  const width = 120
  const height = 120
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // 얼굴 픽스처의 눈 영역(45~75, 45~50)에 흰자를 심는다
      const inEye = x >= 45 && x <= 75 && y >= 45 && y <= 50
      const c = inEye ? sclera : skin
      const i = (y * width + x) * 4
      data[i] = c.r
      data[i + 1] = c.g
      data[i + 2] = c.b
      data[i + 3] = 255
    }
  }

  return { width, height, data }
}

const NORMAL_SKIN: Rgb = { r: 205, g: 160, b: 130 }
const NORMAL_SCLERA: Rgb = { r: 228, g: 226, b: 222 }
const dim = (c: Rgb, k: number): Rgb => ({
  r: Math.round(c.r * k),
  g: Math.round(c.g * k),
  b: Math.round(c.b * k),
})

describe('조명 보정 통합 — 흰자를 찾은 경우', () => {
  function judgedLightness(image: ImageLike): number {
    const result = analyzeFromFace(image, face)
    if (!result.ok) throw new Error(`분석 실패: ${result.reason}`)
    return result.personalColor.evidence.skinLab.l
  }

  test('어둡게 찍힌 사진이 기준 밝기 쪽으로 당겨진다', () => {
    const normal = judgedLightness(faceImage(NORMAL_SKIN, NORMAL_SCLERA))
    const darkRaw = srgbToLab(dim(NORMAL_SKIN, 0.65)).l
    const darkCorrected = judgedLightness(
      faceImage(dim(NORMAL_SKIN, 0.65), dim(NORMAL_SCLERA, 0.65)),
    )

    // 보정 전에는 기준보다 훨씬 어둡고, 보정 후에는 기준에 가까워진다
    expect(Math.abs(darkCorrected - normal)).toBeLessThan(Math.abs(darkRaw - normal))
  })

  test('푸른 조명이 걸린 사진의 색상각이 원래 쪽으로 돌아온다', () => {
    const cast = (c: Rgb): Rgb => ({
      r: Math.round(c.r * 0.92),
      g: c.g,
      b: Math.min(255, Math.round(c.b * 1.16)),
    })

    const normal = analyzeFromFace(faceImage(NORMAL_SKIN, NORMAL_SCLERA), face)
    const tinted = analyzeFromFace(faceImage(cast(NORMAL_SKIN), cast(NORMAL_SCLERA)), face)
    if (!normal.ok || !tinted.ok) throw new Error('분석 실패')

    const rawHue = srgbToLab(cast(NORMAL_SKIN))
    const rawShift = Math.abs(
      Math.atan2(rawHue.b, rawHue.a) - Math.atan2(
        srgbToLab(NORMAL_SKIN).b,
        srgbToLab(NORMAL_SKIN).a,
      ),
    )
    const correctedShift = Math.abs(
      (tinted.personalColor.evidence.hue - normal.personalColor.evidence.hue) *
        (Math.PI / 180),
    )

    expect(correctedShift).toBeLessThan(rawShift)
  })

  test('두 배율이 함께 극단으로 가도 분석이 값을 돌려준다 — 클램프 조합', () => {
    // 어둡고(노출 배율 큼) 색이 크게 치우친(채널 배율 큼) 사진
    const skewed: Rgb = { r: 150, g: 120, b: 96 }
    const result = analyzeFromFace(faceImage(dim(skewed, 0.5), { r: 120, g: 112, b: 96 }), face)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const { l } = result.personalColor.evidence.skinLab
      expect(Number.isFinite(l)).toBe(true)
      expect(l).toBeGreaterThanOrEqual(0)
      expect(l).toBeLessThanOrEqual(100)
    }
  })
})
