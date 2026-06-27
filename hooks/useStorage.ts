// AsyncStorage helpers for PrixBon.
// Stores a single JSON blob under STORAGE_KEY so writes are atomic.
// Exports both low-level helpers and React hooks that subscribe to changes
// (with a simple global pub/sub so screens stay in sync after edits).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  AppData,
  DEFAULT_SETTINGS,
  EMPTY_APP_DATA,
  PriceAlert,
  Receipt,
  ShoppingItem,
  UserSettings,
} from '../types';

export const STORAGE_KEY = '@prixbon/app-data/v1';

// ---------- low level ----------

export async function loadAppData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_APP_DATA;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      receipts: parsed.receipts ?? [],
      shopping: parsed.shopping ?? [],
      alerts: parsed.alerts ?? [],
      settings: mergeSettings(parsed.settings),
    };
  } catch (err) {
    console.warn('[useStorage] loadAppData failed', err);
    return EMPTY_APP_DATA;
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function clearAppData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

function mergeSettings(parsed: Partial<UserSettings> | undefined): UserSettings {
  if (!parsed) return DEFAULT_SETTINGS;
  return {
    profile: {
      name: parsed.profile?.name ?? DEFAULT_SETTINGS.profile.name,
      defaultCountry:
        parsed.profile?.defaultCountry ?? DEFAULT_SETTINGS.profile.defaultCountry,
    },
    preferences: {
      currency:
        parsed.preferences?.currency ?? DEFAULT_SETTINGS.preferences.currency,
      sortReceiptsBy:
        parsed.preferences?.sortReceiptsBy ??
        DEFAULT_SETTINGS.preferences.sortReceiptsBy,
    },
    notifications: {
      enabled:
        parsed.notifications?.enabled ??
        DEFAULT_SETTINGS.notifications.enabled,
      quietHoursEnabled:
        parsed.notifications?.quietHoursEnabled ??
        DEFAULT_SETTINGS.notifications.quietHoursEnabled,
      weekdaysOnly:
        parsed.notifications?.weekdaysOnly ??
        DEFAULT_SETTINGS.notifications.weekdaysOnly,
    },
  };
}

// ---------- change subscription ----------

type Listener = (data: AppData) => void;
const listeners = new Set<Listener>();
let cached: AppData | null = null;
let loading: Promise<AppData> | null = null;

async function ensureLoaded(): Promise<AppData> {
  if (cached) return cached;
  if (!loading) {
    loading = loadAppData()
      .then((data) => {
        cached = data;
        loading = null;
        return data;
      })
      .catch(() => {
        cached = EMPTY_APP_DATA;
        loading = null;
        return EMPTY_APP_DATA;
      });
  }
  return loading;
}

function emit(data: AppData) {
  cached = data;
  for (const l of listeners) l(data);
}

async function mutate(updater: (current: AppData) => AppData): Promise<AppData> {
  const current = await ensureLoaded();
  const next = updater(current);
  await saveAppData(next);
  emit(next);
  return next;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------- reactive hook ----------

export function useAppData(): {
  data: AppData;
  ready: boolean;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<AppData>(cached ?? EMPTY_APP_DATA);
  const [ready, setReady] = useState<boolean>(cached !== null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribe((next) => {
      if (!cancelled) setData(next);
    });
    ensureLoaded().then((loaded) => {
      if (cancelled) return;
      setData(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    const loaded = await loadAppData();
    emit(loaded);
  }, []);

  return { data, ready, refresh };
}

// ---------- ID helper ----------

function newId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

// ---------- receipts ----------

export async function addReceipt(receipt: Omit<Receipt, 'id' | 'createdAt'>): Promise<Receipt> {
  const full: Receipt = {
    ...receipt,
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  await mutate((d) => ({ ...d, receipts: [full, ...d.receipts] }));
  return full;
}

export async function saveReceipt(receipt: Receipt): Promise<Receipt> {
  // Idempotent: if a receipt with the same id exists, replace it; otherwise prepend.
  await mutate((d) => {
    const existing = d.receipts.findIndex((r) => r.id === receipt.id);
    if (existing >= 0) {
      const next = d.receipts.slice();
      next[existing] = receipt;
      return { ...d, receipts: next };
    }
    return { ...d, receipts: [receipt, ...d.receipts] };
  });
  return receipt;
}

export async function deleteReceipt(id: string): Promise<void> {
  await mutate((d) => ({ ...d, receipts: d.receipts.filter((r) => r.id !== id) }));
}

// ---------- receipts (query helpers) ----------

export interface PricePoint {
  date: string;       // ISO timestamp of the receipt
  price: number;      // unit price in EUR for the matched product on that receipt
  store: string;
  receiptId: string;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export async function getReceipts(): Promise<Receipt[]> {
  const data = await ensureLoaded();
  return [...data.receipts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/**
 * Returns the recorded (unit) price history for a product, sorted oldest → newest.
 * Optionally scoped to a specific store (case-insensitive exact match).
 * Prices are normalized by quantity — each line item contributes its `price` field
 * (the unit price the user entered), so quantity doesn't skew the average.
 */
export async function getPriceHistory(
  productName: string,
  store?: string,
): Promise<PricePoint[]> {
  const data = await ensureLoaded();
  const needle = normalizeName(productName);
  const storeNeedle = store ? store.trim().toLowerCase() : null;
  const points: PricePoint[] = [];
  for (const r of data.receipts) {
    if (storeNeedle && r.store.trim().toLowerCase() !== storeNeedle) continue;
    for (const p of r.products) {
      if (normalizeName(p.name) !== needle) continue;
      points.push({
        date: r.date,
        price: p.price,
        store: r.store,
        receiptId: r.id,
      });
    }
  }
  points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return points;
}

export interface PriceStats {
  count: number;
  average: number;
  min: number;
  max: number;
  best: PricePoint | null;
}

export function summarizePriceHistory(points: PricePoint[]): PriceStats {
  if (points.length === 0) {
    return { count: 0, average: 0, min: 0, max: 0, best: null };
  }
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let best: PricePoint = points[0];
  for (const p of points) {
    sum += p.price;
    if (p.price < min) min = p.price;
    if (p.price > max) max = p.price;
    if (p.price < best.price) best = p;
  }
  return {
    count: points.length,
    average: sum / points.length,
    min,
    max,
    best,
  };
}

/**
 * Sync helper that mirrors getPriceHistory/getPriceAlert semantics so screens can
 * reuse the cached `data` from useAppData() instead of re-querying AsyncStorage.
 */
export function getPriceHistorySync(
  receipts: Receipt[],
  productName: string,
  store?: string,
): PricePoint[] {
  const needle = normalizeName(productName);
  const storeNeedle = store ? store.trim().toLowerCase() : null;
  const points: PricePoint[] = [];
  for (const r of receipts) {
    if (storeNeedle && r.store.trim().toLowerCase() !== storeNeedle) continue;
    for (const p of r.products) {
      if (normalizeName(p.name) !== needle) continue;
      points.push({
        date: r.date,
        price: p.price,
        store: r.store,
        receiptId: r.id,
      });
    }
  }
  points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return points;
}

// ---------- shopping list ----------

export async function addShoppingItem(
  item: Omit<ShoppingItem, 'id' | 'createdAt' | 'checked'> & {
    checked?: boolean;
  },
): Promise<ShoppingItem> {
  const full: ShoppingItem = {
    ...item,
    checked: item.checked ?? false,
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  await mutate((d) => ({ ...d, shopping: [full, ...d.shopping] }));
  return full;
}

export async function toggleShoppingItem(id: string): Promise<void> {
  await mutate((d) => ({
    ...d,
    shopping: d.shopping.map((s) =>
      s.id === id ? { ...s, checked: !s.checked } : s,
    ),
  }));
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await mutate((d) => ({ ...d, shopping: d.shopping.filter((s) => s.id !== id) }));
}

export async function clearCheckedShoppingItems(): Promise<void> {
  await mutate((d) => ({ ...d, shopping: d.shopping.filter((s) => !s.checked) }));
}

// ---------- alerts ----------

export async function addPriceAlert(
  alert: Omit<PriceAlert, 'id' | 'createdAt' | 'active'> & {
    active?: boolean;
  },
): Promise<PriceAlert> {
  const full: PriceAlert = {
    ...alert,
    active: alert.active ?? true,
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  await mutate((d) => ({ ...d, alerts: [full, ...d.alerts] }));
  return full;
}

export async function setPriceAlert(
  productName: string,
  targetPrice: number,
  store?: string,
): Promise<PriceAlert> {
  const trimmed = productName.trim();
  if (!trimmed) {
    throw new Error('Productnaam is vereist voor een prijsalert.');
  }
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    throw new Error('Doelprijs moet een positief getal zijn.');
  }
  const cleanedStore = store?.trim() || undefined;
  const needle = normalizeName(trimmed);
  const storeKey = cleanedStore?.toLowerCase();

  const full: PriceAlert = await (async () => {
    const data = await ensureLoaded();
    const existing = data.alerts.find((a) => {
      if (a.productName.trim().toLowerCase() !== needle) return false;
      const aStore = a.store?.trim().toLowerCase() ?? null;
      const bStore = storeKey ?? null;
      return aStore === bStore;
    });
    if (existing) {
      const updated: PriceAlert = { ...existing, targetPrice, active: true };
      await mutate((d) => ({
        ...d,
        alerts: d.alerts.map((a) => (a.id === existing.id ? updated : a)),
      }));
      return updated;
    }
    const created: PriceAlert = {
      id: newId(),
      productName: trimmed,
      store: cleanedStore,
      targetPrice,
      active: true,
      createdAt: new Date().toISOString(),
    };
    await mutate((d) => ({ ...d, alerts: [created, ...d.alerts] }));
    return created;
  })();

  return full;
}

export async function getPriceAlerts(): Promise<PriceAlert[]> {
  const data = await ensureLoaded();
  return data.alerts.filter((a) => a.active);
}

/**
 * Returns true if any active alert matches the given product/price/store combination.
 * - When the alert has a store, both names must match (case-insensitive).
 * - When the alert has no store, it matches any store.
 * Alert triggers when `currentPrice <= alert.targetPrice`.
 */
export async function checkPriceAlert(
  productName: string,
  currentPrice: number,
  store?: string,
): Promise<boolean> {
  if (!Number.isFinite(currentPrice) || currentPrice < 0) return false;
  const data = await ensureLoaded();
  const needle = normalizeName(productName);
  const storeNeedle = store?.trim().toLowerCase() ?? null;
  return data.alerts.some((a) => {
    if (!a.active) return false;
    if (a.productName.trim().toLowerCase() !== needle) return false;
    if (a.store) {
      if (!storeNeedle) return false;
      if (a.store.trim().toLowerCase() !== storeNeedle) return false;
    }
    return currentPrice <= a.targetPrice;
  });
}

export async function togglePriceAlert(id: string): Promise<void> {
  await mutate((d) => ({
    ...d,
    alerts: d.alerts.map((a) =>
      a.id === id ? { ...a, active: !a.active } : a,
    ),
  }));
}

export async function updatePriceAlert(
  id: string,
  patch: Partial<PriceAlert>,
): Promise<void> {
  await mutate((d) => ({
    ...d,
    alerts: d.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  }));
}

export async function deletePriceAlert(id: string): Promise<void> {
  await mutate((d) => ({ ...d, alerts: d.alerts.filter((a) => a.id !== id) }));
}

// ---------- formatting helpers ----------

export function formatEuro(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `€ ${safe.toFixed(2).replace('.', ',')}`;
}

/**
 * Formats a value using the user's preferred currency symbol.
 * Falls back to € for unknown symbols so screens never crash on bad data.
 */
export function formatCurrency(
  value: number,
  symbol: '€' | 'Fr' | '$' = '€',
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const body = safe.toFixed(2).replace('.', ',');
  if (symbol === '$') return `$${body}`;
  if (symbol === 'Fr') return `Fr ${body}`;
  return `€ ${body}`;
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('nl-BE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------- settings ----------

export async function updateSettings(
  patch: Partial<UserSettings> | ((s: UserSettings) => UserSettings),
): Promise<UserSettings> {
  const next = await mutate((d) => ({
    ...d,
    settings:
      typeof patch === 'function'
        ? patch(d.settings)
        : {
            ...d.settings,
            ...patch,
            profile: { ...d.settings.profile, ...(patch.profile ?? {}) },
            preferences: {
              ...d.settings.preferences,
              ...(patch.preferences ?? {}),
            },
            notifications: {
              ...d.settings.notifications,
              ...(patch.notifications ?? {}),
            },
          },
  }));
  return next.settings;
}

export async function resetAllData(): Promise<void> {
  await mutate(() => EMPTY_APP_DATA);
}

export interface DataStats {
  bytes: number;
  receiptCount: number;
  shoppingCount: number;
  alertCount: number;
}

export async function getDataStats(): Promise<DataStats> {
  const data = await ensureLoaded();
  const bytes = JSON.stringify(data).length;
  return {
    bytes,
    receiptCount: data.receipts.length,
    shoppingCount: data.shopping.length,
    alertCount: data.alerts.length,
  };
}

/**
 * Build a JSON snapshot of all data for export. The format is self-describing
 * so a future import can version-check and migrate if needed.
 */
export function exportSnapshot(data: AppData): string {
  return JSON.stringify(
    {
      schema: 'prixbon/export/v1',
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2,
  );
}

/**
 * Replace all stored data with the contents of an export snapshot.
 * Validates the schema marker and falls back to EMPTY_APP_DATA on any error
 * so a corrupt import never bricks the app.
 */
export async function importSnapshot(json: string): Promise<AppData> {
  const parsed = JSON.parse(json);
  if (parsed?.schema !== 'prixbon/export/v1' || !parsed.data) {
    throw new Error('Geen geldig PrixBon-exportbestand.');
  }
  const incoming = parsed.data as Partial<AppData>;
  const next: AppData = {
    receipts: incoming.receipts ?? [],
    shopping: incoming.shopping ?? [],
    alerts: incoming.alerts ?? [],
    settings: mergeSettings(incoming.settings),
  };
  await saveAppData(next);
  emit(next);
  return next;
}
