import type { PosAdapter, PosProviderId } from './types';

/**
 * In-process adapter registry. Register only server-side implementations.
 * A provider is not considered integrated merely because its ID is listed:
 * an adapter must be explicitly registered and backed by approved credentials.
 */
export class PosAdapterRegistry {
  private readonly adapters = new Map<PosProviderId, PosAdapter>();

  register(adapter: PosAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      throw new Error(`POS adapter already registered: ${adapter.provider}`);
    }
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: PosProviderId): PosAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`POS provider is not configured: ${provider}`);
    }
    return adapter;
  }

  has(provider: PosProviderId): boolean {
    return this.adapters.has(provider);
  }

  listRegistered(): PosProviderId[] {
    return [...this.adapters.keys()];
  }
}

export const posAdapterRegistry = new PosAdapterRegistry();
