import { describe, expect, test } from 'vitest'
import { screenFromHistoryState } from './useScreenHistory'

/**
 * `history.state`는 우리가 쓴 값이 보장되지 않는다 — 같은 주소에 다른 페이지가
 * 남긴 기록일 수도 있고, 브라우저가 세션을 복원하며 넘겨준 값일 수도 있다.
 * 그래서 시스템 경계로 보고 검증한다(coding-style.md § Input Validation).
 */

describe('screenFromHistoryState', () => {
  test('우리가 남긴 화면 값을 그대로 읽는다', () => {
    expect(screenFromHistoryState({ screen: 'capture' })).toBe('capture')
    expect(screenFromHistoryState({ screen: 'result' })).toBe('result')
    expect(screenFromHistoryState({ screen: 'landing' })).toBe('landing')
  })

  test('기록이 비어 있으면 첫 화면으로 본다 — 앱 진입 직후가 이 경우다', () => {
    expect(screenFromHistoryState(null)).toBe('landing')
    expect(screenFromHistoryState(undefined)).toBe('landing')
  })

  test('모르는 값이면 첫 화면으로 떨어뜨린다 — 빈 화면을 띄우지 않는다', () => {
    expect(screenFromHistoryState({ screen: 'unknown-screen' })).toBe('landing')
    expect(screenFromHistoryState({ screen: 42 })).toBe('landing')
    expect(screenFromHistoryState({ other: 'capture' })).toBe('landing')
    expect(screenFromHistoryState('capture')).toBe('landing')
    expect(screenFromHistoryState([])).toBe('landing')
  })
})
