export type PosLocationInput = {
  connectionId: string;
  providerLocationId: string;
  name: string;
  timezone: string | null;
  currency: string | null;
};

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parsePosLocationInput(input: unknown):
  | { ok: true; value: PosLocationInput }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Invalid POS location details' };
  }

  const body = input as Record<string, unknown>;
  const connectionId = body.connectionId;
  const providerLocationId = typeof body.providerLocationId === 'string' ? body.providerLocationId.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : '';
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';

  if (!isUuid(connectionId) || !providerLocationId || providerLocationId.length > 160 ||
      !name || name.length > 120 || timezone.length > 100 ||
      (currency && !/^[A-Z]{3}$/.test(currency))) {
    return { ok: false, error: 'Invalid POS location details' };
  }

  if (timezone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      return { ok: false, error: 'Invalid IANA timezone' };
    }
  }

  return {
    ok: true,
    value: {
      connectionId,
      providerLocationId,
      name,
      timezone: timezone || null,
      currency: currency || null,
    },
  };
}
