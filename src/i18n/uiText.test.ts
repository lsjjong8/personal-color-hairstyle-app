import { describe, expect, test } from 'vitest'
import type { AnalysisFailureReason, FaceShape, Tone12 } from '../core/types'
import { FACE_SHAPE_LABEL, TONE12_LABEL } from './labels'
import { SUPPORTED_LOCALES, type Locale } from './locale'
import { cardNotice, UI_TEXT } from './uiText'

/**
 * 표시 문구 표의 완전성 검증.
 *
 * 타입이 막아 주는 것과 못 막는 것을 갈라 적는다. `Record<Locale, …>` 형태는
 * **키 누락·로케일 누락·중첩 필드 누락·`undefined`를 전부 컴파일에서 막는다.**
 * 뚫려 있는 것은 **빈 문자열 하나**다 — 그것은 예외를 던지지 않고 화면에서
 * 그냥 안 보인다. 그 하나를 여기서 막는다.
 */

/** 표를 끝까지 훑어 빈 문자열을 찾는다 — 필드를 손으로 나열하지 않는다 */
function emptyPaths(value: unknown, path = ''): string[] {
  if (typeof value === 'string') {
    return value.trim().length === 0 ? [path] : []
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) =>
      emptyPaths(child, path === '' ? key : `${path}.${key}`),
    )
  }

  return []
}

/** 문자열 잎의 경로를 전부 모은다 — 두 로케일의 구조를 대조하는 데 쓴다 */
function stringPaths(value: unknown, path = ''): string[] {
  if (typeof value === 'string') {
    return [path]
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) =>
      stringPaths(child, path === '' ? key : `${path}.${key}`),
    )
  }

  return []
}

const ALL_TONES = Object.keys(TONE12_LABEL.ko) as Tone12[]
const ALL_SHAPES = Object.keys(FACE_SHAPE_LABEL.ko) as FaceShape[]
const ALL_REASONS = Object.keys(UI_TEXT.ko.failure) as AnalysisFailureReason[]

describe('UI_TEXT', () => {
  test('검사 대상이 얼마나 되는지 먼저 센다 — 0건 통과와 전건 통과를 가른다', () => {
    const count = stringPaths(UI_TEXT.ko).length

    expect(count).toBeGreaterThan(40)
    expect(stringPaths(UI_TEXT.en)).toHaveLength(count)
  })

  test.each(SUPPORTED_LOCALES)('%s — 빈 문구가 없다', (locale) => {
    expect(emptyPaths(UI_TEXT[locale])).toEqual([])
  })

  test('두 언어의 구조가 같다 — 한쪽에만 있는 문구가 없다', () => {
    expect(stringPaths(UI_TEXT.en).sort()).toEqual(stringPaths(UI_TEXT.ko).sort())
  })

  test('검사가 실제로 잡는다 — 한 칸을 비우면 그 경로가 나온다', () => {
    const broken = {
      ...UI_TEXT.en,
      result: { ...UI_TEXT.en.result, saveFailed: '' },
    }

    expect(emptyPaths(broken)).toEqual(['result.saveFailed'])
  })

  test('공백만 있는 칸도 빈 것으로 본다', () => {
    expect(emptyPaths({ a: '   ' })).toEqual(['a'])
  })

  test.each(SUPPORTED_LOCALES)('%s — 실패 사유 3종이 모두 문구를 갖는다', (locale) => {
    for (const reason of ALL_REASONS) {
      expect(UI_TEXT[locale].failure[reason].length).toBeGreaterThan(0)
    }

    expect(ALL_REASONS).toHaveLength(3)
  })

  test('영문이 한국어를 그대로 베끼지 않았다', () => {
    const read = (root: unknown, path: string) =>
      path.split('.').reduce<unknown>((node, key) => (node as never)[key], root)

    const same = stringPaths(UI_TEXT.ko).filter(
      (path) => read(UI_TEXT.ko, path) === read(UI_TEXT.en, path),
    )

    // 파일명은 두 언어가 같아도 된다 — 나머지는 번역돼야 한다
    expect(same).toEqual(['cardFilename'])
  })
})

describe('고지 조립', () => {
  test.each(SUPPORTED_LOCALES)('%s — 두 문장이 모두 들어간다', (locale) => {
    const line = cardNotice(UI_TEXT[locale])

    expect(line).toContain(UI_TEXT[locale].notice.fun)
    expect(line).toContain(UI_TEXT[locale].notice.privacy)
  })

  test('조립 규칙이 한 곳이다 — 화면과 카드가 같은 문자열을 본다', () => {
    expect(cardNotice(UI_TEXT.ko)).toBe(
      '진단이 아닌 재미로 보는 제안입니다 · 사진은 기기를 떠나지 않습니다',
    )
  })
})

describe('도메인 라벨', () => {
  test('검사 대상이 12타입 + 얼굴형 5종 = 17키 × 2언어다', () => {
    expect(ALL_TONES).toHaveLength(12)
    expect(ALL_SHAPES).toHaveLength(5)
  })

  test.each(SUPPORTED_LOCALES)('%s — 12타입 라벨이 비어 있지 않다', (locale) => {
    for (const tone of ALL_TONES) {
      expect(TONE12_LABEL[locale][tone].trim().length, tone).toBeGreaterThan(0)
    }
  })

  test.each(SUPPORTED_LOCALES)('%s — 얼굴형 라벨이 비어 있지 않다', (locale) => {
    for (const shape of ALL_SHAPES) {
      expect(FACE_SHAPE_LABEL[locale][shape].trim().length, shape).toBeGreaterThan(0)
    }
  })

  test('영문 라벨이 한국어와 다르다 — 키를 그대로 두지 않았다', () => {
    const untranslated = [
      ...ALL_TONES.filter((tone) => TONE12_LABEL.en[tone] === TONE12_LABEL.ko[tone]),
      ...ALL_SHAPES.filter(
        (shape) => FACE_SHAPE_LABEL.en[shape] === FACE_SHAPE_LABEL.ko[shape],
      ),
    ]

    expect(untranslated).toEqual([])
  })

  test('한국어 라벨은 도메인 키 그대로다 — 표시층이 키를 바꾸지 않는다', () => {
    for (const tone of ALL_TONES) {
      expect(TONE12_LABEL.ko[tone]).toBe(tone)
    }

    for (const shape of ALL_SHAPES) {
      expect(FACE_SHAPE_LABEL.ko[shape]).toBe(shape)
    }
  })

  test('라벨 키가 로케일마다 같다', () => {
    const keys = (value: Record<string, string>) => Object.keys(value).sort()

    expect(keys(TONE12_LABEL.en)).toEqual(keys(TONE12_LABEL.ko))
    expect(keys(FACE_SHAPE_LABEL.en)).toEqual(keys(FACE_SHAPE_LABEL.ko))
  })
})

describe('지원 언어 목록', () => {
  test('표가 지원 목록과 정확히 같다', () => {
    const locales: Locale[] = ['ko', 'en']

    expect([...SUPPORTED_LOCALES].sort()).toEqual([...locales].sort())
    expect(Object.keys(UI_TEXT).sort()).toEqual([...locales].sort())
  })
})
