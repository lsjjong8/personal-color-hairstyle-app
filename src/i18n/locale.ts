/**
 * 표시 언어 — 타입과 해석기.
 *
 * i18n 라이브러리를 쓰지 않는다(ADR-003·005: 런타임 의존성 0). 화면이 셋이고
 * 문자열이 수백 개라 표 하나와 순수 함수 몇 개로 충분하다.
 *
 * **도메인 키는 한국어 그대로 둔다.** `Tone12`·`FaceShape`가 한국어 유니온이고
 * 테스트 수십 곳이 그 값을 기대값으로 쓴다. 키를 바꾸는 것은 번역이 아니라
 * 도메인 변경이다 — 번역은 표시층에서만 한다.
 */

export type Locale = 'ko' | 'en'

export const DEFAULT_LOCALE: Locale = 'ko'

export const SUPPORTED_LOCALES: readonly Locale[] = ['ko', 'en']

/** 주소 쿼리와 저장소에 쓰는 키 */
export const LOCALE_QUERY_KEY = 'lang'
export const LOCALE_STORAGE_KEY = 'personal-color-locale'

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
  )
}

/**
 * 브라우저 언어 목록에서 지원하는 첫 언어를 고른다.
 *
 * `navigator`를 직접 읽지 않고 인자로 받는다 — 브라우저 없이 테스트하기 위해서다.
 * 지역 변종은 구분하지 않는다: `en-GB`도 `en`이다. 아무것도 안 걸리면 `null`을
 * 돌려주고 호출자가 기본값으로 떨어뜨린다. **`'ko'`를 돌려주지 않는다** —
 * 「감지됨」과 「기본값」이 구분돼야 저장 규칙이 성립한다.
 */
export function localeFromLanguages(languages: readonly string[]): Locale | null {
  for (const tag of languages) {
    const primary = tag.split('-')[0]?.toLowerCase()

    if (isLocale(primary)) {
      return primary
    }
  }

  return null
}

/**
 * 주소 쿼리에서 언어를 읽는다. 값이 없거나 지원하지 않으면 `null`.
 *
 * 브라우저 언어 경로와 같이 **소문자로 맞춘다.** 한쪽만 관대하면
 * 손으로 적거나 중간 도구가 대문자로 바꾼 `?lang=EN` 링크가 조용히 무시된다 —
 * 공유 링크가 이 기능의 목적이라 그 어긋남이 그대로 사용자에게 간다.
 */
export function localeFromQuery(search: string): Locale | null {
  const value = new URLSearchParams(search).get(LOCALE_QUERY_KEY)?.toLowerCase()

  return isLocale(value) ? value : null
}

/**
 * 저장된 언어를 읽는다.
 *
 * 사생활 보호 모드에서는 접근 자체가 예외를 던진다. 실패는 **「저장값 없음」**으로
 * 취급한다 — 화면이 깨지는 것보다 기본 언어로 뜨는 편이 낫다.
 */
export function readStoredLocale(storage: Storage | null): Locale | null {
  try {
    const value = storage?.getItem(LOCALE_STORAGE_KEY)

    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

/** 언어를 저장한다 — **사용자가 직접 고른 경우에만** 부른다 */
export function writeStoredLocale(storage: Storage | null, locale: Locale): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // 저장에 실패해도 이번 세션의 언어는 메모리에 있다 — 조용히 넘긴다
  }
}

export interface LocaleSources {
  /** `window.location.search` */
  search: string
  storage: Storage | null
  /** `navigator.languages` */
  languages: readonly string[]
}

/**
 * 진입할 때의 언어를 정한다 — 쿼리 > 저장값 > 브라우저 > 기본값.
 *
 * 쿼리가 맨 앞인 이유는 공유 링크다. 정적 배포라 서버 언어 협상이 없어
 * 링크에 언어를 실을 수단이 쿼리뿐이다.
 */
export function resolveInitialLocale(sources: LocaleSources): Locale {
  return (
    localeFromQuery(sources.search) ??
    readStoredLocale(sources.storage) ??
    localeFromLanguages(sources.languages) ??
    DEFAULT_LOCALE
  )
}

/** 주소의 언어 쿼리만 갈아 끼운다 — 나머지 경로·쿼리는 그대로 둔다 */
export function urlWithLang(href: string, locale: Locale): string {
  const url = new URL(href)

  url.searchParams.set(LOCALE_QUERY_KEY, locale)

  return `${url.pathname}${url.search}${url.hash}`
}
