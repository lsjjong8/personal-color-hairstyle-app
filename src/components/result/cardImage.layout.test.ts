import { describe, expect, test } from 'vitest'
import { FACE_SHAPE_GUIDE } from '../../core/guide/faceShapeGuide'
import { TONE_GUIDE } from '../../core/guide/toneGuide'
import type { FaceShape, Tone12 } from '../../core/types'
import { FACE_SHAPE_LABEL, TONE12_LABEL } from '../../i18n/labels'
import { SUPPORTED_LOCALES, type Locale } from '../../i18n/locale'
import { cardNotice, UI_TEXT } from '../../i18n/uiText'
import {
  drawResultCard,
  layoutCard,
  wrapText,
  type CardContent,
  type CardLayout,
  type Measure,
} from './cardImage'

/**
 * 결과 카드 배치 검증 — 그리기가 아니라 **계산**을 잰다.
 *
 * canvas 2D는 jsdom에 없어 `drawResultCard`를 그대로는 부를 수 없다. 그래서
 * 폭 측정을 주입으로 빼고(`Measure`) 여기서는 대체 측정기로 node 환경에서 돈다
 * (ADR-008 §검증). 실제 글꼴에서의 줄나눔은 이 테스트가 보증하지 못한다 —
 * 그 확인은 실기기 렌더에서 한다.
 */

/**
 * 대체 측정기 — 설계 판정문 §6이 세로 예산을 잴 때 쓴 자폭 가정 그대로다.
 * 한글 1.00em · 공백과 가운뎃점 0.30em · 그 밖 0.55em.
 */
function approxMeasure(scale = 1): Measure {
  return (text, font) => {
    const size = Number(/(\d+)px/.exec(font)?.[1] ?? '16')
    let em = 0

    for (const char of text) {
      if (char >= '가' && char <= '힣') {
        em += 1
      } else if (char === ' ' || char === '·') {
        em += 0.3
      } else {
        em += 0.55
      }
    }

    return em * size * scale
  }
}

const measure = approxMeasure()

function contentFor(tone: Tone12, face: FaceShape, locale: Locale = 'ko'): CardContent {
  const guide = TONE_GUIDE[locale][tone]
  const text = UI_TEXT[locale]

  return {
    header: text.card.header,
    tone12: TONE12_LABEL[locale][tone],
    toneOneLiner: guide.oneLiner,
    sections: {
      palette: text.result.sectionPalette,
      hairColors: text.result.sectionHairColors,
      faceShape: `${text.result.faceShapePrefix} \u00b7 ${FACE_SHAPE_LABEL[locale][face]}`,
    },
    palette: guide.palette,
    hairColors: guide.hairColors,
    cutTips: FACE_SHAPE_GUIDE[locale][face].cutTips,
    notice: cardNotice(text),
  }
}

const TONES = Object.keys(TONE_GUIDE.ko) as Tone12[]
const FACES = Object.keys(FACE_SHAPE_GUIDE.ko) as FaceShape[]
const COMBOS = TONES.flatMap((tone) => FACES.map((face) => [tone, face] as const))

/** 폭 예산을 가장 크게 넘는 블록의 초과분 — 0이면 전부 예산 안 */
function widestOverflow(layout: CardLayout): number {
  return Math.max(0, ...layout.blocks.map((block) => block.width - block.maxWidth))
}

describe('실데이터 60조합 — 게이트가 정상 입력을 통과시킨다', () => {
  test('조합 수가 12타입 × 얼굴형 5개 = 60이다', () => {
    expect(COMBOS).toHaveLength(60)
  })

  test.each(COMBOS)('%s · %s — 넘치지 않고 축약도 없다', (tone, face) => {
    const layout = layoutCard(contentFor(tone, face), measure)

    expect(layout.overflowPx).toBe(0)
    expect(layout.reductions).toEqual([])
    expect(layout.bodyBottomY).toBeLessThanOrEqual(layout.dividerY)
    expect(widestOverflow(layout)).toBe(0)
  })

  test.each(COMBOS)('%s · %s — 컷 제안이 하나도 빠지지 않고 실린다', (tone, face) => {
    const layout = layoutCard(contentFor(tone, face), measure)
    const rendered = layout.blocks
      .filter((block) => block.role === 'cutTip')
      .map((block) => block.text)
      .join('')

    for (const tip of FACE_SHAPE_GUIDE.ko[face].cutTips) {
      // 줄나눔으로 쪼개지므로 공백을 지운 뒤 포함 관계로 본다
      expect(rendered.replace(/[\s·]/g, '')).toContain(tip.replace(/[\s·]/g, ''))
    }
  })

  test('가장 빠듯한 조합의 세로 여유가 108px이다 — 설계 실측값', () => {
    const slacks = COMBOS.map((combo) => {
      const layout = layoutCard(contentFor(...combo), measure)
      return layout.dividerY - layout.bodyBottomY
    })

    // 이 값이 움직이면 카드 기하가 바뀐 것이다. 영문이 이 여유를 먹는다
    expect(Math.min(...slacks)).toBe(108)
  })
})

