import { describe, expect, test } from 'vitest'
import { sampleSkinLab } from './skinSampling'
import { srgbToLab } from '../color/lab'
import type { ImageLike, Rgb } from '../types'

/** 단색 합성 이미지 */
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

/** 특정 픽셀만 다른 색으로 덮어쓴다 */
function paint(image: ImageLike, x: number, y: number, color: Rgb): void {
  const index = (y * image.width + x) * 4
  image.data[index] = color.r
  image.data[index + 1] = color.g
  image.data[index + 2] = color.b
}

const skinColor: Rgb = { r: 225, g: 180, b: 150 }
const centerPoints = [{ x: 20, y: 20 }]

describe('sampleSkinLab', () => {
  test('단색 영역은 그 색의 Lab을 그대로 돌려준다', () => {
    const image = solidImage(40, 40, skinColor)
    const expected = srgbToLab(skinColor)

    const result = sampleSkinLab(image, centerPoints, 4)

    expect(result).not.toBeNull()
    expect(result?.l).toBeCloseTo(expected.l, 5)
    expect(result?.a).toBeCloseTo(expected.a, 5)
    expect(result?.b).toBeCloseTo(expected.b, 5)
  })

  test('하이라이트·그림자가 섞여도 절사 평균이라 피부색 근처를 유지한다', () => {
    const image = solidImage(40, 40, skinColor)
    // 반사광(흰색)과 그림자(검은색)를 영역 안에 심는다
    paint(image, 18, 18, { r: 255, g: 255, b: 255 })
    paint(image, 19, 18, { r: 255, g: 255, b: 255 })
    paint(image, 21, 22, { r: 10, g: 10, b: 10 })
    paint(image, 22, 22, { r: 10, g: 10, b: 10 })
    const expected = srgbToLab(skinColor)

    const result = sampleSkinLab(image, centerPoints, 4)

    expect(result).not.toBeNull()
    expect(result?.l).toBeCloseTo(expected.l, 1)
  })

  test('여러 영역의 픽셀을 함께 모은다', () => {
    const image = solidImage(60, 60, skinColor)
    const expected = srgbToLab(skinColor)

    const result = sampleSkinLab(
      image,
      [
        { x: 15, y: 30 },
        { x: 45, y: 30 },
        { x: 30, y: 12 },
      ],
      3,
    )

    expect(result?.l).toBeCloseTo(expected.l, 5)
  })

  test('이미지 밖 좌표는 건너뛴다', () => {
    const image = solidImage(40, 40, skinColor)

    const result = sampleSkinLab(image, [{ x: 2, y: 2 }], 6)

    expect(result).not.toBeNull()
  })

  test('모은 픽셀이 너무 적으면 null을 돌려준다', () => {
    const image = solidImage(40, 40, skinColor)

    expect(sampleSkinLab(image, [], 4)).toBeNull()
    expect(sampleSkinLab(image, [{ x: -100, y: -100 }], 2)).toBeNull()
  })

  test('완전 투명 픽셀은 표본에서 제외한다', () => {
    const image = solidImage(40, 40, skinColor)

    for (let i = 0; i < image.width * image.height; i += 1) {
      image.data[i * 4 + 3] = 0
    }

    expect(sampleSkinLab(image, centerPoints, 4)).toBeNull()
  })
})
