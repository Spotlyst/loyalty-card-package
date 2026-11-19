import {
  AlignBottomIcon,
  AlignHorizontalCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignVerticalCenterIcon,
  ArrowDown01Icon,
  BracesIcon,
  Cancel01Icon,
  CircleIcon,
  CenterFocusIcon,
  CloudUploadIcon,
  CreditCardIcon,
  Delete02Icon,
  DistributeHorizontalCenterIcon,
  DistributeVerticalCenterIcon,
  FavouriteIcon,
  Image01Icon,
  Layers01Icon,
  Link01Icon,
  LockKeyIcon,
  MinusSignIcon,
  PencilEdit01Icon,
  PlayIcon,
  PlusSignIcon,
  RotateClockwiseIcon,
  ShapesIcon,
  SparklesIcon,
  Square01Icon,
  SquareIcon,
  SquareUnlock01Icon,
  StampIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextFontIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { LOYALTY_CARD_PRESET_CATEGORIES } from "../schema.js";
import type {
  LoyaltyCardAssetElement,
  LoyaltyCardBackground,
  LoyaltyCardElement,
  LoyaltyCardFaceKey,
  LoyaltyCardLineElement,
  LoyaltyCardPresetCategory,
  LoyaltyCardPresetRecord,
  LoyaltyCardShapeElement,
  LoyaltyCardStampGridElement,
  LoyaltyCardTextElement,
  LoyaltyCardTokens,
} from "../schema.js";
import { resolveStampGridCount, resolveStampGridRows, resolveStampGridScale } from "../stampGridLayout.js";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CARD_FIELDS,
  clampNumber,
  defaultBackground,
  FACE_LABELS,
  findCardField,
  formatFontWeightOption,
  getTextFontFamily,
  imageFilterPresets,
  MAX_FILLED_STAMP_PRESETS,
  resizeStampRows,
  resolveMediaResultUrl,
  singleTokenKey,
  stampArrangements,
  stampGridSummary,
  stampRowsPatch,
  textSubtitle,
  tokenFieldLabel,
  tokenKeysIn,
} from "./editorUtils.js";
import type { ImageFilterPresetKey, MediaResult, StampRowDraft } from "./editorUtils.js";
import { Chip, Collapsible, ColorField, Field, Icon, IconButton, Menu, NumberInput, Section, Segmented, SelectField, Slider, Stepper, Switch, TextArea, TextInput, Tile, cx } from "./ui.js";
import type { IconType } from "./ui.js";

export type LoyaltyCardEditorImageContext = {
  face: LoyaltyCardFaceKey;
  field: "background.imageUrl" | "asset.imageUrl" | "stampGrid.emptyImageUrl" | "stampGrid.filledImageUrl";
  elementId?: string;
  currentUrl: string;
};

export type UploadImageHandler = (file: File, context: LoyaltyCardEditorImageContext) => Promise<MediaResult>;
export type ImportImageHandler = (url: string, context: LoyaltyCardEditorImageContext) => Promise<MediaResult>;

export type StampPreviewState = { mode: "auto" | "manual"; count: number };
export type StampGridTab = "layout" | "stamps" | "motion";

type Updater<E> = (updater: (element: E) => E) => void;

/** A new background, or a change to apply to the current one (used when an upload finishes later). */
export type BackgroundUpdate = LoyaltyCardBackground | ((current: LoyaltyCardBackground) => LoyaltyCardBackground);

/* ---------- Shared pieces ---------- */

export function InspectorHeader({ icon, title, subtitle, tone = "primary", element, onToggleHidden, onToggleLocked, children }: { icon: IconType; title: ReactNode; subtitle: ReactNode; tone?: "primary" | "ink"; element?: LoyaltyCardElement | null; onToggleHidden?: () => void; onToggleLocked?: () => void; children?: ReactNode }) {
  return (
    <div className="lce-inspector__header">
      <div className="lce-inspector__heading">
        <span className={cx("lce-type-well", tone === "ink" && "lce-type-well--ink")}><Icon icon={icon} size={19} /></span>
        <span className="lce-inspector__titles">
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        {element && onToggleHidden ? <IconButton icon={element.hidden ? ViewOffSlashIcon : ViewIcon} label={element.hidden ? "Show on the card" : "Hide from the card"} variant="soft" active={Boolean(element.hidden)} onClick={onToggleHidden} /> : null}
        {element && onToggleLocked ? <IconButton icon={element.locked ? LockKeyIcon : SquareUnlock01Icon} label={element.locked ? "Unlock" : "Lock"} variant="soft" active={Boolean(element.locked)} onClick={onToggleLocked} /> : null}
      </div>
      {children}
    </div>
  );
}

export function LockedNotice({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="lce-notice">
      <Icon icon={LockKeyIcon} size={16} />
      <span>This layer is locked, so it can’t be moved or changed.</span>
      <button type="button" className="lce-link-button" onClick={onUnlock}>Unlock</button>
    </div>
  );
}

export function PositionSection({ element, update }: { element: LoyaltyCardElement; update: Updater<LoyaltyCardElement> }) {
  const round = (value: number) => Math.round(value);
  const sizeLabel = element.type === "stampGrid" ? "Box" : "";
  return (
    <Collapsible label="Position and size" summary={`X ${round(element.x)} · Y ${round(element.y)} · ${round(element.width)} × ${round(element.height)} · ${round(element.rotation || 0)}°`}>
      <div className="lce-grid-2">
        <NumberInput label="X" value={element.x} min={-CANVAS_WIDTH} max={CANVAS_WIDTH} decimals={1} onChange={(x) => update((current) => ({ ...current, x }))} />
        <NumberInput label="Y" value={element.y} min={-CANVAS_HEIGHT} max={CANVAS_HEIGHT} decimals={1} onChange={(y) => update((current) => ({ ...current, y }))} />
        <NumberInput label={sizeLabel ? `${sizeLabel} width` : "Width"} value={element.width} min={1} max={CANVAS_WIDTH * 3} decimals={1} onChange={(width) => update((current) => ({ ...current, width }))} />
        <NumberInput label={sizeLabel ? `${sizeLabel} height` : "Height"} value={element.height} min={1} max={CANVAS_HEIGHT * 3} decimals={1} onChange={(height) => update((current) => ({ ...current, height }))} />
        <NumberInput label="Rotation" suffix="°" value={element.rotation || 0} min={-180} max={180} decimals={1} onChange={(rotation) => update((current) => ({ ...current, rotation }))} />
      </div>
    </Collapsible>
  );
}

export function OpacitySection({ element, update }: { element: LoyaltyCardElement; update: Updater<LoyaltyCardElement> }) {
  return (
    <Section>
      <Slider label={<span className="lce-section__label">Opacity</span>} value={Math.round((element.opacity ?? 1) * 100)} min={0} max={100} format={(value) => `${value}%`} onChange={(value) => update((current) => ({ ...current, opacity: value / 100 }))} />
    </Section>
  );
}

