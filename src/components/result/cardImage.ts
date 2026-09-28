import type { ColorSwatch } from '../../core/guide/toneGuide'

/**
 * 결과 카드 PNG 렌더러 — 외부 라이브러리 없이 canvas 2D로 직접 그린다.
 * DOM 캡처 방식(html2canvas 등)은 새 런타임 의존성이 필요해 배제했다.
 * 사진은 카드에 넣지 않는다 — 공유 이미지에 얼굴이 들어가는 것은 v1 범위 밖.
 *
 * **배치와 그리기를 나눠 둔다** (ADR-008 §결과 카드). `layoutCard`가 폭 측정을
 * 주입받아 좌표를 계산하고, `drawResultCard`는 그 결과를 옮겨 그리기만 한다.
 * 나눠 두는 이유 둘:
 *   - 넘침을 **값으로** 알 수 있다. 예전에는 푸터 절대 좌표 위에 본문을 그대로
 *     겹쳐 그렸고 예외도 경고도 없었다.
 *   - canvas 2D가 없는 환경에서도 배치를 검증할 수 있다.
 */

export interface CardContent {
  tone12: string
  toneOneLiner: string
  palette: ColorSwatch[]
  hairColors: ColorSwatch[]
  faceShape: string
  cutTips: string[]
}

/** 4:5 비율 — 모바일 공유에 무난한 크기 */
const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350
const PADDING = 80
/** 좌우 여백을 뺀 글자 영역 — 전폭 블록의 폭 예산 */
const CONTENT_WIDTH = CARD_WIDTH - PADDING * 2

const COLOR_BG = '#fdf8f3'
const COLOR_TEXT = '#241f1c'
const COLOR_MUTED = '#6b615a'
const COLOR_ACCENT = '#b4664a'
const COLOR_LINE = '#e6ded8'

const FONT_FAMILY = "'Pretendard', system-ui, -apple-system, sans-serif"

const FONT_HEADER = `30px ${FONT_FAMILY}`
const FONT_TONE12 = `700 92px ${FONT_FAMILY}`
const FONT_ONE_LINER = `36px ${FONT_FAMILY}`
const FONT_SECTION = `600 34px ${FONT_FAMILY}`
const FONT_SWATCH_NAME = `28px ${FONT_FAMILY}`
const FONT_NOTICE = `26px ${FONT_FAMILY}`
const bodyFont = (size: number): string => `${size}px ${FONT_FAMILY}`

const LINE_HEADER = 38
const LINE_TONE12 = 104
const LINE_ONE_LINER = 48
const LINE_BODY = 44
const LINE_NOTICE = 34

const SWATCH_GAP = 32
const SWATCH_HEIGHT = 130

/** 마지막 글자의 하강부 — 베이스라인 아래로 이 만큼은 잉크가 내려온다 */
const DESCENDER = 7

/** 본문 글자 크기 사다리 — 축약 규칙 3번이 위에서 아래로 내려간다 */
const BODY_FONT_SIZES = [32, 30]

/** 컷 제안은 이 개수 밑으로 줄이지 않는다 (`guide.test.ts`의 불변식과 같은 값) */
const MIN_CUT_TIPS = 2

const HEADER_TEXT = '퍼스널 컬러 · 재미로 보는 제안'
const NOTICE_TEXT = '진단이 아닌 재미로 보는 제안입니다 · 사진은 기기를 떠나지 않습니다'

/** 폭 측정기 — 실제로는 `context.measureText`, 테스트에서는 대체 측정기 */
export type Measure = (text: string, font: string) => number

export type CardBlockRole =
  | 'header'
  | 'tone12'
  | 'oneLiner'
  | 'sectionTitle'
  | 'swatchName'
  | 'cutTip'
  | 'notice'

export interface CardTextBlock {
  role: CardBlockRole
  text: string
  x: number
  /** 베이스라인 */
  y: number
  font: string
  color: string
  align: 'left' | 'center'
  /** 이 블록이 넘지 말아야 할 폭 */
  maxWidth: number
  /** `measure`로 실제로 잰 폭 */
  width: number
}

export interface CardSwatchRect {
  hex: string
  x: number
  y: number
  width: number
  height: number
}

/** 축약 규칙이 실제로 발동했는지 — 조용한 축약을 막기 위해 값으로 남긴다 */
export type CardReduction = 'tips-trimmed' | 'oneliner-ellipsized' | 'body-font-reduced'

