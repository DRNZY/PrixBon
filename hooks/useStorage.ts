// AsyncStorage helpers for PrixBon.
// Stores a single JSON blob under STORAGE_KEY so writes are atomic.
// Exports both low-level helpers and React hooks that subscribe to changes
// (with a simple global pub/sub so screens stay in sync after edits).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  AppData,
  EMPTY_APP_DATA,
  PriceAlert,
  Receipt,
  ShoppingItem,
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

export async function deleteReceipt(id: string): Promise<void> {
  await mutate((d) => ({ ...d, receipts: d.receipts.filter((r) => r.id !== id) }));
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
