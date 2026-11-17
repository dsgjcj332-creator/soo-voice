/**
 * Per-merchant Store & Access Settings — the "owner's remote control" for the
 * customer-facing digital menu (/store):
 *  - Restaurant identity (name, phone, address) shown to customers
 *  - Voice waiter visibility (hide the voice widget, menu becomes manual-only)
 *  - Geo-fence: only guests within N km of the restaurant location can open the menu
 *  - Session duration: menu stays usable for N minutes after scanning, or always
 *
 * Persistence: localStorage always (instant + demo mode), Supabase table
 * `store_settings` for real merchants (see sql/store_settings.sql). If the
 * table does not exist yet, remote save/load degrades gracefully to local-only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, getSupabaseConfig } from './supabase';

export interface StoreSettings {
  restaurantName: string;
  restaurantNameEn: string;
  phone: string;
  address: string;
  /** Optional logo URL — shown on the guest menu header, invoice, and QR stand. */
  logoUrl: string;
  /** Working hours, free-text (Arabic-friendly). Shown on the customer menu
   *  near the address, and read by the voice assistant when asked about hours. */
  workingHours: string;
  /** Optional social/contact links shown on the customer menu footer. */
  instagram: string;
  facebook: string;
  whatsapp: string;
  /** Show the AI voice waiter widget on the customer menu */
  showVoiceWidget: boolean;
  /** Only allow opening the menu within geoRadiusKm of geoLat/geoLng */
  geoEnabled: boolean;
  geoRadiusKm: number;
  geoLat: number | null;
  geoLng: number | null;
  /** Minutes the menu stays open after scanning; 0 = always open */
  sessionMinutes: number;
  updatedAt: number;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  restaurantName: '',
  restaurantNameEn: '',
  phone: '',
  address: '',
  logoUrl: '',
  workingHours: '',
  instagram: '',
  facebook: '',
  whatsapp: '',
  showVoiceWidget: true,
  geoEnabled: false,
  geoRadiusKm: 0.5,
  geoLat: null,
  geoLng: null,
  sessionMinutes: 0,
  updatedAt: 0,
};

/** Owner-selectable session durations (0 = always open). */
export const SESSION_MINUTES_OPTIONS = [0, 5, 10, 15, 30, 60, 120];

/** Owner-selectable geo radii in km. */
export const GEO_RADIUS_OPTIONS = [0.1, 0.25, 0.5, 1, 2, 5];

