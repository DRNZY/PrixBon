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

export interface AppData {
  receipts: Receipt[];
  shopping: ShoppingItem[];
  alerts: PriceAlert[];
}

export const EMPTY_APP_DATA: AppData = {
  receipts: [],
  shopping: [],
  alerts: [],
};