describe('넘침 검출 — 세 가지 모양의 과장 입력', () => {
  /**
   * 반증 입력 하나는 그 모양 하나만 덮는다. 길어지는 방식이 세 가지라 셋 다 넣는다
   * (판정문 §8).
   */
  const base = contentFor('봄 라이트', '둥근형')

  const 긴단어하나: CardContent = {
    ...base,
    toneOneLiner: 'Supercalifragilisticexpialidocious'.repeat(12),
  }

  const 긴문장: CardContent = {
    ...base,
    toneOneLiner: '밝고 화사한 색이 얼굴을 환하게 살려 주는 타입입니다 '.repeat(6),
  }

  const 항목많음: CardContent = {
    ...base,
    cutTips: Array.from(
      { length: 20 },
      (_, index) => `${index + 1}번 제안 — 정수리 볼륨을 살린 레이어드 컷을 권합니다`,
    ),
  }

  const 과장입력: Array<[string, CardContent]> = [
    ['아주 긴 단어 하나', 긴단어하나],
    ['긴 문장', 긴문장],
    ['항목 수가 많음', 항목많음],
  ]

  test.each(과장입력)('%s — 조용히 겹치지 않고 축약이 발동한다', (_label, content) => {
    expect(layoutCard(content, measure).reductions.length).toBeGreaterThan(0)
  })

  test.each(과장입력)('%s — 폭 예산을 넘는 블록이 없다', (_label, content) => {
    expect(widestOverflow(layoutCard(content, measure))).toBe(0)
  })

  test('축약으로도 못 담으면 넘침을 0으로 속이지 않고 값으로 돌려준다', () => {
    // 사다리 끝(컷 제안 2개·한 줄 요약 1줄·본문 30px)에서도 남도록,
    // 개수가 아니라 **한 항목의 길이**로 넘긴다
    const 극단: CardContent = {
      ...base,
      cutTips: Array.from(
        { length: 2 },
        (_, index) => `${index + 1}번 제안 — 정수리 볼륨을 살린 레이어드 컷`.repeat(20),
      ),
    }

    const layout = layoutCard(극단, measure)

    expect(layout.overflowPx).toBeGreaterThan(0)
    expect(layout.overflowPx).toBe(layout.bodyBottomY - layout.dividerY)
  })

  test('넘침 값과 실제 겹침이 항상 일치한다 — 한쪽만 맞는 일이 없다', () => {
    for (const content of [base, 긴단어하나, 긴문장, 항목많음]) {
      const layout = layoutCard(content, measure)

      expect(layout.overflowPx).toBe(Math.max(0, layout.bodyBottomY - layout.dividerY))
    }
  })
})

