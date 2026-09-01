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

/**
 * 조명 보정 근거 — 판정값만으로는 알 수 없는 두 가지를 결과에 남긴다.
 *
 * 필요한 이유는 재보정이다. 목표 밝기(TARGET_REFERENCE_LUMA)는 표본 4장에서 나온
 * 잠정값이라 실사용 분포로 다시 그어야 하는데, 기준 밝기가 결과에 없으면
 * 동료가 그 값을 읽어 보낼 방법이 없다.
 *
 * 보정 적용 여부가 함께 필요한 이유는 **표본 오염**이다. 기준을 못 찾은 사진은
 * 원본 그대로 판정되므로 다른 척도에서 나온 값인데, 겉보기로는 구분되지 않는다.
 * 표시가 없으면 그 사진이 재보정 표본에 섞여도 걸러낼 수 없다.
 */
describe('조명 보정 근거', () => {
  test('흰자를 찾으면 적용 표시와 기준 밝기를 남긴다', () => {
    const result = analyzeFromFace(faceImage(NORMAL_SKIN, NORMAL_SCLERA), face)

    if (!result.ok) throw new Error(`분석 실패: ${result.reason}`)

    expect(result.lighting.applied).toBe(true)
    // 색 보정이 기준을 채널 평균으로 정규화하므로, 기준 밝기는 흰자 채널 평균에 가깝다
    const scleraMean = (NORMAL_SCLERA.r + NORMAL_SCLERA.g + NORMAL_SCLERA.b) / 3
    expect(result.lighting.referenceLuma).toBeCloseTo(scleraMean, 0)
  })

  test('기준 밝기는 색 보정을 거친 값이다 — 보정 전 값과 구분된다', () => {
    // 무채색 흰자로는 두 척도가 0.8밖에 안 벌어져 잘못된 구현도 통과한다.
    // 색이 치우친 흰자(전구색)를 쓰면 차이가 커져 척도가 확실히 갈린다.
    const tinted: Rgb = { r: 240, g: 220, b: 190 }
    const result = analyzeFromFace(faceImage(NORMAL_SKIN, tinted), face)

    if (!result.ok) throw new Error(`분석 실패: ${result.reason}`)

    const afterColorCorrection = (tinted.r + tinted.g + tinted.b) / 3
    const beforeColorCorrection = tinted.r * 0.299 + tinted.g * 0.587 + tinted.b * 0.114

    expect(result.lighting.referenceLuma).toBeCloseTo(afterColorCorrection, 0)
    // 두 값이 실제로 갈라져 있어야 이 테스트가 척도를 지킨다
    expect(Math.abs(afterColorCorrection - beforeColorCorrection)).toBeGreaterThan(3)
  })

  test('흰자를 못 찾으면 건너뛴 사실을 남긴다 — 밝기는 없다', () => {
    // 단색 이미지는 눈 영역도 피부색이라 채도 상한에 걸려 기준을 못 잡는다
    const result = analyzeFromFace(solidImage(120, 120, { r: 225, g: 180, b: 150 }), face)

    if (!result.ok) throw new Error(`분석 실패: ${result.reason}`)

    expect(result.lighting.applied).toBe(false)
    expect(result.lighting.referenceLuma).toBeNull()
  })

  test('보정으로 피부가 255에서 잘리면 그 비율을 남긴다', () => {
    // 흰자가 어둡게 찍힌 사진(실내·그늘). 기준 밝기가 137쯤이라 배율이 1.7 가까이
    // 되고, 피부 R채널(215)이 255를 넘어 잘린다. 잘린 픽셀은 원래 값을 잃었으므로
    // 그 판정값은 다른 사진과 같은 척도가 아니다 — 표시가 없으면 걸러낼 수 없다.
    const result = analyzeFromFace(
      faceImage({ r: 215, g: 150, b: 120 }, { r: 140, g: 138, b: 134 }),
      face,
    )

    if (!result.ok) throw new Error(`분석 실패: ${result.reason}`)

    expect(result.lighting.applied).toBe(true)
    expect(result.lighting.clippedRatio).toBeGreaterThan(0)
  })

  test('잘리지 않은 사진은 잘림 비율이 0이다', () => {
    const result = analyzeFromFace(faceImage(NORMAL_SKIN, NORMAL_SCLERA), face)

    if (!result.ok) throw new Error(`분석 실패: ${result.reason}`)

    expect(result.lighting.clippedRatio).toBe(0)
  })

  test('기준 밝기가 사진의 노출을 따라 움직인다 — 재보정에 쓸 수 있는 값인지', () => {
    const bright = analyzeFromFace(faceImage(NORMAL_SKIN, NORMAL_SCLERA), face)
    const dark = analyzeFromFace(
      faceImage(dim(NORMAL_SKIN, 0.6), dim(NORMAL_SCLERA, 0.6)),
      face,
    )

    if (!bright.ok || !dark.ok) throw new Error('분석 실패')
    if (bright.lighting.referenceLuma === null || dark.lighting.referenceLuma === null) {
      throw new Error('기준 밝기가 없다')
    }

    // 값이 상수라면 재보정 근거가 되지 못한다 — 노출을 반영해야 한다
    expect(dark.lighting.referenceLuma).toBeLessThan(bright.lighting.referenceLuma)
  })
})
