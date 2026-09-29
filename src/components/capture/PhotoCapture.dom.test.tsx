// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { UI_TEXT } from '../../i18n/uiText'
import { PhotoCapture, type CapturedPhoto } from './PhotoCapture'

const t = UI_TEXT.ko

/**
 * 사진 입력 검증 — 두 경로가 **끝까지 간다**는 것을 잰다.
 *
 * 이 화면이 지키는 것은 PRD의 기술 리스크 완화책이다: 카메라가 막혀도
 * 업로드로 끝까지 갈 수 있어야 하고, 실패는 조용하면 안 된다. jsdom에는
 * 카메라도 canvas 2D도 없어 둘 다 가짜로 세운다 — 그래서 이 테스트가
 * 증명하는 것은 **분기와 배선**이지 실제 촬영 품질이 아니다.
 */

const preloadLandmarker = vi.hoisted(() => vi.fn())

vi.mock('../../core/adapters/faceLandmarkerAdapter', () => ({ preloadLandmarker }))

const stop = vi.fn()
const getUserMedia = vi.fn()

/** 2D 컨텍스트 흉내 — drawImage는 아무것도 하지 않고 픽셀만 돌려준다 */
function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    drawImage: vi.fn(),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
      colorSpace: 'srgb' as const,
    }),
    canvas,
  } as unknown as CanvasRenderingContext2D
}

let contextAvailable = true

beforeEach(() => {
  contextAvailable = true
  stop.mockClear()
  preloadLandmarker.mockClear()
  getUserMedia.mockReset()
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] })

  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
    writable: true,
  })

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return contextAvailable ? fakeContext(this) : null
  })

  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/jpeg;base64,TEST',
  )

  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (_file: Blob) => ({ width: 1440, height: 1080, close: vi.fn() })),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderScreen() {
  const onCapture = vi.fn<(photo: CapturedPhoto) => void>()
  const onBack = vi.fn()

  render(<PhotoCapture onCapture={onCapture} onBack={onBack} t={t} />)

  return { onCapture, onBack }
}

/** 파일 선택 input은 라벨 안에 숨어 있어 역할로는 잡히지 않는다 */
function filePicker(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')

  if (input === null) {
    throw new Error('파일 선택 입력을 찾지 못했다')
  }

  return input
}

function shootButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: '지금 촬영' })
}

describe('카메라 경로', () => {
  test('열리기 전에는 촬영 버튼을 누를 수 없다', () => {
    getUserMedia.mockReturnValue(new Promise(() => {}))
    renderScreen()

    expect(shootButton().disabled).toBe(true)
  })

  test('열리면 촬영 버튼이 살아난다', async () => {
    renderScreen()

    await waitFor(() => expect(shootButton().disabled).toBe(false))
  })

  test('촬영하면 줄인 사진과 픽셀을 넘기고 카메라를 끈다', async () => {
    const { onCapture } = renderScreen()

    await waitFor(() => expect(shootButton().disabled).toBe(false))

    const video = document.querySelector('video')

    if (video === null) {
      throw new Error('미리보기 video를 찾지 못했다')
    }

    Object.defineProperty(video, 'videoWidth', { value: 1440, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true })

    fireEvent.click(shootButton())

    expect(onCapture).toHaveBeenCalledTimes(1)

    const photo = onCapture.mock.calls[0]?.[0]

    // 긴 변 1440 → 720으로 줄고 비율은 그대로
    expect(photo?.canvas.width).toBe(720)
    expect(photo?.canvas.height).toBe(540)
    expect(photo?.image.width).toBe(720)
    expect(photo?.previewUrl).toBe('data:image/jpeg;base64,TEST')
    expect(stop).toHaveBeenCalled()
  })

  test('화면을 떠나면 카메라를 끈다', async () => {
    const view = render(<PhotoCapture onCapture={vi.fn()} onBack={vi.fn()} t={t} />)

    await waitFor(() => expect(shootButton().disabled).toBe(false))

    view.unmount()

    expect(stop).toHaveBeenCalled()
  })

  test('모델을 미리 받아 둔다 — 사용자가 자세를 잡는 동안', () => {
    renderScreen()

    expect(preloadLandmarker).toHaveBeenCalledTimes(1)
  })
})