describe('축약 규칙 — 순서가 고정돼 있다', () => {
  const base = contentFor('봄 라이트', '둥근형')

  test('컷 제안은 최소 2개를 남긴다 — 그리고 사다리가 실제로 돌았다', () => {
    const layout = layoutCard(
      {
        ...base,
        cutTips: Array.from({ length: 40 }, (_, index) => `${index + 1}번 제안`),
      },
      measure,
    )

    const tipTexts = new Set(
      layout.blocks.filter((block) => block.role === 'cutTip').map((block) => block.text),
    )

    // 짝 단정 — 축약이 아예 안 일어나 40개가 다 그려져도 통과하는 일이 없게
    expect(layout.reductions).toContain('tips-trimmed')
    expect(layout.overflowPx).toBe(0)
    expect(tipTexts.size).toBeGreaterThanOrEqual(2)
    expect(tipTexts.size).toBeLessThan(40)
  })

  /**
   * 한 줄 요약이 여러 줄이어야 순서를 가를 수 있다. 한 줄짜리를 쓰면
   * `oneliner-ellipsized`가 구조적으로 발동 불가능해, 사다리를 거꾸로 뒤집어도
   * 통과하는 공허한 테스트가 된다.
   */
  const 여러줄요약 = '밝고 화사한 색이 얼굴을 환하게 살려 주는 타입입니다 '.repeat(3)

  test('전제 확인 — 이 입력의 한 줄 요약은 두 줄 이상이다', () => {
    expect(
      wrapText(여러줄요약, 920, '36px sans-serif', measure).length,
    ).toBeGreaterThanOrEqual(2)
  })

  test('컷 제안 축약이 한 줄 요약 축약보다 먼저다', () => {
    const layout = layoutCard(
      {
        ...base,
        toneOneLiner: 여러줄요약,
        cutTips: Array.from(
          { length: 7 },
          (_, index) => `${index + 1}번 제안 — 정수리 볼륨을 살린 레이어드 컷`,
        ),
      },
      measure,
    )

    expect(layout.reductions).toContain('tips-trimmed')
    expect(layout.reductions).not.toContain('oneliner-ellipsized')
  })

  test('컷 제안을 최소치까지 줄이고도 모자라면 그때 한 줄 요약을 말줄임한다', () => {
    const layout = layoutCard(
      {
        ...base,
        toneOneLiner: 여러줄요약,
        cutTips: Array.from(
          { length: 2 },
          (_, index) => `${index + 1}번 제안 — 정수리 볼륨을 살린 레이어드 컷으로`.repeat(4),
        ),
      },
      measure,
    )

    expect(layout.reductions).toContain('oneliner-ellipsized')

    const oneLiner = layout.blocks.filter((block) => block.role === 'oneLiner')

    expect(oneLiner.at(-1)?.text.endsWith('…')).toBe(true)
    // 말줄임표를 붙이고도 폭 예산 안이어야 한다
    expect(layout.widthOverflowPx).toBe(0)
  })

  test('마지막 단은 본문 글자를 32px에서 30px로 낮춘다', () => {
    const layout = layoutCard(
      {
        ...base,
        cutTips: Array.from(
          { length: 2 },
          () => '정수리 볼륨을 살린 레이어드 컷으로 세로 라인을 강조해 보세요'.repeat(7),
        ),
      },
      measure,
    )

    expect(layout.reductions).toContain('body-font-reduced')
    expect(layout.blocks.find((block) => block.role === 'cutTip')?.font).toContain('30px')
  })

  test('카드 크기는 어떤 축약에서도 1080×1350 그대로다', () => {
    const layout = layoutCard(
      { ...base, cutTips: Array.from({ length: 120 }, (_, i) => `${i}번 제안`) },
      measure,
    )

    expect(layout.width).toBe(1080)
    expect(layout.height).toBe(1350)
  })
})

describe('모든 글자가 layoutCard를 거친다', () => {
  const layout = layoutCard(contentFor('봄 라이트', '둥근형'), measure)
  const roles = layout.blocks.map((block) => block.role)

  test.each([
    ['머리글', 'header'],
    ['타입 이름', 'tone12'],
    ['한 줄 요약', 'oneLiner'],
    ['섹션 제목', 'sectionTitle'],
    ['스와치 이름', 'swatchName'],
    ['컷 제안', 'cutTip'],
    ['푸터 고지', 'notice'],
  ])('%s이 블록으로 나온다', (_label, role) => {
    expect(roles).toContain(role)
  })

  test('섹션 제목은 세 개다 — 어울리는 색 · 염색 · 얼굴형', () => {
    expect(roles.filter((role) => role === 'sectionTitle')).toHaveLength(3)
  })

  test('스와치 사각형은 팔레트 4 + 염색 3 = 7개다', () => {
    expect(layout.swatches).toHaveLength(7)
  })
})

