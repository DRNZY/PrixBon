# PrixBon — App Icon Prompt

Use this prompt with **Gemini Nano Banana 2** (or any text-to-image model)
to generate the PrixBon app icon. The output should be a single 1024×1024
PNG that you then export to the four sizes Expo needs.

---

## The prompt (paste verbatim)

```
App icon for "PrixBon", a price-comparison and receipt-tracking app for
smart shoppers in Belgium and the Netherlands. Square 1024x1024, sharp
edges, no rounded corners (the OS adds its own mask).

Design a single, instantly readable mark on a deep navy-purple background
(hex #0f0f1a). The mark should combine two ideas in one unified shape:

  1. A price tag — angled slightly to the right (about 12 degrees), with
     a small punched hole near the top-left corner.
  2. A bar chart — three ascending vertical bars rising from inside or
     behind the price tag, suggesting price history and savings over
     time.

Style rules:
  - Modern, geometric, flat with very subtle gradient depth (no skeuomorphism).
  - Bold geometric sans-serif feel; the bars should be solid, not outlined.
  - Color palette limited to four colors total:
      * background  #0f0f1a  (deep navy-purple)
      * surface     #667eea  (electric indigo — the app's accent)
      * highlight   #00e676  (vibrant green — for the tallest bar only,
                              to read as "savings")
      * accent      #f5f5fa  (off-white — for the price tag shape)
  - The price tag is the largest single element, centered, occupying
    roughly 55% of the canvas width.
  - The three bars sit inside the lower-right of the tag, ascending left
    to right (short, medium, tall). The tallest bar is green; the other
    two are indigo.
  - No text, no numbers, no currency symbols, no faces, no hands, no
    shopping carts, no barcode, no leaf, no globe.
  - The punched hole in the price tag should show the background color
    through it (true knockout), not be filled.
  - Subtle drop shadow under the price tag (soft, offset down 4px,
    blur 8px, opacity 25%) to lift it off the background. No hard edge.
  - No border, no frame, no rounded square background.

The result should look like a confident fintech icon — premium, modern,
trustworthy — not a cartoon, not a sticker, not an emoji.
```

---

## Post-processing checklist

After Gemini returns the image, you need four files for Expo / Play Store.
A clean way to produce all of them at once is to drop the 1024×1024 PNG into
[sharp](https://sharp.pixelplumbing.com/) or use Figma / Sketch:

| File                          | Size      | Where it goes                         |
|-------------------------------|-----------|---------------------------------------|
| `assets/icon.png`             | 1024×1024 | `expo.icon` — universal app icon      |
| `assets/adaptive-icon.png`    | 1024×1024 | `expo.android.adaptiveIcon.foregroundImage` (must have safe area in mind — keep the mark inside the center 66% of the canvas; the OS masks the outer 33%) |
| `assets/splash-icon.png`      | 1242×2436 | `expo.splash.image` (or just 1024×1024 with `resizeMode: contain`) |
| `assets/favicon.png`          | 48×48     | `expo.web.favicon`                    |

For Play Store (separate from in-app icon), you also need:

| File                  | Size      | Where                       |
|-----------------------|-----------|-----------------------------|
| Play Store icon       | 512×512   | Play Console → Store listing → App icon |
| Feature graphic       | 1024×500  | Play Console → Store listing → Feature graphic |

Save those last two somewhere outside the repo (e.g. `~/Desktop/prixbon-store-assets/`)
and upload them directly to Play Console — they are NOT part of the app bundle.

---

## Tips for getting a great result

1. **Generate 4 variations** and pick the one where the price tag is most
   instantly recognizable at 48px. The mark must survive being shrunk onto
   a home screen next to WhatsApp.
2. **Test in monochrome.** Convert your chosen output to grayscale and
   squint — if the mark still reads as "price tag with bars", you're good.
   If it becomes a blob, simplify.
3. **Watch the safe area on adaptive icons.** Android will mask the outer
   ~33% of the canvas to a circle, rounded square, squircle, or teardrop
   depending on the launcher. Keep the price tag and bars inside the inner
   66% circle to avoid being clipped.
4. **Iterate on color.** If the green bar disappears against the indigo
   at small sizes, push it brighter (try `#00ff88`) or move it to the
   leftmost position where it has the most contrast against the tag.
5. **Run a Play Store preview.** Upload the icon to a draft Play Console
   listing and check the screenshot rendering on a Pixel device frame —
   it shows the icon in real contexts (home screen, app drawer, splash).

---

## Negative prompt (for models that accept one)

```
No text, no letters, no numbers, no currency symbols, no emoji, no faces,
no hands, no people, no shopping carts, no barcode, no leaf, no globe,
no checkmark, no shopping bag, no receipt paper, no magnifying glass,
no skull, no fire, no lightning, no 3D bevels, no drop shadow on bars,
no gradient mesh, no rounded corners on the icon canvas, no border,
no frame, no watermark, no signature.
```
