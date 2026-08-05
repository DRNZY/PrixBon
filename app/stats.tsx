import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  formatDate,
  formatEuro,
  getPriceHistorySync,
  summarizePriceHistory,
  useAppData,
} from '../hooks/useStorage';
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

interface ProductOption {
  name: string;
  count: number;
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

function buildProductOptions(receipts: Receipt[]): ProductOption[] {
  const map = new Map<string, ProductOption>();
  for (const r of receipts) {
    for (const p of r.products) {
      const key = p.name.trim();
      if (!key) continue;
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { name: key, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });
}

export default function StatsScreen() {
  const { data, ready } = useAppData();
  const [filter, setFilter] = useState('');

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
    const products = buildProductOptions(receipts);
    return {
      totalSpent,
      productCount,
      avgReceipt,
      avgProduct,
      top,
      monthly,
      stores,
      categories,
      products,
      receiptCount: receipts.length,
    };
  }, [data.receipts]);

  const stores = aggregate(stats.stores);
  const categories = aggregate(stats.categories);
  const monthly = aggregate(stats.monthly);

  // Filter products by typed text — matches prefix or substring (case-insensitive).
  const productFilter = filter.trim().toLowerCase();
  const filteredProducts = productFilter
    ? stats.products.filter((p) => p.name.toLowerCase().includes(productFilter))
    : stats.products;

  const selectedProduct =
    filteredProducts[0]?.name ?? stats.products[0]?.name ?? null;
  const priceHistory = useMemo(() => {
    if (!selectedProduct) return [];
    return getPriceHistorySync(data.receipts, selectedProduct);
  }, [selectedProduct, data.receipts]);
  const priceSummary = useMemo(
    () => summarizePriceHistory(priceHistory),
    [priceHistory],
  );

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

        <Section title="Prijsverloop per product">
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder="Filter op productnaam…"
            placeholderTextColor={colors.textMuted}
            style={styles.filterInput}
          />

          {filteredProducts.length === 0 ? (
            <Text style={styles.muted}>
              Geen producten gevonden voor “{filter.trim()}”.
            </Text>
          ) : (
            <View style={styles.chipsRow}>
              {filteredProducts.slice(0, 10).map((p) => {
                const active = p.name === selectedProduct;
                return (
                  <Pressable
                    key={p.name}
                    onPress={() => setFilter(p.name)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    <Text
                      style={[
                        styles.chipCount,
                        active && styles.chipCountActive,
                      ]}
                    >
                      ×{p.count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {selectedProduct ? (
            <PriceChart
              product={selectedProduct}
              history={priceHistory}
              summary={priceSummary}
            />
          ) : null}
        </Section>

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

function PriceChart({
  product,
  history,
  summary,
}: {
  product: string;
  history: ReturnType<typeof getPriceHistorySync>;
  summary: ReturnType<typeof summarizePriceHistory>;
}) {
  if (history.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <Ionicons name="pulse-outline" size={28} color={colors.textMuted} />
        <Text style={styles.chartEmptyText}>
          Geen prijshistorie voor “{product}”.
        </Text>
      </View>
    );
  }

  const values = history.map((p) => p.price);
  const maxPrice = Math.max(...values);
  const minPrice = Math.min(...values);
  // Add 10% padding so the line doesn't sit on the chart edge.
  const range = Math.max(maxPrice - minPrice, 0.01);
  const yMax = maxPrice + range * 0.1;
  const yMin = Math.max(0, minPrice - range * 0.1);
  const yRange = Math.max(yMax - yMin, 0.0001);

  // SVG-free chart: stack normalized heights via plain Views.
  const pointCount = history.length;
  // If the user has only one data point, render a single horizontal marker
  // instead of a meaningless single-dot "line".
  const single = pointCount === 1;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeadlineRow}>
        <Text style={styles.chartProduct} numberOfLines={1}>
          {product}
        </Text>
        <Text style={styles.chartSampleCount}>
          {pointCount} {pointCount === 1 ? 'meting' : 'metingen'}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <SummaryStat label="Gem." value={formatEuro(summary.average)} />
        <SummaryStat label="Min" value={formatEuro(summary.min)} tone="success" />
        <SummaryStat label="Max" value={formatEuro(summary.max)} tone="danger" />
      </View>

      <View style={styles.chartFrame}>
        {single ? (
          <View style={styles.singlePointWrap}>
            <View style={styles.singlePoint} />
            <Text style={styles.singlePointLabel}>
              {formatEuro(history[0].price)}
            </Text>
          </View>
        ) : (
          <View style={styles.barsRow}>
            {history.map((p, i) => {
              const heightPct = ((p.price - yMin) / yRange) * 100;
              // Highlight the best (lowest) price point.
              const isBest = p.price <= summary.min + Number.EPSILON;
              return (
                <View key={`${p.receiptId}-${i}`} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { height: `${Math.max(4, heightPct)}%` },
                        isBest && styles.barFillBest,
                      ]}
                    />
                  </View>
                  <Text style={styles.barDate}>
                    {new Date(p.date).toLocaleDateString('nl-BE', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {history.length > 0 ? (
        <View style={styles.chartFooter}>
          <Text style={styles.chartFooterLabel}>Beste prijs</Text>
          <Text style={styles.chartFooterValue}>
            {formatEuro(summary.min)} • {formatDate(summary.best!.date)} •{' '}
            {summary.best!.store}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryStatValue,
          tone === 'success' && { color: colors.success },
          tone === 'danger' && { color: colors.danger },
        ]}
      >
        {value}
      </Text>
    </View>
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
    color: colors.accent,
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
  barFillBest: {
    backgroundColor: colors.success,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  filterInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  chipCount: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    fontWeight: '700',
  },
  chipCountActive: {
    color: colors.textInverse,
  },
  chartCard: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  chartHeadlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartProduct: {
    color: colors.text,
    fontSize: typography.h3,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  chartSampleCount: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryStat: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  summaryStatLabel: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  summaryStatValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    marginTop: 2,
  },
  chartFrame: {
    height: 160,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    justifyContent: 'flex-end',
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barDate: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    marginTop: 4,
  },
  singlePointWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  singlePoint: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
  },
  singlePointLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  chartEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  chartEmptyText: {
    color: colors.textMuted,
    fontSize: typography.small,
    textAlign: 'center',
  },
  chartFooter: {
    marginTop: spacing.xs,
  },
  chartFooterLabel: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  chartFooterValue: {
    color: colors.text,
    fontSize: typography.small,
    marginTop: 2,
  },
});