export interface CardLayout {
  width: number
  height: number
  background: string
  blocks: CardTextBlock[]
  swatches: CardSwatchRect[]
  /** 푸터 구분선의 y — 고지가 두 줄이면 그만큼 올라간다 */
  dividerY: number
  /** 마지막 본문 글자의 하강부. `dividerY`를 넘으면 푸터와 겹친다 */
  bodyBottomY: number
  /** 세로로 겹친 만큼의 px. 0이면 겹치지 않는다 */
  overflowPx: number
  /**
   * 폭 예산을 가장 크게 넘은 블록의 초과분. 0이면 전부 예산 안이다.
   *
   * 세로와 달리 축약 사다리가 이 값을 줄이지 못한다 — 넘치는 것이 대개
   * 스와치 이름이고 그 칸 너비는 개수로 정해지기 때문이다. 그래서 값으로만
   * 알리고, 그리기 쪽이 마지막 수단으로 가로 압축을 건다.
   */
  widthOverflowPx: number
  reductions: CardReduction[]
}

/**
 * 최대 폭에 맞게 줄을 나눈다 — 한국어는 음절 단위 줄바꿈을 허용한다.
 *
 * 영문 단어 경계 처리는 다국어 단계에서 로케일로 갈라 넣는다. 지금 규칙을
 * 통째로 바꾸면 한국어 줄나눔 위치가 조용히 달라진다.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  font: string,
  measure: Measure,
): string[] {
  const lines: string[] = []
  let current = ''

  for (const char of text) {
    const candidate = current + char

    if (measure(candidate, font) > maxWidth && current.length > 0) {
      lines.push(current)
      current = char === ' ' ? '' : char
    } else {
      current = candidate
    }
  }

  if (current.length > 0) {
    lines.push(current)
  }

  return lines
}

/** 줄 수를 줄이고 마지막 줄을 말줄임표로 맺는다 */
function ellipsize(
  lines: string[],
  maxLines: number,
  font: string,
  maxWidth: number,
  measure: Measure,
): string[] {
  // 0 이하를 받으면 한 줄은 남긴다 — 빈 배열을 돌려주면 문구가 조용히 사라진다
  const keepCount = Math.max(1, maxLines)

  if (lines.length <= keepCount) {
    return lines
  }

  const kept = lines.slice(0, keepCount)
  let last = kept[keepCount - 1] ?? ''

  while (last.length > 0 && measure(`${last}…`, font) > maxWidth) {
    last = last.slice(0, -1)
  }

  kept[keepCount - 1] = `${last}…`

  return kept
}

interface LayoutState {
  tipCount: number
  oneLinerLines: number
  bodySize: number
}

