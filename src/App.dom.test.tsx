// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'
import type { AnalysisResult, AnalysisSuccess } from './core/types'

/**
 * 화면 전환 검증 — 랜딩 → 사진 입력 → 결과가 실제로 이어지는가.
 *
 * 카메라는 이 파일의 관심사가 아니라 대역으로 세운다. 여기서 재는 것은
 * **App이 맡은 것** 셋이다: ①화면을 방문 기록에 얹는가 ②찍은 사진의
 * 미리보기와 판정을 함께 보여 주는가 ③결과 화면을 벗어날 때 앞 분석을
 * 지우는가. ③이 빠지면 다음 사람의 사진 옆에 앞 사람 판정이 남는다.
 */

const analyzePhoto = vi.hoisted(() => vi.fn<() => Promise<AnalysisResult>>())

vi.mock('./core/analyze', () => ({ analyzePhoto }))

/** 카메라 대역 — 누르면 찍은 셈 치고 넘긴다 */
vi.mock('./components/capture/PhotoCapture', () => ({
  PhotoCapture: ({
    onCapture,
    onBack,
  }: {
    onCapture: (photo: {
      canvas: HTMLCanvasElement
      image: ImageData
      previewUrl: string
    }) => void
    onBack: () => void
  }) => (
    <main>
      <h1>사진 준비</h1>
      <button
        type="button"
        onClick={() =>
          onCapture({
            canvas: {} as HTMLCanvasElement,
            image: {} as ImageData,
            previewUrl: 'data:image/jpeg;base64,PREVIEW',
          })
        }
      >
        대역 촬영
      </button>
      <button type="button" onClick={onBack}>
        뒤로
      </button>
    </main>
  ),
}))

function success(): AnalysisSuccess {
  return {
    ok: true,
    personalColor: {
      tone12: '봄 웜',
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

beforeEach(() => {
  analyzePhoto.mockReset()
  analyzePhoto.mockResolvedValue(success())
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** 랜딩에서 시작해 사진 입력 화면까지 간다 */
async function goToCapture(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
  await screen.findByRole('heading', { name: '사진 준비' })
}

describe('화면이 이어진다', () => {
  test('처음에는 랜딩이다', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: '시작하기' })).toBeTruthy()
  })

  test('시작하면 사진 입력으로 넘어가고 방문 기록이 쌓인다', async () => {
    render(<App />)

    await goToCapture()

    expect(window.history.state).toEqual({ screen: 'capture' })
  })

  test('찍으면 결과 화면에 미리보기와 판정이 함께 나온다', async () => {
    render(<App />)
    await goToCapture()

    fireEvent.click(screen.getByRole('button', { name: '대역 촬영' }))

    const preview = await screen.findByAltText('분석한 사진')

    expect(preview.getAttribute('src')).toBe('data:image/jpeg;base64,PREVIEW')
    expect(await screen.findByText('봄 웜')).toBeTruthy()
    expect(window.history.state).toEqual({ screen: 'result' })
  })

  test('분석이 끝나기 전에는 진행 중임을 알린다', async () => {
    analyzePhoto.mockReturnValue(new Promise(() => {}))

    render(<App />)
    await goToCapture()

    fireEvent.click(screen.getByRole('button', { name: '대역 촬영' }))

    expect(await screen.findByText('분석하고 있습니다…')).toBeTruthy()
  })

  test('분석이 실패하면 사유를 알림으로 띄운다', async () => {
    analyzePhoto.mockResolvedValue({ ok: false, reason: 'no-face-detected' })

    render(<App />)
    await goToCapture()

    fireEvent.click(screen.getByRole('button', { name: '대역 촬영' }))

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('얼굴을 찾지 못했습니다')
  })
})

describe('결과 화면을 벗어나면 앞 분석을 지운다', () => {
  test('다시 찍기로 나가면 미리보기와 판정이 남지 않는다', async () => {
    render(<App />)
    await goToCapture()

    fireEvent.click(screen.getByRole('button', { name: '대역 촬영' }))
    await screen.findByText('봄 웜')

    fireEvent.click(screen.getByRole('button', { name: '다시 찍기' }))

    // 뒤로가기는 popstate를 거쳐 다음 차례에 반영된다
    await screen.findByRole('heading', { name: '사진 준비' })

    expect(screen.queryByAltText('분석한 사진')).toBeNull()
    expect(screen.queryByText('봄 웜')).toBeNull()
  })

  test('다시 찍어도 앞 사진의 미리보기가 섞이지 않는다', async () => {
    render(<App />)
    await goToCapture()

    fireEvent.click(screen.getByRole('button', { name: '대역 촬영' }))
    await screen.findByAltText('분석한 사진')

    fireEvent.click(screen.getByRole('button', { name: '다시 찍기' }))
    await screen.findByRole('heading', { name: '사진 준비' })

    fireEvent.click(screen.getByRole('button', { name: '대역 촬영' }))

    await waitFor(() => expect(screen.getAllByAltText('분석한 사진')).toHaveLength(1))
  })
})
