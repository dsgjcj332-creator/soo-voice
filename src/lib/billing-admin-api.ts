import express from 'express';

type JsonObject = Record<string, unknown>;

export function isValidPlanInput(value: unknown): value is {
  plan_key: string; display_name: string; description?: string | null;
  features?: JsonObject; usage_limits?: JsonObject; sort_order?: number; is_active?: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as JsonObject;
  return typeof body.plan_key === 'string' && /^[a-z][a-z0-9_-]{1,39}$/.test(body.plan_key) &&
    typeof body.display_name === 'string' && body.display_name.trim().length >= 1 &&
    body.display_name.trim().length <= 100 &&
    (body.description === undefined || body.description === null || (typeof body.description === 'string' && body.description.length <= 2000)) &&
    (body.features === undefined || (!!body.features && typeof body.features === 'object' && !Array.isArray(body.features))) &&
    (body.usage_limits === undefined || (!!body.usage_limits && typeof body.usage_limits === 'object' && !Array.isArray(body.usage_limits))) &&
    (body.sort_order === undefined || (Number.isInteger(body.sort_order) && Number(body.sort_order) >= 0 && Number(body.sort_order) <= 100000)) &&
    (body.is_active === undefined || typeof body.is_active === 'boolean');
}

export function isValidPlanPatch(value: unknown): value is JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as JsonObject;
  const allowed = new Set(['display_name', 'description', 'features', 'usage_limits', 'sort_order', 'is_active']);
  const keys = Object.keys(body);
  if (!keys.length || keys.some(key => !allowed.has(key))) return false;
  return isValidPlanInput({
    plan_key: 'valid_key',
    display_name: body.display_name ?? 'Valid',
    description: body.description,
    features: body.features,
    usage_limits: body.usage_limits,
    sort_order: body.sort_order,
    is_active: body.is_active,
  });
}

export function isValidPriceInput(value: unknown): value is {
  plan_id: string; currency: string; billing_interval: 'monthly' | 'yearly';
  amount_minor: number; effective_from?: string; effective_until?: string | null; is_active?: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as JsonObject;
  const validDate = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
  return typeof body.plan_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.plan_id) &&
    typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency) &&
    (body.billing_interval === 'monthly' || body.billing_interval === 'yearly') &&
    Number.isSafeInteger(body.amount_minor) && Number(body.amount_minor) >= 0 &&
    (body.effective_from === undefined || validDate(body.effective_from)) &&
    (body.effective_until === undefined || body.effective_until === null || validDate(body.effective_until)) &&
    (body.is_active === undefined || typeof body.is_active === 'boolean') &&
    (body.effective_until == null || Date.parse(String(body.effective_until)) > Date.parse(String(body.effective_from ?? new Date().toISOString())));
}

export function isValidPromotionInput(value: unknown): value is JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as JsonObject;
  const validDate = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
  const common = typeof body.code === 'string' && /^[A-Z0-9_-]{3,40}$/.test(body.code) &&
    (body.description === undefined || body.description === null || (typeof body.description === 'string' && body.description.length <= 2000)) &&
    validDate(body.starts_at) && validDate(body.ends_at) && Date.parse(String(body.ends_at)) > Date.parse(String(body.starts_at)) &&
    (body.max_redemptions === undefined || body.max_redemptions === null || (Number.isSafeInteger(body.max_redemptions) && Number(body.max_redemptions) > 0)) &&
    (body.first_ten_offer === undefined || typeof body.first_ten_offer === 'boolean') &&
    (body.is_active === undefined || typeof body.is_active === 'boolean') &&
    (body.applicable_plan_keys === undefined || (Array.isArray(body.applicable_plan_keys) && body.applicable_plan_keys.length <= 50 && body.applicable_plan_keys.every(k => typeof k === 'string' && /^[a-z][a-z0-9_-]{1,39}$/.test(k))));
  if (!common) return false;
  if (body.discount_type === 'percent') {
    return Number.isInteger(body.percent_off) && Number(body.percent_off) >= 1 && Number(body.percent_off) <= 100 &&
      body.amount_off_minor === undefined && body.currency === undefined;
  }
  return body.discount_type === 'fixed' && Number.isSafeInteger(body.amount_off_minor) &&
    Number(body.amount_off_minor) > 0 && typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency) &&
    body.percent_off === undefined;
}

