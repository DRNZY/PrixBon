import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../constants/theme';
import { formatEuro, useAppData } from '../hooks/useStorage';
import type { Product, Receipt } from '../types';

interface CategoryAggregate {
  category: string;
  total: number;
  count: number;
}

interface StoreAggregate {
  store: string;
  total: number;
  count: number;
}

interface MonthlyAggregate {
  key: string;       // YYYY-MM
  label: string;     // localized label
  total: number;
}

function aggregate<T extends { total: number }>(
  rows: T[],
): { max: number; items: T[] } {
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);
  return { max, items: rows.sort((a, b) => b.total - a.total) };
}

function buildCategories(receipts: Receipt[]): CategoryAggregate[] {
  const map = new Map<string, CategoryAggregate>();
  for (const r of receipts) {
    for (const p of r.products) {
      const category = (p.category?.trim() || 'Overig').toLowerCase();
      const entry = map.get(category) ?? {
        category,
        total: 0,
        count: 0,
      };
      entry.total += p.price * p.quantity;
      entry.count += p.quantity;
      map.set(category, entry);
    }
  }
  return Array.from(map.values());
}

function buildStores(receipts: Receipt[]): StoreAggregate[] {
  const map = new Map<string, StoreAggregate>();
  for (const r of receipts) {
    const key = r.store.trim() || 'Onbekend';
    const entry = map.get(key) ?? { store: key, total: 0, count: 0 };
    entry.total += r.total;
    entry.count += 1;
    map.set(key, entry);
  }
  return Array.from(map.values());
}

function buildMonthly(receipts: Receipt[]): MonthlyAggregate[] {
  const map = new Map<string, MonthlyAggregate>();
  for (const r of receipts) {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('nl-BE', { month: 'short', year: '2-digit' });
    const entry = map.get(key) ?? { key, label, total: 0 };
    entry.total += r.total;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

function mostExpensiveProduct(receipts: Receipt[]): Product | null {
  let top: Product | null = null;
  let topTotal = -Infinity;
  for (const r of receipts) {
    for (const p of r.products) {
      const line = p.price * p.quantity;
      if (line > topTotal) {
        topTotal = line;
        top = p;
      }
    }
  }
  return top;
}

export default function StatsScreen() {
  const { data, ready } = useAppData();

  const stats = useMemo(() => {
    const receipts = data.receipts;
    const totalSpent = receipts.reduce((s, r) => s + r.total, 0);
    const productCount = receipts.reduce(
      (s, r) => s + r.products.reduce((ps, p) => ps + p.quantity, 0),
      0,
    );
    const avgReceipt = receipts.length > 0 ? totalSpent / receipts.length : 0;
    const avgProduct = productCount > 0 ? totalSpent / productCount : 0;
    const top = mostExpensiveProduct(receipts);
    const monthly = buildMonthly(receipts);
    const stores = buildStores(receipts);
    const categories = buildCategories(receipts);
    return {
      totalSpent,
      productCount,
      avgReceipt,
      avgProduct,
      top,
      monthly,
      stores,
      categories,
      receiptCount: receipts.length,
    };
  }, [data.receipts]);

  const stores = aggregate(stats.stores);
  const categories = aggregate(stats.categories);
  const monthly = aggregate(stats.monthly);

  if (!ready) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.muted}>Statistieken laden…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (stats.receiptCount === 0) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="stats-chart" size={48} color={colors.textMuted} />
          <Text style={styles.title}>Nog geen data</Text>
          <Text style={styles.muted}>
            Scan je eerste bon om hier inzichten te zien.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Statistieken</Text>
        <Text style={styles.subtitle}>
          Inzichten over {stats.receiptCount} bonnen en {stats.productCount}{' '}
          producten.
        </Text>

        <View style={styles.kpiRow}>
          <KpiCard label="Totaal" value={formatEuro(stats.totalSpent)} accent />
          <KpiCard label="Gem. bon" value={formatEuro(stats.avgReceipt)} />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard label="Gem. product" value={formatEuro(stats.avgProduct)} />
          <KpiCard
            label="Top product"
            value={stats.top ? stats.top.name : '—'}
            small
          />
        </View>

        <Section title="Per maand">
          {monthly.items.map((m) => (
            <BarRow
              key={m.key}
              label={m.label}
              value={formatEuro(m.total)}
              ratio={monthly.max ? m.total / monthly.max : 0}
            />
          ))}
          {monthly.items.length === 0 ? (
            <Text style={styles.muted}>Nog geen maanddata.</Text>
          ) : null}
        </Section>

        <Section title="Per winkel">
          {stores.items.map((s) => (
            <BarRow
              key={s.store}
              label={`${s.store} (${s.count})`}
              value={formatEuro(s.total)}
              ratio={stores.max ? s.total / stores.max : 0}
            />
          ))}
          {stores.items.length === 0 ? (
            <Text style={styles.muted}>Nog geen winkels.</Text>
          ) : null}
        </Section>

        <Section title="Per categorie">
          {categories.items.map((c) => (
            <BarRow
              key={c.category}
              label={`${capitalize(c.category)} (${c.count})`}
              value={formatEuro(c.total)}
              ratio={categories.max ? c.total / categories.max : 0}
              tone="success"
            />
          ))}
          {categories.items.length === 0 ? (
            <Text style={styles.muted}>Nog geen categorieën.</Text>
          ) : null}
        </Section>

        <Text style={styles.footnote}>
          Bron: lokale opslag op je toestel. Er worden geen gegevens naar een
          server gestuurd.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <View style={[styles.kpi, accent && styles.kpiAccent]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text
        style={[
          styles.kpiValue,
          accent && styles.kpiValueAccent,
          small && styles.kpiValueSmall,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function BarRow({
  label,
  value,
  ratio,
  tone,
}: {
  label: string;
  value: string;
  ratio: number;
  tone?: 'success';
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${clamped * 100}%` },
            tone === 'success' && { backgroundColor: colors.success },
          ]}
        />
      </View>
    </View>
  );
}

function capitalize(s: string) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  scroll: {
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
  muted: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  kpi: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiAccent: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  kpiLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  kpiValue: {
    color: colors.text,
    fontSize: typography.h2,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  kpiValueAccent: {
    color: colors.success,
  },
  kpiValueSmall: {
    fontSize: typography.h3,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.h3,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  sectionBody: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  barRow: {
    gap: spacing.xs,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabel: {
    color: colors.text,
    fontSize: typography.small,
    flex: 1,
    marginRight: spacing.sm,
  },
  barValue: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
