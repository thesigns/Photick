// Interface languages. Every topic in data/topics.json has a field per language (en, pl).
// Adding a language: a new entry here and a new field on every topic.

export const STRINGS = {
  en: {
    locale: 'en-GB',
    yourTopic: 'your topic',
    drawn: 'drawn',
    left: (n, total) => `${n} of ${total} left on the wheel`,
    lastOne: 'That was the last topic on the wheel. Next time it’s full again.',
    nextSpin: 'You can spin again tomorrow.',
    spinTitle: 'spin the wheel',
    spinHint: 'Flick the wheel with your thumb, or tap Spin.',
    spin: 'Spin',
    spinAgain: 'Spin the wheel',
    back: 'Back',
    switchTo: 'Switch to English',
    loadFailed: 'Couldn’t load the topics. Check your connection and reload the page.',
  },
  pl: {
    locale: 'pl-PL',
    yourTopic: 'twój temat',
    drawn: 'wylosowany',
    left: (n, total) => `na kole zostało ${n} z ${total}`,
    lastOne: 'To był ostatni temat na kole. Następnym razem koło wraca w komplecie.',
    nextSpin: 'Ponownie zakręcisz jutro.',
    spinTitle: 'zakręć kołem',
    spinHint: 'Pchnij koło kciukiem albo dotknij „Zakręć”.',
    spin: 'Zakręć',
    spinAgain: 'Zakręć kołem',
    back: 'Wróć',
    switchTo: 'Przełącz na polski',
    loadFailed: 'Nie udało się wczytać tematów. Sprawdź połączenie i odśwież stronę.',
  },
};

export const LANGUAGES = Object.keys(STRINGS);

const KEY = 'photick.lang';

// The saved choice, otherwise the phone's language, otherwise English.
export function initialLanguage() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch {
    // no storage — fall through to the phone's language
  }
  const preferred = (navigator.languages ?? [navigator.language]).map((l) => l.slice(0, 2).toLowerCase());
  return preferred.find((l) => LANGUAGES.includes(l)) ?? 'en';
}

export function saveLanguage(lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // not remembered — the app keeps working
  }
}
