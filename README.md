# @spotlyst/loyalty-card

Shared loyalty card schema, renderer, editor, font catalog, and normalization utilities for Spotlyst surfaces.

This package is the source of truth for visual loyalty card design behavior shared by Admin, Staff, and customer/public rendering flows. Keep card schema and rendering behavior here instead of duplicating card logic across apps.

## What It Provides

- `LoyaltyCardRenderer`: React renderer for a saved card schema.
- `LoyaltyCardEditor`: React editor used by Admin and Staff surfaces.
- Shared TypeScript schema for card records, faces, tokens, elements, and stamp grids.
- Shared normalization helpers for card elements, layer order, groups, schemas, and presets.
- Built-in loyalty card font catalog metadata.
- Sample fixtures for local previews and integration tests.
- Editor CSS distributed as a package export.

## Package Exports

```ts
import type { LoyaltyCardDesignSchema, LoyaltyCardPresetRecord } from "@spotlyst/loyalty-card";
import { normalizeLoyaltyCardPreset } from "@spotlyst/loyalty-card/normalize";
import { loyaltyCardFontCatalog } from "@spotlyst/loyalty-card/fonts";
import { defaultLoyaltyCardDesignSchema, sampleLoyaltyCardTokens } from "@spotlyst/loyalty-card/fixtures";
import { LoyaltyCardRenderer } from "@spotlyst/loyalty-card/react";
import { LoyaltyCardEditor } from "@spotlyst/loyalty-card/editor";
import "@spotlyst/loyalty-card/editor.css";
```

Available subpath exports:

| Export | Purpose |
| --- | --- |
| `@spotlyst/loyalty-card` | Schema, normalize helpers, fixtures, and font catalog re-exports. |
| `@spotlyst/loyalty-card/schema` | Card schema constants and TypeScript types. |
| `@spotlyst/loyalty-card/normalize` | Normalization helpers. |
| `@spotlyst/loyalty-card/fixtures` | Sample schema and tokens. |
| `@spotlyst/loyalty-card/fonts` | Built-in font catalog metadata. |
| `@spotlyst/loyalty-card/react` | Production renderer. |
| `@spotlyst/loyalty-card/editor` | Editor and design canvas. |
| `@spotlyst/loyalty-card/editor.css` | Editor stylesheet. |

## Installation

The package is published to GitHub Packages.

Add or keep an `.npmrc` in the consuming app:

```ini
@spotlyst:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_GITHUB_TOKEN}
```

Install:

```bash
npm install @spotlyst/loyalty-card
```

This package has React peer dependencies. Consuming apps must provide React and React DOM.

## Rendering A Card

Use the renderer in customer/public-facing surfaces or read-only previews.

```tsx
import { LoyaltyCardRenderer } from "@spotlyst/loyalty-card/react";
import type { LoyaltyCardDesignSchema, LoyaltyCardTokens } from "@spotlyst/loyalty-card";

type Props = {
  schema: LoyaltyCardDesignSchema;
  tokens: LoyaltyCardTokens;
};

export function LoyaltyCardPreview({ schema, tokens }: Props) {
  return (
    <LoyaltyCardRenderer
      schema={schema}
      face="back"
      tokens={tokens}
      animateStampGridLayout
    />
  );
}
```

Renderer props:

| Prop | Type | Notes |
| --- | --- | --- |
| `schema` | `LoyaltyCardDesignSchema` | Full saved design schema. |
| `face` | `"front" | "back" | "reward"` | Card face to render. UI label for `reward` is `Reward Unlock`. |
| `tokens` | `LoyaltyCardTokens` | Runtime token values such as venue, reward, and stamp data. |
| `className` | `string` | Optional wrapper class. |
| `style` | `CSSProperties` | Optional wrapper style. |
| `animateStampGridLayout` | `boolean` | Enables stamp grid animation effects. |

The renderer is intentionally non-interactive. Editor-only controls must stay in the editor/canvas components.

## Using The Editor

Use the editor in Admin and Staff surfaces for creating or changing card presets/designs.

```tsx
import { useState } from "react";
import { LoyaltyCardEditor } from "@spotlyst/loyalty-card/editor";
import "@spotlyst/loyalty-card/editor.css";
import type { LoyaltyCardPresetRecord, LoyaltyCardTokens } from "@spotlyst/loyalty-card";

type Props = {
  initialPreset: LoyaltyCardPresetRecord;
  tokens: LoyaltyCardTokens;
};

export function CardEditorPage({ initialPreset, tokens }: Props) {
  const [preset, setPreset] = useState(initialPreset);

  return (
    <LoyaltyCardEditor
      value={preset}
      onChange={setPreset}
      tokens={tokens}
      title="Loyalty card editor"
      onSave={() => console.log("save", preset)}
    />
  );
}
```

The editor accepts optional integration callbacks for media, assets, and fonts. These callbacks are intentionally host-app owned because Admin and Staff have different permissions.

