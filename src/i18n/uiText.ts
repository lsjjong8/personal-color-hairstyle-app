import type { AnalysisFailureReason } from '../core/types'
import type { Locale } from './locale'

/**
 * L3 상태·실패 문구 + L4 화면 문구.
 *
 * 두 층을 한 표에 담되 **형태로 구분한다** — 실패 사유는 키가 있는
 * `Record<AnalysisFailureReason, string>`이라 사유가 늘면 컴파일이 실패하고,
 * 나머지는 키 없는 화면 문구다. `types.ts`가 이미 *"실패 사유 — UI가 사용자
 * 문구로 번역한다"*고 적어 둔 이음매를 넓힌 것이다.
 *
 * ★ **고지 두 문장은 `notice`에만 있다.** 랜딩 화면과 결과 카드가 같은 값을
 * 읽는다 — 종전에는 두 곳이 서로 다른 표현을 써서, 번역하면 어긋남이 두 배로
 * 늘 상태였다.
 */
export interface UiText {
  /** 문서 메타 */
  documentTitle: string
  cardFilename: string

  /** 고지 두 문장 — 화면과 카드가 함께 읽는다 */
  notice: {
    /** 기대치 관리 — 진단이 아니다 */
    fun: string
    /** 사실 주장 — 사진의 처리 위치 */
    privacy: string
  }

  languageToggle: {
    /** 버튼의 접근성 이름 */
    label: string
    /** 바꿔 갈 언어의 이름 (현재 언어가 아니라 **목적지**를 적는다) */
    to: string
  }

  landing: {
    titleLine1: string
    titleLine2: string
    lead: string
    privacyBody: string
    accuracyHeading: string
    accuracyBody: string
    start: string
  }

  capture: {
    title: string
    lead: string
    previewLabel: string
    cameraFailed: string
    shootFailed: string
    readFailed: string
    shoot: string
    pickFile: string
    back: string
  }

  result: {
    title: string
    previewAlt: string
    analyzing: string
    retake: string
    neutralNotice: string
    sectionPalette: string
    sectionHairColors: string
    faceShapePrefix: string
    save: string
    saveFailed: string
    evidenceSummary: string
    evidenceSkinL: string
    evidenceHue: string
    evidenceChroma: string
    evidenceLengthRatio: string
    evidenceLighting: string
    evidenceReferenceLuma: string
    evidenceClipped: string
    applied: string
    skipped: string
    none: string
  }

  card: {
    header: string
  }

  failure: Record<AnalysisFailureReason, string>
}

/**
 * ⚠ **두 언어의 고지 강도가 다르다 — 숨기지 않고 적는다.**
 *
 * 한국어는 *"사진은 기기를 떠나지 않습니다"*이고 영문은 *"analyzed in your
 * browser"*다. 영어권에서 개인정보 문구는 표시(representation)로 읽혀 무게가
 * 더 크므로, 실측이 덮은 범위까지만 주장한다(설계 판정문 §7 ㉡).
 * 2026-09-29 실측은 「외부 요청 0건」이었으나 얼굴 검출 성공 경로·실기기·
 * 장시간·배포본을 덮지 못했다(`docs/external-request-audit-2026-09-29.md`).
 * 그 공백이 닫히면 **두 언어를 함께** 올리거나 함께 낮춘다.
 */
/**
 * 결과 카드 푸터에 넣을 고지 한 줄.
 *
 * 문구는 `notice`로 합쳤는데 **조립 규칙**이 화면 코드와 테스트 두 곳에
 * 따로 적혀 있었다. 규칙도 한 곳에 둔다 — 구분자를 한쪽만 고치면 카드와
 * 검사가 다른 문자열을 보게 된다.
 */
export function cardNotice(text: UiText): string {
  return `${text.notice.fun} \u00b7 ${text.notice.privacy}`
}