describe('푸터 고지가 두 줄이 되면 푸터 선이 그만큼 올라간다', () => {
  const content = contentFor('봄 라이트', '계란형')

  test('한 줄일 때 구분선은 카드 아래에서 110px', () => {
    const layout = layoutCard(content, measure)

    expect(layout.blocks.filter((block) => block.role === 'notice')).toHaveLength(1)
    expect(layout.dividerY).toBe(1350 - 110)
  })

  test('글자가 넓어져 두 줄이 되면 구분선이 위로 올라간다', () => {
    const layout = layoutCard(content, approxMeasure(1.6))
    const notices = layout.blocks.filter((block) => block.role === 'notice')

    expect(notices.length).toBeGreaterThanOrEqual(2)
    expect(layout.dividerY).toBeLessThan(1350 - 110)
    expect(layout.bodyBottomY).toBeLessThanOrEqual(layout.dividerY)
  })
})

describe('좌표 골든 — 한국어 배치가 한 픽셀도 움직이지 않는다', () => {
  /**
   * 이 값들은 배치를 나누기 **전** 코드가 그리던 좌표다. 상수 하나를 건드리면
   * 여기서 잡힌다 — 넘침 단언만으로는 좌표가 통째로 밀려도 통과한다.
   */
  const layout = layoutCard(contentFor('봄 라이트', '둥근형'), measure)
  const at = (role: string) =>
    layout.blocks.filter((block) => block.role === role).map((block) => block.y)

  test.each([
    ['머리글', 'header', [110]],
    ['타입 이름', 'tone12', [225]],
    ['한 줄 요약', 'oneLiner', [295]],
    ['섹션 제목', 'sectionTitle', [383, 635, 887]],
    ['스와치 이름', 'swatchName', [583, 583, 583, 583, 835, 835, 835]],
    ['컷 제안', 'cutTip', [937, 981, 1031, 1075, 1125]],
    ['푸터 고지', 'notice', [1290]],
  ])('%s의 베이스라인', (_label, role, expected) => {
    expect(at(role)).toEqual(expected)
  })

  test('스와치 사각형의 위치와 크기', () => {
    // 3의 나눗셈이 들어가 부동소수 끝자리가 흔들린다 — 소수 3자리로 고정한다
    const round = (value: number) => Math.round(value * 1000) / 1000

    expect(
      layout.swatches.map((s) => [round(s.x), s.y, round(s.width), s.height]),
    ).toEqual([
      [80, 411, 206, 130],
      [318, 411, 206, 130],
      [556, 411, 206, 130],
      [794, 411, 206, 130],
      [80, 663, 285.333, 130],
      [397.333, 663, 285.333, 130],
      [714.667, 663, 285.333, 130],
    ])
  })

  test('구분선과 본문 바닥', () => {
    expect(layout.dividerY).toBe(1240)
    expect(layout.bodyBottomY).toBe(1132)
  })
})

