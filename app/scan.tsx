import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProductRow from '../components/ProductRow';
import { colors, radius, spacing, typography } from '../constants/theme';
import { notifyPriceAlert } from '../hooks/useNotifications';
import {
  addReceipt,
  checkPriceAlert,
  formatEuro,
} from '../hooks/useStorage';
import type { Country, Product, Receipt } from '../types';

interface DraftProduct {
  id: string;
  name: string;
  price: string;
  quantity: string;
}

function newDraft(): DraftProduct {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: '',
    price: '',
    quantity: '1',
  };
}

export default function ScanScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [store, setStore] = useState('');
  const [country, setCountry] = useState<Country>('BE');
  const [date, setDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [drafts, setDrafts] = useState<DraftProduct[]>([newDraft()]);
  const [saving, setSaving] = useState(false);

  if (!permission) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.body}>Camera wordt geladen…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
          <Text style={styles.title}>Cameratoegang vereist</Text>
          <Text style={styles.body}>
            Geef toegang tot de camera om bonnetjes te scannen. De foto’s
            blijven lokaal op je toestel.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Ionicons name="camera" size={20} color={colors.textInverse} />
            <Text style={styles.primaryButtonText}>Toegang geven</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  async function takePhoto() {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      if (!photo?.uri) return;

      const dir = new FileSystem.Directory(FileSystem.Paths.document, 'receipts');
      if (!dir.exists) dir.create();
      const fileName = `receipt-${Date.now()}.jpg`;
      const dest = new FileSystem.File(dir, fileName);
      const source = new FileSystem.File(photo.uri);
      source.copy(dest);
      setPhotoUri(dest.uri);
    } catch (err) {
      console.warn('[scan] takePhoto failed', err);
      Alert.alert('Foto mislukt', 'De foto kon niet worden opgeslagen.');
    }
  }

  function updateDraft(id: string, patch: Partial<DraftProduct>) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    );
  }

  function removeDraft(id: string) {
    setDrafts((prev) => (prev.length === 1 ? prev : prev.filter((d) => d.id !== id)));
  }

  function addDraft() {
    setDrafts((prev) => [...prev, newDraft()]);
  }

  function parseDrafts(): { products: Product[]; total: number } | string {
    const products: Product[] = [];
    let total = 0;
    for (const d of drafts) {
      const name = d.name.trim();
      const priceNum = Number(d.price.replace(',', '.'));
      const qtyNum = Number(d.quantity || '1');
      if (!name) continue;
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return `Ongeldige prijs voor “${name}”.`;
      }
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        return `Ongeldige hoeveelheid voor “${name}”.`;
      }
      const lineTotal = priceNum * qtyNum;
      products.push({
        id: d.id,
        name,
        price: priceNum,
        quantity: qtyNum,
      });
      total += lineTotal;
    }
    if (products.length === 0) return 'Voeg minstens één product toe.';
    return { products, total: Math.round(total * 100) / 100 };
  }

  async function saveReceipt() {
    if (!store.trim()) {
      Alert.alert('Winkel vereist', 'Vul de naam van de winkel in.');
      return;
    }
    const parsed = parseDrafts();
    if (typeof parsed === 'string') {
      Alert.alert('Producten onvolledig', parsed);
      return;
    }
    setSaving(true);
    try {
      const storeName = store.trim();
      const receipt: Omit<Receipt, 'id' | 'createdAt'> = {
        store: storeName,
        date: new Date(date).toISOString(),
        country,
        total: parsed.total,
        currency: 'EUR',
        imageUri: photoUri,
        products: parsed.products,
      };
      await addReceipt(receipt);
      // After the receipt is on disk, walk every product and fire a local
      // notification for each one whose price matches (or beats) an active
      // alert. Fire-and-forget — a permission denial shouldn't block the flow.
      const triggered = parsed.products.filter(
        (p) => p.price > 0 && p.name.trim().length > 0,
      );
      const fired: string[] = [];
      for (const p of triggered) {
        const hit = await checkPriceAlert(p.name, p.price, storeName);
        if (!hit) continue;
        await notifyPriceAlert(p.name, p.price, storeName);
        fired.push(p.name);
      }
      // reset form
      setStore('');
      setPhotoUri(undefined);
      setDrafts([newDraft()]);
      const summary =
        fired.length > 0
          ? `Bon opgeslagen. ${fired.length} prijsalert${
              fired.length === 1 ? '' : 's'
            } geactiveerd.`
          : `Bon van ${receipt.store} (${formatEuro(receipt.total)}) toegevoegd.`;
      Alert.alert(
        fired.length > 0 ? 'Opgeslagen + alert!' : 'Opgeslagen',
        summary,
      );
    } finally {
      setSaving(false);
    }
  }

  const preview = parseDrafts();

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Nieuwe bon</Text>
          <Text style={styles.subtitle}>
            Maak een foto en voeg de producten toe.
          </Text>

          <View style={styles.cameraCard}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              enableTorch={torch}
            />
            <View style={styles.cameraControls}>
              <Pressable
                style={styles.camBtn}
                onPress={() => setFacing((p) => (p === 'back' ? 'front' : 'back'))}
              >
                <Ionicons name="camera-reverse" size={20} color={colors.text} />
              </Pressable>
              <Pressable
                style={[styles.camBtn, styles.captureBtn]}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={28} color={colors.textInverse} />
              </Pressable>
              <Pressable
                style={styles.camBtn}
                onPress={() => setTorch((t) => !t)}
              >
                <Ionicons
                  name={torch ? 'flash' : 'flash-off'}
                  size={20}
                  color={colors.text}
                />
              </Pressable>
            </View>
          </View>

          {photoUri ? (
            <View style={styles.previewRow}>
              <Image source={{ uri: photoUri }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.removePhoto}
                onPress={() => setPhotoUri(undefined)}
              >
                <Ionicons name="close" size={16} color={colors.textInverse} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.helper}>Nog geen foto — tip op de cameraknop.</Text>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Winkel</Text>
            <TextInput
              value={store}
              onChangeText={setStore}
              placeholder="bv. Colruyt, Albert Heijn"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.fieldGroup, styles.flex]}>
              <Text style={styles.label}>Datum</Text>
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, styles.flex]}>
              <Text style={styles.label}>Land</Text>
              <View style={styles.countryRow}>
                {(['BE', 'NL'] as const).map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCountry(c)}
                    style={[
                      styles.countryChip,
                      country === c && styles.countryChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countryChipText,
                        country === c && styles.countryChipTextActive,
                      ]}
                    >
                      {c === 'BE' ? '🇧🇪 België' : '🇳🇱 Nederland'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Producten</Text>
          {drafts.map((d, idx) => (
            <View key={d.id} style={styles.productCard}>
              <View style={styles.productHeader}>
                <Text style={styles.productIndex}>#{idx + 1}</Text>
                {drafts.length > 1 ? (
                  <TouchableOpacity onPress={() => removeDraft(d.id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                value={d.name}
                onChangeText={(v) => updateDraft(d.id, { name: v })}
                placeholder="Productnaam"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <View style={styles.fieldRow}>
                <View style={[styles.fieldGroup, styles.flex]}>
                  <Text style={styles.label}>Prijs (€)</Text>
                  <TextInput
                    value={d.price}
                    onChangeText={(v) => updateDraft(d.id, { price: v })}
                    placeholder="0,00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
                <View style={[styles.fieldGroup, styles.flex]}>
                  <Text style={styles.label}>Aantal</Text>
                  <TextInput
                    value={d.quantity}
                    onChangeText={(v) => updateDraft(d.id, { quantity: v })}
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addProduct} onPress={addDraft}>
            <Ionicons name="add" size={18} color={colors.accent} />
            <Text style={styles.addProductText}>Product toevoegen</Text>
          </TouchableOpacity>

          <View style={styles.totalsCard}>
            <Text style={styles.totalsLabel}>Totaal</Text>
            <Text style={styles.totalsValue}>
              {typeof preview === 'object' ? formatEuro(preview.total) : '—'}
            </Text>
          </View>

          {typeof preview === 'object' && preview.products.length > 0 ? (
            <View style={styles.previewList}>
              <Text style={styles.sectionTitle}>Voorvertoning</Text>
              {preview.products.map((p) => (
                <ProductRow key={p.id} product={p} />
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabled]}
            onPress={saveReceipt}
            disabled={saving}
          >
            <Ionicons name="save" size={20} color={colors.textInverse} />
            <Text style={styles.primaryButtonText}>
              {saving ? 'Bezig…' : 'Bon opslaan'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
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
  body: {
    color: colors.text,
    fontSize: typography.body,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  cameraCard: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  camera: {
    width: '100%',
    height: 260,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  camBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  captureBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
  },
  previewRow: {
    marginTop: spacing.md,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  removePhoto: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: spacing.md,
  },
  fieldGroup: {
    marginTop: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginBottom: spacing.xs,
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
  countryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countryChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  countryChipText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  countryChipTextActive: {
    color: colors.textInverse,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.h3,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  productCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  productIndex: {
    color: colors.accent,
    fontSize: typography.small,
    fontWeight: '700',
  },
  addProduct: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    marginTop: spacing.sm,
  },
  addProductText: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: '600',
  },
  totalsCard: {
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
  totalsLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  totalsValue: {
    color: colors.accent,
    fontSize: typography.h2,
    fontWeight: '800',
  },
  previewList: {
    marginTop: spacing.sm,
  },
  primaryButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
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
  disabled: {
    opacity: 0.6,
  },
});
