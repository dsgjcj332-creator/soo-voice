/**
 * Single source of truth for currencies across the whole app.
 * Settings page, Digital Menu designer, Store front, KDS, Billing and the
 * AI voice prompt must ALL read from here — never redefine symbol maps locally.
 */

export type CurrencyCode = 'EGP' | 'SAR' | 'AED' | 'KWD' | 'QAR' | 'USD';

export interface CurrencyInfo {
  code: CurrencyCode;
  /** Compact display symbol, e.g. "ج.م" */
  symbol: string;
  labelAr: string;
  labelEn: string;
  /** true when the symbol is written before the number (western convention) */
  symbolBefore: boolean;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  EGP: { code: 'EGP', symbol: 'ج.م', labelAr: 'جنيه مصري', labelEn: 'Egyptian Pound', symbolBefore: false },
  SAR: { code: 'SAR', symbol: 'ر.س', labelAr: 'ريال سعودي', labelEn: 'Saudi Riyal', symbolBefore: false },
  AED: { code: 'AED', symbol: 'د.إ', labelAr: 'درهم إماراتي', labelEn: 'UAE Dirham', symbolBefore: false },
  KWD: { code: 'KWD', symbol: 'د.ك', labelAr: 'دينار كويتي', labelEn: 'Kuwaiti Dinar', symbolBefore: false },
  QAR: { code: 'QAR', symbol: 'ر.ق', labelAr: 'ريال قطري', labelEn: 'Qatari Riyal', symbolBefore: false },
  USD: { code: 'USD', symbol: '$', labelAr: 'دولار أمريكي', labelEn: 'US Dollar', symbolBefore: true },
};

export const CURRENCY_LIST: CurrencyInfo[] = [
  CURRENCIES.EGP,
  CURRENCIES.SAR,
  CURRENCIES.AED,
  CURRENCIES.KWD,
  CURRENCIES.QAR,
  CURRENCIES.USD,
];

export const DEFAULT_CURRENCY: CurrencyCode = 'EGP';

/** Legacy saved configs stored raw symbols instead of currency codes. */
const LEGACY_SYMBOL_TO_CODE: Record<string, CurrencyCode> = {
  '$': 'USD',
  'E£': 'EGP',
  'ج.م': 'EGP',
  'ر.س': 'SAR',
  '﷼': 'SAR',
  'د.إ': 'AED',
  'د.ك': 'KWD',
  'ر.ق': 'QAR',
};

/** Normalize any stored value (code, legacy symbol, random case) to a valid currency code. */
export function normalizeCurrency(value?: string | null): CurrencyCode {
  if (!value) return DEFAULT_CURRENCY;
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  if (upper in CURRENCIES) return upper as CurrencyCode;
  if (trimmed in LEGACY_SYMBOL_TO_CODE) return LEGACY_SYMBOL_TO_CODE[trimmed];
  return DEFAULT_CURRENCY;
}

export function currencyInfo(code?: string | null): CurrencyInfo {
  return CURRENCIES[normalizeCurrency(code)];
}

export function currencySymbol(code?: string | null): string {
  return currencyInfo(code).symbol;
}

/** Format an amount with the right currency, e.g. "12.99 ج.م" or "$12.99". */
export function formatPrice(amount: number | undefined | null, code?: string | null): string {
  const info = currencyInfo(code);
  const safe = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return info.symbolBefore ? `${info.symbol}${formatted}` : `${formatted} ${info.symbol}`;
}

/** Human-readable currency name for AI prompts, e.g. "جنيه مصري (EGP)". */
export function currencyPromptLabel(code?: string | null, language?: 'ar' | 'en'): string {
  const info = currencyInfo(code);
  return language === 'en'
    ? `${info.labelEn} (${info.code})`
    : `${info.labelAr} (${info.code})`;
}