function backendConfig() {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !serviceKey || !anonKey) return null;
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return null;
  } catch { return null; }
  return { supabaseUrl, serviceKey, anonKey };
}

function headers(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export function createBillingAdminRouter() {
  const router = express.Router();

  // Every request validates the bearer token with Supabase Auth and reads
  // app_metadata from the verified user response. user_metadata is never trusted.
  router.use(async (req, res, next) => {
    const backend = backendConfig();
    const authorization = req.headers.authorization || '';
    const match = /^Bearer\s+([A-Za-z0-9._~-]{30,4096})$/i.exec(authorization);
    if (!backend || !match) {
      res.status(503).json({ error: 'Admin billing API is not configured or session is missing' });
      return;
    }
    try {
      const response = await fetch(`${backend.supabaseUrl}/auth/v1/user`, {
        headers: { apikey: backend.anonKey, Authorization: `Bearer ${match[1]}` },
      });
      if (!response.ok) {
        res.status(401).json({ error: 'A valid admin session is required' });
        return;
      }
      const user = await response.json() as { id?: unknown; app_metadata?: { role?: unknown; roles?: unknown } };
      const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata?.roles : [];
      if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id) ||
          (user.app_metadata?.role !== 'admin' && !roles.includes('admin'))) {
        res.status(403).json({ error: 'Platform administrator access is required' });
        return;
      }
      res.locals.billingAdmin = { backend, adminId: user.id };
      next();
    } catch {
      res.status(503).json({ error: 'Could not verify administrator session' });
    }
  });

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/plans', async (_req, res) => {
    const { backend } = res.locals.billingAdmin;
    try {
      const [plansResponse, pricesResponse] = await Promise.all([
        fetch(`${backend.supabaseUrl}/rest/v1/billing_plans?select=*&order=sort_order.asc,created_at.asc`, { headers: headers(backend.serviceKey) }),
        fetch(`${backend.supabaseUrl}/rest/v1/billing_plan_prices?select=*&order=created_at.desc`, { headers: headers(backend.serviceKey) }),
      ]);
      if (!plansResponse.ok || !pricesResponse.ok) {
        res.status(503).json({ error: 'Could not load billing plans' });
        return;
      }
      res.json({ plans: await plansResponse.json(), prices: await pricesResponse.json() });
    } catch {
      res.status(503).json({ error: 'Could not load billing plans' });
    }
  });

  router.post('/plans', async (req, res) => {
    if (!isValidPlanInput(req.body)) {
      res.status(400).json({ error: 'Invalid plan details' });
      return;
    }
    const { backend } = res.locals.billingAdmin;
    const body = req.body;
    const payload = {
      plan_key: body.plan_key, display_name: body.display_name.trim(),
      description: body.description ?? null, features: body.features ?? {},
      usage_limits: body.usage_limits ?? {}, sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? false,
    };
    try {
      const response = await fetch(`${backend.supabaseUrl}/rest/v1/billing_plans`, {
        method: 'POST', headers: { ...headers(backend.serviceKey), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      const rows = await response.json().catch(() => null);
      if (!response.ok) {
        res.status(response.status === 409 ? 409 : 400).json({ error: response.status === 409 ? 'Plan key already exists' : 'Could not create plan' });
        return;
      }
      res.status(201).json(Array.isArray(rows) ? rows[0] : rows);
    } catch {
      res.status(503).json({ error: 'Could not create plan' });
    }
  });

  router.patch('/plans/:planId', async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.planId) || !isValidPlanPatch(req.body)) {
      res.status(400).json({ error: 'Invalid plan update' });
      return;
    }
    const { backend } = res.locals.billingAdmin;
    const body = { ...req.body, ...(typeof req.body.display_name === 'string' ? { display_name: req.body.display_name.trim() } : {}) };
    try {
      const query = new URLSearchParams({ id: `eq.${req.params.planId}`, select: '*' });
      const response = await fetch(`${backend.supabaseUrl}/rest/v1/billing_plans?${query}`, {
        method: 'PATCH', headers: { ...headers(backend.serviceKey), Prefer: 'return=representation' },
        body: JSON.stringify(body),
      });
      const rows = await response.json().catch(() => null);
      if (!response.ok) {
        res.status(400).json({ error: 'Could not update plan' });
        return;
      }
      if (!Array.isArray(rows) || rows.length !== 1) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }
      res.json(rows[0]);
    } catch {
      res.status(503).json({ error: 'Could not update plan' });
    }
  });

  router.post('/prices', async (req, res) => {
    if (!isValidPriceInput(req.body)) {
      res.status(400).json({ error: 'Invalid plan price' });
      return;
    }
    const { backend } = res.locals.billingAdmin;
    const body = req.body;
    const payload = {
      plan_id: body.plan_id, currency: body.currency, billing_interval: body.billing_interval,
      amount_minor: body.amount_minor, effective_from: body.effective_from ?? new Date().toISOString(),
      effective_until: body.effective_until ?? null, is_active: body.is_active ?? false,
    };
    try {
      const response = await fetch(`${backend.supabaseUrl}/rest/v1/billing_plan_prices`, {
        method: 'POST', headers: { ...headers(backend.serviceKey), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      const rows = await response.json().catch(() => null);
      if (!response.ok) {
        res.status(400).json({ error: 'Could not create plan price; verify the plan exists and the effective date is unique' });
        return;
      }
      res.status(201).json(Array.isArray(rows) ? rows[0] : rows);
    } catch {
      res.status(503).json({ error: 'Could not create plan price' });
    }
  });

  router.get('/promotions', async (_req, res) => {
    const { backend } = res.locals.billingAdmin;
    try {
      const query = new URLSearchParams({ select: '*', order: 'starts_at.desc' });
      const response = await fetch(`${backend.supabaseUrl}/rest/v1/billing_promotions?${query}`, { headers: headers(backend.serviceKey) });
      if (!response.ok) {
        res.status(503).json({ error: 'Could not load promotions' });
        return;
      }
      res.json(await response.json());
    } catch {
      res.status(503).json({ error: 'Could not load promotions' });
    }
  });

  router.post('/promotions', async (req, res) => {
    if (!isValidPromotionInput(req.body)) {
      res.status(400).json({ error: 'Invalid promotion details' });
      return;
    }
    const { backend } = res.locals.billingAdmin;
    const body = req.body;
    const payload = {
      code: body.code, description: body.description ?? null, discount_type: body.discount_type,
      percent_off: body.discount_type === 'percent' ? body.percent_off : null,
      amount_off_minor: body.discount_type === 'fixed' ? body.amount_off_minor : null,
      currency: body.discount_type === 'fixed' ? body.currency : null,
      starts_at: body.starts_at, ends_at: body.ends_at, max_redemptions: body.max_redemptions ?? null,
      first_ten_offer: body.first_ten_offer ?? false, applicable_plan_keys: body.applicable_plan_keys ?? [],
      is_active: body.is_active ?? false,
    };
    try {
      const response = await fetch(`${backend.supabaseUrl}/rest/v1/billing_promotions`, {
        method: 'POST', headers: { ...headers(backend.serviceKey), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      const rows = await response.json().catch(() => null);
      if (!response.ok) {
        res.status(response.status === 409 ? 409 : 400).json({ error: response.status === 409 ? 'Promotion code already exists' : 'Could not create promotion' });
        return;
      }
      res.status(201).json(Array.isArray(rows) ? rows[0] : rows);
    } catch {
      res.status(503).json({ error: 'Could not create promotion' });
    }
  });

  router.get('/subscriptions', async (req, res) => {
    const { backend } = res.locals.billingAdmin;
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
    const offset = Math.max(Number.parseInt(String(req.query.offset || '0'), 10) || 0, 0);
    const query = new URLSearchParams({
      select: 'id,owner_id,plan_id,price_id,status,billing_interval,currency,trial_starts_at,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,created_at,updated_at',
      order: 'created_at.desc', limit: String(limit), offset: String(offset),
    });
    if (typeof req.query.status === 'string' && ['trialing','active','past_due','paused','canceled','incomplete','expired'].includes(req.query.status)) {
      query.set('status', `eq.${req.query.status}`);
    }
    try {
      const response = await fetch(`${backend.supabaseUrl}/rest/v1/merchant_subscriptions?${query}`, {
        headers: { ...headers(backend.serviceKey), Prefer: 'count=exact' },
      });
      if (!response.ok) {
        res.status(503).json({ error: 'Could not load subscriptions' });
        return;
      }
      const rows = await response.json();
      const range = response.headers.get('content-range');
      res.json({ items: rows, total: range && range.includes('/') ? Number(range.split('/')[1]) || 0 : null, limit, offset });
    } catch {
      res.status(503).json({ error: 'Could not load subscriptions' });
    }
  });

  return router;
}
