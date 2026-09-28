// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { AnalysisResult, AnalysisSuccess } from '../core/types'
import { useAnalysis } from './useAnalysis'

/**
 * 분석 오케스트레이션 검증 — 코어가 아니라 **순서**를 잰다.
 *
 * 이 훅이 지키는 불변식은 하나다: **화면에 보이는 사진과 판정이 같은 분석에서
 * 나온다.** 분석 도중 뒤로가기·'다시 찍기'로 벗어날 수 있어, 먼저 시작한
 * 분석이 나중에 끝나면서 최신 결과를 덮으면 남의 판정이 내 사진 옆에 붙는다.
 * 그 경로는 수동 조작으로는 재현하기 어렵다 — 그래서 여기서 순서를 직접 만든다.
 */

const analyzePhoto = vi.hoisted(() => vi.fn<() => Promise<AnalysisResult>>())

vi.mock('../core/analyze', () => ({ analyzePhoto }))

/** 해소 시점을 테스트가 쥐는 약속 */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })

  return { promise, resolve }
}

function success(tone12: AnalysisSuccess['personalColor']['tone12']): AnalysisSuccess {
  return {
    ok: true,
    personalColor: {
      tone12,
      season: '봄',
      undertone: 'warm',
      evidence: { skinLab: { l: 66.2, a: 12.1, b: 18.4 }, hue: 56.7, chroma: 22, ita: 41.3 },
    },
    faceShape: {
      shape: '계란형',
      evidence: { lengthRatio: 1.42, jawToForehead: 0.85, jawToCheekbone: 0.8 },
    },
    lighting: { applied: true, referenceLuma: 232, clippedRatio: 0 },
  }
}

/** 훅은 내용을 보지 않고 코어에 넘기기만 한다 — 자리만 채운다 */
const source = {} as HTMLCanvasElement
const image = {} as ImageData

beforeEach(() => {
  analyzePhoto.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('상태 전이', () => {
  test('처음에는 아무것도 하지 않는다', () => {
    const { result } = renderHook(() => useAnalysis())

    expect(result.current.state).toEqual({ status: 'idle' })
  })

  test('분석 중에는 running, 끝나면 done과 결과가 함께 온다', async () => {
    const gate = deferred<AnalysisResult>()
    analyzePhoto.mockReturnValue(gate.promise)

    const { result } = renderHook(() => useAnalysis())

    act(() => {
      void result.current.run(source, image)
    })

    expect(result.current.state).toEqual({ status: 'running' })

    await act(async () => {
      gate.resolve(success('봄 웜'))
      await gate.promise
    })

    expect(result.current.state).toEqual({ status: 'done', result: success('봄 웜') })
  })

  test.each([
    [
      'no-face-detected',
      '얼굴을 찾지 못했습니다. 얼굴이 정면으로 크게 나온 사진으로 다시 시도해 주세요.',
    ],
    [
      'too-few-skin-pixels',
      '피부색을 충분히 읽지 못했습니다. 조금 더 밝은 곳에서 다시 찍어 주세요.',
    ],
    ['model-load-failed', '분석 준비에 실패했습니다. 새로고침 후 다시 시도해 주세요.'],
  ] as const)('실패 사유 %s가 사용자 문구로 옮겨진다', async (reason, message) => {
    analyzePhoto.mockResolvedValue({ ok: false, reason })

    const { result } = renderHook(() => useAnalysis())

    await act(async () => {
      await result.current.run(source, image)
    })

    expect(result.current.state).toEqual({ status: 'failed', message })
  })
})

describe('늦게 끝난 분석이 최신 결과를 덮지 않는다', () => {
  test('먼저 시작한 분석이 나중에 끝나도 뒤 분석의 결과가 남는다', async () => {
    const 앞 = deferred<AnalysisResult>()
    const 뒤 = deferred<AnalysisResult>()

    analyzePhoto.mockReturnValueOnce(앞.promise).mockReturnValueOnce(뒤.promise)

    const { result } = renderHook(() => useAnalysis())

    act(() => {
      void result.current.run(source, image)
      void result.current.run(source, image)
    })

    // 뒤 분석이 먼저 끝나고, 앞 분석이 뒤늦게 끝난다
    await act(async () => {
      뒤.resolve(success('겨울 쿨'))
      await 뒤.promise
    })

    await act(async () => {
      앞.resolve(success('봄 웜'))
      await 앞.promise
    })

    expect(result.current.state).toEqual({ status: 'done', result: success('겨울 쿨') })
  })

  test('reset 뒤에 끝난 분석은 화면을 되살리지 않는다', async () => {
    const gate = deferred<AnalysisResult>()
    analyzePhoto.mockReturnValue(gate.promise)

    const { result } = renderHook(() => useAnalysis())

    act(() => {
      void result.current.run(source, image)
    })

    act(() => {
      result.current.reset()
    })

    await act(async () => {
      gate.resolve(success('봄 웜'))
      await gate.promise
    })

    expect(result.current.state).toEqual({ status: 'idle' })
  })

  test('reset 뒤에 끝난 실패도 문구를 띄우지 않는다', async () => {
    const gate = deferred<AnalysisResult>()
    analyzePhoto.mockReturnValue(gate.promise)

    const { result } = renderHook(() => useAnalysis())

    act(() => {
      void result.current.run(source, image)
    })
    act(() => {
      result.current.reset()
    })

    await act(async () => {
      gate.resolve({ ok: false, reason: 'no-face-detected' })
      await gate.promise
    })

    expect(result.current.state).toEqual({ status: 'idle' })
  })
})

describe('reset', () => {
  test('끝난 결과를 지운다', async () => {
    analyzePhoto.mockResolvedValue(success('봄 웜'))

    const { result } = renderHook(() => useAnalysis())

    await act(async () => {
      await result.current.run(source, image)
    })
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    act(() => {
      result.current.reset()
    })

    expect(result.current.state).toEqual({ status: 'idle' })
  })

  test('이미 비어 있으면 같은 상태 객체를 그대로 돌려준다 — 헛렌더를 막는다', () => {
    const { result } = renderHook(() => useAnalysis())
    const before = result.current.state

    act(() => {
      result.current.reset()
    })

    expect(result.current.state).toBe(before)
  })
})

describe('훅이 코어에 넘기는 것', () => {
  test('받은 canvas와 픽셀을 그대로 넘긴다', async () => {
    analyzePhoto.mockResolvedValue(success('봄 웜'))

    const { result } = renderHook(() => useAnalysis())

    await act(async () => {
      await result.current.run(source, image)
    })

    expect(analyzePhoto).toHaveBeenCalledWith(source, image)
  })
})