describe('카메라가 막혀도 업로드로 끝까지 간다', () => {
  const 거부 = '카메라를 열지 못했습니다. 아래에서 사진을 골라 주세요.'

  test('거부되면 안내가 뜨고 파일 선택은 그대로 남는다', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))

    renderScreen()

    expect(await screen.findByText(거부)).toBeTruthy()
    // 폴백을 숨기지 않는다 (PRD 기술 리스크 완화책)
    expect(screen.getByText(/갖고 있는 사진 고르기/)).toBeTruthy()
    expect(filePicker()).toBeTruthy()
  })

  test('카메라가 거부된 상태에서도 파일을 고르면 분석으로 넘어간다', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))

    const { onCapture } = renderScreen()

    await screen.findByText(거부)

    fireEvent.change(filePicker(), {
      target: { files: [new File(['x'], 'me.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1))
    expect(onCapture.mock.calls[0]?.[0].canvas.width).toBe(720)
  })

  test('파일을 고르지 않고 창을 닫으면 아무 일도 없다', async () => {
    const { onCapture } = renderScreen()

    fireEvent.change(filePicker(), { target: { files: [] } })

    await waitFor(() => expect(preloadLandmarker).toHaveBeenCalled())
    expect(onCapture).not.toHaveBeenCalled()
  })
})

describe('실패가 조용하지 않다', () => {
  test('2D 컨텍스트를 못 얻으면 촬영은 문구를 띄우고 넘기지 않는다', async () => {
    const { onCapture } = renderScreen()

    await waitFor(() => expect(shootButton().disabled).toBe(false))

    contextAvailable = false
    fireEvent.click(shootButton())

    expect(onCapture).not.toHaveBeenCalled()
    expect(
      screen.getByText('사진을 만드는 데 실패했습니다. 파일 선택을 이용해 주세요.'),
    ).toBeTruthy()
  })

  test('2D 컨텍스트를 못 얻으면 업로드도 문구를 띄우고 넘기지 않는다', async () => {
    const { onCapture } = renderScreen()

    contextAvailable = false
    fireEvent.change(filePicker(), {
      target: { files: [new File(['x'], 'me.jpg', { type: 'image/jpeg' })] },
    })

    expect(
      await screen.findByText('사진을 읽지 못했습니다. 다른 파일로 시도해 주세요.'),
    ).toBeTruthy()
    expect(onCapture).not.toHaveBeenCalled()
  })
})

describe('언어를 바꿔도 카메라를 다시 잡지 않는다', () => {
  /**
   * ★이 화면의 가장 위험한 경로였다. 실패 문구를 **상태에 문자열로** 담으면
   * 그것을 만드는 `t`가 카메라 effect 의존성에 들어가고, 언어를 바꿀 때마다
   * 카메라가 끊겼다 다시 잡힌다. 그 수백 ms 사이에 촬영을 누르면
   * `video.videoWidth`가 0이라 0 크기 canvas가 만들어지고 `getImageData`가
   * 예외를 던진다 — 에러 경계가 없어 화면이 흰색이 된다.
   *
   * 사유 키만 들고 있으면 그 연쇄가 통째로 사라진다.
   */
  test('t가 바뀌어도 getUserMedia를 다시 부르지 않는다', async () => {
    const view = render(
      <PhotoCapture onCapture={vi.fn()} onBack={vi.fn()} t={UI_TEXT.ko} />,
    )

    await waitFor(() => expect(shootButton().disabled).toBe(false))
    expect(getUserMedia).toHaveBeenCalledTimes(1)

    view.rerender(
      <PhotoCapture onCapture={vi.fn()} onBack={vi.fn()} t={UI_TEXT.en} />,
    )

    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(stop).not.toHaveBeenCalled()
    // 카메라가 살아 있으니 촬영 버튼도 잠기지 않는다
    expect(screen.getByRole('button', { name: 'Take photo' }).hasAttribute('disabled')).toBe(
      false,
    )
  })

  test('이미 떠 있는 실패 문구도 언어를 따라간다', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))

    const view = render(
      <PhotoCapture onCapture={vi.fn()} onBack={vi.fn()} t={UI_TEXT.ko} />,
    )

    await screen.findByText(UI_TEXT.ko.capture.cameraFailed)

    view.rerender(
      <PhotoCapture onCapture={vi.fn()} onBack={vi.fn()} t={UI_TEXT.en} />,
    )

    expect(screen.getByText(UI_TEXT.en.capture.cameraFailed)).toBeTruthy()
    expect(screen.queryByText(UI_TEXT.ko.capture.cameraFailed)).toBeNull()
  })

  test('카메라가 끊기면 촬영 버튼도 함께 잠긴다', async () => {
    const { onCapture } = renderScreen()

    await waitFor(() => expect(shootButton().disabled).toBe(false))

    const video = document.querySelector('video')

    if (video === null) {
      throw new Error('미리보기 video를 찾지 못했다')
    }

    Object.defineProperty(video, 'videoWidth', { value: 1440, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true })

    fireEvent.click(shootButton())

    expect(onCapture).toHaveBeenCalledTimes(1)
    expect(shootButton().disabled).toBe(true)
  })

  test('영상 크기가 0이면 찍지 않고 문구를 띄운다 — 0 크기 canvas를 만들지 않는다', async () => {
    const { onCapture } = renderScreen()

    await waitFor(() => expect(shootButton().disabled).toBe(false))

    // 카메라를 다시 잡는 중이면 이 값이 0이다
    const video = document.querySelector('video')
    Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 0, configurable: true })

    fireEvent.click(shootButton())

    expect(onCapture).not.toHaveBeenCalled()
    expect(screen.getByText(UI_TEXT.ko.capture.shootFailed)).toBeTruthy()
  })
})

describe('되돌아가는 통로', () => {
  test('뒤로 버튼이 호출자에게 알린다', () => {
    const { onBack } = renderScreen()

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
