import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SettingsRow from '../components/SettingsRow';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  ensureNotificationsReady,
  getNotificationPermissionStatus,
} from '../hooks/useNotifications';
import {
  exportSnapshot,
  formatCurrency,
  getDataStats,
  importSnapshot,
  resetAllData,
  updateSettings,
  useAppData,
} from '../hooks/useStorage';
import type {
  Country,
  CurrencySymbol,
  NotificationPrefs,
  ReceiptSort,
} from '../types';

const APP_VERSION_FALLBACK = '1.0.0';

function bytesToReadable(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isQuietHour(now: Date): boolean {
  const h = now.getHours();
  // Quiet hours = 22:00–07:00 local
  return h >= 22 || h < 7;
}

function isWeekday(now: Date): boolean {
  const day = now.getDay();
  return day >= 1 && day <= 5;
}

export default function SettingsScreen() {
  const { data } = useAppData();
  const [stats, setStats] = useState<{
    bytes: number;
    receiptCount: number;
    shoppingCount: number;
    alertCount: number;
  } | null>(null);
  const [profileModal, setProfileModal] = useState(false);
  const [prefsModal, setPrefsModal] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [notificationsGranted, setNotificationsGranted] = useState<
    boolean | null
  >(null);
  const [appVersion, setAppVersion] = useState(APP_VERSION_FALLBACK);

  useEffect(() => {
    void getDataStats().then(setStats);
    void getNotificationPermissionStatus().then(setNotificationsGranted);
    try {
      const v = Application.nativeApplicationVersion;
      if (v) setAppVersion(v);
    } catch {
      // Application module may not be available — keep fallback.
    }
  }, [data]);

  const settings = data.settings;

  async function setProfile(patch: Partial<typeof settings.profile>) {
    await updateSettings((s) => ({
      ...s,
      profile: { ...s.profile, ...patch },
    }));
  }

  async function setPreferences(
    patch: Partial<typeof settings.preferences>,
  ) {
    await updateSettings((s) => ({
      ...s,
      preferences: { ...s.preferences, ...patch },
    }));
  }

  async function setNotifications(patch: Partial<NotificationPrefs>) {
    await updateSettings((s) => ({
      ...s,
      notifications: { ...s.notifications, ...patch },
    }));
  }

  async function requestNotifications() {
    const granted = await ensureNotificationsReady();
    setNotificationsGranted(granted);
    if (!granted) {
      Alert.alert(
        'Meldingen geblokkeerd',
        'Sta meldingen toe in de systeeminstellingen van je telefoon.',
        [
          { text: 'Annuleer', style: 'cancel' },
          { text: 'Open instellingen', onPress: () => void Linking.openSettings() },
        ],
      );
    }
  }

  async function exportData() {
    const json = exportSnapshot(data);
    try {
      await Share.share({
        title: 'PrixBon export',
        message: json,
      });
    } catch (err) {
      console.warn('[settings] Share failed', err);
      Alert.alert(
        'Exporteren',
        'Exporteren via delen is mislukt. Probeer opnieuw.',
      );
    }
  }

  async function doImport() {
    try {
      await importSnapshot(importText);
      setImportModal(false);
      setImportText('');
      Alert.alert('Geïmporteerd', 'Je gegevens zijn hersteld.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Importeren mislukt.';
      Alert.alert('Importeren mislukt', msg);
    }
  }

  async function doReset() {
    try {
      await resetAllData();
      setResetModal(false);
      Alert.alert('Gewist', 'Alle lokale gegevens zijn verwijderd.');
    } catch (err) {
      Alert.alert(
        'Wissen mislukt',
        err instanceof Error ? err.message : 'Onbekende fout.',
      );
    }
  }

  const quietHint =
    settings.notifications.quietHoursEnabled && isQuietHour(new Date())
      ? 'Nu in stille uren'
      : null;
  const weekdayHint =
    settings.notifications.weekdaysOnly && !isWeekday(new Date())
      ? 'Nu weekend — notificaties gepauzeerd'
      : null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Instellingen</Text>
        <Text style={styles.subtitle}>
          Alles blijft lokaal op je toestel. Er wordt niets naar een server gestuurd.
        </Text>

        {/* -------- Profiel -------- */}
        <Section title="Profiel">
          <SettingsRow
            type="chevron"
            icon="person-circle-outline"
            label="Naam"
            description={settings.profile.name || 'Niet ingesteld'}
            trailing={settings.profile.name || '—'}
            onPress={() => setProfileModal(true)}
          />
          <SettingsRow
            type="chevron"
            icon="flag-outline"
            label="Standaard land"
            description={
              settings.profile.defaultCountry === 'BE'
                ? '🇧🇪 België'
                : '🇳🇱 Nederland'
            }
            onPress={() => setPrefsModal(true)}
            trailing={settings.profile.defaultCountry}
          />
        </Section>

        {/* -------- Voorkeuren -------- */}
        <Section title="Voorkeuren">
          <SettingsRow
            type="chevron"
            icon="cash-outline"
            label="Valuta"
            description={`Wordt getoond als ${formatCurrency(1.23, settings.preferences.currency).replace(/[0-9,]/g, '')}`}
            onPress={() => setPrefsModal(true)}
            trailing={settings.preferences.currency}
          />
          <SettingsRow
            type="chevron"
            icon="swap-vertical-outline"
            label="Bonnen sorteren op"
            description={
              settings.preferences.sortReceiptsBy === 'date'
                ? 'Nieuwste eerst'
                : settings.preferences.sortReceiptsBy === 'store'
                  ? 'Op winkelnaam'
                  : 'Duurste eerst'
            }
            onPress={() => setPrefsModal(true)}
            trailing={
              settings.preferences.sortReceiptsBy === 'date'
                ? 'Datum'
                : settings.preferences.sortReceiptsBy === 'store'
                  ? 'Winkel'
                  : 'Totaal'
            }
          />
        </Section>

        {/* -------- Meldingen -------- */}
        <Section
          title="Meldingen"
          rightHint={
            notificationsGranted === false ? 'Uit in systeem' : null
          }
        >
          <SettingsRow
            type="toggle"
            icon="notifications-outline"
            label="Prijsalerts sturen"
            description="Ontvang een melding zodra een product onder je doelprijs zakt."
            value={settings.notifications.enabled}
            onValueChange={(v) => void setNotifications({ enabled: v })}
            disabled={notificationsGranted === false}
          />
          <SettingsRow
            type="toggle"
            icon="moon-outline"
            label="Stille uren (22:00 – 07:00)"
            description="Geen meldingen tussen 22u en 7u."
            value={settings.notifications.quietHoursEnabled}
            onValueChange={(v) =>
              void setNotifications({ quietHoursEnabled: v })
            }
            disabled={!settings.notifications.enabled}
          />
          <SettingsRow
            type="toggle"
            icon="calendar-outline"
            label="Alleen doordeweeks"
            description="Geen meldingen in het weekend."
            value={settings.notifications.weekdaysOnly}
            onValueChange={(v) => void setNotifications({ weekdaysOnly: v })}
            disabled={!settings.notifications.enabled}
          />
          {notificationsGranted === false ? (
            <View style={styles.notice}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={colors.warning}
              />
              <Text style={styles.noticeText}>
                Meldingen zijn uitgeschakeld in Android. Tik om ze opnieuw in te
                schakelen.
              </Text>
              <TouchableOpacity onPress={requestNotifications}>
                <Text style={styles.noticeAction}>Open</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {quietHint || weekdayHint ? (
            <View style={styles.hint}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={colors.textMuted}
              />
              <Text style={styles.hintText}>{quietHint ?? weekdayHint}</Text>
            </View>
          ) : null}
        </Section>

        {/* -------- Data -------- */}
        <Section title="Data">
          {stats ? (
            <View style={styles.statsCard}>
              <StatRow
                icon="receipt-outline"
                label="Bonnen"
                value={String(stats.receiptCount)}
              />
              <StatRow
                icon="cart-outline"
                label="Boodschappenlijst"
                value={String(stats.shoppingCount)}
              />
              <StatRow
                icon="notifications-outline"
                label="Actieve alerts"
                value={String(stats.alertCount)}
              />
              <View style={styles.statDivider} />
              <StatRow
                icon="server-outline"
                label="Geschatte opslag"
                value={bytesToReadable(stats.bytes)}
              />
            </View>
          ) : null}

          <SettingsRow
            type="action"
            icon="download-outline"
            label="Exporteren naar JSON"
            description="Deel of bewaar een volledige kopie van je gegevens."
            tone="accent"
            onPress={exportData}
          />
          <SettingsRow
            type="chevron"
            icon="cloud-upload-outline"
            label="Importeren uit JSON"
            description="Herstel een eerdere export. Vervangt alle huidige data."
            onPress={() => setImportModal(true)}
          />
          <SettingsRow
            type="action"
            icon="trash-outline"
            label="Alles wissen"
            description="Verwijdert bonnen, lijst, alerts en instellingen."
            tone="danger"
            onPress={() => setResetModal(true)}
          />
        </Section>

        {/* -------- Over -------- */}
        <Section title="Over">
          <SettingsRow
            type="text"
            icon="information-circle-outline"
            label="Versie"
            value={appVersion}
          />
          <SettingsRow
            type="text"
            icon="shield-checkmark-outline"
            label="Privacy"
            value="100% lokaal"
          />
        </Section>
      </ScrollView>

      <ProfileEditorModal
        visible={profileModal}
        onClose={() => setProfileModal(false)}
        name={settings.profile.name}
        defaultCountry={settings.profile.defaultCountry}
        onSave={async (name, defaultCountry) => {
          await setProfile({ name, defaultCountry });
          setProfileModal(false);
        }}
      />

      <PreferencesModal
        visible={prefsModal}
        onClose={() => setPrefsModal(false)}
        currency={settings.preferences.currency}
        sortReceiptsBy={settings.preferences.sortReceiptsBy}
        onSave={async (currency, sortReceiptsBy) => {
          await setPreferences({ currency, sortReceiptsBy });
          setPrefsModal(false);
        }}
      />

      <ConfirmResetModal
        visible={resetModal}
        onClose={() => setResetModal(false)}
        onConfirm={doReset}
      />

      <ImportModal
        visible={importModal}
        onClose={() => setImportModal(false)}
        value={importText}
        onChangeText={setImportText}
        onConfirm={doImport}
      />
    </SafeAreaView>
  );
}

function Section({
  title,
  rightHint,
  children,
}: {
  title: string;
  rightHint?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {rightHint ? (
          <Text style={styles.sectionHint}>{rightHint}</Text>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

interface ProfileEditorProps {
  visible: boolean;
  onClose: () => void;
  name: string;
  defaultCountry: Country;
  onSave: (name: string, defaultCountry: Country) => Promise<void>;
}

function ProfileEditorModal({
  visible,
  onClose,
  name,
  defaultCountry,
  onSave,
}: ProfileEditorProps) {
  const [localName, setLocalName] = useState(name);
  const [localCountry, setLocalCountry] = useState<Country>(defaultCountry);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setLocalName(name);
      setLocalCountry(defaultCountry);
    }
  }, [visible, name, defaultCountry]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.modalCenter} pointerEvents="box-none">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Profiel</Text>
          <Text style={styles.modalLabel}>Naam</Text>
          <TextInput
            value={localName}
            onChangeText={setLocalName}
            placeholder="bv. Sam"
            placeholderTextColor={colors.textMuted}
            style={styles.modalInput}
            autoFocus
          />
          <Text style={styles.modalLabel}>Standaard land</Text>
          <View style={styles.chipRow}>
            {(['BE', 'NL'] as const).map((c) => {
              const active = c === localCountry;
              return (
                <Pressable
                  key={c}
                  onPress={() => setLocalCountry(c)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {c === 'BE' ? '🇧🇪 België' : '🇳🇱 Nederland'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={[styles.modalBtn, styles.modalBtnGhost]}
            >
              <Text style={styles.modalBtnText}>Annuleer</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                setSaving(true);
                try {
                  await onSave(localName.trim(), localCountry);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              style={[styles.modalBtn, styles.modalBtnPrimary]}
            >
              <Text
                style={[styles.modalBtnText, styles.modalBtnTextPrimary]}
              >
                {saving ? 'Opslaan…' : 'Opslaan'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface PreferencesModalProps {
  visible: boolean;
  onClose: () => void;
  currency: CurrencySymbol;
  sortReceiptsBy: ReceiptSort;
  onSave: (currency: CurrencySymbol, sortReceiptsBy: ReceiptSort) => Promise<void>;
}

function PreferencesModal({
  visible,
  onClose,
  currency,
  sortReceiptsBy,
  onSave,
}: PreferencesModalProps) {
  const [localCurrency, setLocalCurrency] = useState<CurrencySymbol>(currency);
  const [localSort, setLocalSort] = useState<ReceiptSort>(sortReceiptsBy);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setLocalCurrency(currency);
      setLocalSort(sortReceiptsBy);
    }
  }, [visible, currency, sortReceiptsBy]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.modalCenter} pointerEvents="box-none">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Voorkeuren</Text>

          <Text style={styles.modalLabel}>Valuta</Text>
          <View style={styles.chipRow}>
            {(['€', 'Fr', '$'] as const).map((c) => {
              const active = c === localCurrency;
              return (
                <Pressable
                  key={c}
                  onPress={() => setLocalCurrency(c)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {c === '€'
                      ? '€ Euro'
                      : c === 'Fr'
                        ? 'Fr Frank'
                        : '$ Dollar'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.modalLabel}>Bonnen sorteren</Text>
          <View style={styles.chipRow}>
            {(
              [
                ['date', 'Datum'],
                ['store', 'Winkel'],
                ['total', 'Totaal'],
              ] as const
            ).map(([key, label]) => {
              const active = key === localSort;
              return (
                <Pressable
                  key={key}
                  onPress={() => setLocalSort(key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={[styles.modalBtn, styles.modalBtnGhost]}
            >
              <Text style={styles.modalBtnText}>Annuleer</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                setSaving(true);
                try {
                  await onSave(localCurrency, localSort);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              style={[styles.modalBtn, styles.modalBtnPrimary]}
            >
              <Text
                style={[styles.modalBtnText, styles.modalBtnTextPrimary]}
              >
                {saving ? 'Opslaan…' : 'Opslaan'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmResetModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setConfirmText('');
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.modalCenter} pointerEvents="box-none">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Alles wissen</Text>
          <Text style={styles.modalBody}>
            Dit verwijdert al je bonnen, boodschappenlijst, alerts en
            instellingen. Dit kan niet ongedaan worden gemaakt.
          </Text>
          <Text style={[styles.modalLabel, { marginTop: spacing.md }]}>
            Typ VERWIJDER om te bevestigen
          </Text>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="VERWIJDER"
            placeholderTextColor={colors.textMuted}
            style={styles.modalInput}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={[styles.modalBtn, styles.modalBtnGhost]}
            >
              <Text style={styles.modalBtnText}>Annuleer</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy || confirmText.trim() !== 'VERWIJDER'}
              style={[
                styles.modalBtn,
                styles.modalBtnDanger,
                (busy || confirmText.trim() !== 'VERWIJDER') &&
                  styles.modalBtnDisabled,
              ]}
            >
              <Text
                style={[styles.modalBtnText, styles.modalBtnTextDanger]}
              >
                {busy ? 'Bezig…' : 'Wis alles'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ImportModal({
  visible,
  onClose,
  value,
  onChangeText,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChangeText: (v: string) => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setBusy(false);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetCenter} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.modalTitle}>Importeren</Text>
          <Text style={styles.modalBody}>
            Plak hieronder de JSON die je eerder hebt geëxporteerd. Je huidige
            gegevens worden volledig vervangen.
          </Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="{ ... }"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.modalInput, styles.modalInputMulti]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={[styles.modalBtn, styles.modalBtnGhost]}
            >
              <Text style={styles.modalBtnText}>Annuleer</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy || value.trim().length < 10}
              style={[
                styles.modalBtn,
                styles.modalBtnPrimary,
                (busy || value.trim().length < 10) && styles.modalBtnDisabled,
              ]}
            >
              <Text
                style={[styles.modalBtnText, styles.modalBtnTextPrimary]}
              >
                {busy ? 'Bezig…' : 'Importeer'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
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
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.warning,
    fontSize: typography.tiny,
    fontWeight: '700',
  },
  sectionBody: {
    gap: spacing.sm,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  statLabel: {
    flex: 1,
    color: colors.text,
    fontSize: typography.small,
  },
  statValue: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  statDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  noticeText: {
    flex: 1,
    color: colors.warning,
    fontSize: typography.small,
  },
  noticeAction: {
    color: colors.warning,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: typography.tiny,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheetCenter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.h2,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  modalBody: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 20,
  },
  modalLabel: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalInputMulti: {
    minHeight: 140,
    textAlignVertical: 'top',
    fontFamily: 'Courier',
    fontSize: typography.small,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  modalBtnGhost: {
    backgroundColor: colors.surfaceAlt,
  },
  modalBtnPrimary: {
    backgroundColor: colors.accent,
  },
  modalBtnDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  modalBtnDisabled: {
    opacity: 0.4,
  },
  modalBtnText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  modalBtnTextPrimary: {
    color: colors.textInverse,
  },
  modalBtnTextDanger: {
    color: colors.danger,
  },
});