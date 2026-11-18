/**
 * Foodics OAuth2 authorization-code flow, per the officially documented spec:
 *   - Authorize: https://console.foodics.com/authorize?client_id={id}&state={state}
 *     (sandbox: https://console-sandbox.foodics.com/authorize). The state must
 *     be compared after the redirect and a mismatch must terminate the flow;
 *     the authorization code lives 600 seconds.
 *   - Token exchange: POST https://api.foodics.com/oauth/token with a JSON
 *     body { grant_type: "authorization_code", code, client_id, client_secret,
 *     redirect_uri }; the response carries token_type "Bearer" + access_token.
 *   - Foodics tokens do not expire but can be revoked by the account owner.
 * Source: developers.foodics.com/guides/partnership_authentication_process.html
 *         and developers.foodics.com/guides/get-started.html.
 */
const FOODICS_PRODUCTION_AUTHORIZE_URL = 'https://console.foodics.com/authorize';
const FOODICS_SANDBOX_AUTHORIZE_URL = 'https://console-sandbox.foodics.com/authorize';
const FOODICS_PRODUCTION_TOKEN_URL = 'https://api.foodics.com/oauth/token';
const FOODICS_SANDBOX_TOKEN_URL = 'https://api-sandbox.foodics.com/oauth/token';

export interface FoodicsAuthorizeUrlOptions {
  clientId: string;
  state: string;
  sandbox?: boolean;
}

export function buildFoodicsAuthorizeUrl(options: FoodicsAuthorizeUrlOptions): string {
  if (!options.clientId || typeof options.clientId !== 'string') {
    throw new Error('FOODICS_CLIENT_ID_REQUIRED');
  }
  if (!options.state || typeof options.state !== 'string' || options.state.length < 8) {
    throw new Error('FOODICS_STATE_REQUIRED');
  }
  const base = options.sandbox ? FOODICS_SANDBOX_AUTHORIZE_URL : FOODICS_PRODUCTION_AUTHORIZE_URL;
  const query = new URLSearchParams({
    client_id: options.clientId,
    state: options.state,
  });
  return `${base}?${query}`;
}

export interface FoodicsTokenExchangeRequest {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sandbox?: boolean;
  fetch?: typeof fetch;
}

export async function exchangeFoodicsAuthorizationCode(
  request: FoodicsTokenExchangeRequest,
): Promise<{ apiToken: string }> {
  for (const [name, value] of [
    ['code', request.code], ['clientId', request.clientId],
    ['clientSecret', request.clientSecret], ['redirectUri', request.redirectUri],
  ] as const) {
    if (!value || typeof value !== 'string') {
      throw new Error(`FOODICS_TOKEN_EXCHANGE_MISSING_${name.toUpperCase()}`);
    }
  }
  const tokenUrl = request.sandbox ? FOODICS_SANDBOX_TOKEN_URL : FOODICS_PRODUCTION_TOKEN_URL;
  const doFetch = request.fetch ?? fetch;
  const response = await doFetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: request.code,
      client_id: request.clientId,
      client_secret: request.clientSecret,
      redirect_uri: request.redirectUri,
    }),
  });
  if (!response.ok) throw new Error('FOODICS_TOKEN_EXCHANGE_FAILED');
  const body = await response.json().catch(() => null) as
    | { token_type?: unknown; access_token?: unknown }
    | null;
  if (!body || body.token_type !== 'Bearer' || typeof body.access_token !== 'string' ||
      body.access_token.length < 20) {
    throw new Error('FOODICS_TOKEN_EXCHANGE_INVALID_RESPONSE');
  }
  return { apiToken: body.access_token };
}
