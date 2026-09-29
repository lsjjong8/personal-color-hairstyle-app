import { useCallback, useRef, useState } from 'react'
import { analyzePhoto } from '../core/analyze'
import type { AnalysisFailureReason, AnalysisSuccess } from '../core/types'

/**
 * 실패는 **사유 코드로** 내보낸다 — 문구로 바꾸지 않는다.
 *
 * 예전에는 이 훅이 한국어 문구를 들고 있었는데, 그러면 사용자가 언어를 바꿀 때
 * **이미 떠 있는 실패 문구만 옆 언어로 남는다.** `types.ts`가 적어 둔 대로
 * “사유 — UI가 사용자 문구로 번역한다”가 맞다.
 */
type AnalysisState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: AnalysisSuccess }
  | { status: 'failed'; reason: AnalysisFailureReason }

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })

  /**
   * 진행 중인 분석을 구분하는 번호.
   *
   * 분석 도중에 결과 화면을 벗어나 다시 찍을 수 있다 — 뒤로가기·밀어서 뒤로가기·
   * '다시 찍기' 모두 그 경로다. 번호를 대조하지 않으면 **먼저 시작한 분석이
   * 나중에 끝나면서 최신 결과를 덮어쓸 수 있고**, 화면의 사진과 다른 사람의
   * 판정이 함께 보이게 된다.
   */
  const requestId = useRef(0)

  const run = useCallback(
    async (source: HTMLCanvasElement, image: ImageData): Promise<void> => {
      const id = requestId.current + 1
      requestId.current = id
      setState({ status: 'running' })

      const result = await analyzePhoto(source, image)

      // 그사이 새 분석이 시작됐거나 초기화됐다면 이 결과는 버린다
      if (id !== requestId.current) {
        return
      }

      if (result.ok) {
        setState({ status: 'done', result })
        return
      }

      setState({ status: 'failed', reason: result.reason })
    },
    [],
  )

  const reset = useCallback(() => {
    // 번호를 올려 진행 중인 분석의 결과를 무효로 만든다
    requestId.current += 1
    // 이미 비어 있으면 같은 상태를 돌려줘 불필요한 렌더를 막는다
    setState((previous) => (previous.status === 'idle' ? previous : { status: 'idle' }))
  }, [])

  return { state, run, reset }
}
