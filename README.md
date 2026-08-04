# PrixBon

A local-first receipt and grocery price tracker for Belgium and the Netherlands, built with Expo and React Native. You scan a receipt, type in what you bought, and PrixBon keeps a price history per product so you can see whether that jar of pesto actually got more expensive or you just think it did.

Everything lives on the device. There is no backend, no account, no sync, and no network calls beyond what Expo itself needs during development. Data is stored as a single JSON blob in AsyncStorage, and receipt photos are copied into local app storage.

## Features

- **Receipts**: take a photo with the camera, add products with name, price, and quantity, and save it as a receipt tied to a store, date, and country (Belgium or Netherlands).
- **Price history**: every product you've ever entered gets a price history across all your receipts, matched by name (case-insensitive), optionally scoped to a store. The receipt detail view flags a line item if it's the best price you've ever recorded for that product.
- **Price alerts**: set a target price for a product (optionally scoped to a store). When you save a receipt containing a matching product at or below that price, you get a local notification. Notification behavior respects a master on/off switch, quiet hours (22:00–07:00), and a weekdays-only option.
- **Shopping list**: a simple checklist with quantity and unit per item (stuk, liter, kg, gram, and a few others), shareable as plain text.
- **Statistics**: totals, spending by month, by store, by category, and a per-product price chart you can filter by name — also shareable as a plain-text summary.
- **Export / import**: export your full dataset as a versioned JSON snapshot (shared via the OS share sheet) and re-import it later. A corrupted or hand-edited import is validated and malformed records are skipped rather than accepted as-is.

## What this app is not

There is no price scraper and no automatic price lookup. Every price comes from what you typed in when you scanned a receipt. Alerts are checked at the moment you save a receipt, not continuously — if you want to know whether coffee dropped in price today, you still have to have bought coffee today.

## Tech stack

- [Expo](https://expo.dev) ~54, [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation (tabs)
- React 19 / React Native 0.81
- TypeScript
- `@react-native-async-storage/async-storage` for persistence
- `expo-camera` for receipt photos, `expo-file-system` for storing them locally
- `expo-notifications` for local price-alert notifications
- No backend, no third-party API calls

## Project structure

```
app/                  Screens (Expo Router tabs)
  index.tsx             Bonnen — receipt list, totals, receipt detail sheet
  scan.tsx              Scannen — camera + manual product entry, saves a receipt
  list.tsx              Lijstje — shopping list
  alerts.tsx            Alerts — price alert list and composer
  stats.tsx             Stats — spending breakdowns and price history chart
  settings.tsx          Instellingen — profile, preferences, notifications, export/import
  _layout.tsx           Tab bar setup

components/           Shared UI (ReceiptCard, ProductRow, SettingsRow)
hooks/
  useStorage.ts          AsyncStorage read/write, all data mutations, formatting helpers
  useNotifications.ts    expo-notifications setup and local notification firing
constants/theme.ts    Colors, spacing, radius, typography tokens
types.ts              Shared domain types (Receipt, Product, ShoppingItem, PriceAlert, UserSettings)
```

## Data model

All app data is stored under a single AsyncStorage key (`@prixbon/app-data/v1`) as one JSON object:

```ts
interface AppData {
  receipts: Receipt[];
  shopping: ShoppingItem[];
  alerts: PriceAlert[];
  settings: UserSettings;
}
```

A `Receipt` holds a store, date, country, total, an optional local photo URI, and a list of `Product` line items (name, unit price, quantity, optional category/barcode). See `types.ts` for the full shapes.

## Getting started

```bash
npm install
npx expo start
```

Then run on a device or simulator:

```bash
npm run android   # expo run:android
npm run ios       # expo run:ios
npm run web       # expo start --web
```

Camera access is required for the Scannen tab; on first use PrixBon asks for camera and notification permissions with copy explaining they're used locally only.

## Notes for contributors

- UI copy is Dutch throughout — keep new strings consistent with the existing tone.
- Theme values (`colors`, `spacing`, `radius`, `typography`) live in `constants/theme.ts`; don't hardcode colors or spacing in a screen.
- All data mutations go through `hooks/useStorage.ts` so screens stay in sync via its pub/sub layer — don't read or write AsyncStorage directly from a screen.
- Run `npx tsc --noEmit` before committing.
