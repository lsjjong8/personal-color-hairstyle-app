import { describe, expect, test } from 'vitest'
import { SUPPORTED_LOCALES, type Locale } from '../../i18n/locale'
import type { FaceShape, Tone12 } from '../types'
import { FACE_SHAPE_GUIDE } from './faceShapeGuide'
import { TONE_GUIDE, untranslatedSwatchNames } from './toneGuide'

/**
 * 가이드 데이터의 완전성 검증 — 판정이 12타입·얼굴형 5종 중 무엇을 내놓아도
 * 결과 카드가 **어느 언어에서도** 빈칸 없이 채워져야 한다.
 *
 * 빠진 칸은 화면에서 조용하다. 빈 문자열은 예외를 던지지 않고 그냥 안 보인다.
 */

const ALL_TONES: Tone12[] = [
  '봄 라이트',
  '봄 브라이트',
  '봄 웜',
  '여름 라이트',
  '여름 뮤트',
  '여름 쿨',
  '가을 뮤트',
  '가을 딥',
  '가을 웜',
  '겨울 브라이트',
  '겨울 딥',
  '겨울 쿨',
]

const ALL_SHAPES: FaceShape[] = ['계란형', '둥근형', '각진형', '긴형', '역삼각형']

const HEX_PATTERN = /^#[0-9a-f]{6}$/i

const TONE_CASES = SUPPORTED_LOCALES.flatMap((locale) =>
  ALL_TONES.map((tone) => [locale, tone] as const),
)
const SHAPE_CASES = SUPPORTED_LOCALES.flatMap((locale) =>
  ALL_SHAPES.map((shape) => [locale, shape] as const),
)

describe('TONE_GUIDE', () => {
  test('검사 대상이 12타입 × 2언어 = 24건이다', () => {
    expect(TONE_CASES).toHaveLength(24)
  })

  test.each(SUPPORTED_LOCALES)('%s — 12타입 전부에 항목이 있다', (locale) => {
    for (const tone of ALL_TONES) {
      expect(TONE_GUIDE[locale][tone], tone).toBeDefined()
    }
  })

  test.each(TONE_CASES)('%s · %s — 팔레트 4색·염색 3색·한 줄 설명', (locale, tone) => {
    const guide = TONE_GUIDE[locale][tone]

    expect(guide.palette).toHaveLength(4)
    expect(guide.hairColors).toHaveLength(3)
    expect(guide.oneLiner.length).toBeGreaterThan(0)

    for (const swatch of [...guide.palette, ...guide.hairColors]) {
      expect(swatch.name.length).toBeGreaterThan(0)
      expect(swatch.hex).toMatch(HEX_PATTERN)
    }
  })

  /**
   * hex는 번역 대상이 아니다. 두 언어의 색이 갈리면 같은 타입이 언어에 따라
   * 다른 색을 내놓는다 — 화면은 멀쩡해 보이고 아무도 신고하지 않는다.
   */
  test.each(ALL_TONES)('%s — 두 언어의 hex 배열이 같다', (tone) => {
    const hexes = (locale: Locale) =>
      [...TONE_GUIDE[locale][tone].palette, ...TONE_GUIDE[locale][tone].hairColors].map(
        (swatch) => swatch.hex,
      )

    expect(hexes('en')).toEqual(hexes('ko'))
  })

  test.each(ALL_TONES)('%s — 영문 이름이 한국어와 다르다(실제로 번역됐다)', (tone) => {
    const names = (locale: Locale) =>
      [...TONE_GUIDE[locale][tone].palette, ...TONE_GUIDE[locale][tone].hairColors].map(
        (swatch) => swatch.name,
      )

    expect(names('en')).not.toEqual(names('ko'))
    expect(TONE_GUIDE.en[tone].oneLiner).not.toBe(TONE_GUIDE.ko[tone].oneLiner)
  })

  test('영문 대조표에 빠진 색 이름이 없다', () => {
    expect(untranslatedSwatchNames()).toEqual([])
  })
})

describe('FACE_SHAPE_GUIDE', () => {
  test.each(SUPPORTED_LOCALES)('%s — 얼굴형 5종 전부에 항목이 있다', (locale) => {
    for (const shape of ALL_SHAPES) {
      expect(FACE_SHAPE_GUIDE[locale][shape], shape).toBeDefined()
    }
  })

  test.each(SHAPE_CASES)('%s · %s — 컷 방향 2개 이상·한 줄 설명', (locale, shape) => {
    const guide = FACE_SHAPE_GUIDE[locale][shape]

    expect(guide.cutTips.length).toBeGreaterThanOrEqual(2)
    expect(guide.oneLiner.length).toBeGreaterThan(0)

    for (const tip of guide.cutTips) {
      expect(tip.length).toBeGreaterThan(0)
    }
  })

  /**
   * 컷 제안 개수가 언어마다 다르면 카드의 세로 예산이 갈려 한쪽에서만 넘친다.
   */
  test.each(ALL_SHAPES)('%s — 두 언어의 컷 제안 개수가 같다', (shape) => {
    expect(FACE_SHAPE_GUIDE.en[shape].cutTips).toHaveLength(
      FACE_SHAPE_GUIDE.ko[shape].cutTips.length,
    )
  })

  test.each(ALL_SHAPES)('%s — 영문이 한국어와 다르다(실제로 번역됐다)', (shape) => {
    expect(FACE_SHAPE_GUIDE.en[shape].oneLiner).not.toBe(
      FACE_SHAPE_GUIDE.ko[shape].oneLiner,
    )
    expect(FACE_SHAPE_GUIDE.en[shape].cutTips).not.toEqual(
      FACE_SHAPE_GUIDE.ko[shape].cutTips,
    )
  })
})
