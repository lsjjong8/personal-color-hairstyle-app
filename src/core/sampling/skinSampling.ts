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

/** 한 점 주변 정사각 영역의 픽셀을 Lab으로 모은다 */
function collectAround(image: ImageLike, point: Point, radius: number): Lab[] {
  const collected: Lab[] = []
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

      collected.push(
        srgbToLab({
          r: image.data[index],
          g: image.data[index + 1],
          b: image.data[index + 2],
        }),
      )
    }
  }

  return collected
}

/** 밝기 기준으로 정렬해 상·하위를 잘라낸다 */
function trimByLightness(samples: readonly Lab[]): Lab[] {
  const sorted = [...samples].sort((left, right) => left.l - right.l)
  const cut = Math.floor(sorted.length * TRIM_RATIO)

  if (cut === 0) {
    return sorted
  }

  return sorted.slice(cut, sorted.length - cut)
}

/**
 * 지정한 점들 주변에서 피부색 표본을 모아 대표 Lab 하나를 만든다.
 * 표본이 부족하면 null — 호출부가 'too-few-skin-pixels' 실패로 옮긴다.
 */
export function sampleSkinLab(
  image: ImageLike,
  points: readonly Point[],
  radius: number,
): Lab | null {
  const samples = points.flatMap((point) => collectAround(image, point, radius))

  if (samples.length < MIN_SAMPLE_PIXELS) {
    return null
  }

  return averageLab(trimByLightness(samples))
}
