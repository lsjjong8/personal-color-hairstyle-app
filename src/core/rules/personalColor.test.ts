import { describe, expect, test } from 'vitest'
import { judgePersonalColor } from './personalColor'
import { chroma, hueAngle } from '../color/lab'
import type { Lab, Season, Tone12 } from '../types'

/**
 * 판정 규칙 검증 — 세 층.
 *
 *   1. 실사진 관측값 — 2026-08-22 실기기 4장. **이 규칙이 맞춰야 할 실제 분포다.**
 *   2. 12타입 도달 가능성 — 어떤 타입도 "영영 안 나오는" 상태가 되면 안 된다.
 *   3. 축 의미 — 각 축이 정의대로 동작하는지 (합성 Lab)
 *
 * v1의 대표 피부색 sRGB 표본 테스트는 제거했다. 그 색들은 **조명 보정을 거치지
 * 않은 팔레트 원색**이라 채도가 실사진보다 두 배 가까이 높고, 실제 판정 입력
 * (보정 후 값)과 분포가 다르다. 같은 잣대로 재면 규칙이 아니라 표본을 검증하게 된다.
 */

/** 색상각과 채도로 Lab을 만든다 — 관측값은 L*·h°·C*로 기록되므로 */
function labFrom(lightness: number, hue: number, saturation: number): Lab {
  const radians = (hue * Math.PI) / 180

  return {
    l: lightness,
    a: saturation * Math.cos(radians),
    b: saturation * Math.sin(radians),
  }
}

/**
 * 실사진 범위 스캔 격자. 두 테스트가 같은 범위를 보도록 한곳에 둔다.
 *
 * 세 축을 독립으로 훑으므로 실제로는 잘 나오지 않는 조합(매우 밝으면서 고채도 등)도
 * 만든다. **도달 가능성**을 보는 데는 그게 맞다 — 넉넉히 훑어야 "영영 안 나오는
 * 타입"을 놓치지 않는다. 반면 **점유율**은 인구 분포가 아니라 격자 부피의 비율이라,
 * 실사용 쏠림의 근사치일 뿐 그 자체로 실제 비율은 아니다.
 */
const SCAN = { lMin: 52, lMax: 80, hMin: 45, hMax: 92, cMin: 7, cMax: 20 }

/**
 * 아래 단언은 **회귀 방지용 고정**이지 정확도 검증이 아니다.
 *
 * 이 4장은 기준선을 정하는 데 쓴 바로 그 표본이라, 여기서 갈린다는 것이
 * "새 사진에도 잘 갈린다"를 뜻하지 않는다(훈련 데이터 = 검증 데이터).
 * 이 테스트가 지키는 것은 **넷이 다시 한 타입으로 뭉치는 상태로 되돌아가지 않는 것**뿐이다.
 * 일반화 여부는 동료 배포로 표본이 쌓여야 알 수 있다 (ADR-007).
 */
describe('실사진 관측값 (2026-08-22 실기기 4장) — 회귀 방지 고정', () => {
  const observed = [
    { name: '1번', lab: labFrom(68.1, 88.9, 15.1) },
    { name: '2번', lab: labFrom(59.7, 56.9, 9.9) },
    { name: '3번', lab: labFrom(59.8, 68.9, 12.3) },
    { name: '4번', lab: labFrom(58.9, 64.7, 15.8) },
  ]

  test('관측값이 그대로 복원된다 — 이 표본을 잘못 옮기면 아래 단언이 무의미해진다', () => {
    const expected = [
      { l: 68.1, h: 88.9, c: 15.1 },
      { l: 59.7, h: 56.9, c: 9.9 },
      { l: 59.8, h: 68.9, c: 12.3 },
      { l: 58.9, h: 64.7, c: 15.8 },
    ]

    observed.forEach(({ lab }, index) => {
      expect(lab.l).toBeCloseTo(expected[index].l, 1)
      expect(hueAngle(lab)).toBeCloseTo(expected[index].h, 1)
      expect(chroma(lab)).toBeCloseTo(expected[index].c, 1)
    })
  })

  test('네 장이 한 타입으로 뭉치지 않는다 — 쏠리면 결과를 볼 이유가 없다', () => {
    const types = new Set(observed.map(({ lab }) => judgePersonalColor(lab).tone12))

    expect(types.size).toBeGreaterThanOrEqual(3)
  })

  test('네 장 모두 "탁함" 한쪽으로 몰리지 않는다 — v1의 실패가 그것이었다', () => {
    // v1 기준선에서는 실사진 잔차가 -12.5 ~ -19.1로 전부 soft였고,
    // 그 탓에 선명(vivid)을 요구하는 타입 4종이 도달 불가였다.
    const tones = observed.map(({ lab }) => judgePersonalColor(lab).tone12)

    expect(new Set(tones).size).toBeGreaterThan(1)
  })
})

