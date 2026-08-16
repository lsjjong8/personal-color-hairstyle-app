import { describe, expect, test } from 'vitest'
import { TONE_GUIDE } from './toneGuide'
import { FACE_SHAPE_GUIDE } from './faceShapeGuide'
import type { FaceShape, Tone12 } from '../types'

/**
 * 가이드 데이터의 완전성 검증 — 판정이 12타입·얼굴형 5종 중 무엇을 내놓아도
 * 결과 카드가 빈칸 없이 채워져야 한다.
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

describe('TONE_GUIDE', () => {
  test('12타입 전부에 항목이 있다', () => {
    for (const tone of ALL_TONES) {
      expect(TONE_GUIDE[tone], tone).toBeDefined()
    }
  })

  test.each(ALL_TONES)('%s — 팔레트 4색·염색 3색·한 줄 설명', (tone) => {
    const guide = TONE_GUIDE[tone]

    expect(guide.palette).toHaveLength(4)
    expect(guide.hairColors).toHaveLength(3)
    expect(guide.oneLiner.length).toBeGreaterThan(0)

    for (const swatch of [...guide.palette, ...guide.hairColors]) {
      expect(swatch.name.length).toBeGreaterThan(0)
      expect(swatch.hex).toMatch(HEX_PATTERN)
    }
  })
})

describe('FACE_SHAPE_GUIDE', () => {
  test('얼굴형 5종 전부에 항목이 있다', () => {
    for (const shape of ALL_SHAPES) {
      expect(FACE_SHAPE_GUIDE[shape], shape).toBeDefined()
    }
  })

  test.each(ALL_SHAPES)('%s — 컷 방향 2개 이상·한 줄 설명', (shape) => {
    const guide = FACE_SHAPE_GUIDE[shape]

    expect(guide.cutTips.length).toBeGreaterThanOrEqual(2)
    expect(guide.oneLiner.length).toBeGreaterThan(0)

    for (const tip of guide.cutTips) {
      expect(tip.length).toBeGreaterThan(0)
    }
  })
})
