import { useCallback, useEffect, useState } from 'react'
import {
  localeFromQuery,
  resolveInitialLocale,
  urlWithLang,
  writeStoredLocale,
  type Locale,
} from '../i18n/locale'
import { UI_TEXT, type UiText } from '../i18n/uiText'

/**
 * 표시 언어 상태.
 *
 * **진입할 때는 주소 쿼리가 최우선 입력이고, 세션 안에서는 이 상태가 정본이다.**
 * 주소는 상태를 따라 갱신된다. 반대로 두면(쿼리를 계속 정본으로 읽으면)
 * 뒤로가기에서 언어가 되돌아간다 — 영어로 바꾼 뒤 뒤로 갔더니 한국어가 되는
 * 것은 사용자에게 결함으로 보인다.
 *
 * 언어를 `history.state`에 넣지 않는 이유도 같다. 언어는 화면 이동 단계가
 * 아니다. 대신 `popstate`를 따로 듣고 **도착한 항목의 주소를 현재 언어로 다시
 * 맞춘다** — `useScreenHistory`는 건드리지 않는다(화면과 언어의 책임을 섞지 않는다).
 */

/** 사생활 보호 모드에서는 `localStorage` 접근 자체가 던진다 */
function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export interface UseLocale {
  locale: Locale
  /** 사용자가 직접 고른 경우에만 부른다 — 감지값은 저장하지 않는다 */
  setLocale: (next: Locale) => void
  /** 현재 언어의 화면 문구 */
  t: UiText
}

export function useLocale(): UseLocale {
  const [locale, setLocaleState] = useState<Locale>(() =>
    resolveInitialLocale({
      search: window.location.search,
      storage: safeStorage(),
      languages: window.navigator.languages ?? [window.navigator.language],
    }),
  )

  /**
   * 이 언어를 **사람이 고른 것인가.**
   *
   * ★주소에 언어를 싣는 것은 고른 경우로 한정한다. 감지값까지 실으면
   * 공유 링크가 받는 사람의 저장값과 브라우저 언어를 **둘 다 건너뛴다** —
   * 쿼리가 최우선 입력이기 때문이다. 영어권 사용자가 쿼리 없이 들어와
   * 주소창을 복사해 보내면, 한국어를 직접 골라 둔 상대가 영어 화면을 받는다.
   *
   * 저장 규칙과 같은 축이다: `localeFromLanguages`가 감지 실패에 `'ko'`가 아니라
   * `null`을 돌려주는 것도 「감지됨」과 「골랐음」을 가르기 위해서다.
   */
  const [chosen, setChosen] = useState<boolean>(
    () => localeFromQuery(window.location.search) !== null,
  )

  // 문서 속성 동기 — 화면 낭독기의 발음과 줄나눔이 여기에 달려 있다
  useEffect(() => {
    document.documentElement.lang = locale
    document.title = UI_TEXT[locale].documentTitle
  }, [locale])

  // 주소는 고른 경우에만 따라간다 (위 `chosen` 주석)
  useEffect(() => {
    if (!chosen) {
      return
    }

    window.history.replaceState(
      window.history.state,
      '',
      urlWithLang(window.location.href, locale),
    )
  }, [locale, chosen])

  // 뒤로·앞으로가기로 도착한 항목은 옛 주소를 갖고 있다 — 언어만 다시 맞춘다.
  // 기존 state를 그대로 넘겨야 그 항목의 화면 정보가 보존된다.
  useEffect(() => {
    if (!chosen) {
      return
    }

    function handlePopState(event: PopStateEvent): void {
      window.history.replaceState(
        event.state,
        '',
        urlWithLang(window.location.href, locale),
      )
    }

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [locale, chosen])

  const setLocale = useCallback((next: Locale): void => {
    writeStoredLocale(safeStorage(), next)
    setChosen(true)
    setLocaleState(next)
  }, [])

  return { locale, setLocale, t: UI_TEXT[locale] }
}