describe('12타입 도달 가능성 — v1에서 4종이 영영 안 나오던 결함의 회귀 방지', () => {
  const ALL_TONES: Tone12[] = [
    '봄 라이트',
    '봄 브라이트',
    '봄 웜',
    '여름 라이트',
    '여름 뮤트',
    '여름 쿨',
    '가을 뮤트',
    '가을 딥',
    '가을 웜',
    '겨울 브라이트',
    '겨울 딥',
    '겨울 쿨',
  ]

  /** 실사진에서 나올 법한 범위를 훑어 실제로 나오는 타입을 모은다 */
  function reachableTones(): Set<Tone12> {
    const found = new Set<Tone12>()

    for (let l = SCAN.lMin; l <= SCAN.lMax; l += 1) {
      for (let h = SCAN.hMin; h <= SCAN.hMax; h += 1) {
        for (let c = SCAN.cMin; c <= SCAN.cMax; c += 1) {
          found.add(judgePersonalColor(labFrom(l, h, c)).tone12)
        }
      }
    }

    return found
  }

  test('실사진 범위에서 12타입이 모두 나온다', () => {
    const reachable = reachableTones()
    const missing = ALL_TONES.filter((tone) => !reachable.has(tone))

    expect(missing).toEqual([])
  })

  test('한 타입이 스캔 격자의 3분의 1을 넘게 차지하지 않는다 (실사용 비율의 근사)', () => {
    const counts = new Map<Tone12, number>()
    let total = 0

    for (let l = SCAN.lMin; l <= SCAN.lMax; l += 1) {
      for (let h = SCAN.hMin; h <= SCAN.hMax; h += 1) {
        for (let c = SCAN.cMin; c <= SCAN.cMax; c += 1) {
          const tone = judgePersonalColor(labFrom(l, h, c)).tone12
          counts.set(tone, (counts.get(tone) ?? 0) + 1)
          total += 1
        }
      }
    }

    for (const [, count] of counts) {
      expect(count / total).toBeLessThan(1 / 3)
    }
  })
})

describe('언더톤 판정', () => {
  test('노란 기가 강하면 웜으로 본다', () => {
    expect(judgePersonalColor(labFrom(65, 75, 14)).undertone).toBe('warm')
  })

  test('붉은 기가 강하면 쿨로 본다', () => {
    expect(judgePersonalColor(labFrom(65, 50, 14)).undertone).toBe('cool')
  })

  test('경계 구간은 뉴트럴로 표기한다 — 어느 쪽으로도 판정될 수 있는 유형', () => {
    expect(judgePersonalColor(labFrom(65, 63, 14)).undertone).toBe('neutral')
  })

  test('뉴트럴이어도 12타입은 반드시 하나로 정해진다', () => {
    const result = judgePersonalColor(labFrom(65, 63, 14))

    expect(result.tone12).toBeTruthy()
    expect(result.season).toBeTruthy()
  })
})

