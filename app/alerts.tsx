import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
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
import {
  addPriceAlert,
  deletePriceAlert,
  formatDate,
  formatEuro,
  togglePriceAlert,
  updatePriceAlert,
  useAppData,
} from '../hooks/useStorage';
import type { PriceAlert } from '../types';

export default function AlertsScreen() {
  const { data, ready } = useAppData();
  const [name, setName] = useState('');
  const [store, setStore] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');

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
    const currentNum = current ? Number(current.replace(',', '.')) : undefined;
    if (current && (!Number.isFinite(currentNum) || (currentNum ?? 0) < 0)) {
      Alert.alert('Huidige prijs ongeldig', 'Vul een geldige huidige prijs in.');
      return;
    }
    await addPriceAlert({
      productName: trimmed,
      store: store.trim() || undefined,
      targetPrice: targetNum,
      currentPrice: currentNum,
      active: true,
    });
    setName('');
    setStore('');
    setTarget('');
    setCurrent('');
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
    const progress = item.currentPrice
      ? Math.max(0, Math.min(1, 1 - item.currentPrice / item.targetPrice))
      : 0;
    const triggered =
      item.currentPrice !== undefined && item.currentPrice <= item.targetPrice;
    return (
      <View
        style={[
          styles.card,
          triggered && styles.cardTriggered,
          !item.active && styles.cardInactive,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.flex}>
            <Text style={styles.alertName}>{item.productName}</Text>
            {item.store ? (
              <Text style={styles.alertStore}>{item.store}</Text>
            ) : null}
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

        <View style={styles.pricesRow}>
          <View style={styles.flex}>
            <Text style={styles.priceLabel}>Doel</Text>
            <Text style={styles.priceValue}>{formatEuro(item.targetPrice)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.priceLabel}>Nu</Text>
            <Text style={[styles.priceValue, triggered && styles.priceTriggered]}>
              {item.currentPrice !== undefined
                ? formatEuro(item.currentPrice)
                : '—'}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.priceLabel}>Aangemaakt</Text>
            <Text style={styles.priceMeta}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.cardActions}>
          {item.currentPrice === undefined ? (
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => {
                Alert.prompt?.(
                  'Huidige prijs instellen',
                  `Huidige prijs voor ${item.productName} (€)`,
                  (text) => {
                    const num = Number((text || '').replace(',', '.'));
                    if (Number.isFinite(num)) {
                      void updatePriceAlert(item.id, { currentPrice: num });
                    }
                  },
                  'plain-text',
                  '',
                  'numeric',
                );
                // Alert.prompt only available on iOS — fallback for Android:
                if (Platform.OS !== 'ios') {
                  void updatePriceAlert(item.id, { currentPrice: item.targetPrice });
                }
              }}
            >
              <Ionicons name="create-outline" size={14} color={colors.accent} />
              <Text style={styles.smallBtnText}>Prijs instellen</Text>
            </TouchableOpacity>
          ) : null}
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
            <TextInput
              value={current}
              onChangeText={setCurrent}
              placeholder="Nu € (optioneel)"
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
  cardTriggered: {
    borderColor: colors.success,
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
  pricesRow: {
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
  priceTriggered: {
    color: colors.success,
  },
  priceMeta: {
    color: colors.text,
    fontSize: typography.body,
    marginTop: 2,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
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
