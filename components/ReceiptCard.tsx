import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { formatDate, formatEuro } from '../hooks/useStorage';
import type { Receipt } from '../types';

interface Props {
  receipt: Receipt;
  onPress?: (receipt: Receipt) => void;
  onLongPress?: (receipt: Receipt) => void;
}

export default function ReceiptCard({ receipt, onPress, onLongPress }: Props) {
  const productCount = receipt.products.length;
  const flag = receipt.country === 'NL' ? '🇳🇱' : '🇧🇪';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(receipt)}
      onLongPress={() => onLongPress?.(receipt)}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.store} numberOfLines={1}>
            {receipt.store}
          </Text>
          <Text style={styles.date}>
            {flag} {formatDate(receipt.date)}
          </Text>
        </View>
        <Text style={styles.total}>{formatEuro(receipt.total)}</Text>
      </View>

      {receipt.imageUri ? (
        <Image source={{ uri: receipt.imageUri }} style={styles.thumb} />
      ) : null}

      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <Ionicons name="receipt-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {productCount} {productCount === 1 ? 'product' : 'producten'}
          </Text>
        </View>
        {receipt.products[0] ? (
          <Text style={styles.preview} numberOfLines={1}>
            {receipt.products.slice(0, 3).map((p) => p.name).join(' • ')}
          </Text>
        ) : (
          <Text style={styles.previewMuted}>Geen producten</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  store: {
    color: colors.text,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  date: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  total: {
    color: colors.accent,
    fontSize: typography.h2,
    fontWeight: '800',
  },
  thumb: {
    marginTop: spacing.md,
    width: '100%',
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  preview: {
    color: colors.text,
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  previewMuted: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