describe('그리기는 배치가 정한 것만 옮긴다', () => {
  /** fillText 호출을 세는 대역 canvas — canvas 2D 없이 node에서 돈다 */
  function recordingCanvas() {
    const texts: Array<{ text: string; x: number; y: number; maxWidth?: number }> = []
    const context = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: 'left',
      fillRect: () => {},
      beginPath: () => {},
      roundRect: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      measureText: (text: string) => ({ width: measure(text, context.font) }),
      fillText: (text: string, x: number, y: number, maxWidth?: number) => {
        texts.push({ text, x, y, maxWidth })
      },
    }

    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    return { canvas, texts }
  }

  test('블록 수만큼만 글자를 그린다 — 몰래 끼워 넣은 fillText가 없다', () => {
    const { canvas, texts } = recordingCanvas()
    const layout = drawResultCard(canvas, contentFor('봄 라이트', '둥근형'))

    expect(texts).toHaveLength(layout.blocks.length)
    expect(texts.map((t) => t.text)).toEqual(layout.blocks.map((b) => b.text))
  })

  test('폭 예산 안인 글자에는 가로 압축을 걸지 않는다', () => {
    const { canvas, texts } = recordingCanvas()
    drawResultCard(canvas, contentFor('봄 라이트', '둥근형'))

    expect(texts.every((t) => t.maxWidth === undefined)).toBe(true)
  })

  test('칸을 넘는 이름은 압축이 아니라 두 줄과 말줄임으로 담는다', () => {
    const { canvas, texts } = recordingCanvas()
    const content = contentFor('봄 라이트', '둥근형')
    const 긴이름 = '아주아주아주아주아주긴색이름입니다'

    const layout = drawResultCard(canvas, {
      ...content,
      palette: [{ ...content.palette[0], name: 긴이름 }, ...content.palette.slice(1)],
    })

    // 원문 그대로 그려진 블록은 없다 — 나뉘었거나 말줄임됐다
    expect(texts.find((t) => t.text === 긴이름)).toBeUndefined()
    expect(layout.widthOverflowPx).toBe(0)
    expect(texts.every((t) => t.maxWidth === undefined)).toBe(true)
  })

  /**
   * 그래도 가로 압축 경로는 남겨 둔다 — 한 글자가 칸보다 넓으면 더 쪼갤 수
   * 없어 배치가 맞출 수 없다. 겹쳐 그리는 것보다는 압축이 낫다.
   */
  test('한 글자가 예산보다 넓으면 그때만 가로 압축을 건다', () => {
    const texts: Array<{ text: string; maxWidth?: number }> = []
    const wide = approxMeasure(11)
    const context = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: 'left',
      fillRect: () => {},
      beginPath: () => {},
      roundRect: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      measureText: (text: string) => ({ width: wide(text, context.font) }),
      fillText: (text: string, _x: number, _y: number, maxWidth?: number) => {
        texts.push({ text, maxWidth })
      },
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const layout = drawResultCard(canvas, contentFor('봄 라이트', '둥근형'))

    expect(layout.widthOverflowPx).toBeGreaterThan(0)
    expect(texts.some((t) => t.maxWidth !== undefined)).toBe(true)
  })

  test('배치를 그대로 돌려준다 — 계산해 놓고 버리지 않는다', () => {
    const { canvas } = recordingCanvas()
    const layout = drawResultCard(canvas, contentFor('봄 라이트', '둥근형'))

    expect(layout.overflowPx).toBe(0)
    expect(layout.widthOverflowPx).toBe(0)
    expect(layout.reductions).toEqual([])
  })
})

describe('가로 넘침도 값으로 알린다', () => {
  test('실데이터 60조합에서는 0이다', () => {
    for (const combo of COMBOS) {
      expect(layoutCard(contentFor(...combo), measure).widthOverflowPx).toBe(0)
    }
  })

  test('한 글자도 예산에 안 들어가면 0이 아니다', () => {
    // 글자가 11배 넓으면 타입 이름 한 글자(92px)가 카드 폭 920px를 넘는다.
    // 더 쪼갤 수 없어 배치가 맞출 수 없는 유일한 경우다.
    const layout = layoutCard(contentFor('봄 라이트', '둥근형'), approxMeasure(11))

    expect(layout.widthOverflowPx).toBeGreaterThan(0)
    expect(layout.widthOverflowPx).toBe(widestOverflow(layout))
  })

  test('가로와 세로는 서로 다른 값을 잰다 — 한 값을 다른 쪽에 쓰지 않는다', () => {
    const layout = layoutCard(contentFor('봄 라이트', '둥근형'), approxMeasure(11))

    // 이 극단 입력에서는 둘 다 넘치지만 값이 같지 않다
    expect(layout.widthOverflowPx).not.toBe(layout.overflowPx)
  })

  test('보고 값이 블록 실측과 일치한다', () => {
    const layout = layoutCard(contentFor('봄 라이트', '둥근형'), measure)

    expect(layout.widthOverflowPx).toBe(widestOverflow(layout))
  })
})