export const UI_TEXT: Record<Locale, UiText> = {
  ko: {
    documentTitle: '퍼스널 컬러 · 헤어스타일 제안',
    cardFilename: 'personal-color-card.png',

    notice: {
      fun: '진단이 아닌 재미로 보는 제안입니다',
      privacy: '사진은 기기를 떠나지 않습니다',
    },

    languageToggle: { label: '언어 바꾸기', to: 'English' },

    landing: {
      titleLine1: '사진으로 보는',
      titleLine2: '퍼스널 컬러 · 헤어스타일',
      lead: '얼굴 사진 한 장으로 어울리는 색과 머리 스타일을 제안합니다.',
      privacyBody:
        '분석은 전부 이 브라우저 안에서 이뤄집니다. 사진이 서버로 전송되거나 저장되는 일이 없습니다.',
      accuracyHeading: '결과는 조명에 따라 달라집니다',
      accuracyBody:
        '같은 사람도 조명이 바뀌면 다른 결과가 나옵니다. 전문 진단사끼리도 결과가 갈리는 분야입니다. 창가의 자연광에서 찍으면 좀 더 안정적입니다.',
      start: '시작하기',
    },

    capture: {
      title: '사진 준비',
      lead: '얼굴이 화면에 정면으로 들어오게 하고, 앞머리로 이마를 가리지 않으면 더 잘 잡힙니다.',
      previewLabel: '카메라 미리보기',
      cameraFailed: '카메라를 열지 못했습니다. 아래에서 사진을 골라 주세요.',
      shootFailed: '사진을 만드는 데 실패했습니다. 파일 선택을 이용해 주세요.',
      readFailed: '사진을 읽지 못했습니다. 다른 파일로 시도해 주세요.',
      shoot: '지금 촬영',
      pickFile: '갖고 있는 사진 고르기',
      back: '뒤로',
    },

    result: {
      title: '결과',
      previewAlt: '분석한 사진',
      analyzing: '분석하고 있습니다…',
      retake: '다시 찍기',
      neutralNotice:
        '웜과 쿨의 경계에 가깝습니다. 진단사에 따라 다르게 볼 수 있는 유형입니다.',
      sectionPalette: '어울리는 색',
      sectionHairColors: '염색해 본다면',
      faceShapePrefix: '얼굴형',
      save: '결과 카드 저장 (PNG)',
      saveFailed: '카드 이미지를 만들지 못했습니다. 화면을 캡처해 주세요.',
      evidenceSummary: '판정 근거 보기',
      evidenceSkinL: '피부 밝기 (L*)',
      evidenceHue: '색상각 (h°)',
      evidenceChroma: '채도 (C*)',
      evidenceLengthRatio: '얼굴 세로/가로',
      evidenceLighting: '조명 보정',
      evidenceReferenceLuma: '기준 밝기 (0~255)',
      evidenceClipped: '잘린 픽셀',
      applied: '적용됨',
      skipped: '건너뜀',
      none: '없음',
    },

    card: { header: '퍼스널 컬러 · 재미로 보는 제안' },

    failure: {
      'no-face-detected':
        '얼굴을 찾지 못했습니다. 얼굴이 정면으로 크게 나온 사진으로 다시 시도해 주세요.',
      'too-few-skin-pixels':
        '피부색을 충분히 읽지 못했습니다. 조금 더 밝은 곳에서 다시 찍어 주세요.',
      'model-load-failed': '분석 준비에 실패했습니다. 새로고침 후 다시 시도해 주세요.',
    },
  },

  en: {
    documentTitle: 'Personal Color · Hairstyle Suggestions',
    cardFilename: 'personal-color-card.png',

    notice: {
      fun: 'For fun — not a professional diagnosis',
      privacy: 'Your photo is analyzed in your browser',
    },

    languageToggle: { label: 'Change language', to: '한국어' },

    landing: {
      titleLine1: 'From one photo',
      titleLine2: 'Personal color · Hairstyle',
      lead: 'One face photo, and we suggest colors and cuts that suit you.',
      privacyBody:
        'The analysis runs entirely inside this browser. Your photo is never uploaded to or stored on a server.',
      accuracyHeading: 'Lighting changes the result',
      accuracyBody:
        'The same person can get a different result under different lighting. Even professional analysts disagree in this field. Daylight near a window gives steadier results.',
      start: 'Start',
    },

    capture: {
      title: 'Get your photo ready',
      lead: 'Face the camera straight on. Keeping your fringe off your forehead helps the detection.',
      previewLabel: 'Camera preview',
      cameraFailed: "We couldn't open the camera. Pick a photo below instead.",
      shootFailed: "We couldn't capture the photo. Please use file selection instead.",
      readFailed: "We couldn't read that photo. Please try another file.",
      shoot: 'Take photo',
      pickFile: 'Choose an existing photo',
      back: 'Back',
    },

    result: {
      title: 'Result',
      previewAlt: 'The photo we analyzed',
      analyzing: 'Analyzing…',
      retake: 'Take another',
      neutralNotice:
        'You sit close to the warm–cool border. Analysts may read this type differently.',
      sectionPalette: 'Colors that suit you',
      sectionHairColors: 'If you dye your hair',
      faceShapePrefix: 'Face shape',
      save: 'Save result card (PNG)',
      saveFailed: "We couldn't build the card image. Please take a screenshot instead.",
      evidenceSummary: 'See how this was decided',
      evidenceSkinL: 'Skin lightness (L*)',
      evidenceHue: 'Hue angle (h°)',
      evidenceChroma: 'Chroma (C*)',
      evidenceLengthRatio: 'Face height / width',
      evidenceLighting: 'Lighting correction',
      evidenceReferenceLuma: 'Reference luma (0-255)',
      evidenceClipped: 'Clipped pixels',
      applied: 'Applied',
      skipped: 'Skipped',
      none: 'None',
    },

    card: { header: 'Personal color · just for fun' },

    failure: {
      'no-face-detected':
        "We couldn't find a face. Try a photo where your face is large and facing forward.",
      'too-few-skin-pixels':
        "We couldn't read enough skin tone. Try again somewhere a little brighter.",
      'model-load-failed':
        "We couldn't get the analyzer ready. Please refresh and try again.",
    },
  },
}
