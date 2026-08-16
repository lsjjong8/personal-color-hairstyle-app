import type { Tone12 } from '../types'

/**
 * 12타입별 어울리는 색 팔레트·염색 추천 (context.md §1·§3).
 *
 * 재미 위주 제안이 목적이므로 "정답 팔레트"가 아니라 각 타입의 통상적인
 * 대표색을 담는다. 색 이름은 미용실·화장품에서 쓰는 소비자 어휘를 따른다.
 */

export interface ColorSwatch {
  name: string
  hex: string
}

export interface ToneGuide {
  /** 타입 성격 한 줄 — 결과 카드 상단 문구 */
  oneLiner: string
  /** 어울리는 색 4가지 */
  palette: ColorSwatch[]
  /** 염색 추천 3가지 */
  hairColors: ColorSwatch[]
}

export const TONE_GUIDE: Record<Tone12, ToneGuide> = {
  '봄 라이트': {
    oneLiner: '밝고 화사한 색이 얼굴을 환하게 살려 주는 타입',
    palette: [
      { name: '살구', hex: '#ffcba4' },
      { name: '라이트 피치', hex: '#ffdab9' },
      { name: '크림', hex: '#fff3d6' },
      { name: '민트', hex: '#b8e6d0' },
    ],
    hairColors: [
      { name: '허니 브라운', hex: '#b58150' },
      { name: '밀크 티 브라운', hex: '#c69c6d' },
      { name: '라이트 골드 브라운', hex: '#a97e4f' },
    ],
  },
  '봄 브라이트': {
    oneLiner: '맑고 선명한 색을 만나면 생기가 도는 타입',
    palette: [
      { name: '선명한 코랄', hex: '#ff6f61' },
      { name: '오렌지 레드', hex: '#ff4f3b' },
      { name: '청사과 그린', hex: '#8ed04e' },
      { name: '터콰이즈', hex: '#30c9c9' },
    ],
    hairColors: [
      { name: '브라이트 카퍼', hex: '#b35a2e' },
      { name: '오렌지 브라운', hex: '#a5522b' },
      { name: '골드 브라운', hex: '#8f6132' },
    ],
  },
  '봄 웜': {
    oneLiner: '노란 기 도는 따뜻한 색이 잘 받는 타입',
    palette: [
      { name: '코랄', hex: '#ff8a70' },
      { name: '피치', hex: '#ffb999' },
      { name: '골든 옐로우', hex: '#ffcf4d' },
      { name: '아이보리', hex: '#fdf3e0' },
    ],
    hairColors: [
      { name: '골든 브라운', hex: '#9a6a3a' },
      { name: '카라멜 브라운', hex: '#a9743f' },
      { name: '오렌지 브라운', hex: '#a5522b' },
    ],
  },
  '여름 라이트': {
    oneLiner: '연하고 부드러운 파스텔이 얼굴빛을 맑게 하는 타입',
    palette: [
      { name: '라벤더', hex: '#cbb8e8' },
      { name: '베이비 핑크', hex: '#f6c6d4' },
      { name: '스카이 블루', hex: '#a8d3ef' },
      { name: '라이트 그레이', hex: '#d9dde2' },
    ],
    hairColors: [
      { name: '밀크 애쉬 브라운', hex: '#8a7466' },
      { name: '라이트 애쉬', hex: '#9b8878' },
      { name: '애쉬 베이지', hex: '#a08d75' },
    ],
  },
  '여름 뮤트': {
    oneLiner: '차분하게 톤 다운된 색이 분위기를 만들어 주는 타입',
    palette: [
      { name: '더스티 핑크', hex: '#d8a7b1' },
      { name: '로즈 브라운', hex: '#b08484' },
      { name: '그레이시 블루', hex: '#8fa5b5' },
      { name: '모브', hex: '#a58fa5' },
    ],
    hairColors: [
      { name: '애쉬 브라운', hex: '#7a6a5f' },
      { name: '로즈 브라운', hex: '#8a625d' },
      { name: '다크 애쉬', hex: '#5f544c' },
    ],
  },
  '여름 쿨': {
    oneLiner: '푸른 기 도는 시원한 색이 얼굴을 정돈해 주는 타입',
    palette: [
      { name: '로즈 핑크', hex: '#e88fa9' },
      { name: '블루 그레이', hex: '#7d93a8' },
      { name: '소프트 화이트', hex: '#f4f6f7' },
      { name: '라일락', hex: '#b79fd4' },
    ],
    hairColors: [
      { name: '쿨 애쉬 브라운', hex: '#6d5f58' },
      { name: '다크 브라운', hex: '#4a3b33' },
      { name: '블루 블랙', hex: '#1d232e' },
    ],
  },
  '가을 뮤트': {
    oneLiner: '흐리게 가라앉은 따뜻한 색이 자연스럽게 스미는 타입',
    palette: [
      { name: '베이지', hex: '#d9c1a3' },
      { name: '카키', hex: '#8a8a5c' },
      { name: '더스티 오렌지', hex: '#cf8b5e' },
      { name: '코코아', hex: '#8a6a55' },
    ],
    hairColors: [
      { name: '모카 브라운', hex: '#6b5140' },
      { name: '애쉬 카키 브라운', hex: '#6a5f45' },
      { name: '밀크 브라운', hex: '#7d6a54' },
    ],
  },
  '가을 딥': {
    oneLiner: '깊고 진한 색을 받쳐 입을수록 존재감이 사는 타입',
    palette: [
      { name: '다크 브라운', hex: '#5a3d2b' },
      { name: '버건디', hex: '#7b2d3b' },
      { name: '딥 올리브', hex: '#55603a' },
      { name: '테라코타', hex: '#b0573b' },
    ],
    hairColors: [
      { name: '다크 초콜릿', hex: '#3f2a1d' },
      { name: '딥 카퍼', hex: '#6e3a24' },
      { name: '블랙 브라운', hex: '#2c211a' },
    ],
  },
  '가을 웜': {
    oneLiner: '흙과 단풍의 따뜻한 색이 잘 어울리는 타입',
    palette: [
      { name: '캐멀', hex: '#c1915f' },
      { name: '머스터드', hex: '#d9a62e' },
      { name: '올리브', hex: '#77803f' },
      { name: '벽돌색', hex: '#a8543a' },
    ],
    hairColors: [
      { name: '초콜릿 브라운', hex: '#5b3a26' },
      { name: '다크 카퍼', hex: '#7c4526' },
      { name: '카키 브라운', hex: '#6a5a3d' },
    ],
  },
  '겨울 브라이트': {
    oneLiner: '쨍하게 선명한 색과 만나면 또렷해지는 타입',
    palette: [
      { name: '비비드 핑크', hex: '#ff2e88' },
      { name: '코발트 블루', hex: '#1f4fd8' },
      { name: '레몬 옐로우', hex: '#ffe64d' },
      { name: '퓨어 화이트', hex: '#ffffff' },
    ],
    hairColors: [
      { name: '블루 블랙', hex: '#1d232e' },
      { name: '다크 브라운', hex: '#3d2e26' },
      { name: '딥 바이올렛 브라운', hex: '#42303f' },
    ],
  },
  '겨울 딥': {
    oneLiner: '어둡고 묵직한 색이 오히려 얼굴을 살리는 타입',
    palette: [
      { name: '딥 와인', hex: '#5c1f33' },
      { name: '다크 네이비', hex: '#1c2a4a' },
      { name: '에메랄드', hex: '#0f7d5c' },
      { name: '블랙', hex: '#17171a' },
    ],
    hairColors: [
      { name: '블랙', hex: '#17171a' },
      { name: '다크 와인 블랙', hex: '#33202b' },
      { name: '딥 블루 블랙', hex: '#141b2b' },
    ],
  },
  '겨울 쿨': {
    oneLiner: '희고 검은 대비, 차가운 원색이 어울리는 타입',
    palette: [
      { name: '퓨어 화이트', hex: '#ffffff' },
      { name: '블랙', hex: '#17171a' },
      { name: '로얄 블루', hex: '#2a4fc9' },
      { name: '푸시아', hex: '#d4308f' },
    ],
    hairColors: [
      { name: '블랙', hex: '#17171a' },
      { name: '블루 블랙', hex: '#1d232e' },
      { name: '쿨 다크 브라운', hex: '#3a2f2b' },
    ],
  },
}
