import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReceiptCard from '../components/ReceiptCard';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  deleteReceipt,
  formatDate,
  formatEuro,
  getPriceHistorySync,
  useAppData,
} from '../hooks/useStorage';
import type { Receipt } from '../types';

export default function HomeScreen() {
  const router = useRouter();
  const { data, ready } = useAppData();
  const [detail, setDetail] = useState<Receipt | null>(null);

  const stats = useMemo(() => {
    const receipts = data.receipts;
    const totalSpent = receipts.reduce((sum, r) => sum + r.total, 0);
    const average = receipts.length > 0 ? totalSpent / receipts.length : 0;
    const lastStore = receipts[0]?.store ?? null;
    return { totalSpent, average, count: receipts.length, lastStore };
  }, [data.receipts]);

  function confirmDelete(receipt: Receipt) {
    if (detail?.id === receipt.id) setDetail(null);
    Alert.alert(
      'Bon verwijderen',
      `“${receipt.store}” van ${new Date(receipt.date).toLocaleDateString('nl-BE')} wissen?`,
      [
        { text: 'Annuleer', style: 'cancel' },
        {
          text: 'Verwijder',
          style: 'destructive',
          onPress: () => {
            void deleteReceipt(receipt.id);
          },
        },
      ],
    );
  }

  function openScan() {
    router.push('/scan');
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <FlatList
        data={data.receipts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Bonnen</Text>
            <Text style={styles.subtitle}>
              {stats.count === 0
                ? 'Nog geen bonnetjes — scan je eerste bon.'
                : `${stats.count} bon${stats.count === 1 ? '' : 'nen'} opgeslagen`}
            </Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Totaal uitgegeven</Text>
                  <Text style={styles.summaryValue}>
                    {formatEuro(stats.totalSpent)}
                  </Text>
                </View>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Gemiddeld per bon</Text>
                  <Text style={styles.summaryValueSecondary}>
                    {formatEuro(stats.average)}
                  </Text>
                </View>
              </View>
              {stats.lastStore ? (
                <Text style={styles.lastStore}>
                  Laatste winkel: <Text style={styles.bold}>{stats.lastStore}</Text>
                </Text>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={openScan}>
                <Ionicons name="add-circle" size={20} color={colors.textInverse} />
                <Text style={styles.primaryButtonText}>Nieuwe bon</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push('/stats')}
              >
                <Ionicons name="stats-chart" size={20} color={colors.accent} />
                <Text style={styles.secondaryButtonText}>Statistieken</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Recente bonnen</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReceiptCard
            receipt={item}
            onPress={(r) => setDetail(r)}
            onLongPress={confirmDelete}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nog geen bonnen</Text>
            <Text style={styles.emptyBody}>
              Ga naar “Scannen” om een bonnetje toe te voegen met de camera.
            </Text>
          </View>
        }
        refreshing={!ready}
      />

      <ReceiptDetailModal
        receipt={detail}
        receipts={data.receipts}
        onClose={() => setDetail(null)}
      />
    </SafeAreaView>
  );
}

interface ReceiptDetailProps {
  receipt: Receipt | null;
  receipts: Receipt[];
  onClose: () => void;
}

function ReceiptDetailModal({ receipt, receipts, onClose }: ReceiptDetailProps) {
  // For each product in the receipt, decide if THIS row's price is the lowest
  // ever recorded across all receipts (case-insensitive product name match).
  // We mark a product as "best price ever" only when there's actual history to
  // compare against — first occurrence stays neutral.
  const badges = useMemo(() => {
    const map = new Map<string, { isBest: boolean; historyCount: number }>();
    if (!receipt) return map;
    for (const p of receipt.products) {
      const history = getPriceHistorySync(receipts, p.name);
      const others = history.filter(
        (h) => h.receiptId !== receipt.id && h.date !== receipt.date,
      );
      const minPrice = others.reduce(
        (acc, h) => (h.price < acc ? h.price : acc),
        Infinity,
      );
      const isBest =
        others.length > 0 && p.price <= minPrice + Number.EPSILON;
      map.set(p.id, { isBest, historyCount: history.length });
    }
    return map;
  }, [receipt, receipts]);

  return (
    <Modal
      visible={receipt !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheetWrapper} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {receipt?.store ?? ''}
              </Text>
              <Text style={styles.sheetMeta}>
                {receipt ? formatDate(receipt.date) : ''}
                {receipt?.country ? `  •  ${receipt.country === 'NL' ? '🇳🇱' : '🇧🇪'}` : ''}
              </Text>
            </View>
            <TouchableOpacity hitSlop={8} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.sheetScroll}>
            {receipt?.imageUri ? (
              <Image
                source={{ uri: receipt.imageUri }}
                style={styles.sheetImage}
              />
            ) : null}

            <View style={styles.sheetTotals}>
              <View>
                <Text style={styles.sheetTotalsLabel}>Totaal</Text>
                <Text style={styles.sheetTotalsValue}>
                  {receipt ? formatEuro(receipt.total) : '—'}
                </Text>
              </View>
              <View style={styles.alignEnd}>
                <Text style={styles.sheetTotalsLabel}>Producten</Text>
                <Text style={styles.sheetTotalsMeta}>
                  {receipt?.products.length ?? 0}
                </Text>
              </View>
            </View>

            <Text style={styles.sheetSection}>Producten</Text>
            {receipt?.products.map((p) => {
              const badge = badges.get(p.id);
              return (
                <View key={p.id} style={styles.productRow}>
                  <View style={styles.productRowLeft}>
                    <View style={styles.productIcon}>
                      <Ionicons
                        name="pricetag-outline"
                        size={16}
                        color={colors.accent}
                      />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.productNameRow}>
                        <Text style={styles.productName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        {badge?.isBest ? (
                          <View style={styles.bestBadge}>
                            <Ionicons
                              name="trophy"
                              size={10}
                              color={colors.textInverse}
                            />
                            <Text style={styles.bestBadgeText}>Beste prijs ooit</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.productMeta}>
                        {formatEuro(p.price)}
                        {p.quantity > 1 ? `  ×  ${p.quantity}` : ''}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.productLineTotal}>
                    {formatEuro(p.price * p.quantity)}
                  </Text>
                </View>
              );
            })}

            {receipt && receipt.products.length === 0 ? (
              <Text style={styles.sheetEmpty}>Geen producten op deze bon.</Text>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
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
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
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
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  summaryCol: {
    flex: 1,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  summaryValue: {
    color: colors.accent,
    fontSize: typography.h1,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  summaryValueSecondary: {
    color: colors.text,
    fontSize: typography.h2,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  lastStore: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: spacing.md,
  },
  bold: {
    color: colors.text,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: typography.body,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  secondaryButtonText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: typography.body,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.h3,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '90%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sheetHeaderLeft: {
    flex: 1,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: typography.h2,
    fontWeight: '800',
  },
  sheetMeta: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sheetImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.sm,
  },
  sheetTotals: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  sheetTotalsLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  sheetTotalsValue: {
    color: colors.accent,
    fontSize: typography.h2,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  sheetTotalsMeta: {
    color: colors.text,
    fontSize: typography.h2,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  sheetSection: {
    color: colors.text,
    fontSize: typography.h3,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginRight: spacing.md,
  },
  productIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  productName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  productMeta: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  productLineTotal: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: '700',
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },
  bestBadgeText: {
    color: colors.textInverse,
    fontSize: typography.tiny,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sheetEmpty: {
    color: colors.textMuted,
    fontSize: typography.small,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});