function mergeDefaults(raw: Partial<StoreSettings> | null | undefined): StoreSettings {
  return {
    ...DEFAULT_STORE_SETTINGS,
    ...(raw || {}),
    showVoiceWidget: raw?.showVoiceWidget !== false,
    geoRadiusKm:
      typeof raw?.geoRadiusKm === 'number' && raw.geoRadiusKm > 0 ? raw.geoRadiusKm : 0.5,
    sessionMinutes:
      typeof raw?.sessionMinutes === 'number' && raw.sessionMinutes >= 0 ? raw.sessionMinutes : 0,
    updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

/* ---------------------------------- Local ---------------------------------- */

const localKey = (ownerId: string) => `store_settings_${ownerId}`;

export function loadLocalStoreSettings(ownerId?: string | null): StoreSettings {
  if (!ownerId) return { ...DEFAULT_STORE_SETTINGS };
  try {
    const raw = localStorage.getItem(localKey(ownerId));
    return mergeDefaults(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_STORE_SETTINGS };
  }
}

export function saveLocalStoreSettings(ownerId: string, settings: StoreSettings): boolean {
  try {
    localStorage.setItem(localKey(ownerId), JSON.stringify(settings));
    return true;
  } catch (e) {
    console.warn('Could not persist store settings locally:', e);
    return false;
  }
}

/* --------------------------------- Supabase -------------------------------- */

export async function fetchStoreSettings(ownerId: string): Promise<StoreSettings | null> {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('ownerId', ownerId)
      .maybeSingle();
    if (error) {
      // Supabase returns a 404 + 'Could not find the table' when the
      // store_settings migration has not been applied yet. This is the
      // expected path for new accounts and demo users — degrade silently
      // rather than flooding the console. Other errors (RLS, network) do
      // get logged at warn level.
      const msg = String(error.message || '');
      const isMissingTable = msg.includes('Could not find the table') || msg.includes('schema cache') || msg.includes('42P01');
      if (!isMissingTable) {
        console.warn('store_settings fetch error:', msg);
      }
      return null;
    }
    return data ? mergeDefaults(data) : null;
  } catch (err) {
    console.warn('store_settings fetch failed:', err);
    return null;
  }
}

export async function saveStoreSettingsRemote(
  ownerId: string,
  settings: StoreSettings
): Promise<boolean> {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured || !supabase) return false;
  try {
    const { error } = await supabase
      .from('store_settings')
      .upsert([{ ownerId, ...settings }], { onConflict: 'ownerId' });
    if (error) {
      // Same missing-table path as fetch — degrade silently. Real errors
      // (RLS, network) still get logged.
      const msg = String(error.message || '');
      const isMissingTable = msg.includes('Could not find the table') || msg.includes('schema cache') || msg.includes('42P01');
      if (!isMissingTable) {
        console.warn('store_settings save error:', msg);
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn('store_settings save failed:', err);
    return false;
  }
}

/* ------------------------------ Distance / Geo ------------------------------ */

/** Great-circle distance between two coordinates, in kilometers. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* ----------------------------------- Hook ----------------------------------- */

/**
 * Load + update store settings for one owner. Reads are cached locally for
 * instant paint, then the cloud copy wins when reachable. `remote` controls
 * whether updates are written to Supabase (real merchants only).
 */
export function useStoreSettings(ownerId?: string | null, remote = false) {
  const { isConfigured } = getSupabaseConfig();
  const [settings, setSettings] = useState<StoreSettings>(() => loadLocalStoreSettings(ownerId));
  const [loading, setLoading] = useState<boolean>(!!ownerId);
  const settingsRef = useRef<StoreSettings>(settings);

  useEffect(() => {
    if (!ownerId) {
      setSettings({ ...DEFAULT_STORE_SETTINGS });
      settingsRef.current = DEFAULT_STORE_SETTINGS;
      setLoading(false);
      return;
    }
    let cancelled = false;

    // 1. Instant local paint
    const local = loadLocalStoreSettings(ownerId);
    settingsRef.current = local;
    setSettings(local);
    setLoading(false);

    // 2. Cloud copy wins when reachable (customers always read from cloud)
    if (isConfigured) {
      fetchStoreSettings(ownerId).then((remoteSettings) => {
        if (!cancelled && remoteSettings) {
          settingsRef.current = remoteSettings;
          setSettings(remoteSettings);
          saveLocalStoreSettings(ownerId, remoteSettings);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [ownerId, isConfigured]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!ownerId) return false;
    const snapshot = settingsRef.current;
    if (!saveLocalStoreSettings(ownerId, snapshot)) return false;
    if (!remote) return true;
    if (!isConfigured) return false;
    const persisted = await saveStoreSettingsRemote(ownerId, snapshot);
    // If the user edited settings while the request was in flight, do not
    // report the older snapshot as the final saved state.
    return persisted && settingsRef.current.updatedAt === snapshot.updatedAt;
  }, [ownerId, remote, isConfigured]);

  const update = useCallback(
    (patch: Partial<StoreSettings>) => {
      if (!ownerId) return;
      const next = mergeDefaults({
        ...settingsRef.current,
        ...patch,
        updatedAt: Date.now(),
      });
      settingsRef.current = next;
      setSettings(next);
      saveLocalStoreSettings(ownerId, next);
      if (remote && isConfigured) {
        void saveStoreSettingsRemote(ownerId, next);
      }
    },
    [ownerId, remote, isConfigured]
  );

  return { settings, update, save, loading };
}

/* ---------------------------------- Session --------------------------------- */

const sessionKey = (ownerId: string) => `menu_session_${ownerId}`;

/** Returns the epoch-ms when the current scan session started (creates one if absent). */
export function ensureSessionStart(ownerId: string): number {
  try {
    const raw = sessionStorage.getItem(sessionKey(ownerId));
    const parsed = raw ? Number(raw) : 0;
    if (parsed > 0 && parsed <= Date.now()) return parsed;
  } catch {}
  const now = Date.now();
  try {
    sessionStorage.setItem(sessionKey(ownerId), String(now));
  } catch {}
  return now;
}

export function resetSession(ownerId: string) {
  try {
    sessionStorage.removeItem(sessionKey(ownerId));
  } catch {}
}

/** Seconds left in the current session; null when the menu is always open. */
export function sessionRemainingSeconds(sessionStartMs: number, sessionMinutes: number): number | null {
  if (!sessionMinutes || sessionMinutes <= 0) return null;
  return Math.max(0, sessionMinutes * 60 - Math.floor((Date.now() - sessionStartMs) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
