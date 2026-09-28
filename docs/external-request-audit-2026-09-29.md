# 외부 요청 실측 — 2026-09-29

> 목적: [context.md §5](context.md)와 [ADR-003](adr/003-no-backend-phase1.md)이 근거로 삼는 고지 *"사진은 기기를 떠나지 않습니다"*가 **실행 중에도 참인지**를 관측으로 확인한다.
> 계기: 배포 번들에 `https://odml.pa.googleapis.com/v1/log` 문자열이 있는 것이 확인됐으나, **실제로 호출되는지는 미확인**이었다.

## 목차

1. 결과 한 줄
2. 무엇을 쟀나
3. 관측 결과
4. 코드 축 — 그 문자열의 정체
5. 덮지 못한 것
6. 판정

## 1. 결과 한 줄

✅ **외부 요청 0건** — 관측된 요청 **6건이 전부 같은 출처(localhost)**였다. 분모를 적는다: 페이지 로드부터 결과 화면까지 발생한 **전체 요청 6건 중 외부 0건**이다.

## 2. 무엇을 쟀나

| 항목 | 값 |
|---|---|
| 대상 | `npm run build` 산출물을 `vite preview`로 서빙 (`http://localhost:4173/personal-color-hairstyle-app/`) |
| 번들 | `dist/assets/index-BEcXVeB1.js` |
| 관측 도구 | 브라우저 네트워크 기록 + 콘솔 |
| 거친 경로 | 랜딩 → 사진 화면(모델 미리 받기) → 파일 업로드 → 추론 1회 → 결과 화면 |
| 체류 시간 | 약 2분 30초 — 로거 flush 주기(60초)를 **두 번 이상** 지났다 |

★ **체류 시간을 따로 적는 이유**: 로거가 `setInterval(…, 60000)`으로 돌기 때문에 **10초짜리 관측은 한 번도 전송 시점을 지나지 않는다.** 처음 잰 값이 그랬고, 그대로 「0건」이라 적었으면 **재지 않은 것을 잰 것처럼** 보고할 뻔했다.

## 3. 관측 결과

```
GET  /personal-color-hairstyle-app/                                200
GET  /personal-color-hairstyle-app/assets/index-*.js               200
GET  /personal-color-hairstyle-app/assets/index-*.css              200
GET  /personal-color-hairstyle-app/wasm/vision_wasm_internal.js    200
GET  /personal-color-hairstyle-app/wasm/vision_wasm_internal.wasm  200
GET  /personal-color-hairstyle-app/models/face_landmarker.task     200
```

모델과 wasm까지 **같은 출처에서** 왔다 — `vite.config.ts`의 wasm 복사 플러그인과 `public/models/`의 자체 호스팅이 의도대로 동작한다.

콘솔에는 MediaPipe 그래프가 실제로 돌았다는 기록이 남았다(`Graph successfully started running.`, XNNPACK 델리게이트 생성, 추론 시각 기록). 즉 **추론 경로를 타지 않은 채 0건이 나온 것이 아니다.**

번들에 있는 외부 호스트 문자열은 셋이고 나머지 둘은 요청 대상이 아니다.

| 문자열 | 정체 |
|---|---|
| `odml.pa.googleapis.com` | MediaPipe 로그 전송 경로 (아래 §4) |
| `react.dev` | React 오류 안내 링크 문자열 |
| `www.w3.org` | SVG 네임스페이스 식별자 |

## 4. 코드 축 — 그 문자열의 정체

번들에서 해당 호출 지점을 읽으면 구조가 이렇다.

```js
constructor(e){ this.h=[]; …; this.g=setInterval(()=>{this.flush()}, 6e4) }
flush(e,t){
  if(this.error) …
  else if(this.h.length===0) e?.();        // ← 큐가 비면 아무것도 보내지 않는다
  else { … this.m.send({url:`https://odml.pa.googleapis.com/v1/log`, bb:`POST`, …}) }
}
```

- 전송은 **큐에 쌓인 것이 있을 때만** 일어난다.
- 보내는 것은 protobuf 본문이며 `withCredentials:!1`(자격증명 미포함)이다.
- ⚠ **사진 픽셀이 전송된다는 증거는 이번에도 없다** — 다만 "없다"는 것은 **이 경로로는 확인되지 않았다**는 뜻이고, 본문 내용을 해독해 확인한 것은 아니다. 관측된 전송이 0건이라 해독할 대상 자체가 없었다.

## 5. 덮지 못한 것

「0건」의 범위를 좁혀 적는다. 아래는 **재지 않은 것**이다.

| # | 덮지 못한 것 | 왜 |
|---|---|---|
| 1 | ❌ **얼굴이 실제로 검출된 경로** | 합성 이미지를 넣어 `no-face-detected`로 끝났다. 검출 성공 뒤의 랜드마크 처리 구간은 지나지 않았다. 저장소에 얼굴 표본이 없다 |
| 2 | ❌ 실기기·실브라우저(모바일 Safari·Chrome) | 데스크톱 브라우저 한 대에서만 쟀다 |
| 3 | ❌ 장시간 사용(수십 분) | 2분 30초까지만 봤다 |
| 4 | ❌ 배포본(GitHub Pages) | 로컬 preview 서버 기준이다. 산출물은 같지만 서빙 환경이 다르다 |

★ 1번이 가장 큰 공백이다. **얼굴 사진 한 장으로 닫힌다** — 표본이 생기면 같은 절차를 다시 돌린다.

## 6. 판정

PO 결정(2026-09-28)은 조건부였다 — *"요청이 확인되면 **막고**(CSP `connect-src 'self'` 후보) 다시 재서 0건을 확인한 뒤 두 언어 모두 강한 고지 문구를 쓴다."*

⇒ **요청이 확인되지 않았으므로 차단 작업에 착수하지 않는다.** 조건이 성립하지 않았다.

⚠ 다만 **코드 경로는 번들 안에 남아 있다.** 위 §5의 공백 1~4에서 발현할 가능성을 배제하지 못한다. 그래서 고지 문구의 수위는 다음과 같이 가른다(설계 판정문 §7과 같은 축).

- ✅ **"분석은 이 브라우저 안에서 이뤄집니다"** — 관측과 구조 둘 다 뒷받침한다.
- ⚠ **"어떤 요청도 나가지 않습니다"** — 이번 관측 범위에서는 참이나 **전 범위를 덮지 못했다.** 이 문장을 쓰려면 §5의 공백을 닫거나 CSP로 구조적으로 막아야 한다.

★ **선택지 하나를 열어 둔다**: CSP `connect-src 'self'`를 **선제적으로** 걸면 §5의 공백 넷이 한꺼번에 닫히고 고지를 강하게 쓸 수 있다. 비용은 자체 호스팅 자산만 쓰는 현 구조에서 사실상 0이다. **PO 판정 사항** — 현 결정 문면은 "요청이 확인되면"이라 지금은 착수 근거가 없다.
