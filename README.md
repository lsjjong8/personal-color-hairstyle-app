# 사진 기반 퍼스널 컬러·헤어스타일 추천 (1단계 웹)

사진 한 장으로 12타입 퍼스널 컬러와 얼굴형을 분석해 어울리는 색 팔레트·염색 색상·컷 방향을 제안하는 정적 웹 서비스.

- **포지셔닝**: 진단이 아닌 제안 — 재미(엔터테인먼트) 위주
- **개인정보**: 사진은 브라우저 안에서만 처리되고 기기를 떠나지 않는다 (서버 없음)

## 문서

| 문서 | 내용 |
|---|---|
| [docs/context.md](docs/context.md) | 도메인 지식 (진단 체계·피부톤 추출·추천 변수·마켓 심사·개인정보) |
| [docs/adr/](docs/adr/) | 결정 기록 — 001 플랫폼 순서, 002 웹 스택, 003 백엔드 없음, 004 판정 규칙, 005 결과 카드, 006 조명 색 보정 |

## 스택 (ADR-002)

Vite + React + TypeScript + MediaPipe tasks-vision. 분석 코어는 [src/core/](src/core/) — UI 독립 순수 TS 모듈.

## 개발

```bash
npm install
npm run dev
```

배포: `main` push 시 GitHub Actions가 GitHub Pages로 정적 배포 (`.github/workflows/deploy.yml`).
