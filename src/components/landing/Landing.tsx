import type { UiText } from '../../i18n/uiText'

interface LandingProps {
  onStart: () => void
  t: UiText
}

/**
 * 진입 화면 — 시작 전에 두 가지를 먼저 알린다.
 *   1. 이것은 진단이 아니라 제안이다 (포지셔닝)
 *   2. 사진은 기기를 떠나지 않는다 (ADR-003 구조를 사용자 언어로)
 *
 * 두 고지의 문장은 `t.notice`에서 온다 — **결과 카드와 같은 값**이다.
 * 종전에는 두 곳이 서로 다르게 적혀 있었다.
 */
export function Landing({ onStart, t }: LandingProps) {
  return (
    <main className="screen">
      <h1>
        {t.landing.titleLine1}
        <br />
        {t.landing.titleLine2}
      </h1>

      <p className="lead">
        {t.landing.lead} {t.notice.fun}.
      </p>

      <section className="notice" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">{t.notice.privacy}</h2>
        <p>{t.landing.privacyBody}</p>
      </section>

      <section className="notice" aria-labelledby="accuracy-heading">
        <h2 id="accuracy-heading">{t.landing.accuracyHeading}</h2>
        <p>{t.landing.accuracyBody}</p>
      </section>

      <button type="button" className="primary" onClick={onStart}>
        {t.landing.start}
      </button>
    </main>
  )
}
