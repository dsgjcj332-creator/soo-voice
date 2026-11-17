import type { PosCatalogReviewEntry } from './catalog-review-planner';

export type PosMenuApplyField = 'name' | 'description' | 'price';

export interface PosMenuApplyMapping {
  providerItemId: string;
  menuItemId: string;
  fieldOverrides: Partial<Record<PosMenuApplyField, boolean>>;
}

export interface PosMenuApplyPlan {
  menuItemId: string;
  providerItemId: string;
  patch: Partial<Record<PosMenuApplyField, string | number>>;
  expected: Partial<Record<PosMenuApplyField, string | number | boolean | null>>;
}

/**
 * Produces a narrowly-scoped, merchant-selected patch for a future atomic
 * apply transaction. This is deliberately not a persistence function.
 *
 * Only menu_items fields confirmed by the current application schema are
 * eligible. Category and availability are excluded until their POS-to-menu
 * semantics and storage columns are explicitly defined.
 */
export function buildApprovedPosMenuApplyPlan(
  entry: PosCatalogReviewEntry,
  mapping: PosMenuApplyMapping,
  selectedFields: PosMenuApplyField[],
): PosMenuApplyPlan {
  if (!entry || entry.status !== 'update' || !entry.menuItemId || !entry.incoming) {
    throw new Error('POS_APPLY_REQUIRES_REVIEWED_UPDATE');
  }
  if (
    !mapping ||
    mapping.providerItemId !== entry.providerItemId ||
    mapping.menuItemId !== entry.menuItemId
  ) {
    throw new Error('POS_APPLY_MAPPING_MISMATCH');
  }
  if (!Array.isArray(selectedFields) || selectedFields.length === 0 ||
      new Set(selectedFields).size !== selectedFields.length) {
    throw new Error('POS_APPLY_FIELDS_REQUIRED');
  }

  const allowed = new Set<PosMenuApplyField>(['name', 'description', 'price']);
  const patch: PosMenuApplyPlan['patch'] = {};
  const expected: PosMenuApplyPlan['expected'] = {};

  for (const field of selectedFields) {
    if (!allowed.has(field)) throw new Error('POS_APPLY_FIELD_NOT_SUPPORTED');
    if (mapping.fieldOverrides[field] === true) {
      throw new Error('POS_APPLY_FIELD_PROTECTED');
    }
    const change = entry.changes[field];
    if (!change || change.current === change.proposed) {
      throw new Error('POS_APPLY_FIELD_HAS_NO_CHANGE');
    }
    if (field === 'price') {
      if (typeof change.proposed !== 'number' || !Number.isFinite(change.proposed) ||
          change.proposed < 0 || change.proposed > 1_000_000) {
        throw new Error('POS_APPLY_INVALID_PRICE');
      }
    } else if (typeof change.proposed !== 'string' || change.proposed.length > (field === 'name' ? 200 : 4000)) {
      throw new Error('POS_APPLY_INVALID_TEXT');
    }
    patch[field] = change.proposed;
    expected[field] = change.current;
  }

  return {
    menuItemId: entry.menuItemId,
    providerItemId: entry.providerItemId,
    patch,
    expected,
  };
}
