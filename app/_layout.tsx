import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { colors, typography } from '../constants/theme';

export default function RootLayout() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 68,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: typography.tiny,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Bonnen',
            tabBarLabel: 'Bonnen',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="receipt" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scannen',
            tabBarLabel: 'Scannen',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="camera" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="list"
          options={{
            title: 'Lijstje',
            tabBarLabel: 'Lijstje',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alerts',
            tabBarLabel: 'Alerts',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarLabel: 'Stats',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Instellingen',
            tabBarLabel: 'Instellingen',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