describe('wrapText — 줄나눔이 폭을 실제로 지킨다', () => {
  const font = '32px sans-serif'
  const text = '정수리 볼륨을 살린 레이어드 컷으로 세로 라인을 강조해 보세요'

  test('나눈 각 줄이 최대 폭 안에 들어간다', () => {
    for (const line of wrapText(text, 400, font, measure)) {
      expect(measure(line, font)).toBeLessThanOrEqual(400)
    }
  })

  test('나누지 않으면 그 폭을 넘는다 — 검사가 통과하는 이유가 줄나눔이다', () => {
    expect(measure(text, font)).toBeGreaterThan(400)
  })

  test('빈 문자열은 빈 배열이다', () => {
    expect(wrapText('', 400, font, measure)).toEqual([])
  })

  /**
   * 알려진 한계 — 한 글자가 최대 폭보다 넓으면 더 쪼갤 수 없어 그대로 남는다.
   * 지금 쓰는 폭에서는 도달하지 않지만, 좁은 칸에 이 함수를 쓰면 즉시 발현한다.
   * 고치지 않고 **적어 둔다** — 모르고 좁은 칸에 쓰는 것을 막으려는 것이다.
   */
  test('한 글자가 최대 폭보다 넓으면 그 줄은 폭을 넘긴 채 남는다', () => {
    const lines = wrapText('가나다', 10, font, measure)

    expect(lines).toEqual(['가', '나', '다'])
    expect(measure('가', font)).toBeGreaterThan(10)
  })

  test('실제로 쓰는 폭에서는 그 한계에 닿지 않는다', () => {
    // 가장 큰 글꼴(타입 이름 92px)의 한 글자도 카드 폭 920px 안이다
    expect(measure('겨', `700 92px ${'sans-serif'}`)).toBeLessThan(920)
  })
})

describe('wrapText — 로케일이 규칙을 가른다', () => {
  const font = '32px sans-serif'
  const english = 'Keep side volume restrained and let the hair fall along the jaw'

  test('영문은 단어 중간에서 끊지 않는다', () => {
    const lines = wrapText(english, 400, font, measure, 'en')

    expect(lines.length).toBeGreaterThan(1)

    for (const line of lines) {
      for (const word of line.split(' ')) {
        // 쪼개진 조각이 아니라 원문에 그대로 있는 단어여야 한다
        expect(english.split(' ')).toContain(word)
      }
    }
  })

  test('한국어 규칙을 영문에 쓰면 단어가 잘린다 — 로케일로 가르는 이유', () => {
    const korean = wrapText(english, 400, font, measure, 'ko')
    const words = new Set(english.split(' '))
    const broken = korean
      .flatMap((line) => line.split(' '))
      .filter((part) => part.length > 0 && !words.has(part))

    expect(broken.length).toBeGreaterThan(0)
  })

  test('한국어 동작은 그대로다 — 로케일을 생략하면 기존 규칙', () => {
    const text = '정수리 볼륨을 살린 레이어드 컷으로 세로 라인을 강조해 보세요'

    expect(wrapText(text, 400, font, measure)).toEqual(
      wrapText(text, 400, font, measure, 'ko'),
    )
  })

  test('한 단어가 줄보다 길면 그 단어만 글자 단위로 내려간다', () => {
    const lines = wrapText('Supercalifragilisticexpialidocious ok', 200, font, measure, 'en')

    expect(lines.length).toBeGreaterThan(1)
    expect(lines.at(-1)).toContain('ok')
  })
})

