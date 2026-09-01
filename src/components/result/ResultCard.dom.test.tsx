// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultCard } from './ResultCard'
import type { AnalysisSuccess } from '../../core/types'

/**
 * 판정 근거 표시 검증 — 조명 보정 두 줄이 실제로 화면에 나오는지.
 *
 * 이 테스트가 지키는 것은 **동료가 읽어 보낼 값이 화면에 있다**는 사실이다.
 * 재보정에 필요한 값(기준 밝기)과 표본을 걸러낼 표시(보정 적용 여부)는
 * 코어가 계산해도 화면에 없으면 수집되지 않는다 — 그 사이가 끊어지면
 * 코어 테스트는 전부 통과하면서 목적만 조용히 사라진다.
 *
 * 카드 PNG 렌더(canvas)는 저장 버튼을 눌렀을 때만 도는 경로라 여기서 타지 않는다.
 *
 * **jsdom은 접힘 상태를 모델링하지 않는다.** 닫힌 `<details>` 안의 글자도
 * 그대로 잡히므로, 이 테스트는 "펼치는 경로가 살아 있고 값이 올바르게 붙어
 * 있다"까지만 증명한다. 실제 폰에서 가려지지 않는지는 실기기 확인의 몫이다.
 */

function result(lighting: AnalysisSuccess['lighting']): AnalysisSuccess {
  return {
    ok: true,
    personalColor: {
      tone12: '봄 웜',
      season: '봄',
      undertone: 'warm',
      evidence: {
        skinLab: { l: 66.2, a: 12.1, b: 18.4 },
        hue: 56.7,
        chroma: 22.0,
        ita: 41.3,
      },
    },
    faceShape: {
      shape: '계란형',
      evidence: { lengthRatio: 1.42, jawToForehead: 0.85, jawToCheekbone: 0.8 },
    },
    lighting,
  }
}

/**
 * 라벨 옆에 붙은 값을 읽는다.
 *
 * "각각 화면 어딘가에 있다"가 아니라 **"이 라벨의 값이 이것이다"**를 확인한다.
 * 두 값이 서로 뒤바뀌어도 존재 여부만 보는 단언은 통과하는데, 스크린 리더는
 * 라벨과 값을 붙여 읽으므로 뒤바뀌면 그대로 잘못 읽힌다.
 */
function 근거값(라벨: string): string {
  const dt = screen.getByText(라벨)

  return dt.nextElementSibling?.textContent ?? ''
}

/** 판정 근거는 접혀 있다 — 동료가 실제로 하는 동작대로 펼쳐서 본다 */
function 근거펼치기(): void {
  screen.getByText('판정 근거 보기').click()
}

describe('ResultCard 판정 근거', () => {
  test('보정이 걸린 사진은 적용 표시와 기준 밝기를 보여준다', () => {
    render(<ResultCard result={result({ applied: true, referenceLuma: 225.3, clippedRatio: 0 })} />)
    근거펼치기()

    expect(근거값('조명 보정')).toBe('적용됨')
    expect(근거값('기준 밝기 (0~255)')).toBe('225.3')
    expect(근거값('잘린 픽셀')).toBe('0%')
  })

  test('보정을 건너뛴 사진은 그 사실을 보여준다 — 밝기 자리는 낱말로 채운다', () => {
    render(
      <ResultCard result={result({ applied: false, referenceLuma: null, clippedRatio: 0 })} />,
    )
    근거펼치기()

    expect(근거값('조명 보정')).toBe('건너뜀')
    // 기호(—) 대신 낱말을 쓴다. 기호는 스크린 리더 설정에 따라 읽히지 않고,
    // 옮겨 적을 때도 사람마다 다른 글자로 바뀐다
    expect(근거값('기준 밝기 (0~255)')).toBe('없음')
  })

  test('잘린 사진은 보정이 적용됐어도 그 비율을 보여준다', () => {
    render(
      <ResultCard result={result({ applied: true, referenceLuma: 137.3, clippedRatio: 0.42 })} />,
    )
    근거펼치기()

    // "적용됨"이 곧 "믿을 수 있다"가 아니라는 것이 이 줄의 존재 이유다
    expect(근거값('조명 보정')).toBe('적용됨')
    expect(근거값('잘린 픽셀')).toBe('42%')
  })
})
