// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { LOCALE_STORAGE_KEY } from '../i18n/locale'
import { useLocale } from './useLocale'

/**
 * 언어 상태 검증 — **뒤로가기에서 언어가 되돌아가지 않는가.**
 *
 * 이게 이 훅의 어려운 부분이다. `useScreenHistory`가 `pushState`에 URL을
 * 넘기지 않아 브라우저가 그 시점의 주소를 방문 기록에 복사한다. 그래서 세션
 * 중에 언어를 바꾸면 **이전 항목들의 주소는 옛 언어로 남는다.** 쿼리를 정본으로
 * 읽으면 뒤로가기에서 언어가 되돌아가고, 안 읽으면 주소와 화면이 갈린다.
 *
 * 화면 상태(`history.state.screen`)도 함께 지켜져야 한다 — 잃으면 앞으로가기나
 * 새로고침으로 그 자리에 돌아왔을 때 첫 화면으로 떨어진다.
 */

function setUrl(search: string): void {
  window.history.replaceState({ screen: 'landing' }, '', `/app/${search}`)
}

/** jsdom의 popstate는 비동기다 — 도착할 때까지 기다린다 */
function waitForPopState(trigger: () => void): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true })
    trigger()
  })
}

beforeEach(() => {
  window.localStorage.clear()
  setUrl('')
})

afterEach(() => {
  window.localStorage.clear()
})

describe('진입', () => {
  test('쿼리에 언어가 있으면 그것으로 연다', () => {
    setUrl('?lang=en')

    const { result } = renderHook(() => useLocale())

    expect(result.current.locale).toBe('en')
  })

  test('쿼리가 없으면 저장값을 쓴다', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')

    const { result } = renderHook(() => useLocale())

    expect(result.current.locale).toBe('en')
  })

  test('쿼리 없이 들어와도 주소에 언어가 실린다 — 공유 링크가 언어를 담는다', () => {
    setUrl('?lang=ko')
    renderHook(() => useLocale())

    expect(window.location.search).toBe('?lang=ko')
  })

  test('자동 감지값은 저장하지 않는다 — 한 번 잘못 감지되면 영구히 굳는다', () => {
    renderHook(() => useLocale())

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })
})

describe('문서 속성 동기', () => {
  test('html lang과 문서 제목이 언어를 따라간다', () => {
    setUrl('?lang=en')

    const { result } = renderHook(() => useLocale())

    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe(result.current.t.documentTitle)

    act(() => result.current.setLocale('ko'))

    expect(document.documentElement.lang).toBe('ko')
    expect(document.title).toBe('퍼스널 컬러 · 헤어스타일 제안')
  })
})

describe('토글', () => {
  test('주소를 바꾸되 방문 기록을 새로 쌓지 않는다', () => {
    setUrl('?lang=ko')

    const before = window.history.length
    const { result } = renderHook(() => useLocale())

    act(() => result.current.setLocale('en'))

    expect(window.location.search).toBe('?lang=en')
    expect(window.history.length).toBe(before)
  })

  test('화면 상태를 잃지 않는다 — 잃으면 복원 시 첫 화면으로 떨어진다', () => {
    setUrl('?lang=ko')
    window.history.replaceState({ screen: 'result' }, '', '/app/?lang=ko')

    const { result } = renderHook(() => useLocale())

    act(() => result.current.setLocale('en'))

    expect(window.history.state).toEqual({ screen: 'result' })
  })

  test('사용자가 고른 언어는 저장한다', () => {
    const { result } = renderHook(() => useLocale())

    act(() => result.current.setLocale('en'))

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
  })

  test('화면 문구가 함께 바뀐다', () => {
    // jsdom의 navigator.language는 en-US라 고정하지 않으면 영어로 열린다
    setUrl('?lang=ko')

    const { result } = renderHook(() => useLocale())

    expect(result.current.t.landing.start).toBe('시작하기')

    act(() => result.current.setLocale('en'))

    expect(result.current.t.landing.start).toBe('Start')
  })
})

describe('뒤로가기', () => {
  test('언어가 되돌아가지 않고, 도착한 항목의 주소도 현재 언어로 맞춰진다', async () => {
    setUrl('?lang=ko')

    const { result } = renderHook(() => useLocale())

    // 화면을 하나 더 쌓는다 — useScreenHistory가 하는 것과 같은 형태다
    act(() => {
      window.history.pushState({ screen: 'capture' }, '', '/app/?lang=ko')
    })

    act(() => result.current.setLocale('en'))

    expect(window.location.search).toBe('?lang=en')

    await act(async () => {
      await waitForPopState(() => window.history.back())
    })

    // 돌아간 항목은 ?lang=ko로 쌓였지만 언어는 영어로 남아야 한다
    expect(result.current.locale).toBe('en')
    expect(window.location.search).toBe('?lang=en')
    // 주소를 고치면서 화면 상태를 잃지 않아야 한다 — 잃으면 복원 시 첫 화면으로 떨어진다
    expect(window.history.state).toEqual({ screen: 'landing' })
  })
})

describe('감지된 언어는 주소에 싣지 않는다', () => {
  /**
   * ★쿼리는 진입 시 **최우선**이다. 감지값까지 주소에 실으면, 그 주소를 복사해
   * 보낸 링크가 받는 사람의 저장값과 브라우저 언어를 **둘 다 건너뛴다.**
   * 저장 규칙이 「감지됨」과 「골랐음」을 가르는 것과 같은 축이다.
   */
  test('쿼리 없이 들어오면 주소를 건드리지 않는다', () => {
    setUrl('')

    renderHook(() => useLocale())

    expect(window.location.search).toBe('')
  })

  test('그래도 문서 속성은 감지된 언어로 맞춘다', () => {
    setUrl('')

    const { result } = renderHook(() => useLocale())

    expect(document.documentElement.lang).toBe(result.current.locale)
  })

  test('사용자가 고르는 순간부터 주소가 따라온다', () => {
    setUrl('')

    const { result } = renderHook(() => useLocale())

    expect(window.location.search).toBe('')

    act(() => result.current.setLocale('en'))

    expect(window.location.search).toBe('?lang=en')
  })
})
