import type { ImageLike, Point, Rgb } from '../types'

/**
 * 조명 색 보정 (화이트밸런스).
 *
 * 퍼스널 컬러 판정의 1축인 색상각 h°는 조명 색온도에 그대로 끌려다닌다 —
 * 2026-08-18 실측에서 같은 사진에 조명만 바꿔 h°가 30.1~57.7로 27.6도
 * 움직였고, 언더톤 경계(48·58)를 통째로 넘나들었다. 실내 LED·형광등은
 * 푸른 기가 강해 누구나 '쿨'로 판정되는 쏠림이 실제로 발생했다.
 *
 * 사진 안에 이미 무채색 기준이 있다: 눈 흰자다. 흰자를 회색으로 되돌리는
 * 채널 배율을 이미지 전체에 적용하면 조명 색이 걷힌다(von Kries 방식의 단순형).
 *
 * **흰자는 밝기가 아니라 채도로 찾는다.** 밝은 순으로만 뽑으면 눈꺼풀 피부가
 * 잡힌다 — 2026-08-18 실측에서 그렇게 뽑은 기준이 (154,129,117)로 상대 채도
 * 0.275였다(흰자라면 0.08 수준). 유채색을 기준으로 삼으면 그 색을 회색으로
 * 만드는 과정에서 피부색까지 왜곡된다. 채도 상한을 먼저 걸고 그 안에서
 * 밝은 픽셀을 고르면 상대 채도 0.06~0.16의 진짜 흰자가 잡힌다.
 *
 * 한계: 흰자를 찾지 못하면(눈 감음·안경 반사·측면 얼굴·강한 색조명) 보정하지
 * 않는다 — 억지로 보정하느니 원본으로 두는 편이 덜 틀린다.
 * 조명의 밝기 편차(노출)는 보정 대상이 아니다 — 그건 명도 축의 문제로 남아 있다.
 */

/**
 * 상대 채도가 이 값을 넘으면 흰자가 아니다 — 홍채·속눈썹·눈꺼풀 피부를 걷어낸다.
 * 실측으로 정한 값이다: 0.20이면 전구색 조명에서 후보가 8개로 모자라 보정이
 * 아예 걸리지 않고, 0.50이면 피부가 섞여 기준 채도가 0.26까지 올라간다.
 * 0.35에서 조명 6종 전부 후보 14개 이상, 기준 채도 0.06~0.16을 유지했다.
 */
const MAX_CANDIDATE_SATURATION = 0.35
/** 채도 통과 픽셀 중 밝은 쪽 이 비율을 남긴다 */
const BRIGHT_FRACTION = 0.5
/** 그중 다시 채도가 낮은 쪽 이 비율을 기준으로 삼는다 */
const NEUTRAL_FRACTION = 0.6
/** 기준 추정에 최소한 이만큼은 있어야 한다 */
const MIN_REFERENCE_PIXELS = 10
/** 기준의 평균 밝기가 이보다 어두우면 흰자가 아니다 — 보정을 포기한다 */
const MIN_REFERENCE_LUMA = 90
/**
 * 기준이 이보다 밝으면 과노출로 채널이 255에서 잘렸을 수 있다.
 * 잘린 채널은 원래 값을 알 수 없어 보정하면 오히려 색이 틀어진다 —
 * 그래서 보정을 포기한다(밝은 조명에서 실제로 발생).
 */
const MAX_REFERENCE_LUMA = 250
/** 한 채널이라도 이 값 이상이면 클리핑으로 본다 */
const CLIPPED_CHANNEL = 253
/** 채널 배율 상·하한 — 극단 보정으로 색이 무너지는 것을 막는다 */
const MIN_GAIN = 0.6
const MAX_GAIN = 1.7

const MIN_ALPHA = 250

function luma(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114
}

function clampGain(value: number): number {
  return Math.min(MAX_GAIN, Math.max(MIN_GAIN, value))
}

type Candidate = { r: number; g: number; b: number; luma: number; saturation: number }

/** 상대 채도 — 밝기에 좌우되지 않도록 평균으로 나눈다 */
function relativeSaturation(r: number, g: number, b: number): number {
  const mean = (r + g + b) / 3

  if (mean === 0) {
    return 0
  }

  return (Math.max(r, g, b) - Math.min(r, g, b)) / mean
}

