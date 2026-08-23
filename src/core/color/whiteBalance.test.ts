import { describe, expect, test } from 'vitest'
import {
  estimateNeutralReference,
  estimateWhiteBalanceGain,
  applyChannelGain,
} from './whiteBalance'
import { srgbToLab, hueAngle } from './lab'
import type { ImageLike, Rgb } from '../types'

/**
 * 조명 색 보정 — 사진 안의 무채색 기준(눈 흰자)으로 색 캐스트를 걷어낸다.
 * 이 보정이 없으면 언더톤 판정이 사람이 아니라 조명을 잰다
 * (2026-08-18 실측: 같은 사진에 조명만 바꿔 h°가 30.1~57.7로 27.6도 이동).
 */

/** 지정 색으로 채운 이미지에 밝은 사각형(흰자 대역)을 심는다 */
function imageWith(base: Rgb, patch: Rgb, patchBox: { x: number; y: number; size: number }): ImageLike {
  const width = 40
  const height = 40
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inPatch =
        x >= patchBox.x && x < patchBox.x + patchBox.size &&
        y >= patchBox.y && y < patchBox.y + patchBox.size
      const color = inPatch ? patch : base
      const i = (y * width + x) * 4
      data[i] = color.r
      data[i + 1] = color.g
      data[i + 2] = color.b
      data[i + 3] = 255
    }
  }

  return { width, height, data }
}

const PATCH = { x: 4, y: 4, size: 10 }
const REGION = [[
  { x: PATCH.x, y: PATCH.y },
  { x: PATCH.x + PATCH.size, y: PATCH.y + PATCH.size },
]]

describe('estimateNeutralReference', () => {
  test('영역 안에서 가장 밝은 픽셀 무리를 무채색 기준으로 뽑는다', () => {
    const image = imageWith({ r: 120, g: 90, b: 80 }, { r: 240, g: 238, b: 236 }, PATCH)

    const reference = estimateNeutralReference(image, REGION)

    expect(reference).not.toBeNull()
    expect(reference!.r).toBeGreaterThan(200)
    expect(reference!.g).toBeGreaterThan(200)
    expect(reference!.b).toBeGreaterThan(200)
  })

  test('밝아도 채도가 높으면 기준으로 삼지 않는다 — 눈꺼풀 피부를 흰자로 오인하지 않는다', () => {
    // 살구빛 피부색(상대 채도 약 0.4)만 있는 영역 — 밝기 조건은 통과한다
    const skinOnly = imageWith({ r: 90, g: 70, b: 60 }, { r: 225, g: 180, b: 150 }, PATCH)

    expect(estimateNeutralReference(skinOnly, REGION)).toBeNull()
  })

  test('밝은 피부 옆에 어두운 무채색이 있으면 무채색 쪽을 고른다', () => {
    // 흰자는 눈꺼풀보다 어두울 수 있다 — 채도가 먼저이고 밝기는 그다음이다
    const width = 40
    const height = 40
    const data = new Uint8ClampedArray(width * height * 4)

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inPatch = x >= PATCH.x && x < PATCH.x + PATCH.size && y >= PATCH.y && y < PATCH.y + PATCH.size
        // 패치 왼쪽 절반은 밝은 피부색, 오른쪽 절반은 조금 어두운 무채색
        const neutralHalf = inPatch && x >= PATCH.x + PATCH.size / 2
        const color = !inPatch
          ? { r: 60, g: 50, b: 45 }
          : neutralHalf
            ? { r: 150, g: 148, b: 149 }
            : { r: 235, g: 185, b: 155 }
        const i = (y * width + x) * 4
        data[i] = color.r
        data[i + 1] = color.g
        data[i + 2] = color.b
        data[i + 3] = 255
      }
    }

    const reference = estimateNeutralReference({ width, height, data }, REGION)

    expect(reference).not.toBeNull()
    // 무채색 쪽이 선택됐다면 채널 차이가 작다
    expect(Math.abs(reference!.r - reference!.b)).toBeLessThan(15)
  })

  test('영역이 이미지 밖이면 null — 호출부가 보정을 건너뛴다', () => {
    const image = imageWith({ r: 120, g: 90, b: 80 }, { r: 240, g: 238, b: 236 }, PATCH)

    expect(estimateNeutralReference(image, [[{ x: -100, y: -100 }, { x: -90, y: -90 }]])).toBeNull()
  })

  test('기준이 어두우면 null — 흰자를 못 찾은 것이라 보정하지 않는다', () => {
    const dark = imageWith({ r: 30, g: 25, b: 22 }, { r: 40, g: 35, b: 32 }, PATCH)

    expect(estimateNeutralReference(dark, REGION)).toBeNull()
  })
})

