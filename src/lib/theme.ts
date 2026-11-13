/**
 * Shared brand-accent palette used by the Menu Designer, the customer Store,
 * and the embeddable VoiceWidget. The designer stores a color NAME; every
 * surface resolves it through this map so colors stay consistent everywhere.
 */

export interface BrandColor {
  key: string;
  /** Main hex — headers, primary buttons, launcher background */
  hex: string;
  /** Darker hex — gradients end, hover states */
  dark: string;
  /** Light tint — subtle backgrounds, icon chips */
  bgLight: string;
  /** Text/icon color on light tint backgrounds */
  textOnLight: string;
  nameAr: string;
  nameEn: string;
}

export const BRAND_COLORS: Record<string, BrandColor> = {
  indigo: {
    key: 'indigo',
    hex: '#4f46e5',
    dark: '#4338ca',
    bgLight: '#eef2ff',
    textOnLight: '#4f46e5',
    nameAr: 'نيلي',
    nameEn: 'Indigo',
  },
  rose: {
    key: 'rose',
    hex: '#e11d48',
    dark: '#be123c',
    bgLight: '#fff1f2',
    textOnLight: '#e11d48',
    nameAr: 'وردي',
    nameEn: 'Rose',
  },
  emerald: {
    key: 'emerald',
    hex: '#059669',
    dark: '#047857',
    bgLight: '#ecfdf5',
    textOnLight: '#059669',
    nameAr: 'زمردي',
    nameEn: 'Emerald',
  },
  amber: {
    key: 'amber',
    hex: '#f59e0b',
    dark: '#d97706',
    bgLight: '#fffbeb',
    textOnLight: '#b45309',
    nameAr: 'برتقالي',
    nameEn: 'Amber',
  },
  violet: {
    key: 'violet',
    hex: '#7c3aed',
    dark: '#6d28d9',
    bgLight: '#f5f3ff',
    textOnLight: '#7c3aed',
    nameAr: 'بنفسجي',
    nameEn: 'Violet',
  },
  gold: {
    key: 'gold',
    hex: '#a16207',
    dark: '#854d0e',
    bgLight: '#fefce8',
    textOnLight: '#a16207',
    nameAr: 'ذهبي فاخر',
    nameEn: 'Luxury Gold',
  },
};

export const DEFAULT_BRAND_COLOR = 'indigo';

export function brandColor(name?: string | null): BrandColor {
  return BRAND_COLORS[name || ''] || BRAND_COLORS[DEFAULT_BRAND_COLOR];
}
