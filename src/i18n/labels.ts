import type { FaceShape, Tone12 } from '../core/types'
import type { Locale } from './locale'

/**
 * L1 도메인 라벨 — 판정 결과를 화면에 쓸 이름으로 옮긴다.
 *
 * **키는 한국어 유니온 그대로다.** `Tone12`·`FaceShape`가 도메인 타입이고
 * 테스트 수십 곳이 그 값을 기대값으로 쓴다 — 키를 바꾸면 번역이 아니라
 * 도메인 변경이 된다. 키가 유니온이라 표에 빈칸이 있으면 컴파일이 실패한다.
 *
 * `Season`·`Undertone`은 넣지 않는다 — 화면에 문자열로 그려지지 않는다.
 * 표시되지 않는 키에 번역표를 두면 아무도 확인하지 않는 표가 생긴다.
 *
 * ★ 영문 12타입 이름은 영어권 12시즌 체계의 통용 형태를 따른다(수식어가 앞:
 * `Light Spring`). `뮤트`는 영어권에서 `Soft`로 굳어 있어 `Muted`가 아니라
 * `Soft`를 쓴다. **원어민 검토 전 초안**이다 — 검토에서 바뀔 수 있다.
 */
export const TONE12_LABEL: Record<Locale, Record<Tone12, string>> = {
  ko: {
    '봄 라이트': '봄 라이트',
    '봄 브라이트': '봄 브라이트',
    '봄 웜': '봄 웜',
    '여름 라이트': '여름 라이트',
    '여름 뮤트': '여름 뮤트',
    '여름 쿨': '여름 쿨',
    '가을 뮤트': '가을 뮤트',
    '가을 딥': '가을 딥',
    '가을 웜': '가을 웜',
    '겨울 브라이트': '겨울 브라이트',
    '겨울 딥': '겨울 딥',
    '겨울 쿨': '겨울 쿨',
  },
  en: {
    '봄 라이트': 'Light Spring',
    '봄 브라이트': 'Bright Spring',
    '봄 웜': 'Warm Spring',
    '여름 라이트': 'Light Summer',
    '여름 뮤트': 'Soft Summer',
    '여름 쿨': 'Cool Summer',
    '가을 뮤트': 'Soft Autumn',
    '가을 딥': 'Deep Autumn',
    '가을 웜': 'Warm Autumn',
    '겨울 브라이트': 'Bright Winter',
    '겨울 딥': 'Deep Winter',
    '겨울 쿨': 'Cool Winter',
  },
}

/**
 * 얼굴형 5분류.
 *
 * `역삼각형`(이마가 넓고 턱이 좁은 형)은 영어 미용 현장에서 `Heart`로 부른다 —
 * 직역 `Inverted Triangle`보다 통용된다. `긴형`은 `Long`보다 `Oblong`이
 * 얼굴형 분류의 관용어다.
 */
export const FACE_SHAPE_LABEL: Record<Locale, Record<FaceShape, string>> = {
  ko: {
    계란형: '계란형',
    둥근형: '둥근형',
    각진형: '각진형',
    긴형: '긴형',
    역삼각형: '역삼각형',
  },
  en: {
    계란형: 'Oval',
    둥근형: 'Round',
    각진형: 'Square',
    긴형: 'Oblong',
    역삼각형: 'Heart',
  },
}
