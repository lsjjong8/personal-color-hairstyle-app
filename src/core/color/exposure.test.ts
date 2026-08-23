import { describe, expect, test } from 'vitest'
import { estimateExposureGain, combineGain, TARGET_REFERENCE_LUMA } from './exposure'
import { applyChannelGain } from './whiteBalance'
import { srgbToLab } from './lab'
import type { ImageLike, Rgb } from '../types'

/**
 * 노출 정규화 — 흰자 밝기를 기준자로 삼아 사진의 밝기를 맞춘다.
 *
 * 조명 색 보정(whiteBalance)이 색을 잡는 동안 **밝기는 그대로 노출에 끌려다녔다.**
 * 2026-08-22 실측: 같은 사람도 노출이 ±35% 흔들리면 L*이 45나 벌어졌고,
 * 이는 사람 사이의 차이(28)보다 컸다 — 판정이 사람이 아니라 조명을 재고 있었다.
 */

function solid(color: Rgb, patch: Rgb, box: { x: number; y: number; size: number }): ImageLike {
  const width = 40
  const height = 40
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inPatch =
        x >= box.x && x < box.x + box.size && y >= box.y && y < box.y + box.size
      const c = inPatch ? patch : color
      const i = (y * width + x) * 4
      data[i] = c.r
      data[i + 1] = c.g
      data[i + 2] = c.b
      data[i + 3] = 255
    }
  }

  return { width, height, data }
}

const gain = (c: Rgb, g: number): Rgb => ({
  r: Math.min(255, Math.round(c.r * g)),
  g: Math.min(255, Math.round(c.g * g)),
  b: Math.min(255, Math.round(c.b * g)),
})

const SKIN: Rgb = { r: 205, g: 160, b: 130 }
const SCLERA: Rgb = { r: 228, g: 226, b: 222 }

describe('estimateExposureGain', () => {
  test('기준이 목표보다 어두우면 밝히는 배율(1보다 큼)을 낸다', () => {
    const dark = gain(SCLERA, 0.65)

    expect(estimateExposureGain(dark)).toBeGreaterThan(1)
  })

  test('기준이 목표보다 밝으면 낮추는 배율(1보다 작음)을 낸다', () => {
    const bright = gain(SCLERA, 1.2)

    expect(estimateExposureGain(bright)).toBeLessThan(1)
  })

  test('기준이 이미 목표 밝기면 배율이 1에 가깝다', () => {
    const value = Math.round(TARGET_REFERENCE_LUMA)

    expect(estimateExposureGain({ r: value, g: value, b: value })).toBeCloseTo(1, 1)
  })

  test('배율이 극단으로 튀지 않는다 — 캄캄한 기준으로 사진을 태우지 않는다', () => {
    expect(estimateExposureGain({ r: 5, g: 5, b: 5 })).toBeLessThanOrEqual(3)
    expect(estimateExposureGain({ r: 250, g: 250, b: 250 })).toBeGreaterThanOrEqual(0.4)
  })
})

/** 노출 배율만 적용한다 — 색 보정 없이 밝기만 볼 때 쓴다 */
const exposureOnly = (image: ImageLike, gain: number) =>
  applyChannelGain(image, combineGain({ r: 1, g: 1, b: 1 }, gain))

describe('combineGain', () => {
  test('채널 배율에 노출 배율을 곱한다', () => {
    expect(combineGain({ r: 1.2, g: 1, b: 0.8 }, 2)).toEqual({ r: 2.4, g: 2, b: 1.6 })
  })

  test('노출 1이면 채널 배율이 그대로다', () => {
    const channel = { r: 1.2, g: 1, b: 0.8 }

    expect(combineGain(channel, 1)).toEqual(channel)
  })
})

describe('노출 배율 적용', () => {
  test('원본 이미지를 바꾸지 않는다', () => {
    const image = solid(SKIN, SCLERA, { x: 4, y: 4, size: 10 })
    const before = image.data[0]

    exposureOnly(image, 1.5)

    expect(image.data[0]).toBe(before)
  })

  test('배율 1이면 픽셀이 그대로다', () => {
    const image = solid(SKIN, SCLERA, { x: 4, y: 4, size: 10 })
    const same = exposureOnly(image, 1)

    expect(same.data[0]).toBe(image.data[0])
    expect(same.data[1]).toBe(image.data[1])
  })

  test('밝기가 다른 두 사진이 같은 피부 밝기로 수렴한다 — 이 보정의 존재 이유', () => {
    const lightnesses = [0.65, 1.0].map((exposure) => {
      const image = solid(gain(SKIN, exposure), gain(SCLERA, exposure), {
        x: 4,
        y: 4,
        size: 10,
      })
      const normalized = exposureOnly(image, estimateExposureGain(gain(SCLERA, exposure)))
      const i = 39 * normalized.width * 4 + 39 * 4 // 피부 영역 픽셀

      return srgbToLab({
        r: normalized.data[i],
        g: normalized.data[i + 1],
        b: normalized.data[i + 2],
      }).l
    })

    // 보정 전이라면 두 노출의 L*이 20 이상 벌어진다
    expect(Math.abs(lightnesses[0] - lightnesses[1])).toBeLessThan(3)
  })

  test('서로 다른 피부는 보정 뒤에도 구분된다 — 사람 차이까지 지우면 안 된다', () => {
    const people: Rgb[] = [
      { r: 225, g: 185, b: 160 },
      { r: 150, g: 110, b: 85 },
    ]

    const lightnesses = people.map((skin) => {
      const image = solid(skin, SCLERA, { x: 4, y: 4, size: 10 })
      const normalized = exposureOnly(image, estimateExposureGain(SCLERA))
      const i = 39 * normalized.width * 4 + 39 * 4

      return srgbToLab({
        r: normalized.data[i],
        g: normalized.data[i + 1],
        b: normalized.data[i + 2],
      }).l
    })

    expect(Math.abs(lightnesses[0] - lightnesses[1])).toBeGreaterThan(10)
  })
})
