import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { formatEuro } from '../hooks/useStorage';
import type { Product } from '../types';

interface Props {
  product: Product;
  onPress?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  trailing?: React.ReactNode;
}

export default function ProductRow({ product, onPress, onDelete, trailing }: Props) {
  const lineTotal = product.price * product.quantity;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={() => onPress?.(product)}
      style={styles.row}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="pricetag-outline" size={18} color={colors.accent} />
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.meta}>
          {formatEuro(product.price)}
          {product.quantity > 1 ? `  ×  ${product.quantity}` : ''}
          {product.category ? `  •  ${product.category}` : ''}
        </Text>
      </View>

      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}

      <View style={styles.totalWrap}>
        <Text style={styles.total}>{formatEuro(lineTotal)}</Text>
        {onDelete ? (
          <TouchableOpacity
            hitSlop={10}
            onPress={() => onDelete(product)}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  trailing: {
    marginRight: spacing.sm,
  },
  totalWrap: {
    alignItems: 'flex-end',
  },
  total: {
    color: colors.success,
    fontSize: typography.body,
    fontWeight: '700',
  },
  deleteBtn: {
    marginTop: 4,
    padding: 4,
  },
});