/** 기존 테스트가 쓰던 형태 — 기준색으로 곧장 보정한다 */
const applyWhiteBalance = (image: ImageLike, reference: Rgb) =>
  applyChannelGain(image, estimateWhiteBalanceGain(reference))

describe('applyWhiteBalance', () => {
  test('기준색을 무채색으로 만든다', () => {
    const image = imageWith({ r: 200, g: 160, b: 130 }, { r: 240, g: 220, b: 190 }, PATCH)
    const reference = { r: 240, g: 220, b: 190 }

    const balanced = applyWhiteBalance(image, reference)
    const i = (PATCH.y + 2) * balanced.width * 4 + (PATCH.x + 2) * 4
    const [r, g, b] = [balanced.data[i], balanced.data[i + 1], balanced.data[i + 2]]

    expect(Math.abs(r - g)).toBeLessThanOrEqual(2)
    expect(Math.abs(g - b)).toBeLessThanOrEqual(2)
  })

  test('푸른 조명과 노란 조명에서 같은 피부색으로 수렴한다 — 이 보정의 존재 이유', () => {
    const skin: Rgb = { r: 214, g: 168, b: 140 }
    // 조명 배율을 곱해도 255에서 잘리지 않는 밝기 — 클리핑은 아래 별도 테스트에서 다룬다
    const white: Rgb = { r: 200, g: 198, b: 196 }
    const cast = (c: Rgb, gr: number, gg: number, gb: number): Rgb => ({
      r: Math.min(255, Math.round(c.r * gr)),
      g: Math.min(255, Math.round(c.g * gg)),
      b: Math.min(255, Math.round(c.b * gb)),
    })

    const results = [
      [0.92, 1.0, 1.16], // 형광등 — 푸른 기
      [1.08, 1.0, 0.88], // 전구색 — 노란 기
    ].map(([gr, gg, gb]) => {
      const image = imageWith(cast(skin, gr, gg, gb), cast(white, gr, gg, gb), PATCH)
      const reference = estimateNeutralReference(image, REGION)
      expect(reference).not.toBeNull()
      const balanced = applyWhiteBalance(image, reference!)
      const i = 39 * balanced.width * 4 + 39 * 4 // 피부 영역 픽셀
      return hueAngle(
        srgbToLab({ r: balanced.data[i], g: balanced.data[i + 1], b: balanced.data[i + 2] }),
      )
    })

    // 보정 전이라면 두 조명의 색상각이 20도 이상 벌어진다
    expect(Math.abs(results[0] - results[1])).toBeLessThan(5)
  })

  test('한 채널만 잘려도 기준을 거부한다 — 밝기 상한과는 다른 가드다', () => {
    // luma 약 200으로 밝기 상한(250) 안이지만 r 채널이 클리핑 경계를 넘는다
    const clipped = imageWith({ r: 120, g: 100, b: 95 }, { r: 254, g: 190, b: 185 }, PATCH)

    expect(estimateNeutralReference(clipped, REGION)).toBeNull()
  })

  test('과노출로 전체가 날아가도 기준을 거부한다', () => {
    const blown = imageWith({ r: 214, g: 168, b: 140 }, { r: 255, g: 255, b: 252 }, PATCH)

    expect(estimateNeutralReference(blown, REGION)).toBeNull()
  })

  test('원본 이미지를 바꾸지 않는다', () => {
    const image = imageWith({ r: 200, g: 160, b: 130 }, { r: 240, g: 220, b: 190 }, PATCH)
    const before = image.data[0]

    applyWhiteBalance(image, { r: 240, g: 220, b: 190 })

    expect(image.data[0]).toBe(before)
  })
})