/** 한 영역(점들의 최소 사각형) 안의 픽셀을 모은다 */
function collectRegion(image: ImageLike, region: readonly Point[]): Candidate[] {
  if (region.length === 0) {
    return []
  }

  const xs = region.map((point) => point.x)
  const ys = region.map((point) => point.y)
  const left = Math.max(0, Math.floor(Math.min(...xs)))
  const right = Math.min(image.width - 1, Math.ceil(Math.max(...xs)))
  const top = Math.max(0, Math.floor(Math.min(...ys)))
  const bottom = Math.min(image.height - 1, Math.ceil(Math.max(...ys)))

  const collected: Candidate[] = []

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const index = (y * image.width + x) * 4

      if (image.data[index + 3] < MIN_ALPHA) {
        continue
      }

      const r = image.data[index]
      const g = image.data[index + 1]
      const b = image.data[index + 2]
      const saturation = relativeSaturation(r, g, b)

      if (saturation > MAX_CANDIDATE_SATURATION) {
        continue
      }

      collected.push({ r, g, b, luma: luma(r, g, b), saturation })
    }
  }

  return collected
}

/**
 * 각 영역에서 가장 밝은 픽셀 무리를 모아 무채색 기준을 만든다.
 *
 * **영역을 반드시 눈 하나씩 따로 넘긴다.** 양쪽 눈을 한 사각형으로 묶으면
 * 그 사이 콧대가 영역에 들어오고, 콧대 피부가 흰자보다 밝을 수 있다.
 * 노란 피부를 무채색으로 만들려는 보정이 되어 결과가 파랗게 밀린다
 * (2026-08-18 실측: 묶어서 넘겼을 때 보정 후 h°가 341~348도로 뒤집혔다).
 *
 * 기준으로 삼기 부적절하면 null — 호출부는 보정을 건너뛴다.
 */
export function estimateNeutralReference(
  image: ImageLike,
  regions: readonly (readonly Point[])[],
): Rgb | null {
  const candidates: Candidate[] = []

  for (const region of regions) {
    const inRegion = collectRegion(image, region)

    if (inRegion.length === 0) {
      continue
    }

    // 밝은 쪽을 먼저 남기고(흰자는 눈에서 밝다), 그중 가장 무채색인 것을 고른다
    inRegion.sort((left, right) => right.luma - left.luma)
    const bright = inRegion.slice(0, Math.max(4, Math.round(inRegion.length * BRIGHT_FRACTION)))

    bright.sort((left, right) => left.saturation - right.saturation)
    candidates.push(...bright.slice(0, Math.max(4, Math.round(bright.length * NEUTRAL_FRACTION))))
  }

  if (candidates.length < MIN_REFERENCE_PIXELS) {
    return null
  }

  const count = candidates.length

  const reference: Rgb = {
    r: candidates.reduce((sum, pixel) => sum + pixel.r, 0) / count,
    g: candidates.reduce((sum, pixel) => sum + pixel.g, 0) / count,
    b: candidates.reduce((sum, pixel) => sum + pixel.b, 0) / count,
  }

  const referenceLuma = luma(reference.r, reference.g, reference.b)

  if (referenceLuma < MIN_REFERENCE_LUMA || referenceLuma > MAX_REFERENCE_LUMA) {
    return null
  }

  if (Math.max(reference.r, reference.g, reference.b) >= CLIPPED_CHANNEL) {
    return null
  }

  return reference
}

/**
 * 기준색을 무채색으로 만드는 채널 배율을 낸다.
 *
 * 적용과 분리해 둔 이유: 노출 정규화 배율과 **곱해서 한 번에 적용**하기 위해서다.
 * 따로 적용하면 이미지를 두 번 훑을 뿐 아니라, 노출 배율을 색 보정 전 기준으로
 * 계산하게 돼 체계적으로 어긋난다(색 보정이 기준의 밝기를 바꾸기 때문).
 */
export function estimateWhiteBalanceGain(reference: Rgb): Rgb {
  const mean = (reference.r + reference.g + reference.b) / 3

  return {
    r: clampGain(mean / reference.r),
    g: clampGain(mean / reference.g),
    b: clampGain(mean / reference.b),
  }
}

/** 색에 채널 배율을 적용한다 */
export function applyGainToColor(color: Rgb, gain: Rgb): Rgb {
  return { r: color.r * gain.r, g: color.g * gain.g, b: color.b * gain.b }
}

/**
 * 채널 배율을 적용한 새 이미지를 만든다.
 * 원본은 바꾸지 않는다 — 미리보기에 쓰이는 픽셀과 같은 배열이기 때문이다.
 */
export function applyChannelGain(image: ImageLike, gain: Rgb): ImageLike {
  const data = new Uint8ClampedArray(image.width * image.height * 4)

  for (let i = 0; i < data.length; i += 4) {
    data[i] = image.data[i] * gain.r
    data[i + 1] = image.data[i + 1] * gain.g
    data[i + 2] = image.data[i + 2] * gain.b
    data[i + 3] = image.data[i + 3]
  }

  return { width: image.width, height: image.height, data }
}