function buildLayout(
  content: CardContent,
  measure: Measure,
  state: LayoutState,
): CardLayout {
  const blocks: CardTextBlock[] = []
  const swatches: CardSwatchRect[] = []

  const push = (
    role: CardBlockRole,
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
    maxWidth: number,
    align: 'left' | 'center' = 'left',
  ): void => {
    blocks.push({ role, text, x, y, font, color, align, maxWidth, width: measure(text, font) })
  }

  // 푸터를 먼저 잡는다 — 고지 줄 수가 본문에 허용되는 세로 예산을 정한다
  const noticeLines = wrapText(NOTICE_TEXT, CONTENT_WIDTH, FONT_NOTICE, measure)
  const lastNoticeBaseline = CARD_HEIGHT - 60
  const firstNoticeBaseline = lastNoticeBaseline - (noticeLines.length - 1) * LINE_NOTICE
  const dividerY = firstNoticeBaseline - 50

  // 머리글
  const headerLines = wrapText(HEADER_TEXT, CONTENT_WIDTH, FONT_HEADER, measure)
  headerLines.forEach((line, index) => {
    push(
      'header',
      line,
      PADDING,
      110 + index * LINE_HEADER,
      FONT_HEADER,
      COLOR_MUTED,
      CONTENT_WIDTH,
    )
  })
  const headerExtra = (headerLines.length - 1) * LINE_HEADER

  // 타입 이름
  const toneLines = wrapText(content.tone12, CONTENT_WIDTH, FONT_TONE12, measure)
  toneLines.forEach((line, index) => {
    push(
      'tone12',
      line,
      PADDING,
      225 + headerExtra + index * LINE_TONE12,
      FONT_TONE12,
      COLOR_TEXT,
      CONTENT_WIDTH,
    )
  })
  const toneExtra = (toneLines.length - 1) * LINE_TONE12

  // 타입 한 줄 설명
  let y = 295 + headerExtra + toneExtra
  const oneLinerAll = wrapText(content.toneOneLiner, CONTENT_WIDTH, FONT_ONE_LINER, measure)
  const oneLinerLines = ellipsize(
    oneLinerAll,
    state.oneLinerLines,
    FONT_ONE_LINER,
    CONTENT_WIDTH,
    measure,
  )

  for (const line of oneLinerLines) {
    push('oneLiner', line, PADDING, y, FONT_ONE_LINER, COLOR_MUTED, CONTENT_WIDTH)
    y += LINE_ONE_LINER
  }

  const section = (title: string, gapAbove: number): number => {
    const baseline = y + gapAbove
    push('sectionTitle', title, PADDING, baseline, FONT_SECTION, COLOR_ACCENT, CONTENT_WIDTH)
    return baseline + 28
  }

  const swatchRow = (row: ColorSwatch[], top: number): number => {
    const size = (CONTENT_WIDTH - SWATCH_GAP * (row.length - 1)) / row.length

    row.forEach((swatch, index) => {
      const left = PADDING + index * (size + SWATCH_GAP)

      swatches.push({ hex: swatch.hex, x: left, y: top, width: size, height: SWATCH_HEIGHT })
      push(
        'swatchName',
        swatch.name,
        left + size / 2,
        top + SWATCH_HEIGHT + 42,
        FONT_SWATCH_NAME,
        COLOR_MUTED,
        size,
        'center',
      )
    })

    return top + SWATCH_HEIGHT + 70
  }

  y = swatchRow(content.palette, section('어울리는 색', 40))
  y = swatchRow(content.hairColors, section('염색해 본다면', 24))

  // 컷 제안이 하나도 없으면 이 제목이 마지막 글자가 된다 — 실재하는 베이스라인을 쥔다
  const faceTitleBaseline = section(`얼굴형 · ${content.faceShape}`, 24) - 28
  y = faceTitleBaseline + 28 + 22

  // 컷 방향 제안
  const font = bodyFont(state.bodySize)
  let lastBodyBaseline = faceTitleBaseline

  for (const tip of content.cutTips.slice(0, state.tipCount)) {
    for (const line of wrapText(`· ${tip}`, CONTENT_WIDTH, font, measure)) {
      push('cutTip', line, PADDING, y, font, COLOR_TEXT, CONTENT_WIDTH)
      lastBodyBaseline = y
      y += LINE_BODY
    }

    y += 6
  }

  // 푸터 고지
  noticeLines.forEach((line, index) => {
    push(
      'notice',
      line,
      PADDING,
      firstNoticeBaseline + index * LINE_NOTICE,
      FONT_NOTICE,
      COLOR_MUTED,
      CONTENT_WIDTH,
    )
  })

  const bodyBottomY = lastBodyBaseline + DESCENDER
  const reductions: CardReduction[] = []

  if (state.tipCount < content.cutTips.length) {
    reductions.push('tips-trimmed')
  }

  if (oneLinerLines.length < oneLinerAll.length) {
    reductions.push('oneliner-ellipsized')
  }

  if (state.bodySize < BODY_FONT_SIZES[0]) {
    reductions.push('body-font-reduced')
  }

  return {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    background: COLOR_BG,
    blocks,
    swatches,
    dividerY,
    bodyBottomY,
    overflowPx: Math.max(0, bodyBottomY - dividerY),
    widthOverflowPx: Math.max(0, ...blocks.map((block) => block.width - block.maxWidth)),
    reductions,
  }
}

/**
 * 카드 배치를 계산한다. 넘치면 정해진 순서로 축약하고, 그래도 남으면
 * `overflowPx`로 알린다 — 조용히 겹쳐 그리지 않는다.
 *
 * 축약 순서(ADR-008): ①컷 제안을 뒤에서부터(최소 2개는 남긴다) ②한 줄 요약을
 * 말줄임 ③본문 글자 한 단 축소. 카드 크기 1080×1350은 건드리지 않는다 —
 * 4:5가 공유 플랫폼 전제다.
 */
