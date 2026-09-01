import { averageLab, srgbToLab } from '../color/lab'
import type { ImageLike, Lab, Point } from '../types'

/**
 * 피부색 표본 추출.
 *
 * 볼·이마 같은 영역에서 픽셀을 모으되, 반사광(하이라이트)과 그림자가
 * 평균을 끌어당기지 않도록 밝기 기준 상·하위를 잘라낸 뒤 평균을 낸다.
 * 조명 편차 자체를 없애지는 못한다 — 그건 도메인의 근본 한계다(context.md §2).
 */

/** 밝기 기준 상·하위에서 각각 잘라낼 비율 */
const TRIM_RATIO = 0.2
/** 이 개수에 못 미치면 판정 근거로 삼지 않는다 */
const MIN_SAMPLE_PIXELS = 12
/** 알파값이 이 값 미만이면 표본에서 제외 */
const MIN_ALPHA = 250

/**
 * 한 채널이라도 이 값이면 잘린 것으로 본다.
 *
 * 보정 배율이 1을 넘으면 밝은 피부 채널이 255를 넘어가는데, 저장 배열이
 * 8비트라 255에서 멈춘다. 넘어간 양은 복구할 수 없다 — 그 픽셀의 색은
 * 원래 색이 아니라 **잘린 뒤의 색**이라 다른 사진과 같은 잣대로 잴 수 없다.
 */
const CLIPPED_CHANNEL = 255

/** 표본 픽셀 하나 — 색과, 그 색이 잘린 것인지 */
type Sample = { lab: Lab; clipped: boolean }

/** 한 점 주변 정사각 영역의 픽셀을 모은다 */
function collectAround(image: ImageLike, point: Point, radius: number): Sample[] {
  const collected: Sample[] = []
  const centerX = Math.round(point.x)
  const centerY = Math.round(point.y)

  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    if (y < 0 || y >= image.height) {
      continue
    }

    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x < 0 || x >= image.width) {
        continue
      }

      const index = (y * image.width + x) * 4

      if (image.data[index + 3] < MIN_ALPHA) {
        continue
      }

      const rgb = {
        r: image.data[index],
        g: image.data[index + 1],
        b: image.data[index + 2],
      }

      collected.push({
        lab: srgbToLab(rgb),
        clipped: Math.max(rgb.r, rgb.g, rgb.b) >= CLIPPED_CHANNEL,
      })
    }
  }

  return collected
}

/** 밝기 기준으로 정렬해 상·하위를 잘라낸다 */
function trimByLightness(samples: readonly Sample[]): Sample[] {
  const sorted = [...samples].sort((left, right) => left.lab.l - right.lab.l)
  const cut = Math.floor(sorted.length * TRIM_RATIO)

  if (cut === 0) {
    return sorted
  }

  return sorted.slice(cut, sorted.length - cut)
}

/** 피부 표본 결과 — 대표 색과, 그 색을 얼마나 믿을 수 있는지 */
export interface SkinSample {
  lab: Lab
  /**
   * 판정에 실제로 쓴 표본 중 채널이 잘린 픽셀의 비율(0~1).
   *
   * 0보다 크면 그 판정값은 다른 사진과 같은 척도가 아니다. 특히 한 채널만
   * 잘리는 경우가 위험한데, 밝기는 정상 범위에 남으면서 색만 틀어져
   * 눈으로는 구분되지 않는다.
   */
  clippedRatio: number
}

/**
 * 지정한 점들 주변에서 피부색 표본을 모아 대표 Lab 하나를 만든다.
 * 표본이 부족하면 null — 호출부가 'too-few-skin-pixels' 실패로 옮긴다.
 */
export function sampleSkinLab(
  image: ImageLike,
  points: readonly Point[],
  radius: number,
): SkinSample | null {
  const samples = points.flatMap((point) => collectAround(image, point, radius))

  if (samples.length < MIN_SAMPLE_PIXELS) {
    return null
  }

  const used = trimByLightness(samples)

  return {
    lab: averageLab(used.map((sample) => sample.lab)),
    // 잘림은 **판정에 쓴 픽셀** 기준으로 센다. 절사로 버린 픽셀은 판정에
    // 들어가지 않으므로 그것까지 세면 실제보다 나쁘게 나온다.
    clippedRatio: used.filter((sample) => sample.clipped).length / used.length,
  }
}
