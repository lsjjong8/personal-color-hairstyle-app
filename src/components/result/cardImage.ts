import type { ColorSwatch } from '../../core/guide/toneGuide'

/**
 * 결과 카드 PNG 렌더러 — 외부 라이브러리 없이 canvas 2D로 직접 그린다.
 * DOM 캡처 방식(html2canvas 등)은 새 런타임 의존성이 필요해 배제했다.
 * 사진은 카드에 넣지 않는다 — 공유 이미지에 얼굴이 들어가는 것은 v1 범위 밖.
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

const COLOR_BG = '#fdf8f3'
const COLOR_TEXT = '#241f1c'
const COLOR_MUTED = '#6b615a'
const COLOR_ACCENT = '#b4664a'
const COLOR_LINE = '#e6ded8'

const FONT_FAMILY = "'Pretendard', system-ui, -apple-system, sans-serif"

/** 캔버스 measureText 기준으로 최대 폭에 맞게 줄을 나눈다 (한국어는 음절 단위 줄바꿈 허용) */
function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  let current = ''

  for (const char of text) {
    const candidate = current + char

    if (context.measureText(candidate).width > maxWidth && current.length > 0) {
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

function drawSwatchRow(
  context: CanvasRenderingContext2D,
  swatches: ColorSwatch[],
  top: number,
): number {
  const gap = 32
  const size = (CARD_WIDTH - PADDING * 2 - gap * (swatches.length - 1)) / swatches.length
  const swatchHeight = 130

  swatches.forEach((swatch, index) => {
    const left = PADDING + index * (size + gap)

    context.fillStyle = swatch.hex
    context.strokeStyle = COLOR_LINE
    context.lineWidth = 2
    context.beginPath()
    context.roundRect(left, top, size, swatchHeight, 18)
    context.fill()
    context.stroke()

    context.fillStyle = COLOR_MUTED
    context.font = `28px ${FONT_FAMILY}`
    context.textAlign = 'center'
    context.fillText(swatch.name, left + size / 2, top + swatchHeight + 42, size)
  })

  context.textAlign = 'left'

  return top + swatchHeight + 70
}

function drawSectionTitle(
  context: CanvasRenderingContext2D,
  title: string,
  top: number,
): number {
  context.fillStyle = COLOR_ACCENT
  context.font = `600 34px ${FONT_FAMILY}`
  context.fillText(title, PADDING, top)

  return top + 28
}

/** 결과 카드를 canvas에 그린다 — 호출자가 canvas를 만들어 넘긴다 */
export function drawResultCard(canvas: HTMLCanvasElement, content: CardContent): void {
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT

  const context = canvas.getContext('2d')

  if (context === null) {
    throw new Error('canvas 2D 컨텍스트를 만들 수 없습니다')
  }

  context.fillStyle = COLOR_BG
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // 헤더
  context.fillStyle = COLOR_MUTED
  context.font = `30px ${FONT_FAMILY}`
  context.fillText('퍼스널 컬러 · 재미로 보는 제안', PADDING, 110)

  // 타입 이름
  context.fillStyle = COLOR_TEXT
  context.font = `700 92px ${FONT_FAMILY}`
  context.fillText(content.tone12, PADDING, 225)

  // 타입 한 줄 설명
  context.fillStyle = COLOR_MUTED
  context.font = `36px ${FONT_FAMILY}`
  let y = 295

  for (const line of wrapText(context, content.toneOneLiner, CARD_WIDTH - PADDING * 2)) {
    context.fillText(line, PADDING, y)
    y += 48
  }

  // 어울리는 색
  y = drawSectionTitle(context, '어울리는 색', y + 40)
  y = drawSwatchRow(context, content.palette, y)

  // 염색 추천
  y = drawSectionTitle(context, '염색해 본다면', y + 24)
  y = drawSwatchRow(context, content.hairColors, y)

  // 얼굴형·컷 방향
  y = drawSectionTitle(context, `얼굴형 · ${content.faceShape}`, y + 24)
  y += 22
  context.fillStyle = COLOR_TEXT
  context.font = `32px ${FONT_FAMILY}`

  for (const tip of content.cutTips) {
    const lines = wrapText(context, `· ${tip}`, CARD_WIDTH - PADDING * 2)

    for (const line of lines) {
      context.fillText(line, PADDING, y)
      y += 44
    }

    y += 6
  }

  // 푸터 고지
  context.strokeStyle = COLOR_LINE
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(PADDING, CARD_HEIGHT - 110)
  context.lineTo(CARD_WIDTH - PADDING, CARD_HEIGHT - 110)
  context.stroke()

  context.fillStyle = COLOR_MUTED
  context.font = `26px ${FONT_FAMILY}`
  context.fillText(
    '진단이 아닌 재미로 보는 제안입니다 · 사진은 기기를 떠나지 않습니다',
    PADDING,
    CARD_HEIGHT - 60,
  )
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
