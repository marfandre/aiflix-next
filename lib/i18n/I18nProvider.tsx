'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { dict, DEFAULT_LOCALE, LOCALES, type Locale, type DictKey } from './dict';

const STORAGE_KEY = 'waiva.locale';

type Vars = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: DictKey, vars?: Vars) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(str: string, vars?: Vars): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'ru' || stored === 'en') return stored;
  const nav = window.navigator?.language?.toLowerCase() ?? '';
  if (nav.startsWith('ru')) return 'ru';
  return 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // SSR/первый клиентский рендер всегда DEFAULT_LOCALE — иначе hydration mismatch.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const detected = detectInitialLocale();
    if (detected !== locale) setLocaleState(detected);
    // обновляем <html lang> для accessibility/SEO
    if (typeof document !== 'undefined') {
      document.documentElement.lang = detected;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((l: Locale) => {
    if (!LOCALES.includes(l)) return;
    setLocaleState(l);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    }
  }, []);

  const t = useCallback(
    (key: DictKey, vars?: Vars) => {
      const table = dict[locale] ?? dict[DEFAULT_LOCALE];
      const raw = table[key] ?? dict[DEFAULT_LOCALE][key] ?? key;
      return interpolate(raw, vars);
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // фолбэк: вне провайдера — отдаём дефолтный словарь, без реактивности
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key, vars) => interpolate(dict[DEFAULT_LOCALE][key] ?? key, vars),
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
