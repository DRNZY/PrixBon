// Reusable Settings row — matches the dark theme tokens used across the app.
// Supports four layouts:
//   - toggle (boolean switch on the right)
//   - chevron (tap to navigate or open a sheet)
//   - text (right-aligned value text)
//   - action (right-aligned destructive/accent label)

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';

interface BaseProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface ToggleProps extends BaseProps {
  type: 'toggle';
  value: boolean;
  onValueChange: (next: boolean) => void;
}

interface ChevronProps extends BaseProps {
  type: 'chevron';
  onPress: () => void;
  trailing?: string;
}

interface TextProps extends BaseProps {
  type: 'text';
  value: string;
  onPress?: () => void;
}

interface ActionProps extends BaseProps {
  type: 'action';
  label: string;
  tone?: 'accent' | 'danger';
  onPress: () => void;
}

type Props = ToggleProps | ChevronProps | TextProps | ActionProps;

export default function SettingsRow(props: Props) {
  const isInteractive =
    props.type !== 'toggle' && (props as { onPress?: () => void }).onPress != null;
  const containerStyle = [
    styles.row,
    props.disabled && styles.disabled,
  ];

  const inner = (
    <View style={containerStyle}>
      {props.icon ? (
        <View style={styles.iconWrap}>
          <Ionicons
            name={props.icon}
            size={18}
            color={
              props.type === 'action' && props.tone === 'danger'
                ? colors.danger
                : colors.accent
            }
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <Text
          style={[
            styles.label,
            props.type === 'action' && props.tone === 'danger' && {
              color: colors.danger,
            },
          ]}
          numberOfLines={1}
        >
          {props.label}
        </Text>
        {props.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {props.description}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {renderTrailing(props)}
      </View>
    </View>
  );

  if (isInteractive && !props.disabled) {
    return (
      <Pressable
        onPress={(props as { onPress: () => void }).onPress}
        android_ripple={{ color: colors.surfaceAlt }}
        style={styles.pressable}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}

function renderTrailing(props: Props) {
  switch (props.type) {
    case 'toggle':
      return (
        <Switch
          value={props.value}
          onValueChange={props.onValueChange}
          disabled={props.disabled}
          trackColor={{ false: colors.surfaceAlt, true: colors.accentSoft }}
          thumbColor={props.value ? colors.accent : colors.textMuted}
        />
      );
    case 'chevron':
      return (
        <>
          {props.trailing ? (
            <Text style={styles.value} numberOfLines={1}>
              {props.trailing}
            </Text>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </>
      );
    case 'text':
      return (
        <>
          <Text style={styles.value} numberOfLines={1}>
            {props.value}
          </Text>
          {props.onPress ? (
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          ) : null}
        </>
      );
    case 'action':
      return (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={
            props.tone === 'danger' ? colors.danger : colors.textMuted
          }
        />
      );
  }
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.5,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
});