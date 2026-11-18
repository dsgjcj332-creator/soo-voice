/**
 * Foodics API v5 client implementing the officially documented spec:
 *   - Base URLs: https://api.foodics.com/v5 (production) and
 *     https://api-sandbox.foodics.com/v5 (sandbox).
 *   - Headers: "Authorization: Bearer <token>" (capital B is mandatory),
 *     "Accept: application/json", "Content-Type: application/json".
 *   - Pagination: a single "page" query param, 50 objects per page, response
 *     envelope { data, meta: { current_page, last_page, per_page, total } }.
 *   - Relations are embedded via a comma-separated "include" query param.
 *   - Rate limit: 30 requests per minute per access token; the worker runs
 *     sequential batches, so no client-side throttling is added here.
 * Source: developers.foodics.com/guides/get-started.html,
 *         developers.foodics.com/guides/fetching-general-data.html,
 *         apidocs.foodics.com/core/pagination.html.
 */
const FOODICS_PRODUCTION_API_BASE = 'https://api.foodics.com/v5';
const FOODICS_SANDBOX_API_BASE = 'https://api-sandbox.foodics.com/v5';
const MAX_CATALOG_PAGES = 40;

export interface FoodicsClientConfig {
  apiToken: string;
  sandbox?: boolean;
  fetch?: typeof fetch;
  maxPages?: number;
}

export interface FoodicsBranch {
  id: string;
  name: string;
  reference?: string | null;
  receives_online_orders?: boolean;
}

export interface FoodicsBranchPivot {
  price?: number | null;
  is_active?: boolean | null;
  is_in_stock?: boolean | null;
}

export interface FoodicsModifierOption {
  id: string;
  name?: string | null;
  is_active?: boolean | null;
  price?: number | null;
}

export interface FoodicsModifierGroup {
  id: string;
  name?: string | null;
  pivot?: { minimum_options?: number | null; maximum_options?: number | null } | null;
  options?: FoodicsModifierOption[] | null;
}

export interface FoodicsProduct {
  id: string;
  name: string;
  price?: number | null;
  is_active?: boolean | null;
  is_ready?: boolean | null;
  selling_method?: number | null;
  branches?: Array<{ id: string; pivot?: FoodicsBranchPivot | null }> | null;
  modifiers?: FoodicsModifierGroup[] | null;
}

export interface FoodicsOrderProductInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  kitchen_notes?: string;
  options?: Array<{ modifier_option_id: string; quantity: number; unit_price: number }>;
}

export interface FoodicsOrderPayload {
  id: string;
  type: 1 | 2 | 3;
  branch_id: string;
  products: FoodicsOrderProductInput[];
  customer_name?: string;
}

export interface FoodicsCreateOrderResult {
  order: Record<string, unknown> | null;
  duplicated: boolean;
}

interface FoodicsPage<T> {
  data: T[];
  lastPage: number;
}

export class FoodicsClient {
  private readonly apiBase: string;
  private readonly maxPages: number;
  private readonly request: typeof fetch;

  constructor(private readonly config: FoodicsClientConfig) {
    if (!config.apiToken || typeof config.apiToken !== 'string') {
      throw new Error('FOODICS_API_TOKEN_REQUIRED');
    }
    this.apiBase = config.sandbox ? FOODICS_SANDBOX_API_BASE : FOODICS_PRODUCTION_API_BASE;
    this.maxPages = config.maxPages ?? MAX_CATALOG_PAGES;
    this.request = config.fetch ?? fetch;
  }

  private headers(): Record<string, string> {
    return {
      // "Bearer" must be capitalized; lowercase causes authorization errors.
      Authorization: `Bearer ${this.config.apiToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private async getPage<T>(path: string, query: URLSearchParams): Promise<FoodicsPage<T>> {
    const response = await this.request(`${this.apiBase}${path}?${query}`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (response.status === 401) throw new Error('FOODICS_AUTHORIZATION_FAILED');
    if (response.status === 429) throw new Error('FOODICS_RATE_LIMITED');
    if (!response.ok) throw new Error(`FOODICS_REQUEST_FAILED_${response.status}`);
    const body = await response.json().catch(() => null) as
      | { data?: unknown; meta?: { last_page?: unknown } }
      | null;
    if (!body || !Array.isArray(body.data)) throw new Error('FOODICS_RESPONSE_INVALID');
    const lastPage = Number(body.meta?.last_page);
    return {
      data: body.data as T[],
      lastPage: Number.isInteger(lastPage) && lastPage >= 1 ? lastPage : 1,
    };
  }

  private async listAll<T>(path: string, include: string): Promise<T[]> {
    const rows: T[] = [];
    let page = 1;
    for (;;) {
      const query = new URLSearchParams({ page: String(page) });
      if (include) query.set('include', include);
      const result = await this.getPage<T>(path, query);
      rows.push(...result.data);
      if (page >= result.lastPage || page >= this.maxPages) break;
      page += 1;
    }
    return rows;
  }

  listBranches(): Promise<FoodicsBranch[]> {
    return this.listAll<FoodicsBranch>('/branches', '');
  }

  /** Products with per-branch pricing/availability and modifier groups embedded. */
  listProducts(): Promise<FoodicsProduct[]> {
    return this.listAll<FoodicsProduct>('/products', 'branches,modifiers');
  }

  /**
   * Creates an order. Foodics idempotency is the client-generated UUIDv4 "id":
   * resending the same id returns 422 with errors.id ["Duplicate ID."], which
   * means a previous attempt already landed and is reported as duplicated.
   */
  async createOrder(payload: FoodicsOrderPayload): Promise<FoodicsCreateOrderResult> {
    const response = await this.request(`${this.apiBase}/orders`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const body = await response.json().catch(() => null) as { data?: Record<string, unknown> } | null;
      return { order: body?.data ?? null, duplicated: false };
    }
    if (response.status === 422) {
      const body = await response.json().catch(() => null) as
        | { errors?: { id?: string[] } }
        | null;
      if (body?.errors?.id?.includes('Duplicate ID.')) {
        return { order: null, duplicated: true };
      }
      throw new Error('FOODICS_ORDER_REJECTED');
    }
    if (response.status === 401) throw new Error('FOODICS_AUTHORIZATION_FAILED');
    if (response.status === 429) throw new Error('FOODICS_RATE_LIMITED');
    throw new Error(`FOODICS_ORDER_FAILED_${response.status}`);
  }
}
