// Centralized expo-notifications setup for PrixBon.
// All screens fire alerts through this module so we only request permissions once,
// create the Android channel once, and configure the handler in a single place.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'prixbon-price-alerts';
let setupPromise: Promise<boolean> | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests notification permissions (idempotent). Returns true if granted.
 * Also sets up the Android channel on first call.
 */
export async function ensureNotificationsReady(): Promise<boolean> {
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Prijsalerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#667eea',
        });
      } catch (err) {
        console.warn('[notifications] setNotificationChannelAsync failed', err);
      }
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  })();

  return setupPromise;
}

/**
 * Synchronous-feeling permission check that doesn't trigger a system prompt.
 * Returns true if already granted, false if denied/undetermined/unsupported.
 * Safe to call from useEffect on first mount.
 */
export async function getNotificationPermissionStatus(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Fire a local price-alert notification immediately. Best-effort — if permissions
 * aren't granted yet, silently swallows the error so the calling screen flow
 * (e.g. save-receipt) is never blocked.
 */
export async function notifyPriceAlert(
  productName: string,
  price: number,
  store: string,
): Promise<void> {
  try {
    const ready = await ensureNotificationsReady();
    if (!ready) return;
    const formattedPrice = `€ ${price.toFixed(2).replace('.', ',')}`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Prijsalert!',
        body: `${productName} is nu ${formattedPrice} bij ${store}`,
        sound: undefined,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[notifications] notifyPriceAlert failed', err);
  }
}