export function ImageUrlField({ label, value, context, onChange, onUploadImage, onImportImageUrl }: { label: string; value: string; context: LoyaltyCardEditorImageContext; onChange: (value: string) => void; onUploadImage?: UploadImageHandler; onImportImageUrl?: ImportImageHandler }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (task: () => Promise<MediaResult>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = resolveMediaResultUrl(await task());
      if (next) onChange(next);
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="lce-image-field">
      <Field label={label}>
        <span className="lce-input-icon">
          <Icon icon={Link01Icon} size={15} />
          <input className="lce-input" type="url" placeholder="https://…" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)} />
        </span>
      </Field>
      {onUploadImage || onImportImageUrl ? (
        <div className="lce-button-row">
          {onUploadImage ? (
            <>
              <input ref={inputRef} className="lce-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void run(() => onUploadImage(file, { ...context, currentUrl: value }), "Image upload failed.");
              }} />
              <button type="button" className="lce-button lce-button--small" disabled={busy} onClick={() => inputRef.current?.click()}><Icon icon={CloudUploadIcon} size={15} />Upload</button>
            </>
          ) : null}
          {onImportImageUrl ? <button type="button" className="lce-button lce-button--small" disabled={busy || !value.trim()} onClick={() => void run(() => onImportImageUrl(value.trim(), { ...context, currentUrl: value }), "Image import failed.")}><Icon icon={Link01Icon} size={15} />{busy ? "Working…" : "Import link"}</button> : null}
        </div>
      ) : null}
      {error ? <p className="lce-error" role="alert">{error}</p> : null}
    </div>
  );
}

/* ---------- Text ---------- */

type TextInspectorProps = {
  element: LoyaltyCardTextElement;
  update: Updater<LoyaltyCardTextElement>;
  tokens: LoyaltyCardTokens;
  weightOptions: number[];
  weight: number;
  styleOptions: Array<"normal" | "italic">;
  style: "normal" | "italic";
  onVariantChange: (weight: number, style: "normal" | "italic") => void;
  onOpenFontPicker: () => void;
};

export function TextInspectorBody({ element, update, tokens, weightOptions, weight, styleOptions, style, onVariantChange, onOpenFontPicker }: TextInspectorProps) {
  const [fieldMenuOpen, setFieldMenuOpen] = useState(false);
  const tokenKey = singleTokenKey(element.token);
  const field = tokenKey ? findCardField(tokenKey) : null;
  const hasTokens = tokenKeysIn(element.token).length > 0;
  const family = getTextFontFamily(element);
  const outlineOn = (element.textStrokeWidth || 0) > 0;

  const usePlainText = () => {
    const resolved = String(tokens[tokenKey] ?? "");
    update((current) => ({ ...current, token: current.fallbackText || resolved || tokenFieldLabel(tokenKey) }));
  };
  const useField = (key: string) => {
    const picked = findCardField(key);
    if (!picked) return;
    update((current) => ({ ...current, token: picked.token, fallbackText: current.fallbackText || picked.fallback }));
  };

  return (
    <>
      <Section
        label="Content"
        aside={tokenKey ? (
          <button type="button" className="lce-link-button" onClick={usePlainText}>Use plain text</button>
        ) : (
          <span className="lce-menu-anchor">
            <button type="button" className="lce-link-button" aria-expanded={fieldMenuOpen} onClick={() => setFieldMenuOpen((open) => !open)}>Use a card field</button>
            {fieldMenuOpen ? <Menu label="Card fields" items={CARD_FIELDS.map((item) => ({ id: item.key, label: item.label, icon: BracesIcon, onSelect: () => useField(item.key) }))} onClose={() => setFieldMenuOpen(false)} /> : null}
          </span>
        )}
      >
        {tokenKey ? (
          <>
            <div className="lce-token-input" aria-label="Card field">
              <Chip tone="primary" icon={BracesIcon} onRemove={usePlainText} removeLabel={`Stop using ${tokenFieldLabel(tokenKey)}`}>{tokenFieldLabel(tokenKey)}</Chip>
            </div>
            <TextInput label={field?.emptyLabel || "If the field is empty, show"} value={element.fallbackText} onChange={(fallbackText) => update((current) => ({ ...current, fallbackText }))} />
          </>
        ) : (
          <>
            <TextArea label="Text" rows={2} value={element.token} onChange={(token) => update((current) => ({ ...current, token }))} />
            {hasTokens ? <TextInput label="If a field is empty, show" value={element.fallbackText} onChange={(fallbackText) => update((current) => ({ ...current, fallbackText }))} /> : null}
          </>
        )}
      </Section>

      <Section label="Font">
        <button type="button" className="lce-font-trigger" onClick={onOpenFontPicker} aria-label={`Font: ${family}. Change font`}>
          <span className="lce-font-trigger__well" style={{ fontFamily: `"${family}", sans-serif` }}>Aa</span>
          <span className="lce-font-trigger__name" style={{ fontFamily: `"${family}", sans-serif` }}>{family}</span>
          <Icon icon={ArrowDown01Icon} size={16} />
        </button>
        <div className="lce-grid-2">
          <SelectField label="Weight" value={String(weight)} options={weightOptions.map((option) => ({ value: String(option), label: formatFontWeightOption(option) }))} onChange={(value) => onVariantChange(Number(value), style)} />
          <Field label="Style">
            <Segmented label="Font style" value={style} options={[{ value: "normal", label: "Normal", disabled: !styleOptions.includes("normal") }, { value: "italic", label: "Italic", disabled: !styleOptions.includes("italic") }]} onChange={(next) => onVariantChange(weight, next)} />
          </Field>
        </div>
        <div className="lce-grid-3">
          <NumberInput label="Size" suffix="px" value={element.fontSize} min={6} max={180} decimals={1} onChange={(fontSize) => update((current) => ({ ...current, fontSize }))} />
          <NumberInput label="Line height" value={element.lineHeight} min={0.7} max={2.5} step={0.05} decimals={2} onChange={(lineHeight) => update((current) => ({ ...current, lineHeight }))} />
          <NumberInput label="Spacing" suffix="px" value={element.letterSpacing || 0} min={-20} max={80} step={0.5} decimals={1} onChange={(letterSpacing) => update((current) => ({ ...current, letterSpacing }))} />
        </div>
        <Field label="Letter case">
          <Segmented label="Letter case" value={element.textTransform || "none"} options={[{ value: "none", label: "As typed" }, { value: "uppercase", label: "ABC" }, { value: "lowercase", label: "abc" }, { value: "capitalize", label: "Abc" }]} onChange={(textTransform) => update((current) => ({ ...current, textTransform }))} />
        </Field>
      </Section>

      <Section label="Alignment">
        <div className="lce-grid-2">
          <Segmented iconOnly label="Horizontal alignment" value={element.align} options={[{ value: "left", label: "Left", title: "Align text left", icon: TextAlignLeftIcon }, { value: "center", label: "Centre", title: "Centre text", icon: TextAlignCenterIcon }, { value: "right", label: "Right", title: "Align text right", icon: TextAlignRightIcon }]} onChange={(align) => update((current) => ({ ...current, align }))} />
          <Segmented iconOnly label="Vertical alignment" value={element.verticalAlign || "center"} options={[{ value: "top", label: "Top", title: "Top of the box", icon: AlignTopIcon }, { value: "center", label: "Middle", title: "Middle of the box", icon: AlignVerticalCenterIcon }, { value: "bottom", label: "Bottom", title: "Bottom of the box", icon: AlignBottomIcon }]} onChange={(verticalAlign) => update((current) => ({ ...current, verticalAlign }))} />
        </div>
      </Section>

      <Section label="Colour">
        <ColorField label="Text colour" value={element.color} fallback="#181311" onChange={(color) => update((current) => ({ ...current, color }))} />
        <Switch label="Outline" checked={outlineOn} onChange={(checked) => update((current) => ({ ...current, textStrokeWidth: checked ? Math.max(1, current.textStrokeWidth || 2) : 0 }))} />
        {outlineOn ? (
          <div className="lce-grid-color">
            <ColorField label="Outline colour" value={element.textStrokeColor || "#000000"} fallback="#000000" onChange={(textStrokeColor) => update((current) => ({ ...current, textStrokeColor }))} />
            <NumberInput label="Width" suffix="px" value={element.textStrokeWidth || 0} min={0} max={20} step={0.5} decimals={1} onChange={(textStrokeWidth) => update((current) => ({ ...current, textStrokeWidth }))} />
          </div>
        ) : null}
      </Section>
    </>
  );
}