describe('영문 실데이터 — 번역문이 카드를 넘치지 않는다', () => {
  test('지원 언어가 둘이다', () => {
    expect(SUPPORTED_LOCALES).toEqual(['ko', 'en'])
  })

  test.each(COMBOS)('en · %s · %s — 세로·가로 모두 예산 안', (tone, face) => {
    const layout = layoutCard(contentFor(tone, face, 'en'), measure, 'en')

    expect(layout.overflowPx).toBe(0)
    expect(layout.widthOverflowPx).toBe(0)
    expect(widestOverflow(layout)).toBe(0)
  })

  test.each(COMBOS)('en · %s · %s — 단어 중간 분절이 없다', (tone, face) => {
    const content = contentFor(tone, face, 'en')
    const layout = layoutCard(content, measure, 'en')
    const source = new Set(
      [content.toneOneLiner, ...content.cutTips, content.notice, content.header]
        .join(' ')
        .split(/[\s·]+/)
        .filter((word) => word.length > 0),
    )

    for (const block of layout.blocks) {
      if (block.role !== 'cutTip' && block.role !== 'oneLiner') {
        continue
      }

      for (const word of block.text.split(/[\s·]+/).filter((w) => w.length > 0)) {
        expect(source, `${block.role}: ${block.text}`).toContain(word)
      }
    }
  })

  /**
   * ⚠ **대체 측정기 기준이다.** 실제 글꼴(2026-09-29 브라우저 실측)에서는 영문
   * 고지가 한 줄에 들어간다 — 이 측정기가 라틴 글자를 실제보다 넓게 잡기
   * 때문이다. 여기서 재는 것은 "영문이 두 줄이다"가 아니라 **"두 줄이 되면
   * 예산이 따라 움직인다"**는 동작이고, 보수적인 쪽이라 게이트로는 안전하다.
   */
  test('고지가 두 줄이 되면 푸터 선이 그만큼 올라간다 (대체 측정기 기준)', () => {
    const layout = layoutCard(contentFor('봄 라이트', '계란형', 'en'), measure, 'en')
    const notices = layout.blocks.filter((block) => block.role === 'notice')

    expect(notices.length).toBeGreaterThanOrEqual(2)
    expect(layout.dividerY).toBeLessThan(1350 - 110)
    expect(layout.bodyBottomY).toBeLessThanOrEqual(layout.dividerY)
  })

  /**
   * ★한국어에는 최소 여유를 못 박아 둔 단언이 있는데(108px) **정작 빠듯한 쪽인
   * 영문에는 없었다.** 넘침 단언만으로는 여유가 한 줄 밑으로 깎여도 통과한다 —
   * 예정된 원어민 검토가 문장을 늘리는 방향이라 그 구간이 가장 위험하다.
   *
   * 이 값이 줄면 **본문 한 줄(44px)을 더할 여지가 없다**는 신호다.
   */
  test('가장 빠듯한 영문 조합의 세로 여유를 못 박는다', () => {
    const slacks = COMBOS.map((combo) => {
      const layout = layoutCard(contentFor(...combo, 'en'), measure, 'en')
      return layout.dividerY - layout.bodyBottomY
    })

    const min = Math.min(...slacks)

    expect(min).toBe(30)
    // 이 측정기 기준으로는 본문 한 줄(44px)을 더할 여지가 없다.
    // 실제 글꼴에서는 108px였다 — 이 측정기가 라틴 글자를 넓게 잡아
    // **안전한 쪽으로 틀려 있다.** 그래도 여기서 줄어들면 실물도 함께 줄어든다.
    expect(min).toBeLessThan(44)
  })

  test('영문에서도 축약 없이 담긴다 — 60조합 전부', () => {
    const reduced = COMBOS.filter(
      (combo) => layoutCard(contentFor(...combo, 'en'), measure, 'en').reductions.length > 0,
    )

    expect(reduced).toEqual([])
  })
})

describe('스와치 이름이 칸을 넘으면 두 줄로 내린다', () => {
  const content = contentFor('봄 라이트', '계란형')

  test('한국어 이름은 한 줄에 들어간다 — 글꼴이 그대로다', () => {
    const layout = layoutCard(content, measure)

    for (const block of layout.blocks.filter((b) => b.role === 'swatchName')) {
      expect(block.font).toContain('28px')
    }
  })

  test('칸을 넘는 이름은 글꼴을 낮추고 두 줄까지 쓴다', () => {
    const layout = layoutCard(
      {
        ...content,
        palette: [
          { ...content.palette[0], name: '아주 길고 긴 색 이름 하나' },
          ...content.palette.slice(1),
        ],
      },
      measure,
    )

    const lines = layout.blocks.filter(
      (block) => block.role === 'swatchName' && block.font.includes('26px'),
    )

    expect(lines.length).toBe(2)
    expect(lines.map((line) => line.text).join('')).toContain('아주')
  })

  test('두 줄이 되면 아래 내용이 그만큼 밀린다 — 겹치지 않는다', () => {
    const wide = layoutCard(
      {
        ...content,
        palette: [
          { ...content.palette[0], name: '아주 길고 긴 색 이름 하나' },
          ...content.palette.slice(1),
        ],
      },
      measure,
    )
    const plain = layoutCard(content, measure)

    const firstTitle = (layout: typeof plain) =>
      layout.blocks.filter((block) => block.role === 'sectionTitle')[1]?.y ?? 0

    expect(firstTitle(wide)).toBeGreaterThan(firstTitle(plain))
    expect(wide.overflowPx).toBe(0)
  })
})
