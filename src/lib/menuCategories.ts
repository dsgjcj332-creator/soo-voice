/**
 * Per-merchant menu categories — the restaurant's own list, no longer
 * hardcoded. Each category has an English id (stable, used as the value
 * stored on each menu item), a bilingual label, and an optional emoji.
 *
 * Persistence: localStorage always (instant + demo mode), Supabase table
 * `menu_categories` for real merchants (see sql/menu_categories.sql).
 * If the Supabase table is not yet migrated, remote save/load degrades
 * gracefully to local-only — the merchant's categories still work
 * on this device, just not synced across devices.
 *
 * The hardcoded `getCategoriesForSector()` list in DigitalMenu has been
 * replaced by this dynamic source. The old `category` field on
 * MenuItem (a string like "Main Course") stays as-is; new items are
 * created with the merchant's first category by default.
 */

import { getSupabase, getSupabaseConfig } from './supabase';

export interface MenuCategory {
  /** Stable id, used as the value stored on MenuItem.category. */
  id: string;
  labelAr: string;
  labelEn: string;
  emoji?: string;
  /** Display order in the menu — lower comes first. */
  order: number;
}

/** Sensible default categories used when the merchant has none yet. */
export const DEFAULT_CATEGORIES: MenuCategory[] = [
  { id: 'Main Course', labelAr: 'أطباق رئيسية وسندوتشات', labelEn: 'Main Course & Sandwiches', emoji: '🍽️', order: 0 },
  { id: 'Appetizers', labelAr: 'مقبلات وبطاطس وصوصات', labelEn: 'Appetizers & Sides', emoji: '🍟', order: 1 },
  { id: 'Drinks', labelAr: 'مشروبات وقهوة وعصائر', labelEn: 'Drinks & Specialty Coffee', emoji: '☕', order: 2 },
  { id: 'Desserts', labelAr: 'حلويات ومخبوزات', labelEn: 'Desserts & Bakery', emoji: '🍰', order: 3 },
  { id: 'Secret Menu', labelAr: 'أطباق سرية للشيف (أوف منيو)', labelEn: 'Chef Secret Menu (Off-Menu)', emoji: '✨', order: 4 },
];

const STORAGE_KEY = (ownerId: string) => `menu_categories_${ownerId}`;

/* --------------------------------- Local ---------------------------------- */

export function loadLocalCategories(ownerId?: string | null): MenuCategory[] {
  if (!ownerId) return [...DEFAULT_CATEGORIES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY(ownerId));
    if (!raw) return [...DEFAULT_CATEGORIES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_CATEGORIES];
    return parsed as MenuCategory[];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

export function saveLocalCategories(ownerId: string, categories: MenuCategory[]) {
  try {
    localStorage.setItem(STORAGE_KEY(ownerId), JSON.stringify(categories));
  } catch (e) {
    console.warn('Could not persist categories locally:', e);
  }
}

/* -------------------------------- Supabase -------------------------------- */

const isMissingTableError = (msg: string): boolean =>
  msg.includes('Could not find the table') ||
  msg.includes('schema cache') ||
  msg.includes('42P01');

export async function fetchCategoriesRemote(ownerId: string): Promise<MenuCategory[] | null> {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('categories')
      .eq('ownerId', ownerId)
      .maybeSingle();
    if (error) {
      const msg = String(error.message || '');
      if (!isMissingTableError(msg)) console.warn('menu_categories fetch error:', msg);
      return null;
    }
    if (data && Array.isArray(data.categories)) {
      return data.categories as MenuCategory[];
    }
    return null;
  } catch (err) {
    console.warn('menu_categories fetch failed:', err);
    return null;
  }
}

export async function saveCategoriesRemote(
  ownerId: string,
  categories: MenuCategory[]
): Promise<boolean> {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured || !supabase) return false;
  try {
    const { error } = await supabase
      .from('menu_categories')
      .upsert(
        { ownerId, categories, updatedAt: Date.now() },
        { onConflict: 'ownerId' }
      );
    if (error) {
      const msg = String(error.message || '');
      if (!isMissingTableError(msg)) console.warn('menu_categories save error:', msg);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('menu_categories save failed:', err);
    return false;
  }
}

/* --------------------------------- Helpers -------------------------------- */

/** Lowercase id slug from a free-text label (used when the merchant
 *  types a new Arabic label and we need a stable id). */
export function makeCategoryId(labelAr: string, labelEn: string): string {
  const base = (labelEn || labelAr || 'category')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'category';
}

/** Look up the bilingual label for a stored item.category id, falling
 *  back to the raw value if the merchant deleted the category. */
export function categoryLabel(
  categoryId: string,
  categories: MenuCategory[],
  language: 'ar' | 'en'
): string {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return categoryId;
  return language === 'ar' ? cat.labelAr : cat.labelEn;
}
