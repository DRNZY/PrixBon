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
  addShoppingItem,
  clearCheckedShoppingItems,
  deleteShoppingItem,
  toggleShoppingItem,
  useAppData,
} from '../hooks/useStorage';
import type { ShoppingItem } from '../types';

export default function ListScreen() {
  const { data, ready } = useAppData();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('stuk');

  const summary = useMemo(() => {
    const total = data.shopping.length;
    const checked = data.shopping.filter((i) => i.checked).length;
    return { total, checked, remaining: total - checked };
  }, [data.shopping]);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Product vereist', 'Vul een productnaam in.');
      return;
    }
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    await addShoppingItem({ name: trimmed, quantity: qty, unit, checked: false });
    setName('');
    setQuantity('1');
  }

  function confirmClearChecked() {
    if (summary.checked === 0) return;
    Alert.alert(
      'Afgevinkte wissen',
      `${summary.checked} afgevinkt${summary.checked === 1 ? '' : 'e'} item${summary.checked === 1 ? '' : 's'} verwijderen?`,
      [
        { text: 'Annuleer', style: 'cancel' },
        { text: 'Wis', style: 'destructive', onPress: () => void clearCheckedShoppingItems() },
      ],
    );
  }

  function renderItem({ item }: { item: ShoppingItem }) {
    return (
      <View style={[styles.row, item.checked && styles.rowChecked]}>
        <Pressable
          hitSlop={8}
          onPress={() => void toggleShoppingItem(item.id)}
          style={[styles.checkbox, item.checked && styles.checkboxOn]}
        >
          {item.checked ? (
            <Ionicons name="checkmark" size={16} color={colors.textInverse} />
          ) : null}
        </Pressable>
        <View style={styles.body}>
          <Text
            style={[styles.name, item.checked && styles.nameChecked]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={styles.meta}>
            {item.quantity} {item.unit ?? 'stuk'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void deleteShoppingItem(item.id)}
          style={styles.deleteBtn}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Boodschappenlijst</Text>
          <Text style={styles.subtitle}>
            {summary.total === 0
              ? 'Nog leeg — voeg je eerste item toe.'
              : `${summary.remaining} te kopen • ${summary.checked} klaar`}
          </Text>
        </View>

        <View style={styles.composer}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Wat moet je kopen?"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.flex]}
            onSubmitEditing={add}
            returnKeyType="done"
          />
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Aantal"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={[styles.input, styles.qtyInput]}
          />
          <TouchableOpacity style={styles.addBtn} onPress={add}>
            <Ionicons name="add" size={22} color={colors.textInverse} />
          </TouchableOpacity>
        </View>

        <View style={styles.unitRow}>
          {(['stuk', 'liter', 'kg', 'pak'] as const).map((u) => (
            <Pressable
              key={u}
              onPress={() => setUnit(u)}
              style={[styles.unitChip, unit === u && styles.unitChipActive]}
            >
              <Text
                style={[
                  styles.unitChipText,
                  unit === u && styles.unitChipTextActive,
                ]}
              >
                {u}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={data.shopping}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={!ready}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cart-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Lege lijst</Text>
              <Text style={styles.emptyBody}>
                Voeg hier je boodschappen toe en vink ze af in de winkel.
              </Text>
            </View>
          }
        />

        {summary.checked > 0 ? (
          <TouchableOpacity style={styles.clearBtn} onPress={confirmClearChecked}>
            <Ionicons name="checkmark-done" size={18} color={colors.success} />
            <Text style={styles.clearBtnText}>
              {summary.checked} afgevinkt{summary.checked === 1 ? '' : 'e'} wissen
            </Text>
          </TouchableOpacity>
        ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
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
  qtyInput: {
    width: 64,
    textAlign: 'center',
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  unitChipText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  unitChipTextActive: {
    color: colors.textInverse,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowChecked: {
    opacity: 0.7,
    borderColor: colors.success,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxOn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  body: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  nameChecked: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  deleteBtn: {
    padding: spacing.sm,
  },
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
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.success,
  },
  clearBtnText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: typography.body,
  },
});
