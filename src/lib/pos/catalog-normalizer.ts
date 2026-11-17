import type { PosCatalogItem, PosModifierGroup, PosModifierOption } from './types';

const MAX_ITEMS = 10_000;
const MAX_GROUPS = 100;
const MAX_OPTIONS = 200;
const MAX_MONEY = 1_000_000;

function text(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`INVALID_POS_CATALOG_${field.toUpperCase()}`);
  }
  return value.trim();
}

function money(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_MONEY) {
    throw new Error(`INVALID_POS_CATALOG_${field.toUpperCase()}`);
  }
  return Math.round(value * 100) / 100;
}

function signedMoney(value: unknown, field: string): number {\n  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_MONEY) {\n    throw new Error(`INVALID_POS_CATALOG_${field.toUpperCase()}`);\n  }\n  return Math.round(value * 100) / 100;\n}\n\nfunction normalizeOption(value: unknown): PosModifierOption {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_POS_CATALOG_MODIFIER_OPTION');
  }
  const row = value as Record<string, unknown>;
  return {
    id: text(row.id, 'modifier_option_id', 160),
    ...(row.providerId === undefined ? {} : { providerId: text(row.providerId, 'modifier_option_provider_id', 160) }),
    name: text(row.name, 'modifier_option_name'),
    priceDelta: money(row.priceDelta, 'modifier_option_price'),
    available: row.available === true,
  };
}

function normalizeGroup(value: unknown): PosModifierGroup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_POS_CATALOG_MODIFIER_GROUP');
  }
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.options) || row.options.length > MAX_OPTIONS) {
    throw new Error('INVALID_POS_CATALOG_MODIFIER_OPTIONS');
  }
  const min = row.minSelections;
  const max = row.maxSelections;
  if (!Number.isInteger(min) || !Number.isInteger(max) || (min as number) < 0 ||
      (max as number) < (min as number) || (max as number) > row.options.length) {
    throw new Error('INVALID_POS_CATALOG_MODIFIER_SELECTIONS');
  }
  if (typeof row.required !== 'boolean') throw new Error('INVALID_POS_CATALOG_MODIFIER_REQUIRED');\n  if (row.required && (min as number) < 1) throw new Error('INVALID_POS_CATALOG_MODIFIER_REQUIRED');\n  const options = row.options.map(normalizeOption);
  if (new Set(options.map(option => option.id)).size !== options.length) {
    throw new Error('DUPLICATE_POS_CATALOG_MODIFIER_OPTION');
  }
  return {
    id: text(row.id, 'modifier_group_id', 160),
    ...(row.providerId === undefined ? {} : { providerId: text(row.providerId, 'modifier_group_provider_id', 160) }),
    name: text(row.name, 'modifier_group_name'),
    required: row.required === true,
    minSelections: min as number,
    maxSelections: max as number,
    options,
  };
}

/**
 * Validate and copy provider data before it enters SooVoice's canonical catalog.
 * Provider adapters should map vendor payloads into this shape; this boundary
 * rejects malformed identifiers, unsafe numeric values and inconsistent modifiers.
 */
export function normalizePosCatalog(input: unknown): PosCatalogItem[] {
  if (!Array.isArray(input) || input.length > MAX_ITEMS) {
    throw new Error('INVALID_POS_CATALOG');
  }
  const rows = input.map((value): PosCatalogItem => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('INVALID_POS_CATALOG_ITEM');
    }
    const row = value as Record<string, unknown>;
    if (typeof row.available !== 'boolean' || !Array.isArray(row.locationIds) || row.locationIds.length > 500 ||
        !Array.isArray(row.modifierGroups) || row.modifierGroups.length > MAX_GROUPS) {
      throw new Error('INVALID_POS_CATALOG_COLLECTION');
    }
    const currency = text(row.currency, 'currency', 3);
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('INVALID_POS_CATALOG_CURRENCY');
    const modifierGroups = row.modifierGroups.map(normalizeGroup);
    if (new Set(modifierGroups.map(group => group.id)).size !== modifierGroups.length) {
      throw new Error('DUPLICATE_POS_CATALOG_MODIFIER_GROUP');
    }
    const updatedAt = text(row.updatedAt, 'updated_at', 40);
    if (!Number.isFinite(Date.parse(updatedAt))) throw new Error('INVALID_POS_CATALOG_UPDATED_AT');
    return {
      id: text(row.id, 'id', 160),
      providerId: text(row.providerId, 'provider_id', 160),
      locationIds: row.locationIds.map(id => text(id, 'location_id', 160)),
      ...(row.categoryId === undefined ? {} : { categoryId: text(row.categoryId, 'category_id', 160) }),
      name: text(row.name, 'name'),
      ...(row.description === undefined ? {} : { description: text(row.description, 'description', 2000) }),
      currency,
      unitPrice: money(row.unitPrice, 'unit_price'),
      available: row.available === true,
      modifierGroups,
      ...(row.sourceVersion === undefined ? {} : { sourceVersion: text(row.sourceVersion, 'source_version', 160) }),
      updatedAt: new Date(updatedAt).toISOString(),
    };
  });
  for (const row of rows) {\n    if (new Set(row.locationIds).size !== row.locationIds.length) {\n      throw new Error('DUPLICATE_POS_CATALOG_LOCATION');\n    }\n  }\n  const providerIds = rows.map(row => row.providerId);
  if (new Set(providerIds).size !== providerIds.length) {
    throw new Error('DUPLICATE_POS_CATALOG_PROVIDER_ITEM');
  }
  return rows;
}
