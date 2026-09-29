// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { UI_TEXT } from '../../i18n/uiText'
import { Landing } from './Landing'

const t = UI_TEXT.ko

/**
 * 진입 화면 검증 — 이 화면의 일은 **시작 전에 두 가지를 먼저 알리는 것**이다.
 * 포지셔닝(진단이 아니다)과 처리 위치(사진이 나가지 않는다)가 그것이며,
 * 둘 다 빠지면 안 되는 고지라 존재를 단언으로 묶어 둔다.
 */

describe('시작 전에 알리는 것', () => {
  test('사진이 나가지 않는다는 고지가 있다', () => {
    render(<Landing onStart={vi.fn()} t={t} />)

    expect(
      screen.getByRole('heading', { name: '사진은 기기를 떠나지 않습니다' }),
    ).toBeTruthy()
    expect(screen.getByText(/분석은 전부 이 브라우저 안에서 이뤄집니다/)).toBeTruthy()
  })

  test('진단이 아니라 제안이라는 고지가 있다', () => {
    render(<Landing onStart={vi.fn()} t={t} />)

    expect(screen.getByText(/진단이 아닌 재미로 보는 제안입니다/)).toBeTruthy()
  })

  test('조명에 따라 결과가 달라진다는 고지가 있다', () => {
    render(<Landing onStart={vi.fn()} t={t} />)

    expect(
      screen.getByRole('heading', { name: '결과는 조명에 따라 달라집니다' }),
    ).toBeTruthy()
  })

  test('두 고지 영역이 제목과 연결돼 있다 — 화면 낭독기가 묶어 읽는다', () => {
    const { container } = render(<Landing onStart={vi.fn()} t={t} />)
    const notices = container.querySelectorAll('section.notice[aria-labelledby]')

    expect(notices).toHaveLength(2)

    for (const notice of notices) {
      const id = notice.getAttribute('aria-labelledby')

      expect(id).not.toBeNull()
      expect(container.querySelector(`#${id ?? ''}`)).not.toBeNull()
    }
  })
})

describe('시작하기', () => {
  test('누르면 호출자에게 알린다', () => {
    const onStart = vi.fn()
    render(<Landing onStart={onStart} t={t} />)

    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))

    expect(onStart).toHaveBeenCalledTimes(1)
  })

  test('그리기만으로는 시작되지 않는다', () => {
    const onStart = vi.fn()
    render(<Landing onStart={onStart} t={t} />)

    expect(onStart).not.toHaveBeenCalled()
  })
})
