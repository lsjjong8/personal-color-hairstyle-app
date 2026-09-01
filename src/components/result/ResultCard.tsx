import { useState } from 'react'
import { TONE_GUIDE } from '../../core/guide/toneGuide'
import { FACE_SHAPE_GUIDE } from '../../core/guide/faceShapeGuide'
import type { AnalysisSuccess } from '../../core/types'
import { drawResultCard, saveCardPng } from './cardImage'

interface ResultCardProps {
  result: AnalysisSuccess
}

/**
 * 결과 카드 — 12타입·팔레트·염색·얼굴형·컷 방향을 한 화면에 담고,
 * 같은 내용을 canvas로 그려 PNG로 저장한다 (PRD Phase 4).
 */
export function ResultCard({ result }: ResultCardProps) {
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { personalColor, faceShape, lighting } = result
  const toneGuide = TONE_GUIDE[personalColor.tone12]
  const shapeGuide = FACE_SHAPE_GUIDE[faceShape.shape]

  async function handleSave(): Promise<void> {
    setSaveError(null)
    setSaving(true)

    try {
      const canvas = document.createElement('canvas')

      drawResultCard(canvas, {
        tone12: personalColor.tone12,
        toneOneLiner: toneGuide.oneLiner,
        palette: toneGuide.palette,
        hairColors: toneGuide.hairColors,
        faceShape: faceShape.shape,
        cutTips: shapeGuide.cutTips,
      })

      await saveCardPng(canvas, 'personal-color-card.png')
    } catch {
      setSaveError('카드 이미지를 만들지 못했습니다. 화면을 캡처해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="result">
      <p className="tone">{personalColor.tone12}</p>
      <p className="lead">{toneGuide.oneLiner}</p>

      {personalColor.undertone === 'neutral' && (
        <p className="notice">
          웜과 쿨의 경계에 가깝습니다. 진단사에 따라 다르게 볼 수 있는 유형입니다.
        </p>
      )}

      <h2 className="section-title">어울리는 색</h2>
      <ul className="swatch-grid">
        {toneGuide.palette.map((swatch) => (
          <li key={swatch.name} className="swatch">
            <span className="swatch-color" style={{ backgroundColor: swatch.hex }} />
            {swatch.name}
          </li>
        ))}
      </ul>

      <h2 className="section-title">염색해 본다면</h2>
      <ul className="swatch-grid">
        {toneGuide.hairColors.map((swatch) => (
          <li key={swatch.name} className="swatch">
            <span className="swatch-color" style={{ backgroundColor: swatch.hex }} />
            {swatch.name}
          </li>
        ))}
      </ul>

      <h2 className="section-title">얼굴형 · {faceShape.shape}</h2>
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
        결과 카드 저장 (PNG)
      </button>

      {saveError !== null && (
        <p className="error" role="alert">
          {saveError}
        </p>
      )}

      <details className="evidence-box">
        <summary>판정 근거 보기</summary>
        <dl className="evidence">
          <dt>피부 밝기 (L*)</dt>
          <dd>{personalColor.evidence.skinLab.l.toFixed(1)}</dd>
          <dt>색상각 (h°)</dt>
          <dd>{personalColor.evidence.hue.toFixed(1)}</dd>
          <dt>채도 (C*)</dt>
          <dd>{personalColor.evidence.chroma.toFixed(1)}</dd>
          <dt>얼굴 세로/가로</dt>
          <dd>{faceShape.evidence.lengthRatio.toFixed(2)}</dd>
          {/*
            건너뛴 사유는 적지 않는다 — 기준을 포기하는 경로가 넷이라
            (저채도 픽셀 부족·너무 어두움·과노출·채널 클리핑) 하나를 골라 쓰면
            나머지 셋에 대해 틀린 말을 하게 된다.
          */}
          <dt>조명 보정</dt>
          <dd>{lighting.applied ? '적용됨' : '건너뜀'}</dd>
          {/* 척도를 라벨에 단다 — 0~255이며 L*(0~100)가 아니다. 옮겨 적은 숫자가
              어느 척도인지 모르면 재보정에서 두 스케일이 섞인다 */}
          <dt>기준 밝기 (0~255)</dt>
          <dd>{lighting.applied ? lighting.referenceLuma.toFixed(1) : '없음'}</dd>
          {/* 잘림은 보정이 적용된 사진에서 오히려 잘 난다 — 배율이 1을 넘으면
              밝은 피부 채널이 255에서 멈춘다. "적용됨"만으로는 못 거른다 */}
          <dt>잘린 픽셀</dt>
          <dd>{`${Math.round(lighting.clippedRatio * 100)}%`}</dd>
        </dl>
      </details>
    </section>
  )
}
