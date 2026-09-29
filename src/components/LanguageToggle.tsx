import { SUPPORTED_LOCALES, type Locale } from '../i18n/locale'
import type { UiText } from '../i18n/uiText'

interface LanguageToggleProps {
  locale: Locale
  onChange: (next: Locale) => void
  t: UiText
}

/**
 * 언어 전환 — 화면 셋 어디서나 보이도록 `App`이 화면 위에 함께 그린다.
 *
 * 버튼에 **갈 곳**의 언어 이름을 적는다(현재 언어가 아니라). 현재 언어를
 * 적으면 "지금 이게 뭔지"인지 "누르면 뭐가 되는지"인지 읽는 사람이 갈린다.
 */
export function LanguageToggle({ locale, onChange, t }: LanguageToggleProps) {
  const next = SUPPORTED_LOCALES.find((candidate) => candidate !== locale) ?? locale

  return (
    <button
      type="button"
      className="language-toggle"
      /*
       * 접근성 이름에 **보이는 글자를 포함한다**(WCAG 2.5.3 Label in Name).
       * 보이는 글자를 덮어쓰면 음성 제어 사용자가 "English 클릭"이라고 말해도
       * 매칭되지 않아 이 버튼을 누를 수 없다 — 언어를 바꿀 유일한 수단인데.
       */
      aria-label={`${t.languageToggle.label}: ${t.languageToggle.to}`}
      /*
       * 이 글자는 구조상 **항상 반대 언어**다. html lang이 현재 언어로 맞춰져
       * 있어 표시하지 않으면 화면 낭독기가 엉뚱한 음소로 읽는다.
       */
      lang={next}
      onClick={() => onChange(next)}
    >
      {t.languageToggle.to}
    </button>
  )
}