export function textHeader(element: LoyaltyCardTextElement) {
  return { icon: TextFontIcon, title: element.name?.trim() || "Text", subtitle: textSubtitle(element) };
}

/* ---------- Stamp grid ---------- */

const STAMP_SHAPES: Array<{ value: "circle" | "rounded_square" | "heart"; label: string; icon: IconType }> = [
  { value: "circle", label: "Circle", icon: CircleIcon },
  { value: "rounded_square", label: "Rounded", icon: SquareIcon },
  { value: "heart", label: "Heart", icon: FavouriteIcon },
];

function ArrangementPreview({ rows }: { rows: number[] }) {
  const columns = Math.max(...rows);
  const dot = clampNumber(Math.floor(30 / Math.max(columns, rows.length * 1.3)), 3, 6);
  return (
    <span className="lce-arrangement__dots" aria-hidden="true" style={{ "--lce-dot": `${dot}px` } as CSSProperties}>
      {rows.map((count, index) => <span key={index}>{Array.from({ length: count }).map((_, dotIndex) => <i key={dotIndex} />)}</span>)}
    </span>
  );
}

function StampSwatch({ mode, shape, fill, stroke, strokeWidth, imageUrl }: { mode: "shape" | "image"; shape: "circle" | "rounded_square" | "heart"; fill: string; stroke: string; strokeWidth: number; imageUrl?: string }) {
  if (mode === "image" && imageUrl) return <span className="lce-stamp-swatch lce-stamp-swatch--image"><img src={imageUrl} alt="" /></span>;
  return <span className={cx("lce-stamp-swatch", `lce-stamp-swatch--${shape}`)} style={{ background: fill, borderColor: stroke, borderWidth: Math.min(3, Math.max(1, strokeWidth)) }} aria-hidden="true" />;
}

type StampGridInspectorProps = {
  element: LoyaltyCardStampGridElement;
  update: Updater<LoyaltyCardStampGridElement>;
  tab: StampGridTab;
  preview: StampPreviewState;
  effectivePreviewCount: number;
  onPreviewChange: (preview: StampPreviewState) => void;
  onPlay: () => void;
  onOpenLibrary: (target: "empty" | "filled") => void;
  face: LoyaltyCardFaceKey;
  onUploadImage?: UploadImageHandler;
  onImportImageUrl?: ImportImageHandler;
};

export function StampGridTabs({ tab, onChange }: { tab: StampGridTab; onChange: (tab: StampGridTab) => void }) {
  return <Segmented label="Stamp grid settings" className="lce-segmented--tabs" value={tab} options={[{ value: "layout", label: "Layout" }, { value: "stamps", label: "Stamps" }, { value: "motion", label: "Motion" }]} onChange={onChange} />;
}

export function stampGridHeader(element: LoyaltyCardStampGridElement) {
  return { icon: StampIcon, title: element.name?.trim() || "Stamp grid", subtitle: stampGridSummary(element) };
}

export function StampGridInspectorBody(props: StampGridInspectorProps) {
  if (props.tab === "stamps") return <StampStylesTab {...props} />;
  if (props.tab === "motion") return <StampMotionTab {...props} />;
  return <StampLayoutTab {...props} />;
}