```tsx
<LoyaltyCardEditor
  value={preset}
  onChange={setPreset}
  tokens={tokens}
  assetLibrary={assets}
  uploadedFonts={fonts}
  onUploadImage={uploadCardImage}
  onImportImageUrl={importImageUrl}
  onUploadLibraryAsset={uploadGlobalAsset}
  onArchiveLibraryAsset={archiveGlobalAsset}
  onRestoreLibraryAsset={restoreGlobalAsset}
  onDeleteLibraryAsset={deleteGlobalAsset}
  onUploadFont={uploadGlobalFont}
  onArchiveFont={archiveGlobalFont}
  onDeleteFont={deleteGlobalFont}
/>
```

### Layout (0.4)

Since 0.4 the editor follows the Admin Panel design (Pencil file `designs/admin-panel.pen`, "Content · Card editor"):

- **Top bar:** back button, preset name and status chip, "category · Changes saved X ago", undo, redo, Preview, a "…" menu, and the save and publish buttons.
- **Left panel:** Add (text presets, card fields, shapes and media, colours in this card), Layers, and Library (stamp, icon and pattern images, plus uploaded fonts).
- **Canvas:** an arrange bar, the card with an orange selection box and a field tag, zoom, face thumbnails and the Snap switch.
- **Right panel:** labelled settings for the selected item; Card settings when nothing is selected.

All the older props still work. These optional props fill the new top bar and Card settings:

```tsx
<LoyaltyCardEditor
  value={preset}
  onChange={setPreset}
  tokens={tokens}
  onBack={() => navigate("/presets")}
  backLabel="Back to card presets"
  onSaveDraft={() => save("draft")}       // shows "Save draft"
  saveDraftLabel="Save draft"
  onPublish={() => save("published")}     // shows the dark "Publish" button
  publishLabel="Publish"
  isSaving={saving}
  savedAt={preset.updatedAt}             // "Changes saved 2 min ago"
  hasUnsavedChanges={dirty}               // "Unsaved changes"
  menuActions={[{ id: "duplicate", label: "Duplicate", onSelect: duplicate }]}
  showPresetDetails                       // name, category, note for venues and slug in Card settings
/>
```

- `actions` still renders, to the left of the save buttons, for hosts that draw their own buttons.
- `renderMeta` renders inside Card settings (under the preset details when `showPresetDetails` is on).
- The "…" menu always holds the editor's light/dark switch, which keeps using `localStorage` key `spotlyst.loyaltyCardEditor.theme`.
- The stamp preview count, the sample venue name and reward under "Preview with sample data", zoom and undo history are editor state only; they are never written to the design.

Permission guidance:

- Admin/superadmin surfaces may pass upload/archive/delete callbacks for global assets and fonts.
- Staff surfaces should normally pass approved active assets/fonts only and omit global management callbacks.
- Public/customer rendering should use `LoyaltyCardRenderer`, not `LoyaltyCardEditor`.

## Schema Overview

Cards are stored as JSON-safe design schemas.

```ts
type LoyaltyCardDesignSchema = {
  version: number;
  canvas: {
    width: number;
    height: number;
    aspectRatio: "16:9";
    borderRadius?: number;
    safeArea: { x: number; y: number; width: number; height: number };
  };
  faces: Record<"front" | "back" | "reward", LoyaltyCardFace>;
};
```

Supported element types:

- `text`
- `asset`
- `shape`
- `line`
- `stampGrid`

Important schema rules:

- The canvas is fixed at `1000 x 562.5` with `16:9` aspect ratio.
- Card faces are `front`, `back`, and `reward`.
- Stamp grids belong on the `back` face in normal product flows.
- Schema values must remain safe JSON. Do not store raw HTML, raw CSS, JavaScript, or executable data.
- Persisted designs should be normalized before save where possible.

## Tokens

Text and stamp data use token strings such as `{{venueName}}` and `{{stamps}}`.

Common tokens:

```ts
const tokens = {
  venueName: "Cake Shop",
  tierName: "VIP",
  rewardTitle: "10th cup free",
  rewardDescription: "Enjoy this reward on your next visit.",
  stampsCollected: 6,
  stampsRequired: 10,
  stamps: [
    { awardedAt: "2026-06-01T10:30:00.000Z" },
    { awardedAt: "2026-06-04T14:10:00.000Z" },
  ],
};
```

Token helpers:

- `resolveLoyaltyCardToken(value, tokens)` replaces token placeholders inside strings.
- `resolveLoyaltyCardTokenValue(value, tokens)` returns raw token values when the whole string is a token.

## Fonts

The package supports three font sources:

- `preset`: legacy/internal font key compatibility.
- `catalog`: built-in catalog font metadata from `fonts.ts`.
- `customUrl`: uploaded fonts served from a CDN URL.

### Uploaded Font Metadata

