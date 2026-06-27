import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../constants/theme';
import { ensureNotificationsReady } from '../hooks/useNotifications';
import {
  deletePriceAlert,
  formatDate,
  formatEuro,
  setPriceAlert,
  togglePriceAlert,
  useAppData,
} from '../hooks/useStorage';
import type { PriceAlert } from '../types';

export default function AlertsScreen() {
  const { data, ready } = useAppData();
  const [name, setName] = useState('');
  const [store, setStore] = useState('');
  const [target, setTarget] = useState('');
  const [notificationsReady, setNotificationsReady] = useState<boolean | null>(null);

  // Ask for notification permission once when the user lands here. We don't
  // request eagerly on app start — first visit feels like the right moment.
  useEffect(() => {
    let cancelled = false;
    void ensureNotificationsReady().then((granted) => {
      if (!cancelled) setNotificationsReady(granted);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    return [...data.alerts].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.targetPrice - b.targetPrice;
    });
  }, [data.alerts]);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Product vereist', 'Vul een productnaam in.');
      return;
    }
    const targetNum = Number(target.replace(',', '.'));
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      Alert.alert('Doelprijs vereist', 'Vul een geldige doelprijs in.');
      return;
    }
    try {
      await setPriceAlert(trimmed, targetNum, store.trim() || undefined);
      setName('');
      setStore('');
      setTarget('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kon alert niet opslaan.';
      Alert.alert('Alert mislukt', msg);
    }
  }

  function confirmDelete(alert: PriceAlert) {
    Alert.alert(
      'Alert verwijderen',
      `Alert voor “${alert.productName}” wissen?`,
      [
        { text: 'Annuleer', style: 'cancel' },
        {
          text: 'Verwijder',
          style: 'destructive',
          onPress: () => void deletePriceAlert(alert.id),
        },
      ],
    );
  }

  function renderItem({ item }: { item: PriceAlert }) {
    const storeLine = item.store ? item.store : 'Alle winkels';
    return (
      <View style={[styles.card, !item.active && styles.cardInactive]}>
        <View style={styles.cardHeader}>
          <View style={styles.flex}>
            <Text style={styles.alertName} numberOfLines={1}>
              {item.productName}
            </Text>
            <Text style={styles.alertStore} numberOfLines={1}>
              {storeLine}
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => void togglePriceAlert(item.id)}
            style={[
              styles.toggle,
              item.active ? styles.toggleOn : styles.toggleOff,
            ]}
          >
            <View
              style={[
                styles.toggleDot,
                item.active && styles.toggleDotOn,
              ]}
            />
          </Pressable>
        </View>

        <View style={styles.targetRow}>
          <View style={styles.flex}>
            <Text style={styles.priceLabel}>Doelprijs</Text>
            <Text style={styles.priceValue}>
              {formatEuro(item.targetPrice)}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.priceLabel}>Aangemaakt</Text>
            <Text style={styles.priceMeta}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        <Text style={styles.alertHint}>
          Je krijgt een melding zodra je dit product scant op of onder{' '}
          {formatEuro(item.targetPrice)}.
        </Text>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.smallBtn, styles.smallBtnDanger]}
            onPress={() => confirmDelete(item)}
          >
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={[styles.smallBtnText, styles.smallBtnTextDanger]}>
              Verwijderen
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Prijsalerts</Text>
          <Text style={styles.subtitle}>
            Krijg een melding wanneer een product onder je doelprijs zakt.
          </Text>
          {notificationsReady === false ? (
            <TouchableOpacity
              style={styles.notice}
              onPress={() => void ensureNotificationsReady()}
            >
              <Ionicons
                name="notifications-off-outline"
                size={16}
                color={colors.warning}
              />
              <Text style={styles.noticeText}>
                Meldingen staan uit. Tik om opnieuw te vragen.
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.composer}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Product"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <TextInput
            value={store}
            onChangeText={setStore}
            placeholder="Winkel (optioneel)"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <View style={styles.row2}>
            <TextInput
              value={target}
              onChangeText={setTarget}
              placeholder="Doelprijs €"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={[styles.input, styles.flex]}
            />
            <TouchableOpacity style={styles.addBtn} onPress={add}>
              <Ionicons name="add" size={22} color={colors.textInverse} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={!ready}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="notifications-off-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>Geen alerts</Text>
              <Text style={styles.emptyBody}>
                Stel een doelprijs in voor een product dat je in de gaten
                wilt houden.
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.h1,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  noticeText: {
    color: colors.warning,
    fontSize: typography.small,
    flex: 1,
  },
  composer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row2: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInactive: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertName: {
    color: colors.text,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  alertStore: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  targetRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  priceLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  priceValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: 2,
  },
  priceMeta: {
    color: colors.text,
    fontSize: typography.body,
    marginTop: 2,
  },
  alertHint: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  smallBtnText: {
    color: colors.accent,
    fontSize: typography.small,
    fontWeight: '700',
  },
  smallBtnDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  smallBtnTextDanger: {
    color: colors.danger,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: colors.success,
    alignItems: 'flex-end',
  },
  toggleOff: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'flex-start',
  },
  toggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.textInverse,
  },
  toggleDotOn: {},
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.h3,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: typography.small,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});