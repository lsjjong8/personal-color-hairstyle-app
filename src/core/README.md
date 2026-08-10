# 분석 코어 (UI 독립 — ADR-002)

사진 → 판정 결과까지의 순수 로직 모듈. **React 등 UI 프레임워크를 import하지 않는다.**
Android TWA·iOS 네이티브 계층 단계에서 재사용하기 위한 경계다.

예정 구성 (PRD Phase 2):

- 얼굴 landmark 추출 (MediaPipe tasks-vision 연동)
- 피부색 샘플링 (볼·이마 영역) → sRGB→Lab 변환
- 퍼스널 컬러 12타입 판정 규칙
- 얼굴형 5분류 판정 규칙 (landmark 비율)

입출력 계약: 이미지 입력 → 판정 결과 객체 (UI 계층과의 인터페이스 — Phase 2/3 병렬 개발의 합의 지점).
