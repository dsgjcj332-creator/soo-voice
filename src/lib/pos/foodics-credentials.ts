/**
 * Foodics API credentials accepted by the connection vault.
 * Foodics issues account-level API tokens after account-owner approval.
 */
export interface FoodicsCredentials {
  apiToken: string;
}

export function parseFoodicsCredentials(value: unknown): FoodicsCredentials {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('FOODICS_CREDENTIALS_INVALID');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length !== 1 || entries[0][0] !== 'apiToken' || typeof entries[0][1] !== 'string') {
    throw new Error('FOODICS_API_TOKEN_REQUIRED');
  }
  const apiToken = entries[0][1].trim();
  if (apiToken.length < 20 || apiToken.length > 4096) {
    throw new Error('FOODICS_API_TOKEN_INVALID');
  }
  return { apiToken };
}
