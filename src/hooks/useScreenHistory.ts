import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 화면 전환을 브라우저 방문 기록에 얹는다.
 *
 * 화면을 `useState`로만 바꾸면 방문 기록에는 아무것도 쌓이지 않는다. 그러면
 * 폰의 뒤로가기가 앱 안 단계를 되짚지 않고 **앱 자체를 벗어난다** — 주소로
 * 들어온 사용자는 곧장 이전 페이지(새 탭 화면)로 튕겨 나간다.
 *
 * 화면마다 기록을 하나씩 남기고 뒤로가기(popstate)를 받아 되돌리면,
 * 하드웨어 버튼·브라우저 뒤로가기·iOS의 밀어서 뒤로가기가 모두 같은 경로를 탄다.
 * 라우터 라이브러리를 들이지 않은 이유는 화면이 셋뿐이고, 런타임 의존성을
 * 늘리지 않는 것이 이 앱의 방침이기 때문이다(ADR-003·ADR-005).
 */

export type Screen = 'landing' | 'capture' | 'result'

const SCREENS: ReadonlySet<string> = new Set<Screen>(['landing', 'capture', 'result'])

function isScreen(value: unknown): value is Screen {
  return typeof value === 'string' && SCREENS.has(value)
}

/** 방문 기록이 없거나 알아볼 수 없을 때 돌아갈 화면 */
const FALLBACK_SCREEN: Screen = 'landing'

/**
 * 방문 기록에 담긴 값을 화면으로 옮긴다.
 *
 * `history.state`는 우리가 넣은 값이라는 보장이 없다 — 같은 주소에 다른
 * 페이지가 남겼거나 브라우저가 세션을 복원하며 넘겨준 값일 수 있다.
 * 알아볼 수 없으면 첫 화면으로 떨어뜨린다(빈 화면을 띄우지 않는다).
 */
export function screenFromHistoryState(state: unknown): Screen {
  if (typeof state !== 'object' || state === null) {
    return FALLBACK_SCREEN
  }

  const candidate = (state as { screen?: unknown }).screen

  return isScreen(candidate) ? candidate : FALLBACK_SCREEN
}

export function useScreenHistory() {
  const [screen, setScreen] = useState<Screen>(FALLBACK_SCREEN)

  /**
   * 뒤로가기를 요청해 두고 아직 popstate를 못 받은 상태인지.
   *
   * `history.back()`은 즉시 돌아오지만 화면 전환은 다음 차례에 일어난다.
   * 그사이 버튼이 한 번 더 눌리면 기록을 **두 칸** 되감아 앱 밖으로 나간다 —
   * 이 훅이 막으려던 바로 그 증상이다. 화면이 안 바뀌면 한 번 더 누르는 것이
   * 자연스러운 반응이라 실제로 일어난다.
   */
  const backPending = useRef(false)

  useEffect(() => {
    // 첫 기록에 현재 화면을 새겨 둔다. 이게 없으면 뒤로가기로 돌아온 자리의
    // state가 비어 있어 어느 화면이었는지 알 수 없다.
    window.history.replaceState({ screen: FALLBACK_SCREEN }, '')

    function handlePopState(event: PopStateEvent): void {
      backPending.current = false
      setScreen(screenFromHistoryState(event.state))
    }

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  /** 다음 화면으로 넘어간다 — 기록이 하나 쌓이므로 뒤로가기로 되돌아올 수 있다 */
  const goTo = useCallback((next: Screen): void => {
    backPending.current = false
    window.history.pushState({ screen: next }, '')
    setScreen(next)
  }, [])

  /**
   * 앞 화면으로 돌아간다. 기록을 새로 쌓지 않고 되감으므로,
   * 촬영과 결과를 오가도 기록이 무한정 길어지지 않는다.
   * 실제 화면 전환은 popstate를 받아 이뤄진다.
   */
  const goBack = useCallback((): void => {
    if (backPending.current) {
      return
    }

    backPending.current = true
    window.history.back()
  }, [])

  return { screen, goTo, goBack }
}
