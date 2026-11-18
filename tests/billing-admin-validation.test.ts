import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTrustedPlatformAdmin,
  isValidPlanInput,
  isValidPlanPatch,
  isValidPriceInput,
  isValidPromotionInput,
} from '../src/lib/billing-admin-api';

const planId = '123e4567-e89b-12d3-a456-426614174000';

test('plan creation accepts a constrained plan definition', () => {
  assert.equal(isValidPlanInput({
    plan_key: 'growth', display_name: 'Growth', features: { voice: true },
    usage_limits: { monthly_orders: 1000 }, is_active: false,
  }), true);
});

test('plan creation rejects invalid keys, oversized names, and non-object feature data', () => {
  assert.equal(isValidPlanInput({ plan_key: 'Growth!', display_name: 'Growth' }), false);
  assert.equal(isValidPlanInput({ plan_key: 'growth', display_name: 'x'.repeat(101) }), false);
  assert.equal(isValidPlanInput({ plan_key: 'growth', display_name: 'Growth', features: [] }), false);
});

test('plan patch accepts only mutable allowlisted fields', () => {
  assert.equal(isValidPlanPatch({ display_name: 'Growth Plus', is_active: true }), true);
  assert.equal(isValidPlanPatch({ plan_key: 'enterprise' }), false);
  assert.equal(isValidPlanPatch({ status: 'active' }), false);
  assert.equal(isValidPlanPatch({}), false);
});

test('price validation requires supported interval, currency, and nonnegative minor units', () => {
  assert.equal(isValidPriceInput({
    plan_id: planId, currency: 'EGP', billing_interval: 'monthly', amount_minor: 149000,
  }), true);
  assert.equal(isValidPriceInput({
    plan_id: planId, currency: 'egp', billing_interval: 'monthly', amount_minor: 149000,
  }), false);
  assert.equal(isValidPriceInput({
    plan_id: planId, currency: 'EGP', billing_interval: 'weekly', amount_minor: 149000,
  }), false);
  assert.equal(isValidPriceInput({
    plan_id: planId, currency: 'EGP', billing_interval: 'monthly', amount_minor: -1,
  }), false);
});

test('price effective end must be later than its start', () => {
  assert.equal(isValidPriceInput({
    plan_id: planId, currency: 'EGP', billing_interval: 'monthly', amount_minor: 100,
    effective_from: '2026-01-02T00:00:00Z', effective_until: '2026-01-01T00:00:00Z',
  }), false);
});

test('percentage promotion is bounded and cannot mix fixed amount fields', () => {
  const valid = {
    code: 'LAUNCH50', discount_type: 'percent', percent_off: 50,
    starts_at: '2026-01-01T00:00:00Z', ends_at: '2027-01-01T00:00:00Z',
    max_redemptions: 10, first_ten_offer: true,
  };
  assert.equal(isValidPromotionInput(valid), true);
  assert.equal(isValidPromotionInput({ ...valid, percent_off: 101 }), false);
  assert.equal(isValidPromotionInput({ ...valid, amount_off_minor: 100 }), false);
});

test('fixed promotion requires a positive amount and explicit currency', () => {
  const valid = {
    code: 'SAVE100', discount_type: 'fixed', amount_off_minor: 10000, currency: 'EGP',
    starts_at: '2026-01-01T00:00:00Z', ends_at: '2027-01-01T00:00:00Z',
  };
  assert.equal(isValidPromotionInput(valid), true);
  assert.equal(isValidPromotionInput({ ...valid, amount_off_minor: 0 }), false);
  assert.equal(isValidPromotionInput({ ...valid, currency: undefined }), false);
});

test('promotion dates and redemption limits are validated', () => {
  const valid = {
    code: 'EARLYBIRD', discount_type: 'percent', percent_off: 20,
    starts_at: '2026-02-01T00:00:00Z', ends_at: '2026-01-01T00:00:00Z',
  };
  assert.equal(isValidPromotionInput(valid), false);
  assert.equal(isValidPromotionInput({ ...valid, ends_at: '2027-01-01T00:00:00Z', max_redemptions: 0 }), false);
});

test('admin authorization trusts only verified app_metadata role claims', () => {
  assert.equal(isTrustedPlatformAdmin({ role: 'admin' }), true);
  assert.equal(isTrustedPlatformAdmin({ roles: ['merchant', 'admin'] }), true);
  assert.equal(isTrustedPlatformAdmin({ role: 'merchant', roles: ['merchant'] }), false);
  assert.equal(isTrustedPlatformAdmin(null), false);
  assert.equal(isTrustedPlatformAdmin({ user_metadata: { role: 'admin' } }), false);
});
