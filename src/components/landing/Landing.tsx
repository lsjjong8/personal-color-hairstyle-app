interface LandingProps {
  onStart: () => void
}

/**
 * 진입 화면 — 시작 전에 두 가지를 먼저 알린다.
 *   1. 이것은 진단이 아니라 제안이다 (포지셔닝)
 *   2. 사진은 기기를 떠나지 않는다 (ADR-003 구조를 사용자 언어로)
 */
export function Landing({ onStart }: LandingProps) {
  return (
    <main className="screen">
      <h1>
        사진으로 보는
        <br />
        퍼스널 컬러 · 헤어스타일
      </h1>

      <p className="lead">
        얼굴 사진 한 장으로 어울리는 색과 머리 스타일을 제안합니다. 재미로 보는
        제안이며, 전문 진단을 대신하지 않습니다.
      </p>

      <section className="notice" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">사진은 어디로도 보내지 않습니다</h2>
        <p>
          분석은 전부 이 브라우저 안에서 이뤄집니다. 사진이 서버로 전송되거나
          저장되는 일이 없습니다.
        </p>
      </section>

      <section className="notice" aria-labelledby="accuracy-heading">
        <h2 id="accuracy-heading">결과는 조명에 따라 달라집니다</h2>
        <p>
          같은 사람도 조명이 바뀌면 다른 결과가 나옵니다. 전문 진단사끼리도 결과가
          갈리는 분야입니다. 창가의 자연광에서 찍으면 좀 더 안정적입니다.
        </p>
      </section>

      <button type="button" className="primary" onClick={onStart}>
        시작하기
      </button>
    </main>
  )
}