function StampLayoutTab({ element, update, preview, effectivePreviewCount, onPreviewChange }: StampGridInspectorProps) {
  const total = resolveStampGridCount(element);
  const rows: StampRowDraft[] = resolveStampGridRows(element).map((row) => ({ count: row.count, align: row.align }));
  const rowCounts = rows.map((row) => row.count).join(",");
  const arrangements = stampArrangements(total);
  const activeArrangement = arrangements.find((option) => option.rows.join(",") === rowCounts)?.id || "custom";
  // Arrangements and alignment keep a live total; changing the number of stamps sets a fixed one.
  const applyRows = (nextRows: StampRowDraft[]) => {
    const nextTotal = nextRows.reduce((sum, row) => sum + Math.max(0, Math.floor(row.count)), 0);
    update((current) => ({ ...current, ...stampRowsPatch(nextRows, { fixedTotal: nextTotal !== total }) }));
  };
  const stampSize = Math.round(resolveStampGridScale(element));
  const horizontal = element.horizontalAlign || "center";
  const vertical = element.verticalAlign || "top";

  return (
    <>
      <Section label="Stamps to earn the reward">
        <div className="lce-stamp-total">
          <span>
            <strong>{total} stamp{total === 1 ? "" : "s"}</strong>
            <small>Venues can change this later</small>
          </span>
          <Stepper label="Stamps to earn the reward" value={total} min={1} max={100} onChange={(next) => applyRows(resizeStampRows(rows, next))} />
        </div>
      </Section>

      <Section label="Arrangement" aside={<span className="lce-hint-inline">Tap a preset</span>}>
        <div className="lce-arrangements">
          {arrangements.map((option) => (
            <Tile key={option.id} label={option.label} active={activeArrangement === option.id} onClick={() => applyRows(option.rows.map((count, index) => ({ count, align: rows[index]?.align || "center" })))}>
              <ArrangementPreview rows={option.rows} />
            </Tile>
          ))}
          <Tile label="Custom" icon={PencilEdit01Icon} active={activeArrangement === "custom"} title="Set each row yourself below" onClick={() => document.getElementById(`lce-rows-${element.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })} />
        </div>
      </Section>

      <Section label="Rows" aside={<button type="button" className="lce-link-button" disabled={rows.length >= 20 || total >= 100} onClick={() => applyRows([...rows, { count: Math.min(12, Math.max(1, Math.min(rows[rows.length - 1]?.count || 1, 100 - total))), align: rows[rows.length - 1]?.align || "center" }])}><Icon icon={PlusSignIcon} size={14} />Add row</button>}>
        <div className="lce-rows" id={`lce-rows-${element.id}`}>
          {rows.map((row, index) => (
            <div key={index} className="lce-row">
              <span className="lce-row__label">Row {index + 1}</span>
              <Stepper label={`Stamps in row ${index + 1}`} value={row.count} min={1} max={12} onChange={(count) => applyRows(rows.map((item, rowIndex) => rowIndex === index ? { ...item, count: Math.min(count, item.count + Math.max(0, 100 - total)) } : item))} />
              <Segmented iconOnly label={`Row ${index + 1} alignment`} value={row.align} options={[{ value: "left", label: "Left", title: "Align row left", icon: AlignLeftIcon }, { value: "center", label: "Centre", title: "Centre row", icon: AlignHorizontalCenterIcon }, { value: "right", label: "Right", title: "Align row right", icon: AlignRightIcon }]} onChange={(align) => (element.stampSlots?.length
                ? update((current) => ({ ...current, stampRows: rows.map((item, rowIndex) => (rowIndex === index ? { ...item, align } : item)) }))
                : applyRows(rows.map((item, rowIndex) => (rowIndex === index ? { ...item, align } : item))))} />
              <IconButton icon={Cancel01Icon} label={`Remove row ${index + 1}`} size="sm" disabled={rows.length <= 1} onClick={() => applyRows(rows.filter((_, rowIndex) => rowIndex !== index))} />
            </div>
          ))}
        </div>
      </Section>

      <Section label="Size and spacing">
        <Slider label="Stamp size" value={stampSize} min={16} max={220} format={(value) => `${Math.round((value / 56) * 100)}%`} onChange={(value) => update((current) => ({ ...current, stampSize: value }))} />
        <Slider label="Gap between stamps" value={Math.round(element.gap || 0)} min={0} max={80} format={(value) => `${value} px`} onChange={(gap) => update((current) => ({ ...current, gap }))} />
      </Section>

      <Section label="Place in the box">
        <div className="lce-place">
          <div className="lce-place__grid" role="radiogroup" aria-label="Where the stamps sit in the box">
            {(["top", "center", "bottom"] as const).map((v) => (["left", "center", "right"] as const).map((h) => {
              const active = horizontal === h && vertical === v;
              return <button key={`${v}-${h}`} type="button" role="radio" aria-checked={active} aria-label={`${v === "center" ? "Middle" : v[0].toUpperCase() + v.slice(1)} ${h === "center" ? "centre" : h}`} className={cx("lce-place__dot", active && "lce-place__dot--active")} onClick={() => update((current) => ({ ...current, horizontalAlign: h, verticalAlign: v }))}><span /></button>;
            }))}
          </div>
          <p>Where the stamps sit when the box is bigger than the grid.</p>
        </div>
      </Section>

      <Section label="Preview" aside={<span className="lce-hint-inline">Not saved on the card</span>}>
        <div className="lce-preview-row">
          <Segmented label="Preview stamps" value={preview.mode} options={[{ value: "auto", label: "Auto" }, { value: "manual", label: "Set number" }]} onChange={(mode) => onPreviewChange({ mode, count: effectivePreviewCount })} />
          <Stepper label="Stamps shown as collected" value={effectivePreviewCount} min={0} max={total} onChange={(count) => onPreviewChange({ mode: "manual", count })} />
        </div>
      </Section>

      <Collapsible label="Live data" summary="For custom data links only">
        <p className="lce-hint">Only for older or custom data links. Tier cards take their stamps from this design.</p>
        <TextInput label="Total stamps field" value={element.countToken} onChange={(countToken) => update((current) => ({ ...current, countToken }))} />
        <TextInput label="Collected stamps field" value={element.filledToken || ""} onChange={(filledToken) => update((current) => ({ ...current, filledToken }))} />
        <TextInput label="Stamp history field" value={element.stampDataToken || "{{stamps}}"} onChange={(stampDataToken) => update((current) => ({ ...current, stampDataToken }))} />
      </Collapsible>
    </>
  );
}

function StampStylesTab({ element, update, onOpenLibrary, face, onUploadImage, onImportImageUrl }: StampGridInspectorProps) {
  const emptyMode = element.emptyMode || "shape";
  const filledMode = element.filledMode || "shape";
  const emptyShape = element.emptyShape || element.shape;
  const filledShape = element.filledShape || element.shape;
  const filledUrls = Array.from(new Set([...(element.filledImageUrls || []), element.filledImageUrl || ""].filter(Boolean)));
  const usesImages = emptyMode === "image" || filledMode === "image";
  const setFilledUrls = (urls: string[]) => update((current) => ({ ...current, filledImageUrls: urls, filledImageUrl: urls[0] || "" }));

  return (
    <>
      <Section label="Empty stamp" aside={<StampSwatch mode={emptyMode} shape={emptyShape} fill={element.emptyFill || element.fill} stroke={element.emptyStroke || element.stroke} strokeWidth={element.emptyStrokeWidth ?? 2} imageUrl={element.emptyImageUrl} />}>
        <Segmented label="Empty stamp style" value={emptyMode} options={[{ value: "shape", label: "Shape" }, { value: "image", label: "Image" }]} onChange={(next) => update((current) => ({ ...current, emptyMode: next }))} />
        {emptyMode === "shape" ? (
          <>
            <div className="lce-tiles-3">
              {STAMP_SHAPES.map((shape) => <Tile key={shape.value} icon={shape.icon} label={shape.label} active={emptyShape === shape.value} onClick={() => update((current) => ({ ...current, emptyShape: shape.value }))} />)}
            </div>
            <ColorField label="Fill" value={element.emptyFill || element.fill} fallback="#FFFFFF" onChange={(color) => update((current) => ({ ...current, emptyFill: color }))} />
            <div className="lce-grid-color">
              <ColorField label="Outline" value={element.emptyStroke || element.stroke} fallback="#181311" onChange={(color) => update((current) => ({ ...current, emptyStroke: color }))} />
              <NumberInput label="Width" suffix="px" value={element.emptyStrokeWidth ?? 2} min={0} max={24} step={0.5} decimals={1} onChange={(emptyStrokeWidth) => update((current) => ({ ...current, emptyStrokeWidth }))} />
            </div>
          </>
        ) : (
          <>
            <div className="lce-stamp-images">
              {element.emptyImageUrl ? (
                <span className="lce-stamp-image">
                  <img src={element.emptyImageUrl} alt="Empty stamp" />
                  <button type="button" aria-label="Remove the empty stamp image" onClick={() => update((current) => ({ ...current, emptyImageUrl: "" }))}><Icon icon={Cancel01Icon} size={12} /></button>
                </span>
              ) : null}
              <button type="button" className="lce-stamp-image lce-stamp-image--add" aria-label="Choose an empty stamp from the library" onClick={() => onOpenLibrary("empty")}><Icon icon={PlusSignIcon} size={18} /></button>
              <span className="lce-hint">{element.emptyImageUrl ? "Pick another from the Library to swap it." : "Pick an image in the Library."}</span>
            </div>
            <ImageUrlField label="Or paste an image link" value={element.emptyImageUrl || ""} context={{ face, field: "stampGrid.emptyImageUrl", elementId: element.id, currentUrl: element.emptyImageUrl || "" }} onChange={(emptyImageUrl) => update((current) => ({ ...current, emptyImageUrl }))} onUploadImage={onUploadImage} onImportImageUrl={onImportImageUrl} />
          </>
        )}
      </Section>

      <Section label="Filled stamp" aside={<StampSwatch mode={filledMode} shape={filledShape} fill={element.filledFill || element.stroke} stroke={element.filledStroke || element.stroke} strokeWidth={element.filledStrokeWidth ?? 2} imageUrl={filledUrls[0]} />}>
        <Segmented label="Filled stamp style" value={filledMode} options={[{ value: "shape", label: "Shape" }, { value: "image", label: "Image" }]} onChange={(next) => update((current) => ({ ...current, filledMode: next }))} />
        {filledMode === "shape" ? (
          <>
            <div className="lce-tiles-3">
              {STAMP_SHAPES.map((shape) => <Tile key={shape.value} icon={shape.icon} label={shape.label} active={filledShape === shape.value} onClick={() => update((current) => ({ ...current, filledShape: shape.value }))} />)}
            </div>
            <ColorField label="Fill" value={element.filledFill || element.stroke} fallback="#F45925" onChange={(filledFill) => update((current) => ({ ...current, filledFill }))} />
            <div className="lce-grid-color">
              <ColorField label="Outline" value={element.filledStroke || element.stroke} fallback="#F45925" onChange={(filledStroke) => update((current) => ({ ...current, filledStroke }))} />
              <NumberInput label="Width" suffix="px" value={element.filledStrokeWidth ?? 2} min={0} max={24} step={0.5} decimals={1} onChange={(filledStrokeWidth) => update((current) => ({ ...current, filledStrokeWidth }))} />
            </div>
          </>
        ) : (
          <>
            <div className="lce-stamp-images">
              {filledUrls.map((url, index) => (
                <span key={url} className="lce-stamp-image">
                  <img src={url} alt={`Filled stamp ${index + 1}`} />
                  <button type="button" aria-label={`Remove filled stamp ${index + 1}`} onClick={() => setFilledUrls(filledUrls.filter((item) => item !== url))}><Icon icon={Cancel01Icon} size={12} /></button>
                </span>
              ))}
              {filledUrls.length < MAX_FILLED_STAMP_PRESETS ? <button type="button" className="lce-stamp-image lce-stamp-image--add" aria-label="Add a filled stamp from the library" onClick={() => onOpenLibrary("filled")}><Icon icon={PlusSignIcon} size={18} /></button> : null}
              <span className="lce-hint">{filledUrls.length > 1 ? "Each stamp picks one of these at random." : `Add up to ${MAX_FILLED_STAMP_PRESETS}; each stamp picks one at random.`}</span>
            </div>
          </>
        )}
        <Field label="How it sits on the empty stamp">
          <Segmented label="How the filled stamp sits on the empty stamp" value={element.filledComposition || "overlay"} options={[{ value: "overlay", label: "On top" }, { value: "replace", label: "Replaces it" }]} onChange={(filledComposition) => update((current) => ({ ...current, filledComposition }))} />
        </Field>
        {usesImages ? (
          <Field label="Image fit">
            <Segmented label="Image fit" value={element.imageFit || "contain"} options={[{ value: "contain", label: "Contain" }, { value: "cover", label: "Cover" }, { value: "fill", label: "Stretch" }]} onChange={(imageFit) => update((current) => ({ ...current, imageFit }))} />
          </Field>
        ) : null}
        <Slider label="Size" value={Math.round((element.filledScale ?? 1) * 100)} min={25} max={250} step={1} format={(value) => `${value}%`} onChange={(value) => update((current) => ({ ...current, filledScale: value / 100 }))} />
        <Slider label="Random tilt" value={element.filledRandomRotation ?? 45} min={0} max={45} format={(value) => value === 0 ? "None" : `up to ${value}°`} onChange={(filledRandomRotation) => update((current) => ({ ...current, filledRandomRotation }))} />
      </Section>
    </>
  );
}

function dateExamples() {
  const now = new Date();
  const earlier = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  return {
    short: new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(earlier),
    medium: new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(earlier),
    relative: "3 days ago",
  };
}

function StampMotionTab({ element, update, onPlay }: StampGridInspectorProps) {
  const animation = element.animation || "none";
  const examples = dateExamples();
  const motions: Array<{ value: "none" | "pop" | "stamp" | "bounce"; label: string; icon: IconType }> = [
    { value: "none", label: "None", icon: Cancel01Icon },
    { value: "pop", label: "Pop", icon: SparklesIcon },
    { value: "stamp", label: "Stamp", icon: StampIcon },
    { value: "bounce", label: "Bounce", icon: SparklesIcon },
  ];
  return (
    <>
      <Section label="When a stamp is added" aside={<button type="button" className="lce-link-button" disabled={animation === "none"} onClick={onPlay}><Icon icon={PlayIcon} size={14} />Play</button>}>
        <div className="lce-tiles-4">
          {motions.map((motion) => <Tile key={motion.value} icon={motion.icon} label={motion.label} active={animation === motion.value} onClick={() => update((current) => ({ ...current, animation: motion.value }))} />)}
        </div>
        <Slider label="Length" value={element.animationDuration ?? 420} min={100} max={1500} step={10} disabled={animation === "none"} format={(value) => `${value} ms`} onChange={(animationDuration) => update((current) => ({ ...current, animationDuration }))} />
        <Slider label="Delay between stamps" value={element.animationStagger ?? 45} min={0} max={500} step={5} disabled={animation === "none"} format={(value) => `${value} ms`} onChange={(animationStagger) => update((current) => ({ ...current, animationStagger }))} />
      </Section>
      <Section label="Stamp dates">
        <Switch label="Show the date under each stamp" checked={element.showStampDates !== false} onChange={(showStampDates) => update((current) => ({ ...current, showStampDates }))} />
        <Segmented label="Date format" value={element.dateFormat || "short"} options={[{ value: "short", label: examples.short, disabled: element.showStampDates === false }, { value: "medium", label: examples.medium, disabled: element.showStampDates === false }, { value: "relative", label: examples.relative, disabled: element.showStampDates === false }]} onChange={(dateFormat) => update((current) => ({ ...current, dateFormat }))} />
      </Section>
    </>
  );
}

/* ---------- Image ---------- */

export function imageHeader(element: LoyaltyCardAssetElement) {
  return { icon: Image01Icon, title: element.name?.trim() || "Image", subtitle: element.imageUrl ? "A picture on the card" : "No picture yet" };
}

export function ImageInspectorBody({ element, update, face, onUploadImage, onImportImageUrl }: { element: LoyaltyCardAssetElement; update: Updater<LoyaltyCardAssetElement>; face: LoyaltyCardFaceKey; onUploadImage?: UploadImageHandler; onImportImageUrl?: ImportImageHandler }) {
  const preset = (element.filterPreset || "none") as ImageFilterPresetKey;
  const setFilter = (patch: Partial<LoyaltyCardAssetElement>) => update((current) => ({ ...current, filterPreset: "none", ...patch }));
  return (
    <>
      <Section label="Picture">
        <div className="lce-image-preview">{element.imageUrl ? <img src={element.imageUrl} alt="" /> : <span><Icon icon={Image01Icon} size={22} />No picture yet</span>}</div>
        <ImageUrlField label="Image link" value={element.imageUrl} context={{ face, field: "asset.imageUrl", elementId: element.id, currentUrl: element.imageUrl }} onChange={(imageUrl) => update((current) => ({ ...current, imageUrl }))} onUploadImage={onUploadImage} onImportImageUrl={onImportImageUrl} />
      </Section>
      <Section label="Fit">
        <Segmented label="Image fit" value={element.fit} options={[{ value: "contain", label: "Contain" }, { value: "cover", label: "Cover" }, { value: "crop", label: "Crop" }]} onChange={(fit) => update((current) => ({ ...current, fit, cropX: current.cropX || 0, cropY: current.cropY || 0, cropScale: current.cropScale || 1 }))} />
        {element.fit === "crop" ? (
          <div className="lce-grid-3">
            <NumberInput label="Crop X" value={element.cropX || 0} min={-CANVAS_WIDTH} max={CANVAS_WIDTH} decimals={1} onChange={(cropX) => update((current) => ({ ...current, cropX }))} />
            <NumberInput label="Crop Y" value={element.cropY || 0} min={-CANVAS_HEIGHT} max={CANVAS_HEIGHT} decimals={1} onChange={(cropY) => update((current) => ({ ...current, cropY }))} />
            <NumberInput label="Zoom" suffix="×" value={element.cropScale || 1} min={0.1} max={5} step={0.05} decimals={2} onChange={(cropScale) => update((current) => ({ ...current, cropScale }))} />
          </div>
        ) : null}
        <Switch label="Keep proportions when resizing" checked={element.lockAspectRatio ?? true} onChange={(lockAspectRatio) => update((current) => ({ ...current, lockAspectRatio }))} />
      </Section>
      <Section label="Filters">
        <div className="lce-chip-row lce-chip-row--wrap" role="radiogroup" aria-label="Filter">
          {(Object.keys(imageFilterPresets) as ImageFilterPresetKey[]).map((key) => (
            <button key={key} type="button" role="radio" aria-checked={preset === key} className={cx("lce-filter-chip", preset === key && "lce-filter-chip--active")} onClick={() => {
              const values = imageFilterPresets[key];
              update((current) => ({ ...current, filterPreset: key, filterBrightness: values.filterBrightness, filterContrast: values.filterContrast, filterSaturation: values.filterSaturation, filterHue: values.filterHue, filterSepia: values.filterSepia, filterGrayscale: values.filterGrayscale, filterInvert: values.filterInvert, filterBlur: values.filterBlur }));
            }}>{imageFilterPresets[key].label}</button>
          ))}
        </div>
      </Section>
      <Collapsible label="Adjust" summary="Brightness, contrast, colour and blur">
        <Slider label="Brightness" value={Math.round((element.filterBrightness ?? 1) * 100)} min={0} max={200} format={(value) => `${value}%`} onChange={(value) => setFilter({ filterBrightness: value / 100 })} />
        <Slider label="Contrast" value={Math.round((element.filterContrast ?? 1) * 100)} min={0} max={200} format={(value) => `${value}%`} onChange={(value) => setFilter({ filterContrast: value / 100 })} />
        <Slider label="Saturation" value={Math.round((element.filterSaturation ?? 1) * 100)} min={0} max={300} format={(value) => `${value}%`} onChange={(value) => setFilter({ filterSaturation: value / 100 })} />
        <Slider label="Hue" value={element.filterHue ?? 0} min={-180} max={180} format={(value) => `${value}°`} onChange={(filterHue) => setFilter({ filterHue })} />
        <Slider label="Sepia" value={Math.round((element.filterSepia ?? 0) * 100)} min={0} max={100} format={(value) => `${value}%`} onChange={(value) => setFilter({ filterSepia: value / 100 })} />
        <Slider label="Greyscale" value={Math.round((element.filterGrayscale ?? 0) * 100)} min={0} max={100} format={(value) => `${value}%`} onChange={(value) => setFilter({ filterGrayscale: value / 100 })} />
        <Slider label="Invert" value={Math.round((element.filterInvert ?? 0) * 100)} min={0} max={100} format={(value) => `${value}%`} onChange={(value) => setFilter({ filterInvert: value / 100 })} />
        <Slider label="Blur" value={element.filterBlur ?? 0} min={0} max={20} step={0.5} format={(value) => `${value} px`} onChange={(filterBlur) => setFilter({ filterBlur })} />
      </Collapsible>
      <Collapsible label="Placeholder" summary="Shown until a picture is added">
        <TextInput label="Placeholder text" value={element.assetId} onChange={(assetId) => update((current) => ({ ...current, assetId }))} />
        <ColorField label="Placeholder colour" value={element.tint} fallback="#111827" onChange={(tint) => update((current) => ({ ...current, tint }))} />
      </Collapsible>
    </>
  );
}

/* ---------- Shape and line ---------- */

const SHAPE_OPTIONS: Array<{ value: "rect" | "circle" | "blob"; label: string; icon: IconType }> = [
  { value: "rect", label: "Rectangle", icon: SquareIcon },
  { value: "circle", label: "Circle", icon: CircleIcon },
  { value: "blob", label: "Blob", icon: ShapesIcon },
];

export function shapeHeader(element: LoyaltyCardShapeElement) {
  const option = SHAPE_OPTIONS.find((item) => item.value === element.shape) || SHAPE_OPTIONS[0];
  return { icon: option.icon, title: element.name?.trim() || option.label, subtitle: "Shape" };
}

export function ShapeInspectorBody({ element, update }: { element: LoyaltyCardShapeElement; update: Updater<LoyaltyCardShapeElement> }) {
  const outlineOn = element.strokeWidth > 0;
  const lockRatio = element.lockAspectRatio ?? (element.shape === "circle" || element.shape === "blob");
  return (
    <>
      <Section label="Shape">
        <div className="lce-tiles-3">
          {SHAPE_OPTIONS.map((option) => <Tile key={option.value} icon={option.icon} label={option.label} active={element.shape === option.value} onClick={() => update((current) => {
            if (current.shape === option.value) return current;
            const squareSize = Math.max(1, Math.min(current.width, current.height));
            const wasAspectShape = current.shape === "circle" || current.shape === "blob";
            const lockAspectRatio = option.value === "rect" ? false : wasAspectShape ? current.lockAspectRatio ?? true : true;
            return { ...current, shape: option.value, width: option.value === "rect" ? current.width : squareSize, height: option.value === "rect" ? current.height : squareSize, radius: option.value === "circle" ? 999 : current.shape === "circle" || !current.radius ? 24 : current.radius, lockAspectRatio };
          })} />)}
        </div>
        <Switch label="Keep proportions when resizing" checked={lockRatio} onChange={(lockAspectRatio) => update((current) => ({ ...current, lockAspectRatio }))} />
      </Section>
      <Section label="Colour">
        <ColorField label="Fill" value={element.fill} fallback="#F45925" onChange={(fill) => update((current) => ({ ...current, fill }))} />
        <Switch label="Outline" checked={outlineOn} onChange={(checked) => update((current) => ({ ...current, strokeWidth: checked ? Math.max(1, current.strokeWidth || 2) : 0, stroke: current.stroke || "#181311" }))} />
        {outlineOn ? (
          <div className="lce-grid-color">
            <ColorField label="Outline colour" value={element.stroke || "#000000"} fallback="#000000" onChange={(stroke) => update((current) => ({ ...current, stroke }))} />
            <NumberInput label="Width" suffix="px" value={element.strokeWidth} min={0} max={40} decimals={1} onChange={(strokeWidth) => update((current) => ({ ...current, strokeWidth }))} />
          </div>
        ) : null}
      </Section>
      {element.shape === "rect" ? (
        <Section label="Corners">
          <Slider label="Corner radius" value={clampNumber(element.radius, 0, 200)} min={0} max={200} format={(value) => `${value} px`} onChange={(radius) => update((current) => ({ ...current, radius }))} />
        </Section>
      ) : null}
    </>
  );
}

export function lineHeader(element: LoyaltyCardLineElement) {
  return { icon: MinusSignIcon, title: element.name?.trim() || "Line", subtitle: "Shape" };
}

export function LineInspectorBody({ element, update }: { element: LoyaltyCardLineElement; update: Updater<LoyaltyCardLineElement> }) {
  return (
    <Section label="Line">
      <ColorField label="Colour" value={element.color} fallback="#181311" onChange={(color) => update((current) => ({ ...current, color }))} />
      <Slider label="Thickness" value={element.strokeWidth} min={1} max={40} format={(value) => `${value} px`} onChange={(strokeWidth) => update((current) => ({ ...current, strokeWidth }))} />
    </Section>
  );
}

/* ---------- Several selected ---------- */

export function MultiSelectionBody({ count, editableCount, canUngroup, onAlign, onDistribute, onCenter, onGroup, onUngroup, onDelete }: { count: number; editableCount: number; canUngroup: boolean; onAlign: (axis: "x" | "y", position: "start" | "center" | "end") => void; onDistribute: (axis: "x" | "y") => void; onCenter: () => void; onGroup: () => void; onUngroup: () => void; onDelete: () => void }) {
  return (
    <>
      <Section label="Line them up">
        <div className="lce-icon-row">
          <IconButton icon={AlignLeftIcon} label="Align left edges" variant="soft" onClick={() => onAlign("x", "start")} />
          <IconButton icon={AlignHorizontalCenterIcon} label="Align centres" variant="soft" onClick={() => onAlign("x", "center")} />
          <IconButton icon={AlignRightIcon} label="Align right edges" variant="soft" onClick={() => onAlign("x", "end")} />
          <IconButton icon={AlignTopIcon} label="Align top edges" variant="soft" onClick={() => onAlign("y", "start")} />
          <IconButton icon={AlignVerticalCenterIcon} label="Align middles" variant="soft" onClick={() => onAlign("y", "center")} />
          <IconButton icon={AlignBottomIcon} label="Align bottom edges" variant="soft" onClick={() => onAlign("y", "end")} />
        </div>
        <div className="lce-button-row">
          <button type="button" className="lce-button lce-button--small" disabled={editableCount < 3} onClick={() => onDistribute("x")}><Icon icon={DistributeHorizontalCenterIcon} size={15} />Space evenly across</button>
          <button type="button" className="lce-button lce-button--small" disabled={editableCount < 3} onClick={() => onDistribute("y")}><Icon icon={DistributeVerticalCenterIcon} size={15} />Space evenly down</button>
          <button type="button" className="lce-button lce-button--small" onClick={onCenter}><Icon icon={CenterFocusIcon} size={15} />Centre on the card</button>
        </div>
      </Section>
      <Section label="Group">
        <p className="lce-hint">Grouped items move and select together. Alt-click picks one item inside a group.</p>
        <div className="lce-button-row">
          <button type="button" className="lce-button lce-button--small" disabled={count < 2} onClick={onGroup}><Icon icon={Layers01Icon} size={15} />Group</button>
          <button type="button" className="lce-button lce-button--small" disabled={!canUngroup} onClick={onUngroup}>Ungroup</button>
          <button type="button" className="lce-button lce-button--small lce-button--danger" disabled={editableCount === 0} onClick={onDelete}><Icon icon={Delete02Icon} size={15} />Delete</button>
        </div>
      </Section>
    </>
  );
}

/* ---------- Card settings ---------- */

const CATEGORY_LABELS: Record<LoyaltyCardPresetCategory, string> = { coffee: "Coffee", bakery: "Bakery", restaurant: "Restaurant", bar: "Bar", generic: "Other" };
const CATEGORY_ORDER: LoyaltyCardPresetCategory[] = ["coffee", "bakery", "restaurant", "bar", "generic"];

export function categoryLabel(category: string | undefined) {
  return CATEGORY_LABELS[category as LoyaltyCardPresetCategory] || (category ? category[0].toUpperCase() + category.slice(1) : "");
}

export function slugifyPresetName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const CORNER_PRESETS = [
  { value: 0, label: "Square" },
  { value: 16, label: "Soft" },
  { value: 32, label: "Round" },
];

export type SampleData = { venueName: string; rewardTitle: string };

type CardSettingsProps = {
  record: LoyaltyCardPresetRecord;
  commit: (updater: (record: LoyaltyCardPresetRecord) => LoyaltyCardPresetRecord) => void;
  face: LoyaltyCardFaceKey;
  background: LoyaltyCardBackground | null;
  onBackgroundChange: (background: BackgroundUpdate) => void;
  showPresetDetails: boolean;
  meta: ReactNode;
  sample: SampleData;
  onSampleChange: (sample: SampleData) => void;
  previewCount: number;
  previewTotal: number;
  hasStampGrid: boolean;
  onPreviewCountChange: (count: number) => void;
  onUploadImage?: UploadImageHandler;
  onImportImageUrl?: ImportImageHandler;
};

export function CardSettingsBody({ record, commit, face, background, onBackgroundChange, showPresetDetails, meta, sample, onSampleChange, previewCount, previewTotal, hasStampGrid, onPreviewCountChange, onUploadImage, onImportImageUrl }: CardSettingsProps) {
  const radius = record.designSchema.canvas.borderRadius ?? 32;
  const setRadius = (borderRadius: number) => commit((current) => ({ ...current, designSchema: { ...current.designSchema, canvas: { ...current.designSchema.canvas, borderRadius: clampNumber(borderRadius, 0, 160) } } }));
  const visible = record.status === "published";
  const categories = CATEGORY_ORDER.filter((item) => (LOYALTY_CARD_PRESET_CATEGORIES as readonly string[]).includes(item));

  return (
    <>
      {showPresetDetails ? (
        <Section label="Preset details" aside={<Chip tone={visible ? "success" : "warning"}>{visible ? "Visible to venues" : "Hidden from venues"}</Chip>}>
          <TextInput label="Name" value={record.name} onChange={(name) => commit((current) => ({ ...current, name, slug: slugifyPresetName(name) || current.slug }))} />
          <Field label="Category">
            <div className="lce-chip-row lce-chip-row--wrap" role="radiogroup" aria-label="Category">
              {categories.map((category) => <button key={category} type="button" role="radio" aria-checked={record.category === category} className={cx("lce-filter-chip", record.category === category && "lce-filter-chip--active")} onClick={() => commit((current) => ({ ...current, category }))}>{CATEGORY_LABELS[category]}</button>)}
            </div>
          </Field>
          <TextArea label="Note for venues" rows={2} value={record.description} placeholder="Who this card suits, and how stamps are earned" onChange={(description) => commit((current) => ({ ...current, description }))} />
          <p className="lce-slug"><Icon icon={Link01Icon} size={14} /><span>{record.slug || "—"}</span><small>· made from the name</small></p>
          {meta}
        </Section>
      ) : meta ? (
        <Section label="Details">{meta}</Section>
      ) : null}

      <Section label="Card shape">
        <div className="lce-tiles-3">
          {CORNER_PRESETS.map((preset) => (
            <Tile key={preset.label} label={preset.label} active={radius === preset.value} onClick={() => setRadius(preset.value)}>
              <span className="lce-corner-preview" style={{ borderRadius: Math.round(preset.value / 3) }} aria-hidden="true" />
            </Tile>
          ))}
        </div>
        <Slider label="Corner radius" value={radius} min={0} max={160} format={(value) => `${value}`} onChange={setRadius} />
      </Section>

      {background ? <BackgroundSection face={face} background={background} onChange={onBackgroundChange} onUploadImage={onUploadImage} onImportImageUrl={onImportImageUrl} /> : null}

      <Section label="Preview with sample data" aside={<span className="lce-hint-inline">Not saved</span>}>
        <div className="lce-grid-sample">
          <TextInput label="Venue name" value={sample.venueName} onChange={(venueName) => onSampleChange({ ...sample, venueName })} />
          {hasStampGrid ? <NumberInput label="Stamps collected" suffix={`of ${previewTotal}`} value={previewCount} min={0} max={previewTotal} decimals={0} onChange={(count) => onPreviewCountChange(Math.round(count))} /> : null}
        </div>
        <TextInput label="Reward" value={sample.rewardTitle} onChange={(rewardTitle) => onSampleChange({ ...sample, rewardTitle })} />
      </Section>
    </>
  );
}

export function cardSettingsHeader() {
  return { icon: CreditCardIcon, title: "Card settings", subtitle: "Click anything on the card to edit it" };
}

function BackgroundSection({ face, background, onChange, onUploadImage, onImportImageUrl }: { face: LoyaltyCardFaceKey; background: LoyaltyCardBackground; onChange: (background: BackgroundUpdate) => void; onUploadImage?: UploadImageHandler; onImportImageUrl?: ImportImageHandler }) {
  const type = background.type;
  return (
    <Section label={`${FACE_LABELS[face]} background`} aside={<span className="lce-hint-inline">Each side has its own</span>}>
      <Segmented label="Background type" value={type === "solid" ? "solid" : type} options={[{ value: "solid", label: "Colour" }, { value: "gradient", label: "Gradient" }, { value: "image", label: "Image" }]} onChange={(next) => onChange(defaultBackground(next, background))} />
      {background.type === "solid" ? <ColorField label="Colour" value={background.color} fallback="#111827" onChange={(color) => onChange({ ...background, color })} /> : null}
      {background.type === "gradient" ? <GradientEditor background={background} onChange={onChange} /> : null}
      {background.type === "image" ? (
        <>
          <ImageUrlField label="Image link" value={background.imageUrl} context={{ face, field: "background.imageUrl", currentUrl: background.imageUrl }} onChange={(imageUrl) => onChange((current) => (current.type === "image" ? { ...current, imageUrl } : current))} onUploadImage={onUploadImage} onImportImageUrl={onImportImageUrl} />
          <ColorField label="Colour behind the image" value={background.color} fallback="#111827" onChange={(color) => onChange({ ...background, color })} />
          <Slider label="Image opacity" value={Math.round((background.opacity ?? 1) * 100)} min={0} max={100} format={(value) => `${value}%`} onChange={(value) => onChange({ ...background, opacity: value / 100 })} />
          <Field label="Fit">
            <Segmented label="Image fit" value={background.fit} options={[{ value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }, { value: "fill", label: "Stretch" }, { value: "manual", label: "Manual" }]} onChange={(fit) => onChange({ ...background, fit })} />
          </Field>
          <div className="lce-grid-2">
            <Field label="Across">
              <Segmented iconOnly label="Horizontal position" value={background.alignX || "center"} options={[{ value: "left", label: "Left", title: "Left", icon: AlignLeftIcon }, { value: "center", label: "Centre", title: "Centre", icon: AlignHorizontalCenterIcon }, { value: "right", label: "Right", title: "Right", icon: AlignRightIcon }]} onChange={(alignX) => onChange({ ...background, alignX })} />
            </Field>
            <Field label="Down">
              <Segmented iconOnly label="Vertical position" value={background.alignY || "center"} options={[{ value: "top", label: "Top", title: "Top", icon: AlignTopIcon }, { value: "center", label: "Middle", title: "Middle", icon: AlignVerticalCenterIcon }, { value: "bottom", label: "Bottom", title: "Bottom", icon: AlignBottomIcon }]} onChange={(alignY) => onChange({ ...background, alignY })} />
            </Field>
          </div>
          {background.fit === "manual" ? (
            <div className="lce-grid-2">
              <NumberInput label="Image X" value={background.x ?? 0} min={-CANVAS_WIDTH} max={CANVAS_WIDTH} decimals={1} onChange={(x) => onChange({ ...background, x })} />
              <NumberInput label="Image Y" value={background.y ?? 0} min={-CANVAS_HEIGHT} max={CANVAS_HEIGHT} decimals={1} onChange={(y) => onChange({ ...background, y })} />
              <NumberInput label="Image width" value={background.width ?? CANVAS_WIDTH} min={1} max={CANVAS_WIDTH * 3} decimals={1} onChange={(width) => onChange({ ...background, width })} />
              <NumberInput label="Image height" value={background.height ?? CANVAS_HEIGHT} min={1} max={CANVAS_HEIGHT * 3} decimals={1} onChange={(height) => onChange({ ...background, height })} />
            </div>
          ) : null}
        </>
      ) : null}
    </Section>
  );
}

function GradientEditor({ background, onChange }: { background: Extract<LoyaltyCardBackground, { type: "gradient" }>; onChange: (background: LoyaltyCardBackground) => void }) {
  const colors = background.colors.length >= 2 ? background.colors : [background.colors[0] || "#111827", "#F45925"];
  const setColor = (index: number, color: string) => onChange({ ...background, colors: colors.map((item, itemIndex) => itemIndex === index ? color : item) });
  return (
    <>
      <div className="lce-gradient-bar" style={{ background: `linear-gradient(90deg, ${colors.join(", ")})` }} aria-hidden="true">
        {colors.map((color, index) => <span key={index} style={{ left: `${(index / (colors.length - 1)) * 100}%`, background: color }} />)}
      </div>
      <div className="lce-gradient-stops">
        {colors.map((color, index) => (
          <span key={index} className="lce-gradient-stop">
            <ColorField label={`Colour ${index + 1}`} hideLabel compact value={color} fallback="#111827" onChange={(next) => setColor(index, next)} />
            {colors.length > 2 ? <IconButton icon={Cancel01Icon} label={`Remove colour ${index + 1}`} size="sm" onClick={() => onChange({ ...background, colors: colors.filter((_, itemIndex) => itemIndex !== index) })} /> : null}
          </span>
        ))}
        <NumberInput label="Angle" hideLabel suffix="°" value={background.angle} min={0} max={360} decimals={0} onChange={(angle) => onChange({ ...background, angle })} />
      </div>
      {colors.length < 4 ? <button type="button" className="lce-link-button" onClick={() => onChange({ ...background, colors: [...colors, colors[colors.length - 1]] })}><Icon icon={PlusSignIcon} size={14} />Add a colour</button> : null}
    </>
  );
}