export function layoutCard(content: CardContent, measure: Measure): CardLayout {
  const fullTips = content.cutTips.length
  const minTips = Math.min(MIN_CUT_TIPS, fullTips)
  const fullOneLinerLines = Math.max(
    1,
    wrapText(content.toneOneLiner, CONTENT_WIDTH, FONT_ONE_LINER, measure).length,
  )

  const ladder: LayoutState[] = []

  for (let tips = fullTips; tips >= minTips; tips -= 1) {
    ladder.push({
      tipCount: tips,
      oneLinerLines: fullOneLinerLines,
      bodySize: BODY_FONT_SIZES[0],
    })
  }

  for (let lines = fullOneLinerLines - 1; lines >= 1; lines -= 1) {
    ladder.push({ tipCount: minTips, oneLinerLines: lines, bodySize: BODY_FONT_SIZES[0] })
  }

  for (const size of BODY_FONT_SIZES.slice(1)) {
    ladder.push({ tipCount: minTips, oneLinerLines: 1, bodySize: size })
  }

  let layout: CardLayout | null = null

  for (const state of ladder) {
    layout = buildLayout(content, measure, state)

    if (layout.overflowPx === 0) {
      return layout
    }
  }

  // 사다리 끝까지 갔는데도 넘친다 — 가장 줄인 배치를 넘침 값과 함께 돌려준다.
  // `ladder`는 항상 한 칸 이상이라 `layout`이 null로 남지 않는다.
  return layout ?? buildLayout(content, measure, ladder[0])
}

/** 계산된 배치를 canvas에 옮겨 그린다 — 여기에는 판단이 없다 */
function paint(context: CanvasRenderingContext2D, layout: CardLayout): void {
  context.fillStyle = layout.background
  context.fillRect(0, 0, layout.width, layout.height)

  for (const swatch of layout.swatches) {
    context.fillStyle = swatch.hex
    context.strokeStyle = COLOR_LINE
    context.lineWidth = 2
    context.beginPath()
    context.roundRect(swatch.x, swatch.y, swatch.width, swatch.height, 18)
    context.fill()
    context.stroke()
  }

  context.strokeStyle = COLOR_LINE
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(PADDING, layout.dividerY)
  context.lineTo(CARD_WIDTH - PADDING, layout.dividerY)
  context.stroke()

  for (const block of layout.blocks) {
    context.fillStyle = block.color
    context.font = block.font
    context.textAlign = block.align

    /**
     * 평소에는 `maxWidth`를 넘기지 않는다 — 배치가 이미 폭에 맞췄으므로
     * 가로 압축에 기대지 않는다. 다만 **배치가 맞추지 못한 블록**(칸 너비가
     * 개수로 정해지는 스와치 이름)에는 마지막 수단으로 걸어 둔다. 없으면
     * 옆 칸 글자와 겹쳐 그려지고, 겹침은 압축보다 나쁘다.
     */
    if (block.width > block.maxWidth) {
      context.fillText(block.text, block.x, block.y, block.maxWidth)
    } else {
      context.fillText(block.text, block.x, block.y)
    }
  }

  context.textAlign = 'left'
}

/**
 * 결과 카드를 canvas에 그린다 — 호출자가 canvas를 만들어 넘긴다.
 *
 * 쓴 배치를 그대로 돌려준다. 계산해 놓고 버리면 `overflowPx`·`reductions`가
 * 테스트에서만 살아 있는 값이 되고, 실제 사용자에게는 변경 전과 똑같이
 * **아무 신호 없이** 넘친 카드가 나간다.
 */
export function drawResultCard(
  canvas: HTMLCanvasElement,
  content: CardContent,
): CardLayout {
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT

  const context = canvas.getContext('2d')

  if (context === null) {
    throw new Error('canvas 2D 컨텍스트를 만들 수 없습니다')
  }

  const measure: Measure = (text, font) => {
    context.font = font
    return context.measureText(text).width
  }

  const layout = layoutCard(content, measure)

  // 서버가 없어 보낼 곳이 없다(ADR-003). 남길 수 있는 곳은 콘솔뿐이라
  // 여기에라도 남긴다 — 조용히 넘치는 것보다 낫다.
  if (layout.overflowPx > 0 || layout.widthOverflowPx > 0) {
    console.warn(
      `결과 카드가 넘쳤다 — 세로 ${layout.overflowPx}px · 가로 ${layout.widthOverflowPx}px` +
        `(적용한 축약: ${layout.reductions.join(', ') || '없음'})`,
    )
  }

  paint(context, layout)

  return layout
}

/** canvas를 PNG 파일로 저장한다 — 실패하면 예외를 던지고 호출자가 문구로 옮긴다 */
export async function saveCardPng(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )

  if (blob === null) {
    throw new Error('PNG 생성 실패')
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  // 일부 브라우저는 DOM에 붙은 앵커만 download를 신뢰한다
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // 클릭이 처리된 뒤 해제한다 — 즉시 해제하면 일부 브라우저에서 다운로드가 끊긴다
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
