import { useState } from 'react'
import { FACE_SHAPE_GUIDE } from '../../core/guide/faceShapeGuide'
import { TONE_GUIDE } from '../../core/guide/toneGuide'
import type { AnalysisSuccess } from '../../core/types'
import { FACE_SHAPE_LABEL, TONE12_LABEL } from '../../i18n/labels'
import type { Locale } from '../../i18n/locale'
import { cardNotice, type UiText } from '../../i18n/uiText'
import { drawResultCard, saveCardPng } from './cardImage'

interface ResultCardProps {
  result: AnalysisSuccess
  locale: Locale
  t: UiText
}

/**
 * 결과 카드 — 12타입·팔레트·염색·얼굴형·컷 방향을 한 화면에 담고,
 * 같은 내용을 canvas로 그려 PNG로 저장한다 (PRD Phase 4).
 *
 * 화면과 카드가 **같은 문자열**을 읽는다. 섹션 제목·고지가 두 곳에 따로 적혀
 * 있으면 번역하면서 갈린다 — 표를 한 곳에 두는 것이 그 대비책이다.
 * (배치 코드는 여전히 둘이다. ADR-005가 받아들인 비용이고 다국어가 그 두 번째 청구서다.)
 */
export function ResultCard({ result, locale, t }: ResultCardProps) {
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { personalColor, faceShape, lighting } = result
  const toneGuide = TONE_GUIDE[locale][personalColor.tone12]
  const shapeGuide = FACE_SHAPE_GUIDE[locale][faceShape.shape]
  const toneLabel = TONE12_LABEL[locale][personalColor.tone12]
  const shapeLabel = FACE_SHAPE_LABEL[locale][faceShape.shape]
  const faceShapeTitle = `${t.result.faceShapePrefix} · ${shapeLabel}`

  async function handleSave(): Promise<void> {
    setSaveError(null)
    setSaving(true)

    try {
      const canvas = document.createElement('canvas')

      drawResultCard(
        canvas,
        {
          header: t.card.header,
          tone12: toneLabel,
          toneOneLiner: toneGuide.oneLiner,
          sections: {
            palette: t.result.sectionPalette,
            hairColors: t.result.sectionHairColors,
            faceShape: faceShapeTitle,
          },
          palette: toneGuide.palette,
          hairColors: toneGuide.hairColors,
          cutTips: shapeGuide.cutTips,
          notice: cardNotice(t),
        },
        locale,
      )

      await saveCardPng(canvas, t.cardFilename)
    } catch {
      setSaveError(t.result.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="result">
      <p className="tone">{toneLabel}</p>
      <p className="lead">{toneGuide.oneLiner}</p>

      {personalColor.undertone === 'neutral' && (
        <p className="notice">{t.result.neutralNotice}</p>
      )}

      <h2 className="section-title">{t.result.sectionPalette}</h2>
      <ul className="swatch-grid">
        {toneGuide.palette.map((swatch, index) => (
          <li key={`${swatch.hex}-${index}`} className="swatch">
            <span className="swatch-color" style={{ backgroundColor: swatch.hex }} />
            {swatch.name}
          </li>
        ))}
      </ul>

      <h2 className="section-title">{t.result.sectionHairColors}</h2>
      <ul className="swatch-grid">
        {toneGuide.hairColors.map((swatch, index) => (
          <li key={`${swatch.hex}-${index}`} className="swatch">
            <span className="swatch-color" style={{ backgroundColor: swatch.hex }} />
            {swatch.name}
          </li>
        ))}
      </ul>

      <h2 className="section-title">{faceShapeTitle}</h2>
      <p className="lead">{shapeGuide.oneLiner}</p>
      <ul className="tips">
        {shapeGuide.cutTips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>

      <button
        type="button"
        className="primary"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {t.result.save}
      </button>

      {saveError !== null && (
        <p className="error" role="alert">
          {saveError}
        </p>
      )}

      <details className="evidence-box">
        <summary>{t.result.evidenceSummary}</summary>
        <dl className="evidence">
          <dt>{t.result.evidenceSkinL}</dt>
          <dd>{personalColor.evidence.skinLab.l.toFixed(1)}</dd>
          <dt>{t.result.evidenceHue}</dt>
          <dd>{personalColor.evidence.hue.toFixed(1)}</dd>
          <dt>{t.result.evidenceChroma}</dt>
          <dd>{personalColor.evidence.chroma.toFixed(1)}</dd>
          <dt>{t.result.evidenceLengthRatio}</dt>
          <dd>{faceShape.evidence.lengthRatio.toFixed(2)}</dd>
          {/*
            건너뛴 사유는 적지 않는다 — 기준을 포기하는 경로가 넷이라
            (저채도 픽셀 부족·너무 어두움·과노출·채널 클리핑) 하나를 골라 쓰면
            나머지 셋에 대해 틀린 말을 하게 된다.
          */}
          <dt>{t.result.evidenceLighting}</dt>
          <dd>{lighting.applied ? t.result.applied : t.result.skipped}</dd>
          {/* 척도를 라벨에 단다 — 0~255이며 L*(0~100)가 아니다. 옮겨 적은 숫자가
              어느 척도인지 모르면 재보정에서 두 스케일이 섞인다 */}
          <dt>{t.result.evidenceReferenceLuma}</dt>
          <dd>{lighting.applied ? lighting.referenceLuma.toFixed(1) : t.result.none}</dd>
          {/* 잘림은 보정이 적용된 사진에서 오히려 잘 난다 — 배율이 1을 넘으면
              밝은 피부 채널이 255에서 멈춘다. "적용됨"만으로는 못 거른다 */}
          <dt>{t.result.evidenceClipped}</dt>
          <dd>{`${Math.round(lighting.clippedRatio * 100)}%`}</dd>
        </dl>
      </details>
    </section>
  )
}
