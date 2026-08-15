import { useCallback, useState } from 'react'
import { analyzePhoto } from '../core/analyze'
import type { AnalysisFailureReason, AnalysisSuccess } from '../core/types'

type AnalysisState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: AnalysisSuccess }
  | { status: 'failed'; message: string }

/** 실패 사유를 사용자 언어로 옮긴다 — 코어는 사유 코드만 알고 문구는 UI가 정한다 */
const FAILURE_MESSAGE: Record<AnalysisFailureReason, string> = {
  'no-face-detected':
    '얼굴을 찾지 못했습니다. 얼굴이 정면으로 크게 나온 사진으로 다시 시도해 주세요.',
  'too-few-skin-pixels':
    '피부색을 충분히 읽지 못했습니다. 조금 더 밝은 곳에서 다시 찍어 주세요.',
  'model-load-failed': '분석 준비에 실패했습니다. 새로고침 후 다시 시도해 주세요.',
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })

  const run = useCallback(
    async (source: HTMLCanvasElement, image: ImageData): Promise<void> => {
      setState({ status: 'running' })

      const result = await analyzePhoto(source, image)

      if (result.ok) {
        setState({ status: 'done', result })
        return
      }

      setState({ status: 'failed', message: FAILURE_MESSAGE[result.reason] })
    },
    [],
  )

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, run, reset }
}
