import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Alert,
  FlatList,
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
  formatEuro,
  useAppData,
} from '../hooks/useStorage';
import type { Receipt } from '../types';

export default function HomeScreen() {
  const router = useRouter();
  const { data, ready } = useAppData();

  const stats = useMemo(() => {
    const receipts = data.receipts;
    const totalSpent = receipts.reduce((sum, r) => sum + r.total, 0);
    const average = receipts.length > 0 ? totalSpent / receipts.length : 0;
    const lastStore = receipts[0]?.store ?? null;
    return { totalSpent, average, count: receipts.length, lastStore };
  }, [data.receipts]);

  function confirmDelete(receipt: Receipt) {
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
            onPress={(r) =>
              Alert.alert(
                r.store,
                `${item.products.length} producten — ${formatEuro(r.total)}`,
              )
            }
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.success,
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
});
