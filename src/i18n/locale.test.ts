import { describe, expect, test } from 'vitest'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  localeFromLanguages,
  localeFromQuery,
  readStoredLocale,
  resolveInitialLocale,
  urlWithLang,
  writeStoredLocale,
  type Locale,
} from './locale'

/**
 * 언어 해석 검증 — 무엇이 무엇을 이기는가.
 *
 * 우선순위가 틀리면 증상이 조용하다. 공유 링크로 들어온 사람이 자기 저장값
 * 언어를 보거나, 한 번 잘못 감지된 언어가 영구히 굳는다. 둘 다 화면이
 * 멀쩡해 보여서 아무도 신고하지 않는다.
 */

/** 저장소 대역 — 던지게도 만들 수 있다 */
function fakeStorage(initial?: string, throws = false): Storage {
  let value = initial

  return {
    getItem: (key: string) => {
      if (throws) throw new Error('접근 거부')
      return key === LOCALE_STORAGE_KEY ? (value ?? null) : null
    },
    setItem: (key: string, next: string) => {
      if (throws) throw new Error('접근 거부')
      if (key === LOCALE_STORAGE_KEY) value = next
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage
}

describe('브라우저 언어 목록 해석', () => {
  test.each([
    [['ko'], 'ko'],
    [['en'], 'en'],
    [['en-GB'], 'en'],
    [['ko-KR'], 'ko'],
    [['EN-US'], 'en'],
  ] as const)('%s → %s', (languages, expected) => {
    expect(localeFromLanguages(languages)).toBe(expected)
  })

  test('순서대로 훑어 처음 걸리는 것을 고른다', () => {
    expect(localeFromLanguages(['fr', 'en-GB', 'ko'])).toBe('en')
  })

  test('지원하지 않는 언어뿐이면 null — 기본값으로 대신하지 않는다', () => {
    expect(localeFromLanguages(['fr', 'de', 'ja'])).toBeNull()
  })

  test('빈 목록도 null', () => {
    expect(localeFromLanguages([])).toBeNull()
  })

  test('「감지 안 됨」과 「한국어 감지」가 구분된다 — 저장 규칙이 여기 걸린다', () => {
    expect(localeFromLanguages(['fr'])).toBeNull()
    expect(localeFromLanguages(['ko'])).toBe('ko')
  })
})

describe('주소 쿼리 해석', () => {
  test.each([
    ['?lang=en', 'en'],
    ['?lang=ko', 'ko'],
    ['?a=1&lang=en&b=2', 'en'],
  ] as const)('%s → %s', (search, expected) => {
    expect(localeFromQuery(search)).toBe(expected)
  })

  test.each(['', '?lang=', '?lang=fr', '?other=en'])(
    '%s → null (지원하지 않거나 없음)',
    (search) => {
      expect(localeFromQuery(search)).toBeNull()
    },
  )

  /**
   * 브라우저 언어 경로와 같은 관대함을 준다. 한쪽만 엄격하면 손으로 적거나
   * 중간 도구가 대문자로 바꾼 공유 링크가 조용히 무시된다.
   */
  test.each(['?lang=EN', '?lang=En', '?lang=KO'])('%s도 받는다 — 대소문자 무관', (search) => {
    expect(localeFromQuery(search)).not.toBeNull()
  })

  test('두 진입 경로의 대소문자 처리가 같다', () => {
    expect(localeFromQuery('?lang=EN')).toBe(localeFromLanguages(['EN-US']))
  })
})

describe('저장소', () => {
  test('저장된 값을 읽는다', () => {
    expect(readStoredLocale(fakeStorage('en'))).toBe('en')
  })

  test('지원하지 않는 값은 없는 것으로 본다', () => {
    expect(readStoredLocale(fakeStorage('fr'))).toBeNull()
  })

  test('저장소가 없으면 null', () => {
    expect(readStoredLocale(null)).toBeNull()
  })

  test('접근이 예외를 던지면 「저장값 없음」으로 취급한다 — 화면을 깨뜨리지 않는다', () => {
    expect(readStoredLocale(fakeStorage('en', true))).toBeNull()
  })

  test('쓰기가 예외를 던져도 조용히 넘어간다', () => {
    expect(() => writeStoredLocale(fakeStorage(undefined, true), 'en')).not.toThrow()
  })

  test('쓴 값을 다시 읽을 수 있다', () => {
    const storage = fakeStorage()

    writeStoredLocale(storage, 'en')

    expect(readStoredLocale(storage)).toBe('en')
  })
})

describe('진입 시 우선순위 4단 — 쿼리 > 저장값 > 브라우저 > 기본값', () => {
  test('쿼리가 있으면 쿼리가 이긴다', () => {
    expect(
      resolveInitialLocale({
        search: '?lang=en',
        storage: fakeStorage('ko'),
        languages: ['ko'],
      }),
    ).toBe('en')
  })

  test('쿼리가 없으면 저장값이 이긴다', () => {
    expect(
      resolveInitialLocale({ search: '', storage: fakeStorage('en'), languages: ['ko'] }),
    ).toBe('en')
  })

  test('쿼리·저장값이 없으면 브라우저 언어', () => {
    expect(resolveInitialLocale({ search: '', storage: null, languages: ['en-GB'] })).toBe(
      'en',
    )
  })

  test('아무것도 없으면 기본값 ko', () => {
    expect(resolveInitialLocale({ search: '', storage: null, languages: ['fr'] })).toBe(
      DEFAULT_LOCALE,
    )
    expect(DEFAULT_LOCALE).toBe('ko')
  })

  test('저장소가 던져도 다음 단으로 넘어간다', () => {
    expect(
      resolveInitialLocale({
        search: '',
        storage: fakeStorage('en', true),
        languages: ['en'],
      }),
    ).toBe('en')
  })

  test('각 단이 실제로 다음 단을 막는다 — 한 단만 지우면 답이 바뀐다', () => {
    const storage = fakeStorage('ko')
    const languages = ['en'] as const

    expect(resolveInitialLocale({ search: '?lang=en', storage, languages })).toBe('en')
    expect(resolveInitialLocale({ search: '', storage, languages })).toBe('ko')
    expect(resolveInitialLocale({ search: '', storage: null, languages })).toBe('en')
  })
})

describe('주소에 언어 싣기', () => {
  test.each([
    ['https://x.dev/app/', 'en', '/app/?lang=en'],
    ['https://x.dev/app/?lang=ko', 'en', '/app/?lang=en'],
    ['https://x.dev/app/?a=1', 'en', '/app/?a=1&lang=en'],
    ['https://x.dev/app/#top', 'ko', '/app/?lang=ko#top'],
  ] as const)('%s + %s → %s', (href, locale: Locale, expected) => {
    expect(urlWithLang(href, locale)).toBe(expected)
  })

  test('출처는 남기지 않는다 — replaceState에 넘길 상대 주소다', () => {
    expect(urlWithLang('https://x.dev/app/', 'en').startsWith('/')).toBe(true)
  })
})
