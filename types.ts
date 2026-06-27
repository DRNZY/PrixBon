// Shared domain types for PrixBon.
// A receipt groups products (line items) purchased at a single store on a date.
// A shopping item is something the user wants to buy next.
// A price alert watches a product and notifies when the target price is met.

export type Country = 'BE' | 'NL';

export interface Product {
  id: string;
  name: string;
  price: number;          // unit price in EUR
  quantity: number;       // count (default 1)
  category?: string;
  barcode?: string;
}

export interface Receipt {
  id: string;
  store: string;
  date: string;           // ISO 8601 string
  country: Country;
  total: number;          // EUR
  currency: 'EUR';
  imageUri?: string;      // optional local photo path
  products: Product[];
  createdAt: string;      // ISO 8601 string
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;          // e.g. "stuk", "liter", "kg"
  checked: boolean;
  note?: string;
  createdAt: string;
}

export interface PriceAlert {
  id: string;
  productName: string;
  store?: string;
  targetPrice: number;    // notify when price <= target
  currentPrice?: number;
  active: boolean;
  createdAt: string;
}

export type ReceiptSort = 'date' | 'store' | 'total';
export type CurrencySymbol = '€' | 'Fr' | '$';

export interface NotificationPrefs {
  enabled: boolean;           // master kill-switch for price-alert notifications
  quietHoursEnabled: boolean; // suppress between 22:00 and 07:00 local
  weekdaysOnly: boolean;      // only fire Mon–Fri
}

export interface UserSettings {
  profile: {
    name: string;
    defaultCountry: Country;
  };
  preferences: {
    currency: CurrencySymbol;
    sortReceiptsBy: ReceiptSort;
  };
  notifications: NotificationPrefs;
}

export interface AppData {
  receipts: Receipt[];
  shopping: ShoppingItem[];
  alerts: PriceAlert[];
  settings: UserSettings;
}

export const DEFAULT_SETTINGS: UserSettings = {
  profile: {
    name: '',
    defaultCountry: 'BE',
  },
  preferences: {
    currency: '€',
    sortReceiptsBy: 'date',
  },
  notifications: {
    enabled: true,
    quietHoursEnabled: false,
    weekdaysOnly: false,
  },
};

export const EMPTY_APP_DATA: AppData = {
  receipts: [],
  shopping: [],
  alerts: [],
  settings: DEFAULT_SETTINGS,
};
