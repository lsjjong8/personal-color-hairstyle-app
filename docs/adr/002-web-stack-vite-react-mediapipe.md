# 002 — 1단계 웹 스택: Vite + React + TypeScript + MediaPipe tasks-vision

- 상태: 승인 (2026-08-10)
- 결정자: PO
- 선행 결정: [001 플랫폼 순서](001-web-first-platform-order.md) — 1단계는 GitHub Pages 정적 웹
- 관련 지식: [context.md](../context.md) §2 피부톤 추출, §3 추천 변수

## 맥락

- 평가 기준 1순위는 **개발 생산성** — 프로토타입 → 사용자 테스트 구간의 속도 (PO, 2026-08-07).
- 제약 조건은 ADR-001이 확정한 "정적 배포 + 브라우저 카메라 + 클라이언트 전용 분석"과의 정합.
- 서비스 코어는 "브라우저에서 얼굴 landmark 추출 + 피부색 분석"이며, 이 생태계(MediaPipe `@mediapipe/tasks-vision`)는 JS/WASM 네이티브다.

## 결정

1단계 웹은 **Vite + React + TypeScript + MediaPipe tasks-vision**으로 구현한다.

- **분석 코어(landmark·색 추출·타입 판정)는 UI 프레임워크에 의존하지 않는 순수 TypeScript 모듈로 분리**한다. Android TWA에서는 웹이 그대로 재사용되고, iOS 네이티브 계층 단계에서도 웹뷰 또는 포팅으로 재사용 가능하게 하기 위함이다.

## 검토한 대안

| 대안 | 기각 사유 |
|---|---|
| Expo / React Native Web | 정적 export·Pages 배포는 공식 지원되나, MediaPipe 웹 분석은 RN 추상화 밖 DOM/canvas 직접 구현이 필요해 1단계 개발 속도가 순수 웹보다 느리다. "한 코드베이스로 앱 전환" 강점도 분석 코어가 웹/네이티브에서 갈려 부분적으로만 성립. |
| Flutter Web | 번들 과대(main.dart.js) 문제와 getUserMedia 미해결 이슈(2025-08 기준 오픈)가 있고, MediaPipe JS 생태계를 Dart에서 쓰기 어렵다. Dart 신규 학습 비용도 개발 생산성 1순위와 충돌. |

- 출처: [Expo — Publish websites](https://docs.expo.dev/guides/publishing-websites/), [Flutter Web 2025 이슈 정리](https://cleancodestack.com/choosing-flutter-web-in-2025-top-8-issues/), [flutter/flutter#175233](https://github.com/flutter/flutter/issues/175233), [MediaPipe Face Landmarker Web 가이드](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)

## 결과 (트레이드오프)

- 최종장 iOS 단계에서 네이티브 계층은 별도 작업으로 남는다 — ADR-001이 이미 수용한 비용이며, 본 결정으로 추가로 나빠지지 않는다.
- Flutter 학습 경험은 이 프로젝트에서 얻지 않는다.
- React·TS는 PO의 일상 업무 스택과 동일해 학습 비용이 사실상 0이다.