Uploaded fonts are passed to the editor as `LoyaltyCardEditorUploadedFont` records:

```ts
type LoyaltyCardEditorUploadedFont = {
  id: string;
  name: string;
  fontFamily: string;
  fontUrl?: string;
  cdnUrl?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  isVariable?: boolean;
  fontWeightMin?: number;
  fontWeightMax?: number;
  fontWeightDefault?: number;
  variationAxes?: Array<{ tag: string; name?: string; min: number; max: number; default?: number }>;
};
```

Font behavior:

- Font weights are numeric CSS weights, not string labels.
- The UI may label common weights like `300 Light` or `700 Bold`, but saved schema stores numbers.
- Static variants should be separate records grouped by the same `fontFamily`.
- Italic is not automatic. Real italic requires a separate italic file or a font with a real italic/slant axis.
- Variable fonts with a `wght` axis should set `isVariable`, `fontWeightMin`, `fontWeightMax`, and `fontWeightDefault`.
- The editor constrains weight/style dropdowns to the selected font's actual supported metadata.
- The renderer emits variable `@font-face` descriptors like `font-weight: 100 900` for variable custom fonts.

Correct grouping example:

| File | Font name | Font family | Style |
| --- | --- | --- | --- |
| `CabinetGrotesk-Variable.woff2` | `Cabinet Grotesk Variable` | `Cabinet Grotesk` | `Normal` |
| `CabinetGrotesk-Italic-Variable.woff2` | `Cabinet Grotesk Variable Italic` | `Cabinet Grotesk` | `Italic` |

Both records should appear as one uploaded family in the picker: `Cabinet Grotesk`.

## Stamp Grid Behavior

Stamp grids are layout elements for loyalty progress.

Key behavior:

- The stamp grid box is authoritative. Rows, slots, stamps, and gaps fit inside it.
- `gap: 0` is valid.
- `stampRows` and `stampSlots` preserve custom layouts.
- `previewFilledMode: "auto"` fills a preview proportion and leaves the final stamp empty.
- `previewFilledMode: "manual"` uses `previewFilledCount`.
- The renderer clips to the card root, not to each stamp image.
- In-canvas layout editing is editor-only.

## Normalization

Use normalization before saving if the host app has modified schema programmatically.

```ts
import { normalizeLoyaltyCardPreset } from "@spotlyst/loyalty-card/normalize";

const safePreset = normalizeLoyaltyCardPreset(preset);
```

Normalization currently handles:

- Canvas dimensions and safe area.
- Element bounds, rotation, opacity, and layer order.
- Group membership cleanup.
- Face normalization across `front`, `back`, and `reward`.

Backend routes still own final validation and persistence rules.

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

The build compiles TypeScript and copies `src/editor/editor.css` into `dist/editor/editor.css`.

There is no standalone test script in this package at the moment. Use the package build plus consuming app builds for verification after package changes.

Recommended verification after editor/renderer changes:

```bash
npm run build
```

Then update and build consuming apps:

```bash
npm install @spotlyst/loyalty-card@<version>
npm run build
```

## Publishing

This package is published to GitHub Packages.

1. Build locally.
2. Bump the package version without creating a git tag.
3. Publish with a GitHub Packages token.
4. Install the new version in Admin and Staff.
5. Commit package changes and consuming app lockfile changes.

```bash
npm run build
npm version <next-version> --no-git-tag-version
npm publish
```

When publishing from local shells that use `NPM_GITHUB_TOKEN`, ensure the token is set in the environment and never committed.

## Repo Discipline

- Keep shared card behavior in this package.
- Do not duplicate editor/renderer business logic in Admin, Staff, Hub, or mobile surfaces.
- Do not add backend-only permissions or persistence assumptions to the package.
- Keep renderer output clean and non-interactive.
- Keep editor-only controls inside editor/canvas code.
- Preserve JSON-safe schema fields only.
- Treat public QR ordering and customer rendering as separate production surfaces from Staff/Admin editing.

## Current Consumers

Known consumers in the Spotlyst workspace:

- `Admin-Panel`: Admin preset/editor management.
- `spotlyst-staff`: Staff venue-scoped card design editing.
- Backend APIs persist and validate schemas/fonts/assets but do not import this package directly in the current setup.

## Troubleshooting

### Uploaded font appears as multiple families

Ensure related variants share the same `fontFamily`. Put weight/style words in the `name`, not the family.

### Italic option is missing

The selected font family does not have a real italic variant available. Upload the italic file under the same `fontFamily` with `fontStyle: "italic"`.

### Weight option is missing

The selected font does not advertise that weight. For variable fonts, check `fontWeightMin` and `fontWeightMax`. For static fonts, upload the missing weight as another variant under the same family.

### Existing card still renders after font deletion

Catalog deletion removes the font record, not the CDN object. Existing designs that already store the font URL can keep rendering.