describe('계절 판정 — 언더톤 × 명도', () => {
  test('웜 + 밝음 = 봄', () => {
    expect(judgePersonalColor(labFrom(72, 75, 13)).season).toBe('봄')
  })

  test('웜 + 어두움 = 가을', () => {
    expect(judgePersonalColor(labFrom(60, 75, 14)).season).toBe('가을')
  })

  test('쿨 + 밝음 = 여름', () => {
    expect(judgePersonalColor(labFrom(72, 50, 13)).season).toBe('여름')
  })

  test('쿨 + 어두움 = 겨울', () => {
    expect(judgePersonalColor(labFrom(60, 50, 14)).season).toBe('겨울')
  })
})

describe('12타입 세부 판정 — 명도 극단 우선, 그다음 채도 잔차', () => {
  test('봄: 매우 밝으면 라이트, 기대선보다 선명하면 브라이트, 나머지는 웜', () => {
    expect(judgePersonalColor(labFrom(82, 75, 12)).tone12).toBe('봄 라이트')
    expect(judgePersonalColor(labFrom(72, 75, 16)).tone12).toBe('봄 브라이트')
    expect(judgePersonalColor(labFrom(72, 75, 12)).tone12).toBe('봄 웜')
  })

  test('여름: 매우 밝으면 라이트, 기대선보다 탁하면 뮤트, 나머지는 쿨', () => {
    expect(judgePersonalColor(labFrom(82, 50, 12)).tone12).toBe('여름 라이트')
    expect(judgePersonalColor(labFrom(72, 50, 8)).tone12).toBe('여름 뮤트')
    expect(judgePersonalColor(labFrom(72, 50, 12)).tone12).toBe('여름 쿨')
  })

  test('가을: 매우 어두우면 딥, 기대선보다 탁하면 뮤트, 나머지는 웜', () => {
    expect(judgePersonalColor(labFrom(52, 75, 14)).tone12).toBe('가을 딥')
    expect(judgePersonalColor(labFrom(60, 75, 10)).tone12).toBe('가을 뮤트')
    expect(judgePersonalColor(labFrom(60, 75, 14)).tone12).toBe('가을 웜')
  })

  test('겨울: 매우 어두우면 딥, 기대선보다 선명하면 브라이트, 나머지는 쿨', () => {
    expect(judgePersonalColor(labFrom(52, 50, 14)).tone12).toBe('겨울 딥')
    expect(judgePersonalColor(labFrom(60, 50, 18)).tone12).toBe('겨울 브라이트')
    expect(judgePersonalColor(labFrom(60, 50, 14)).tone12).toBe('겨울 쿨')
  })

  test("'딥'은 두 계절 모두 어두운 쪽이다 — v0의 가을·겨울 상반 배정 회귀 방지", () => {
    expect(judgePersonalColor(labFrom(52, 75, 14)).tone12).toBe('가을 딥')
    expect(judgePersonalColor(labFrom(52, 50, 14)).tone12).toBe('겨울 딥')
  })
})

describe('판정 근거', () => {
  test('결과에 색상각·채도·ITA와 입력 Lab을 함께 담는다', () => {
    const lab = labFrom(70, 70, 15)
    const result = judgePersonalColor(lab)

    expect(result.evidence.skinLab).toEqual(lab)
    expect(result.evidence.hue).toBeCloseTo(70, 1)
    expect(result.evidence.chroma).toBeCloseTo(15, 1)
    expect(typeof result.evidence.ita).toBe('number')
  })
})

describe('계절 분포 — 넓은 범위에서 네 계절이 모두 나온다', () => {
  test('실사진 범위에서 봄·여름·가을·겨울이 모두 출현한다', () => {
    const seasons = new Set<Season>()

    for (let l = SCAN.lMin; l <= SCAN.lMax; l += 2) {
      for (let h = SCAN.hMin; h <= SCAN.hMax; h += 2) {
        seasons.add(judgePersonalColor(labFrom(l, h, 13)).season)
      }
    }

    expect(seasons.size).toBe(4)
  })
})
