# 사진 기반 퍼스널 컬러·헤어스타일 추천 (1단계 웹)

사진 한 장으로 12타입 퍼스널 컬러와 얼굴형을 분석해 어울리는 색 팔레트·염색 색상·컷 방향을 제안하는 정적 웹 서비스.

**[바로 써 보기](https://lsjjong8.github.io/personal-color-hairstyle-app/)** — 설치 없이 브라우저에서 동작한다.

- **포지셔닝**: 진단이 아닌 제안 — 재미(엔터테인먼트) 위주 ([ADR-001](docs/adr/001-web-first-platform-order.md))
- **개인정보**: 사진은 브라우저 안에서만 처리되고 기기를 떠나지 않는다. 서버가 없어 사업자 관점에서 개인정보 "수집" 자체가 발생하지 않는 구조다 ([ADR-003](docs/adr/003-no-backend-phase1.md))

---

## 이 서비스가 보장하지 않는 것

먼저 적는다. 아래는 겸양이 아니라 이 저장소에 기록된 사실이며, 각 항목의 근거 문서를 열어 확인할 수 있다.

- **정확도를 측정한 적이 없다.** 판정 기준선은 실사진 **4장**에서 나온 잠정값이고, 그 4장으로 검증까지 해서 순환적이다. 이 한계는 [ADR-007 §결과](docs/adr/007-recalibrate-thresholds-on-real-photos.md)에 그 문서가 스스로 적어 두었다 — 경계와 표본 사이 여유가 최소 0.05로 노이즈 수준이라는 것까지.
- **동료 배포·피드백 수집은 하지 않았다.** 원래 계획(PRD Phase 5)은 동료 12명 사용·피드백 12건이었으나 **2026-09-05에 범위를 줄여 종결**했다. 실제로 확인된 것은 링크가 열린다는 것 하나다. 따라서 위 "표본 4장"은 중간 상태가 아니라 **현재의 최종 상태**이며, 실기기 검증 3건(iOS Safari 동작·EXIF 회전·미리보기 좌우 불일치)도 미검증으로 남았다.
- **같은 사람도 조명이 바뀌면 결과가 바뀔 수 있다.** 조명 보정으로 편차를 줄였지만 없애지는 못했다. 도메인의 근본 한계이며 [context.md §2](docs/context.md)에 그렇게 적었다.
- **이 분야에는 표준 진단 절차도 공인 자격도 없다.** 진단사끼리도 결과가 갈린다. 그래서 목표를 "정답 맞히기"가 아니라 **한쪽으로 쏠리지 않는 판정**으로 잡았다 ([ADR-004](docs/adr/004-relative-skin-distribution-judgment.md)).

## 판정 방법

각 항목은 코드로 바로 갈 수 있다. 위치 없는 주장은 두지 않는다.

| 축 | 방법 | 위치 |
|---|---|---|
| 색공간 | sRGB → CIELAB. 밝기 L\*, 색상각 h°, 채도 C\* | [lab.ts](src/core/color/lab.ts) |
| 조명 색 보정 | 눈 흰자를 무채색 기준으로 삼아 채널 배율을 잰다. 흰자는 밝기가 아니라 **채도**로 찾는다 — 밝기로 찾으면 눈꺼풀 피부를 흰자로 오인한다 | [whiteBalance.ts](src/core/color/whiteBalance.ts) · [ADR-006](docs/adr/006-white-balance-by-eye-sclera.md) |
| 노출 정규화 | 보정된 기준을 목표 밝기로 맞춘다. 색 보정 배율과 **곱해서 한 번에** 적용한다 — 따로 걸면 노출을 색 보정 전 기준으로 재게 되어 어긋난다 | [exposure.ts](src/core/color/exposure.ts) · [analyze.ts](src/core/analyze.ts) |
| 웜/쿨 | 색상각 h° — CIELAB의 a·b 두 축을 함께 쓴다 | [personalColor.ts](src/core/rules/personalColor.ts) |
| 채도 | C\* 절대값이 아니라 **명도에 따라 기대되는 값과의 차이(잔차)**. 채도와 명도가 서로 무관하지 않기 때문이다 | 같은 파일 · [ADR-004](docs/adr/004-relative-skin-distribution-judgment.md)·[007](docs/adr/007-recalibrate-thresholds-on-real-photos.md) |
| 입력 품질 | 보정 적용 여부·기준 밝기·**잘린 픽셀 비율**을 결과에 함께 남긴다 | [types.ts](src/core/types.ts) · [skinSampling.ts](src/core/sampling/skinSampling.ts) |

마지막 줄이 이 프로젝트에서 가장 늦게 배운 것이다. **보정이 "적용됨"이라는 표시는 결과를 믿어도 된다는 뜻이 아니다.** 배율이 1을 넘으면 밝은 피부 채널이 255에서 잘리는데, 그 손상은 보정이 걸린 사진에서 오히려 더 잘 난다. 게다가 한 채널만 잘리면 밝기는 정상 범위에 남고 색만 틀어져 눈으로는 구분되지 않는다. 그래서 잘린 비율을 따로 재서 보여 준다.

## 다른 공개 구현과의 대조

[docs/benchmark.md](docs/benchmark.md)에 GitHub 공개 구현 5건과 상용 서비스 3곳의 대조를 남겼다. 상대의 판정 임계값·표본 수·조명 보정 유무는 README 서술이 아니라 **소스 코드에서 직접 확인**했다.

요지 두 줄:

- 조명 보정, 채도의 명도 의존, 입력 품질 표시 — 이 셋을 함께 갖춘 공개 구현은 조사 범위에서 찾지 못했다.
- **그런데 그것이 맞는지는 아직 모른다.** 가장 많이 참조되는 공개 구현인 [ShowMeTheColor](https://github.com/starbucksdolcelatte/ShowMeTheColor)는 40장으로 정확도를 재서 "여름·겨울 각 50%"라는 **틀렸다는 사실**을 알아냈다. 우리는 4장뿐이라 맞는지 틀린지를 알 수단 자체가 없다.

따라서 필요한 것은 방법 개선이 아니라 표본이다. **그런데 그 표본 수집은 하지 않은 채로 트랙이 종결됐다**(2026-09-05, 위 §보장하지 않는 것). 수집 절차는 [docs/sample-collection.md](docs/sample-collection.md)에 준비돼 있고, 다시 열린다면 거기서 시작한다.

## 직접 확인하는 법

위 서술을 믿지 않아도 된다. 받아서 돌려 보면 된다.

```bash
git clone https://github.com/lsjjong8/personal-color-hairstyle-app.git
cd personal-color-hairstyle-app
npm install
npx vitest run      # 테스트 111건
npx tsc --noEmit    # 타입 검사
npm run build
```

테스트는 각 축이 무엇을 지키는지를 이름에 적어 두었다. 특히 [analyze.test.ts](src/core/analyze.test.ts)의 "기준 밝기는 색 보정을 거친 값이다"와 [whiteBalance.test.ts](src/core/color/whiteBalance.test.ts)의 기준 포기 경로 4종이, 위 표의 서술이 실제 동작인지를 확인해 준다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/context.md](docs/context.md) | 도메인 지식 — 진단 체계·피부톤 추출·추천 변수·마켓 심사·개인정보 |
| [docs/adr/](docs/adr/) | 결정 기록 7건 — 플랫폼 순서·웹 스택·백엔드 없음·판정 규칙·결과 카드·조명 보정·기준선 재보정 |
| [docs/benchmark.md](docs/benchmark.md) | 공개 구현·상용 서비스 대조와 자체 평가 |
| [docs/sample-collection.md](docs/sample-collection.md) | 표본 수집 양식과 규칙 |
| [src/core/README.md](src/core/README.md) | 분석 코어 모듈 구성 |

결정 기록(ADR)에는 채택한 안뿐 아니라 **버린 안과 그 이유, 그리고 그 결정이 나중에 틀렸다고 드러난 경위**도 함께 적혀 있다. ADR-004가 정한 기준선이 ADR-007에서 뒤집힌 과정이 그 예다.

## 스택

Vite + React + TypeScript + MediaPipe tasks-vision ([ADR-002](docs/adr/002-web-stack-vite-react-mediapipe.md)). 분석 코어는 [src/core/](src/core/)에 UI와 분리된 순수 TypeScript 모듈로 두었다 — 화면 없이 테스트할 수 있게 하려는 것이다.

## 개발

```bash
npm install
npm run dev
```

배포: `main`에 push하면 GitHub Actions가 GitHub Pages로 정적 배포한다 (`.github/workflows/deploy.yml`).
