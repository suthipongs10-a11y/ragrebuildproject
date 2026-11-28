import { z } from 'zod';

/** A locale file is a flat map of translation key → text. */
export const localeSchema = z.record(z.string().regex(/^[a-z0-9_.]+$/), z.string().min(1));
export type LocaleTable = z.infer<typeof localeSchema>;

export const SUPPORTED_LOCALES = ['en', 'th'] as const;
export type LocaleId = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: LocaleId = 'en';
