import en from '../data/locales/en.json';
import th from '../data/locales/th.json';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type LocaleId, type LocaleTable } from '../data/schema';

const tables: Record<LocaleId, LocaleTable> = { en, th };
let current: LocaleId = DEFAULT_LOCALE;

export function resolveLocale(languageTag: string): LocaleId {
  const base = languageTag.toLowerCase().split('-')[0];
  return SUPPORTED_LOCALES.find((id) => id === base) ?? DEFAULT_LOCALE;
}

export function setLocale(id: LocaleId): void {
  current = id;
}

export function getLocale(): LocaleId {
  return current;
}

/** Looks up a UI string. Missing keys render as the key so they are easy to spot. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const template = tables[current][key] ?? tables[DEFAULT_LOCALE][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}
