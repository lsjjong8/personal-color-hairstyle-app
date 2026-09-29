// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { UI_TEXT } from '../i18n/uiText'
import { LanguageToggle } from './LanguageToggle'

/**
 * 언어 전환 버튼 — 이 기능의 **유일한 조작 수단**이다.
 *
 * 그래서 두 가지를 함께 잰다: 눌렀을 때 맞는 언어로 가는가, 그리고
 * **음성 제어와 화면 낭독기가 이 버튼에 닿을 수 있는가.** 닿지 못하면
 * 그 사용자에게는 언어를 바꿀 방법이 아예 없다.
 */

describe('무엇을 보여 주는가', () => {
  test('현재 언어가 아니라 갈 곳의 언어를 적는다', () => {
    render(<LanguageToggle locale="ko" onChange={vi.fn()} t={UI_TEXT.ko} />)

    expect(screen.getByRole('button').textContent).toBe('English')
  })

  test('영문 화면에서는 한국어로 가는 버튼이다', () => {
    render(<LanguageToggle locale="en" onChange={vi.fn()} t={UI_TEXT.en} />)

    expect(screen.getByRole('button').textContent).toBe('한국어')
  })
})

describe('누르면', () => {
  test('ko에서는 en을 넘긴다', () => {
    const onChange = vi.fn()
    render(<LanguageToggle locale="ko" onChange={onChange} t={UI_TEXT.ko} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onChange).toHaveBeenCalledWith('en')
  })

  test('en에서는 ko를 넘긴다', () => {
    const onChange = vi.fn()
    render(<LanguageToggle locale="en" onChange={onChange} t={UI_TEXT.en} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onChange).toHaveBeenCalledWith('ko')
  })

  test('그리기만으로는 부르지 않는다', () => {
    const onChange = vi.fn()
    render(<LanguageToggle locale="ko" onChange={onChange} t={UI_TEXT.ko} />)

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('닿을 수 있는가', () => {
  /**
   * WCAG 2.5.3 Label in Name — 접근성 이름에 보이는 글자가 들어 있어야
   * 음성 제어 사용자가 "English 클릭"으로 누를 수 있다.
   */
  test('접근성 이름이 보이는 글자를 포함한다', () => {
    render(<LanguageToggle locale="ko" onChange={vi.fn()} t={UI_TEXT.ko} />)

    const button = screen.getByRole('button')
    const name = button.getAttribute('aria-label') ?? ''

    expect(name).toContain(button.textContent ?? '')
  })

  test('버튼 글자에 그 글자의 언어를 표시한다 — 낭독 발음이 여기 달려 있다', () => {
    render(<LanguageToggle locale="ko" onChange={vi.fn()} t={UI_TEXT.ko} />)

    // 한국어 화면의 버튼 글자는 "English"이므로 en으로 읽혀야 한다
    expect(screen.getByRole('button').getAttribute('lang')).toBe('en')
  })

  test('영문 화면에서는 반대다', () => {
    render(<LanguageToggle locale="en" onChange={vi.fn()} t={UI_TEXT.en} />)

    expect(screen.getByRole('button').getAttribute('lang')).toBe('ko')
  })
})
