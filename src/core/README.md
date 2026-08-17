# 분석 코어 (UI 독립 — ADR-002)

사진 → 판정 결과까지의 순수 로직 모듈. **React 등 UI 프레임워크를 import하지 않는다.**
Android TWA·iOS 네이티브 계층 단계에서 재사용하기 위한 경계다.

구성 (PRD Phase 2 완료, 2026-08-16):

| 디렉토리 | 역할 |
|---|---|
| `adapters/` | 얼굴 landmark 추출 (MediaPipe tasks-vision) — **외부 라이브러리에 의존하는 유일한 곳** |
| `sampling/` | 피부색 샘플링 (양 볼 2지점, 밝기 절사 평균) — 이마는 앞머리 오염 때문에 제외한다 ([ADR-004](../../docs/adr/004-relative-skin-distribution-judgment.md)) |
| `color/` | sRGB→CIELAB 변환과 파생 지표(채도·색상각·ITA) |
| `rules/` | 퍼스널 컬러 12타입·얼굴형 5분류 판정 규칙 |
| `guide/` | 타입별 팔레트·염색 추천, 얼굴형별 컷 제안 (순수 데이터) |
| `analyze.ts` | 위를 엮는 오케스트레이터. 실패를 예외가 아니라 값으로 돌려준다 |

입출력 계약: 이미지 입력 → 판정 결과 객체(`types.ts`). UI 계층과의 유일한 접점이다.
