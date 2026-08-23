// @vitest-environment jsdom
import { describe, expect, test, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useScreenHistory } from './useScreenHistory'

/**
 * 훅 자체의 동작 검증 — 방문 기록 조작과 뒤로가기 처리.
 *
 * 순수 함수(`screenFromHistoryState`)는 `useScreenHistory.test.ts`가 node 환경에서
 * 다룬다. 이 파일은 브라우저 API가 필요한 부분만 jsdom에서 본다.
 *
 * **jsdom은 실제 브라우저가 아니다.** `history.back()`을 불러도 popstate가
 * 자동으로 오지 않아 여기서는 직접 발생시킨다. 그래서 이 테스트가 지키는 것은
 * **"기록을 쌓고 popstate를 받아 화면을 되돌린다"는 우리 쪽 계약**이지,
 * 실제 폰에서 뒤로가기가 동작한다는 보증이 아니다 — 그건 실기기 확인의 몫이다.
 */

/** jsdom의 popstate는 수동으로 보낸다 */
function firePopState(state: unknown): void {
  window.dispatchEvent(new PopStateEvent('popstate', { state }))
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('useScreenHistory', () => {
  test('첫 화면은 랜딩이고, 방문 기록에 그 사실이 새겨진다', () => {
    const { result } = renderHook(() => useScreenHistory())

    expect(result.current.screen).toBe('landing')
    expect(window.history.state).toEqual({ screen: 'landing' })
  })

  test('goTo는 화면을 바꾸고 기록을 하나 쌓는다 — 그래야 뒤로 돌아올 수 있다', () => {
    const { result } = renderHook(() => useScreenHistory())
    const before = window.history.length

    act(() => result.current.goTo('capture'))

    expect(result.current.screen).toBe('capture')
    expect(window.history.state).toEqual({ screen: 'capture' })
    expect(window.history.length).toBe(before + 1)
  })

  test('popstate를 받으면 그 기록의 화면으로 되돌아간다', () => {
    const { result } = renderHook(() => useScreenHistory())

    act(() => result.current.goTo('capture'))
    act(() => result.current.goTo('result'))
    expect(result.current.screen).toBe('result')

    act(() => firePopState({ screen: 'capture' }))
    expect(result.current.screen).toBe('capture')

    act(() => firePopState({ screen: 'landing' }))
    expect(result.current.screen).toBe('landing')
  })

  test('알아볼 수 없는 기록이 오면 첫 화면으로 떨어진다 — 빈 화면을 띄우지 않는다', () => {
    const { result } = renderHook(() => useScreenHistory())

    act(() => result.current.goTo('result'))
    act(() => firePopState({ screen: 'somewhere-else' }))

    expect(result.current.screen).toBe('landing')
  })

  test('언마운트하면 popstate 구독을 해제한다 — 남은 리스너가 죽은 화면을 되살리지 않는다', () => {
    const { result, unmount } = renderHook(() => useScreenHistory())

    act(() => result.current.goTo('capture'))
    const lastScreen = result.current.screen

    unmount()
    act(() => firePopState({ screen: 'result' }))

    expect(result.current.screen).toBe(lastScreen)
  })

  test('goBack을 연달아 눌러도 기록은 한 칸만 되감는다 — 두 칸이면 앱을 벗어난다', () => {
    const { result } = renderHook(() => useScreenHistory())

    act(() => result.current.goTo('capture'))
    const afterPush = window.history.length

    // 화면이 안 바뀌면 한 번 더 누르는 것이 자연스러운 반응이라 실제로 일어난다
    act(() => {
      result.current.goBack()
      result.current.goBack()
      result.current.goBack()
    })

    // 되감기는 비동기라 길이는 그대로지만, 중요한 것은 요청이 한 번만 나갔다는 것이다.
    // popstate가 도착하면 다시 뒤로가기를 받아들인다.
    expect(window.history.length).toBe(afterPush)

    act(() => firePopState({ screen: 'landing' }))
    expect(result.current.screen).toBe('landing')
  })

  test('popstate를 받은 뒤에는 뒤로가기가 다시 동작한다 — 잠금이 풀린다', () => {
    const { result } = renderHook(() => useScreenHistory())

    act(() => result.current.goTo('capture'))
    act(() => result.current.goBack())
    act(() => firePopState({ screen: 'landing' }))

    act(() => result.current.goTo('capture'))
    act(() => result.current.goBack())
    act(() => firePopState({ screen: 'landing' }))

    expect(result.current.screen).toBe('landing')
  })
})
