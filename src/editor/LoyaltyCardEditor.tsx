import { findLoyaltyCardFont, getLoyaltyCardFontCategoryLabel, legacyLoyaltyCardFontMap, loyaltyCardFontCatalog } from "../fonts.js";
import type { LoyaltyCardFontCatalogItem } from "../fonts.js";
import { normalizeLoyaltyCardLayerOrder, normalizeLoyaltyCardPreset } from "../normalize.js";
import { LOYALTY_CARD_CANVAS_HEIGHT, LOYALTY_CARD_CANVAS_WIDTH, LOYALTY_CARD_FACE_KEYS } from "../schema.js";
import {
  AlignLeftIcon,
  AlignVerticalCenterIcon,
  BorderFullIcon,
  CalendarCheckIcon,
  CaseSensitiveIcon,
  CircleIcon,
  Clock01Icon,
  ColorPickerIcon,
  ColorsIcon,
  ColumnInsertIcon,
  ContrastIcon,
  BlurIcon,
  DropletsIcon,
  FilterResetIcon,
  GridTableIcon,
  ImageAdd01Icon,
  LetterSpacingIcon,
  Link01Icon,
  Moon02Icon,
  Move01Icon,
  RadiusIcon,
  Resize01Icon,
  Rotate01Icon,
  RowInsertIcon,
  ShapeCollectionIcon,
  SparklesIcon,
  SquareLock01Icon,
  SquareUnlock01Icon,
  StrokeCenterIcon,
  Sun02Icon,
  TextBoldIcon,
  TextColorIcon,
  TextFontIcon,
  TextIcon,
  Timer01Icon,
  TypeCursorIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignHorizontalSpaceBetween, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalSpaceBetween, ArrowDown, ArrowLeft, ArrowUp, BringToFront, Circle, Crosshair, Eye, EyeOff, GripVertical, Grid3X3, Image, Link, Lock, Minus, SendToBack, Shapes, Square, Trash2, Type, Unlock, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LoyaltyCardDesignCanvas } from "./LoyaltyCardDesignCanvas.js";
import type {
  LoyaltyCardBackground,
  LoyaltyCardDesignSchema,
  LoyaltyCardElement,
  LoyaltyCardFaceKey,
  LoyaltyCardPresetRecord,
  LoyaltyCardTokens,
} from "../schema.js";

const CANVAS_WIDTH = LOYALTY_CARD_CANVAS_WIDTH;
const CANVAS_HEIGHT = LOYALTY_CARD_CANVAS_HEIGHT;

const textTokens = ["{{venueName}}", "{{tierName}}", "{{rewardTitle}}", "{{rewardDescription}}", "{{stampsCollected}}", "{{stampsRequired}}"];
const fontWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const fontCategories = ["sans", "serif", "display", "script", "handwritten", "condensed", "retro", "luxury", "poster", "multilingual"] as const;
const HISTORY_LIMIT = 80;
const EDITOR_THEME_STORAGE_KEY = "spotlyst.loyaltyCardEditor.theme";
type EditorChromeTheme = "light" | "dark";
const FACE_LABELS: Record<LoyaltyCardFaceKey, string> = {
  front: "Front",
  back: "Back",
  reward: "Reward Unlock",
};
const imageFilterPresets = {
  none: { label: "None", filterBrightness: 1, filterContrast: 1, filterSaturation: 1, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  monochrome: { label: "Mono", filterBrightness: 1, filterContrast: 1, filterSaturation: 0, filterHue: 0, filterSepia: 0, filterGrayscale: 1, filterInvert: 0, filterBlur: 0 },
  invert: { label: "Invert", filterBrightness: 1, filterContrast: 1, filterSaturation: 1, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 1, filterBlur: 0 },
  warm: { label: "Warm", filterBrightness: 1, filterContrast: 1, filterSaturation: 1.12, filterHue: 8, filterSepia: 0.12, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  cool: { label: "Cool", filterBrightness: 1, filterContrast: 1, filterSaturation: 1.08, filterHue: -12, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  vintage: { label: "Vintage", filterBrightness: 1, filterContrast: 0.92, filterSaturation: 0.72, filterHue: 0, filterSepia: 0.35, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  dramatic: { label: "Drama", filterBrightness: 0.92, filterContrast: 1.28, filterSaturation: 1.12, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
} as const;
type ImageFilterPresetKey = keyof typeof imageFilterPresets;
const loadedPreviewFontKeys = new Set<string>();
let previewFontPreconnectLoaded = false;

export type LoyaltyCardEditorMetaContext = {
  record: LoyaltyCardPresetRecord;
  update: (updater: (record: LoyaltyCardPresetRecord) => LoyaltyCardPresetRecord) => void;
};

export type LoyaltyCardEditorImageContext = {
  face: LoyaltyCardFaceKey;
  field: "background.imageUrl" | "asset.imageUrl" | "stampGrid.emptyImageUrl" | "stampGrid.filledImageUrl";
  elementId?: string;
  currentUrl: string;
};

export type LoyaltyCardEditorMediaResult = string | { url?: string; cdnUrl?: string };

export type LoyaltyCardEditorProps = {
  value: LoyaltyCardPresetRecord;
  onChange: (record: LoyaltyCardPresetRecord) => void;
  title?: string;
  tokens: LoyaltyCardTokens;
  faces?: LoyaltyCardFaceKey[];
  actions?: ReactNode;
  renderMeta?: (context: LoyaltyCardEditorMetaContext) => ReactNode;
  onSave?: () => void;
  toast?: string | null;
  error?: string | null;
  onUploadImage?: (file: File, context: LoyaltyCardEditorImageContext) => Promise<LoyaltyCardEditorMediaResult>;
  onImportImageUrl?: (url: string, context: LoyaltyCardEditorImageContext) => Promise<LoyaltyCardEditorMediaResult>;
};

function IconLabel({ icon, label }: { icon: IconSvgElement; label: string }) {
  return (
    <span className="loyalty-icon-label" title={label} aria-label={label}>
      <HugeiconsIcon icon={icon} size={15} strokeWidth={1.8} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function InspectorSection({ icon, label }: { icon: IconSvgElement; label: string }) {
  return (
    <div className="loyalty-inspector-section-title">
      <HugeiconsIcon icon={icon} size={14} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function RatioLockButton({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button className={locked ? "loyalty-lock-toggle loyalty-lock-toggle--active" : "loyalty-lock-toggle"} type="button" aria-pressed={locked} onClick={onToggle}>
      <HugeiconsIcon icon={locked ? SquareLock01Icon : SquareUnlock01Icon} size={15} strokeWidth={1.8} aria-hidden="true" />
      <span>{locked ? "Lock ratio" : "Free resize"}</span>
    </button>
  );
}

function resolveMediaResultUrl(result: LoyaltyCardEditorMediaResult) {
  return typeof result === "string" ? result : result.cdnUrl || result.url || "";
}

function getStoredEditorTheme(): EditorChromeTheme {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(EDITOR_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function ImageUrlField({ label, value, context, onChange, onUploadImage, onImportImageUrl }: { label: string; value: string; context: LoyaltyCardEditorImageContext; onChange: (value: string) => void; onUploadImage?: LoyaltyCardEditorProps["onUploadImage"]; onImportImageUrl?: LoyaltyCardEditorProps["onImportImageUrl"] }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMediaActions = Boolean(onUploadImage || onImportImageUrl);

  const applyResult = (result: LoyaltyCardEditorMediaResult) => {
    const nextUrl = resolveMediaResultUrl(result);
    if (nextUrl) onChange(nextUrl);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file || !onUploadImage) return;
    setIsBusy(true);
    setError(null);
    try {
      applyResult(await onUploadImage(file, { ...context, currentUrl: value }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed");
    } finally {
      setIsBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    const sourceUrl = value.trim();
    if (!sourceUrl || !onImportImageUrl) return;
    setIsBusy(true);
    setError(null);
    try {
      applyResult(await onImportImageUrl(sourceUrl, { ...context, currentUrl: value }));
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Image import failed");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="loyalty-image-url-field">
      <label className="field field--icon"><IconLabel icon={Link01Icon} label={label} /><input type="url" placeholder="https://..." value={value} onChange={(event) => onChange(event.target.value)} /></label>
      {hasMediaActions ? (
        <div className="loyalty-image-url-actions">
          {onUploadImage ? (
            <>
              <input ref={inputRef} className="loyalty-image-url-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleUpload(event.target.files?.[0])} />
              <button type="button" disabled={isBusy} onClick={() => inputRef.current?.click()}><UploadCloud size={14} />Upload</button>
            </>
          ) : null}
          {onImportImageUrl ? <button type="button" disabled={isBusy || !value.trim()} onClick={handleImport}><Link size={14} />{isBusy ? "Working" : "Import URL"}</button> : null}
        </div>
      ) : null}
      {error ? <small className="loyalty-image-url-error">{error}</small> : null}
    </div>
  );
}

function getTextFontKey(element: Extract<LoyaltyCardElement, { type: "text" }>) {
  return element.fontKey || legacyLoyaltyCardFontMap[element.fontFamily]?.key || findLoyaltyCardFont(element.fontFamily)?.key || "outfit";
}

function getTextFontWeight(element: Extract<LoyaltyCardElement, { type: "text" }>) {
  return fontWeights.includes(element.fontWeight) ? element.fontWeight : 700;
}

function getTextFontStyle(element: Extract<LoyaltyCardElement, { type: "text" }>) {
  return element.fontStyle === "italic" ? "italic" : "normal";
}

function getFontPreviewWeight(font: LoyaltyCardFontCatalogItem) {
  return font.weights.includes(400)
    ? 400
    : font.weights.reduce((nearest, weight) => (Math.abs(weight - 400) < Math.abs(nearest - 400) ? weight : nearest), font.weights[0] || 400);
}

function getGoogleFontCssUrl(font: LoyaltyCardFontCatalogItem) {
  const family = font.family.trim().replace(/\s+/g, "+");
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${getFontPreviewWeight(font)}&display=swap`;
}

function ensurePreviewFontPreconnect() {
  if (previewFontPreconnectLoaded || typeof document === "undefined") return;
  previewFontPreconnectLoaded = true;
  for (const href of ["https://fonts.googleapis.com", "https://fonts.gstatic.com"]) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (href.includes("gstatic")) link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
}

function loadPreviewFont(font: LoyaltyCardFontCatalogItem) {
  if (font.source !== "google" || typeof document === "undefined" || loadedPreviewFontKeys.has(font.key)) return;
  ensurePreviewFontPreconnect();
  loadedPreviewFontKeys.add(font.key);
  const linkId = `loyalty-font-preview-${font.key}`;
  if (document.getElementById(linkId)) return;
  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = getGoogleFontCssUrl(font);
  document.head.appendChild(link);
}

function FontBrowserItem({ font, isActive, onSelect }: { font: LoyaltyCardFontCatalogItem; isActive: boolean; onSelect: (fontKey: string) => void }) {
  const itemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const element = itemRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      loadPreviewFont(font);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadPreviewFont(font);
        observer.disconnect();
      }
    }, { rootMargin: "180px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [font]);

  useEffect(() => {
    if (isActive) loadPreviewFont(font);
  }, [font, isActive]);

  return (
    <button ref={itemRef} key={font.key} type="button" className={isActive ? "loyalty-font-browser-item loyalty-font-browser-item--active" : "loyalty-font-browser-item"} onClick={() => onSelect(font.key)}>
      <strong style={{ fontFamily: `"${font.family}", sans-serif`, fontWeight: getFontPreviewWeight(font) }}>{font.family}</strong>
    </button>
  );
}

function withFace(schema: LoyaltyCardDesignSchema, face: LoyaltyCardFaceKey, elements: LoyaltyCardElement[]) {
  return {
    ...schema,
    faces: {
      ...schema.faces,
      [face]: {
        ...schema.faces[face],
        elements,
      },
    },
  };
}

function defaultBackground(type: LoyaltyCardBackground["type"], current?: LoyaltyCardBackground): LoyaltyCardBackground {
  if (type === "gradient") {
    if (current?.type === "gradient") return current;
    const baseColor = current?.type === "solid" || current?.type === "image" ? current.color : "#111827";
    return { type, colors: [baseColor, "#F97316"], angle: 135 };
  }
  if (type === "image") {
    if (current?.type === "image") return current;
    const baseColor = current?.type === "solid" ? current.color : "#111827";
    return { type, color: baseColor, imageUrl: "", fit: "cover", alignX: "center", alignY: "center", x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, opacity: 1 };
  }
  return { type: "solid", color: current?.type === "solid" || current?.type === "image" ? current.color : "#111827" };
}

function updateElement(schema: LoyaltyCardDesignSchema, face: LoyaltyCardFaceKey, elementId: string, updater: (element: LoyaltyCardElement) => LoyaltyCardElement) {
  return withFace(
    schema,
    face,
    schema.faces[face].elements.map((element) => (element.id === elementId ? updater(element) : element)),
  );
}

function elementLabel(element: LoyaltyCardElement) {
  if (element.name?.trim()) return element.name.trim();
  if (element.type === "text") return element.token || element.fallbackText || element.id;
  if (element.type === "stampGrid") return "Stamp grid";
  return `${element.type} · ${element.id}`;
}

function createElement(type: LoyaltyCardElement["type"], zIndex: number, options: { shape?: "rect" | "circle" | "blob" } = {}): LoyaltyCardElement {
  const requestedShape = options.shape || "rect";
  const shapeSize = requestedShape === "circle" ? { width: 160, height: 160 } : requestedShape === "blob" ? { width: 180, height: 180 } : { width: 260, height: 120 };
  const base = {
    id: `${type}-${Date.now()}`,
    type,
    x: 120,
    y: 120,
    width: type === "line" ? 320 : type === "shape" ? shapeSize.width : 260,
    height: type === "line" ? 8 : type === "shape" ? shapeSize.height : 120,
    rotation: 0,
    opacity: 1,
    zIndex,
  } as const;

  if (type === "text") {
    return { ...base, type, token: "New text", fallbackText: "", fontSource: "catalog", fontKey: "outfit", fontFamily: "Outfit", fontUrl: "", fontStyle: "normal", fontSize: 42, fontWeight: 700, lineHeight: 1, letterSpacing: 0, textTransform: "none", color: "#111827", align: "left", verticalAlign: "center", textStrokeColor: "#000000", textStrokeWidth: 0 };
  }

  if (type === "asset") {
    return { ...base, type, assetId: "image", imageUrl: "", fit: "contain", cropX: 0, cropY: 0, cropScale: 1, filterPreset: "none", filterBrightness: 1, filterContrast: 1, filterSaturation: 1, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0, lockAspectRatio: true, tint: "#111827" };
  }

  if (type === "shape") {
    return { ...base, type, shape: requestedShape, fill: "#F97316", stroke: "", strokeWidth: 0, radius: requestedShape === "circle" ? 999 : 24, lockAspectRatio: requestedShape === "circle" || requestedShape === "blob" };
  }

  if (type === "line") {
    return { ...base, type, color: "#111827", strokeWidth: 4 };
  }

  return { ...base, type, width: 300, height: 220, columns: 5, count: 10, countToken: "{{stampsRequired}}", filledToken: "{{stampsCollected}}", stampDataToken: "{{stamps}}", shape: "circle", emptyMode: "shape", emptyShape: "circle", emptyFill: "#FFFFFF", emptyStroke: "#111827", emptyStrokeWidth: 2, emptyImageUrl: "", filledMode: "shape", filledShape: "circle", filledFill: "#F97316", filledStroke: "#F97316", filledStrokeWidth: 2, filledImageUrl: "", imageFit: "contain", imageInset: 6, showStampDates: true, dateFormat: "short", animation: "stamp", animationDuration: 420, animationStagger: 45, stroke: "#111827", fill: "#FFFFFF", gap: 16 };
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampColorAlpha(value: number) {
  return Math.round(clampNumber(value, 0, 100));
}

function expandHexColor(value: string) {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex) || /^[0-9a-fA-F]{4}$/.test(hex)) {
    return hex.split("").map((char) => `${char}${char}`).join("");
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{8}$/.test(hex)) return hex;
  return null;
}

function alphaToHex(alpha: number) {
  return Math.round((clampColorAlpha(alpha) / 100) * 255).toString(16).padStart(2, "0").toUpperCase();
}

function hexToAlpha(hex: string | undefined) {
  if (!hex) return 100;
  return Math.round((parseInt(hex, 16) / 255) * 100);
}

function parseColor(value: string | undefined, fallback = "#000000") {
  const raw = String(value || "").trim();
  const expanded = expandHexColor(raw) || expandHexColor(fallback) || "000000";
  const hex = expanded.slice(0, 6).toUpperCase();
  const alpha = expanded.length === 8 ? hexToAlpha(expanded.slice(6, 8)) : 100;
  return {
    hex: `#${hex}`,
    alpha,
    value: alpha >= 100 ? `#${hex}` : `#${hex}${alphaToHex(alpha)}`,
  };
}

function formatColor(hex: string, alpha: number) {
  const parsed = parseColor(hex);
  const nextAlpha = clampColorAlpha(alpha);
  return nextAlpha >= 100 ? parsed.hex : `${parsed.hex}${alphaToHex(nextAlpha)}`;
}

function ColorField({ icon, label, value, fallback = "#000000", onChange }: { icon?: IconSvgElement; label: string; value: string | undefined; fallback?: string; onChange: (value: string) => void }) {
  const parsed = parseColor(value, fallback);
  const [draft, setDraft] = useState(parsed.value);

  useEffect(() => {
    setDraft(parsed.value);
  }, [parsed.value]);

  const commitHex = (raw: string) => {
    const expanded = expandHexColor(raw);
    if (!expanded) return;
    const hex = `#${expanded.slice(0, 6).toUpperCase()}`;
    const alpha = expanded.length === 8 ? hexToAlpha(expanded.slice(6, 8)) : parsed.alpha;
    onChange(formatColor(hex, alpha));
  };

  const commitAlpha = (alpha: number) => {
    onChange(formatColor(parsed.hex, alpha));
  };

  return (
    <label className={icon ? "field field--icon loyalty-color-field" : "field loyalty-color-field"}>
      {icon ? <IconLabel icon={icon} label={label} /> : <span>{label}</span>}
      <div className="loyalty-color-field__control">
        <input className="loyalty-color-field__picker" type="color" value={parsed.hex} onChange={(event) => onChange(formatColor(event.target.value, parsed.alpha))} aria-label={`${label} color`} />
        <input
          className="loyalty-color-field__hex"
          value={draft}
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setDraft(next);
            commitHex(next);
          }}
          onBlur={() => setDraft(parsed.value)}
          aria-label={`${label} hex`}
        />
        <input className="loyalty-color-field__alpha-range" type="range" min="0" max="100" step="1" value={parsed.alpha} onChange={(event) => commitAlpha(Number(event.target.value))} aria-label={`${label} opacity`} />
        <input className="loyalty-color-field__alpha" type="number" min="0" max="100" step="1" value={parsed.alpha} onChange={(event) => commitAlpha(Number(event.target.value))} aria-label={`${label} opacity percent`} />
        <span className="loyalty-color-field__percent">%</span>
      </div>
    </label>
  );
}

function moveLayer(elements: LoyaltyCardElement[], selectedElementId: string, direction: "up" | "down") {
  const ordered = normalizeLoyaltyCardLayerOrder(elements).sort((a, b) => a.zIndex - b.zIndex || elements.findIndex((element) => element.id === a.id) - elements.findIndex((element) => element.id === b.id));
  const selectedIndex = ordered.findIndex((element) => element.id === selectedElementId);
  const swapIndex = direction === "up" ? selectedIndex + 1 : selectedIndex - 1;
  if (selectedIndex < 0 || swapIndex < 0 || swapIndex >= ordered.length) return ordered;
  [ordered[selectedIndex], ordered[swapIndex]] = [ordered[swapIndex], ordered[selectedIndex]];
  const zIndexById = new Map(ordered.map((element, index) => [element.id, index + 1]));
  return normalizeLoyaltyCardLayerOrder(elements.map((element) => ({ ...element, zIndex: zIndexById.get(element.id) || element.zIndex } as LoyaltyCardElement)));
}

function moveLayerToEdge(elements: LoyaltyCardElement[], selectedElementId: string, edge: "front" | "back") {
  const ordered = normalizeLoyaltyCardLayerOrder(elements).sort((a, b) => a.zIndex - b.zIndex || elements.findIndex((element) => element.id === a.id) - elements.findIndex((element) => element.id === b.id));
  const selectedIndex = ordered.findIndex((element) => element.id === selectedElementId);
  if (selectedIndex < 0) return ordered;
  const [selected] = ordered.splice(selectedIndex, 1);
  if (edge === "front") ordered.push(selected);
  else ordered.unshift(selected);
  const zIndexById = new Map(ordered.map((element, index) => [element.id, index + 1]));
  return normalizeLoyaltyCardLayerOrder(elements.map((element) => ({ ...element, zIndex: zIndexById.get(element.id) || element.zIndex } as LoyaltyCardElement)));
}

function reorderLayer(elements: LoyaltyCardElement[], draggedElementId: string, targetElementId: string) {
  if (draggedElementId === targetElementId) return elements;
  const orderedTopFirst = normalizeLoyaltyCardLayerOrder(elements).sort((a, b) => b.zIndex - a.zIndex || elements.findIndex((element) => element.id === a.id) - elements.findIndex((element) => element.id === b.id));
  const draggedIndex = orderedTopFirst.findIndex((element) => element.id === draggedElementId);
  const targetIndex = orderedTopFirst.findIndex((element) => element.id === targetElementId);
  if (draggedIndex < 0 || targetIndex < 0) return elements;
  const [dragged] = orderedTopFirst.splice(draggedIndex, 1);
  orderedTopFirst.splice(targetIndex, 0, dragged);
  const bottomFirst = [...orderedTopFirst].reverse();
  const zIndexById = new Map(bottomFirst.map((element, index) => [element.id, index + 1]));
  return normalizeLoyaltyCardLayerOrder(elements.map((element) => ({ ...element, zIndex: zIndexById.get(element.id) || element.zIndex } as LoyaltyCardElement)));
}

function lockedLayerOrderChanged(currentElements: LoyaltyCardElement[], nextElements: LoyaltyCardElement[]) {
  const nextById = new Map(nextElements.map((element) => [element.id, element]));
  return currentElements.some((element) => element.locked && nextById.get(element.id)?.zIndex !== element.zIndex);
}

function rotatedElementBounds(element: LoyaltyCardElement) {
  const radians = ((element.rotation || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = element.width * cos + element.height * sin;
  const height = element.width * sin + element.height * cos;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    right: centerX + width / 2,
    bottom: centerY + height / 2,
    width,
    height,
    centerX,
    centerY,
  };
}

function elementFrameBounds(elements: LoyaltyCardElement[]) {
  const bounds = elements.map(rotatedElementBounds);
  const left = Math.min(...bounds.map((bound) => bound.left));
  const top = Math.min(...bounds.map((bound) => bound.top));
  const right = Math.max(...bounds.map((bound) => bound.right));
  const bottom = Math.max(...bounds.map((bound) => bound.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function elementsChanged(currentElements: LoyaltyCardElement[], nextElements: LoyaltyCardElement[]) {
  return nextElements.some((element, index) => element.x !== currentElements[index]?.x || element.y !== currentElements[index]?.y);
}

function alignElements(elements: LoyaltyCardElement[], selectedIds: Set<string>, axis: "x" | "y", position: "start" | "center" | "end") {
  const selected = elements.filter((element) => selectedIds.has(element.id));
  if (selected.length === 0) return elements;
  const bounds = selected.length === 1 ? { left: 0, top: 0, right: CANVAS_WIDTH, bottom: CANVAS_HEIGHT, width: CANVAS_WIDTH, height: CANVAS_HEIGHT } : elementFrameBounds(selected);

  return elements.map((element) => {
    if (!selectedIds.has(element.id)) return element;
    const elementBounds = rotatedElementBounds(element);
    if (axis === "x") {
      const visualLeft = position === "start" ? bounds.left : position === "center" ? bounds.left + (bounds.width - elementBounds.width) / 2 : bounds.right - elementBounds.width;
      const x = visualLeft + elementBounds.width / 2 - element.width / 2;
      return { ...element, x: Math.round(x * 10) / 10 } as LoyaltyCardElement;
    }
    const visualTop = position === "start" ? bounds.top : position === "center" ? bounds.top + (bounds.height - elementBounds.height) / 2 : bounds.bottom - elementBounds.height;
    const y = visualTop + elementBounds.height / 2 - element.height / 2;
    return { ...element, y: Math.round(y * 10) / 10 } as LoyaltyCardElement;
  });
}

function centerElementsOnCanvas(elements: LoyaltyCardElement[], selectedIds: Set<string>, axis: "x" | "y" | "both") {
  const selected = elements.filter((element) => selectedIds.has(element.id));
  if (selected.length === 0) return elements;
  const bounds = elementFrameBounds(selected);
  const dx = axis === "x" || axis === "both" ? CANVAS_WIDTH / 2 - (bounds.left + bounds.width / 2) : 0;
  const dy = axis === "y" || axis === "both" ? CANVAS_HEIGHT / 2 - (bounds.top + bounds.height / 2) : 0;

  return elements.map((element) => selectedIds.has(element.id) ? { ...element, x: Math.round((element.x + dx) * 10) / 10, y: Math.round((element.y + dy) * 10) / 10 } as LoyaltyCardElement : element);
}

function distributeElements(elements: LoyaltyCardElement[], selectedIds: Set<string>, axis: "x" | "y") {
  const selected = elements.filter((element) => selectedIds.has(element.id));
  if (selected.length < 3) return elements;
  const sorted = [...selected].sort((a, b) => {
    const aBounds = rotatedElementBounds(a);
    const bBounds = rotatedElementBounds(b);
    return axis === "x" ? aBounds.left - bBounds.left : aBounds.top - bBounds.top;
  });
  const firstBounds = rotatedElementBounds(sorted[0]);
  const lastBounds = rotatedElementBounds(sorted[sorted.length - 1]);
  const start = axis === "x" ? firstBounds.left : firstBounds.top;
  const end = axis === "x" ? lastBounds.right : lastBounds.bottom;
  const totalSize = sorted.reduce((sum, element) => {
    const bounds = rotatedElementBounds(element);
    return sum + (axis === "x" ? bounds.width : bounds.height);
  }, 0);
  const gap = (end - start - totalSize) / (sorted.length - 1);
  const positions = new Map<string, number>();
  let cursor = start;

  sorted.forEach((element) => {
    const bounds = rotatedElementBounds(element);
    const position = axis === "x" ? cursor + bounds.width / 2 - element.width / 2 : cursor + bounds.height / 2 - element.height / 2;
    positions.set(element.id, Math.round(position * 10) / 10);
    cursor += (axis === "x" ? bounds.width : bounds.height) + gap;
  });

  return elements.map((element) => {
    const position = positions.get(element.id);
    if (position === undefined) return element;
    return axis === "x" ? { ...element, x: position } as LoyaltyCardElement : { ...element, y: position } as LoyaltyCardElement;
  });
}

export function LoyaltyCardEditor({
  value,
  onChange,
  title = "Loyalty card studio",
  tokens,
  faces,
  actions,
  renderMeta,
  onSave,
  toast,
  error,
  onUploadImage,
  onImportImageUrl,
}: LoyaltyCardEditorProps) {
  const faceKeys = faces && faces.length ? faces : [...LOYALTY_CARD_FACE_KEYS];
  const [activeFace, setActiveFace] = useState<LoyaltyCardFaceKey>(faceKeys[0]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [leftPanelTab, setLeftPanelTab] = useState<"tools" | "layers">("tools");
  const [inspectorPane, setInspectorPane] = useState<"properties" | "fontPicker">("properties");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [editorTheme, setEditorTheme] = useState<EditorChromeTheme>(() => getStoredEditorTheme());
  const [fontSearch, setFontSearch] = useState("");
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const undoStackRef = useRef<LoyaltyCardPresetRecord[]>([]);
  const redoStackRef = useRef<LoyaltyCardPresetRecord[]>([]);
  const clipboardElementsRef = useRef<LoyaltyCardElement[]>([]);
  const lastSyncedIdRef = useRef<string>(value.id);

  const selectedPreset = value;
  const activeElements = selectedPreset.designSchema.faces[activeFace]?.elements || [];
  const activeBackground = selectedPreset.designSchema.faces[activeFace]?.background || null;
  const activeGroups = selectedPreset.designSchema.faces[activeFace]?.groups || [];
  const selectedElements = activeElements.filter((element) => selectedElementIds.includes(element.id));
  const selectedEditableElements = selectedElements.filter((element) => !element.locked && !element.hidden);
  const selectedElement = selectedElementIds.length === 1 ? activeElements.find((element) => element.id === selectedElementIds[0]) || null : null;
  const selectedGroupIds = activeGroups.filter((group) => group.elementIds.some((id) => selectedElementIds.includes(id))).map((group) => group.id);

  useEffect(() => {
    try {
      window.localStorage.setItem(EDITOR_THEME_STORAGE_KEY, editorTheme);
    } catch {
      // Storage may be unavailable in private or embedded contexts.
    }
  }, [editorTheme]);

  useEffect(() => {
    if (lastSyncedIdRef.current !== value.id) {
      lastSyncedIdRef.current = value.id;
      undoStackRef.current = [];
      redoStackRef.current = [];
      setActiveFace(faceKeys[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.id]);

  useEffect(() => {
    setSelectedElementIds((current) => {
      const elements = value.designSchema.faces[activeFace]?.elements || [];
      const elementIds = new Set(elements.map((element) => element.id));
      const validSelection = current.filter((id) => elementIds.has(id));
      if (validSelection.length > 0) return validSelection;

      const firstElementId = elements[0]?.id;
      return firstElementId ? [firstElementId] : [];
    });
  }, [value.id, activeFace]);

  useEffect(() => {
    setInspectorPane("properties");
  }, [selectedElementIds.join(","), activeFace]);

  const commit = (updater: (preset: LoyaltyCardPresetRecord) => LoyaltyCardPresetRecord, options: { recordHistory?: boolean } = {}) => {
    if (options.recordHistory !== false) {
      undoStackRef.current = [...undoStackRef.current.slice(-(HISTORY_LIMIT - 1)), structuredClone(value)];
      redoStackRef.current = [];
    }
    onChange(updater(value));
  };

  const recordHistorySnapshot = () => {
    undoStackRef.current = [...undoStackRef.current.slice(-(HISTORY_LIMIT - 1)), structuredClone(value)];
    redoStackRef.current = [];
  };

  const handleUndo = () => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current = [...redoStackRef.current.slice(-(HISTORY_LIMIT - 1)), structuredClone(value)];
    setSelectedElementIds((current) => current.filter((id) => previous.designSchema.faces[activeFace]?.elements.some((element) => element.id === id)));
    onChange(previous);
  };

  const handleRedo = () => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current = [...undoStackRef.current.slice(-(HISTORY_LIMIT - 1)), structuredClone(value)];
    setSelectedElementIds((current) => current.filter((id) => next.designSchema.faces[activeFace]?.elements.some((element) => element.id === id)));
    onChange(next);
  };

  const handleSelectElement = (elementId: string, additive = false, isolate = false) => {
    if (!elementId) {
      setSelectedElementIds([]);
      return;
    }
    const groupElementIds = isolate ? [elementId] : activeGroups.find((group) => group.elementIds.includes(elementId))?.elementIds || [elementId];
    setSelectedElementIds((current) => {
      if (!additive) return groupElementIds;
      const groupSet = new Set(groupElementIds);
      const isGroupSelected = groupElementIds.every((id) => current.includes(id));
      if (isGroupSelected) return current.filter((id) => !groupSet.has(id));
      return Array.from(new Set([...current, ...groupElementIds]));
    });
  };

  const updateSelectedElement = (updater: (element: LoyaltyCardElement) => LoyaltyCardElement) => {
    if (!selectedElement || selectedElement.locked) return;
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: updateElement(preset.designSchema, activeFace, selectedElement.id, updater),
    }));
  };

  const fontOptionsByCategory = useMemo(() => {
    const query = fontSearch.trim().toLowerCase();
    const matchingFonts = loyaltyCardFontCatalog.filter((font) => {
      if (!query) return true;
      return font.family.toLowerCase().includes(query) || font.category.toLowerCase().includes(query) || font.license.toLowerCase().includes(query);
    });
    return fontCategories.map((category) => ({
      category,
      fonts: matchingFonts.filter((font) => font.category === category),
    })).filter((group) => group.fonts.length > 0);
  }, [fontSearch]);
  const visibleFontCount = fontOptionsByCategory.reduce((count, group) => count + group.fonts.length, 0);

  const applyCatalogFont = (fontKey: string) => {
    const font = loyaltyCardFontCatalog.find((item) => item.key === fontKey);
    if (!font) return;
    updateSelectedElement((element) => {
      if (element.type !== "text") return element;
      return {
        ...element,
        fontSource: "catalog",
        fontKey: font.key,
        fontFamily: font.family,
        fontUrl: "",
        fontWeight: font.weights.includes(element.fontWeight) ? element.fontWeight : getFontPreviewWeight(font),
        fontStyle: font.styles.includes(element.fontStyle || "normal") ? element.fontStyle : "normal",
      };
    });
    setInspectorPane("properties");
  };

  const updateBackground = (background: LoyaltyCardBackground) => {
    commit((preset) => ({
      ...preset,
      designSchema: {
        ...preset.designSchema,
        faces: {
          ...preset.designSchema.faces,
          [activeFace]: {
            ...preset.designSchema.faces[activeFace],
            background,
          },
        },
      },
    }));
  };

  const updateBackgroundField = (updater: (background: LoyaltyCardBackground) => LoyaltyCardBackground) => {
    if (!activeBackground) return;
    updateBackground(updater(activeBackground));
  };

  const handleAddElement = (type: LoyaltyCardElement["type"], options?: { shape?: "rect" | "circle" | "blob" }) => {
    const element = createElement(type, activeElements.length + 1, options);
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: withFace(preset.designSchema, activeFace, [...preset.designSchema.faces[activeFace].elements, element]),
    }));
    setSelectedElementIds([element.id]);
  };

  const handleDeleteElement = () => {
    if (selectedElementIds.length === 0) return;
    const selectedIds = new Set(activeElements.filter((element) => selectedElementIds.includes(element.id) && !element.locked).map((element) => element.id));
    if (selectedIds.size === 0) return;
    const nextElements = normalizeLoyaltyCardLayerOrder(activeElements.filter((element) => !selectedIds.has(element.id)));
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: {
        ...withFace(preset.designSchema, activeFace, nextElements),
        faces: {
          ...preset.designSchema.faces,
          [activeFace]: {
            ...preset.designSchema.faces[activeFace],
            elements: nextElements,
            groups: (preset.designSchema.faces[activeFace].groups || []).map((group) => ({ ...group, elementIds: group.elementIds.filter((id) => !selectedIds.has(id)) })).filter((group) => group.elementIds.length > 0),
          },
        },
      },
    }));
    setSelectedElementIds(nextElements[0]?.id ? [nextElements[0].id] : []);
  };

  const handleLayerStep = (direction: "up" | "down") => {
    if (!selectedElement || selectedElement.locked) return;
    const nextElements = moveLayer(activeElements, selectedElement.id, direction);
    if (lockedLayerOrderChanged(activeElements, nextElements)) return;
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: withFace(preset.designSchema, activeFace, nextElements),
    }));
  };

  const handleLayerEdge = (edge: "front" | "back") => {
    if (!selectedElement || selectedElement.locked) return;
    const nextElements = moveLayerToEdge(activeElements, selectedElement.id, edge);
    if (lockedLayerOrderChanged(activeElements, nextElements)) return;
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: withFace(preset.designSchema, activeFace, nextElements),
    }));
  };

  const updateLayerElement = (elementId: string, updater: (element: LoyaltyCardElement) => LoyaltyCardElement) => {
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: updateElement(preset.designSchema, activeFace, elementId, updater),
    }));
  };

  const handleLayerDrop = (targetElementId: string) => {
    if (!draggedLayerId || draggedLayerId === targetElementId) return;
    const draggedLayer = activeElements.find((element) => element.id === draggedLayerId);
    if (!draggedLayer || draggedLayer.locked) return;
    const nextElements = reorderLayer(activeElements, draggedLayerId, targetElementId);
    if (nextElements === activeElements) return;
    if (lockedLayerOrderChanged(activeElements, nextElements)) return;
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: withFace(preset.designSchema, activeFace, nextElements),
    }));
    setDraggedLayerId(null);
  };

  const handleAlignElements = (axis: "x" | "y", position: "start" | "center" | "end") => {
    if (selectedEditableElements.length === 0) return;
    const selectedIds = new Set(selectedEditableElements.map((element) => element.id));
    const nextElements = alignElements(activeElements, selectedIds, axis, position);
    if (!elementsChanged(activeElements, nextElements)) return;
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: withFace(preset.designSchema, activeFace, nextElements),
    }));
  };

  const handleCenterElementsOnCanvas = (axis: "x" | "y" | "both") => {
    if (selectedEditableElements.length === 0) return;
    const selectedIds = new Set(selectedEditableElements.map((element) => element.id));
    const nextElements = centerElementsOnCanvas(activeElements, selectedIds, axis);
    if (!elementsChanged(activeElements, nextElements)) return;
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: withFace(preset.designSchema, activeFace, nextElements),
    }));
  };

  const handleDistributeElements = (axis: "x" | "y") => {
    if (selectedEditableElements.length < 3) return;
    const selectedIds = new Set(selectedEditableElements.map((element) => element.id));
    const nextElements = distributeElements(activeElements, selectedIds, axis);
    if (!elementsChanged(activeElements, nextElements)) return;
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: withFace(preset.designSchema, activeFace, nextElements),
    }));
  };

  const handleGroupSelected = () => {
    if (selectedElementIds.length < 2) return;
    const group = {
      id: `group-${Date.now()}`,
      name: `Group ${activeGroups.length + 1}`,
      elementIds: [...selectedElementIds],
      collapsed: false,
    };
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: {
        ...preset.designSchema,
        faces: {
          ...preset.designSchema.faces,
          [activeFace]: {
            ...preset.designSchema.faces[activeFace],
            groups: [...(preset.designSchema.faces[activeFace].groups || []), group],
          },
        },
      },
    }));
  };

  const handleUngroupSelected = () => {
    if (selectedElementIds.length === 0) return;
    const selectedIds = new Set(selectedElementIds);
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: {
        ...preset.designSchema,
        faces: {
          ...preset.designSchema.faces,
          [activeFace]: {
            ...preset.designSchema.faces[activeFace],
            groups: (preset.designSchema.faces[activeFace].groups || []).filter((group) => !group.elementIds.some((id) => selectedIds.has(id))),
          },
        },
      },
    }));
  };

  const moveSelectedElements = (dx: number, dy: number) => {
    if (selectedEditableElements.length === 0) return;
    const selectedIds = new Set(selectedEditableElements.map((element) => element.id));
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: withFace(preset.designSchema, activeFace, activeElements.map((element) => selectedIds.has(element.id)
        ? { ...element, x: clampNumber(element.x + dx, -element.width, CANVAS_WIDTH), y: clampNumber(element.y + dy, -element.height, CANVAS_HEIGHT) } as LoyaltyCardElement
        : element)),
    }));
  };

  const duplicateSelectedElements = () => {
    if (selectedElementIds.length === 0) return;
    const selectedIds = new Set(selectedElementIds);
    const copies = activeElements
      .filter((element) => selectedIds.has(element.id) && !element.locked)
      .map((element, index) => ({
        ...structuredClone(element),
        id: `${element.id}-copy-${Date.now()}-${index}`,
        x: clampNumber(element.x + 24, -element.width, CANVAS_WIDTH),
        y: clampNumber(element.y + 24, -element.height, CANVAS_HEIGHT),
        zIndex: activeElements.length + index + 1,
      } as LoyaltyCardElement));
    if (copies.length === 0) return;
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: withFace(preset.designSchema, activeFace, [...activeElements, ...copies]),
    }));
    setSelectedElementIds(copies.map((copy) => copy.id));
  };

  const copySelectedElements = () => {
    if (selectedElementIds.length === 0) return;
    const selectedIds = new Set(selectedElementIds);
    clipboardElementsRef.current = activeElements.filter((element) => selectedIds.has(element.id) && !element.locked).map((element) => structuredClone(element));
  };

  const pasteCopiedElements = () => {
    if (clipboardElementsRef.current.length === 0) return;
    const timestamp = Date.now();
    const copies = clipboardElementsRef.current.map((element, index) => ({
      ...structuredClone(element),
      id: `${element.id}-paste-${timestamp}-${index}`,
      x: clampNumber(element.x + 24, -element.width, CANVAS_WIDTH),
      y: clampNumber(element.y + 24, -element.height, CANVAS_HEIGHT),
      zIndex: activeElements.length + index + 1,
    } as LoyaltyCardElement));
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: withFace(preset.designSchema, activeFace, [...activeElements, ...copies]),
    }));
    clipboardElementsRef.current = copies.map((copy) => structuredClone(copy));
    setSelectedElementIds(copies.map((copy) => copy.id));
  };

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (isModifier && key === "s") {
        event.preventDefault();
        onSave?.();
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (!isModifier && event.shiftKey && key === "s") {
        event.preventDefault();
        setSnapEnabled((current) => !current);
        return;
      }

      if (isModifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (isModifier && key === "y") {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (isModifier && key === "c") {
        event.preventDefault();
        copySelectedElements();
        return;
      }

      if (isModifier && key === "v") {
        event.preventDefault();
        pasteCopiedElements();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (inspectorPane !== "properties") setInspectorPane("properties");
        else setSelectedElementIds([]);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handleDeleteElement();
        return;
      }

      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (event.key === "ArrowLeft") moveSelectedElements(-step, 0);
        if (event.key === "ArrowRight") moveSelectedElements(step, 0);
        if (event.key === "ArrowUp") moveSelectedElements(0, -step);
        if (event.key === "ArrowDown") moveSelectedElements(0, step);
        return;
      }

      if (isModifier && key === "d") {
        event.preventDefault();
        duplicateSelectedElements();
        return;
      }

      if (isModifier && key === "g") {
        event.preventDefault();
        if (event.shiftKey) handleUngroupSelected();
        else handleGroupSelected();
        return;
      }

      if (isModifier && event.key === "]") {
        event.preventDefault();
        handleLayerStep("up");
        return;
      }

      if (isModifier && event.key === "[") {
        event.preventDefault();
        handleLayerStep("down");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeElements, activeFace, inspectorPane, selectedElementIds, value]);

  return (
    <div className={`loyalty-studio-page loyalty-studio-page--theme-${editorTheme}`}>
      <header className="loyalty-studio-topbar">
        <div>
          <h1>{title}</h1>
        </div>
        <div className="loyalty-studio-topbar-controls">
          <button
            type="button"
            className="loyalty-theme-toggle"
            aria-label={`Switch to ${editorTheme === "light" ? "dark" : "light"} editor theme`}
            title={`Switch to ${editorTheme === "light" ? "dark" : "light"} editor theme`}
            onClick={() => setEditorTheme((current) => current === "light" ? "dark" : "light")}
          >
            <HugeiconsIcon icon={editorTheme === "light" ? Moon02Icon : Sun02Icon} size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{editorTheme === "light" ? "Dark" : "Light"}</span>
          </button>
          <div className="loyalty-studio-actions">{actions}</div>
        </div>
      </header>

      {error ? <div className="loyalty-inspector-empty">{error}</div> : null}
      {toast ? <div className="loyalty-studio-toast" role="status" aria-live="polite">{toast}</div> : null}

      <div className="loyalty-studio-shell">
        <aside className="loyalty-studio-sidebar" aria-label="Editor sidebar">
          <div className="loyalty-studio-tabs" role="tablist" aria-label="Editor sidebar tabs">
            <button className={leftPanelTab === "tools" ? "loyalty-studio-tabs__button loyalty-studio-tabs__button--active" : "loyalty-studio-tabs__button"} type="button" role="tab" aria-selected={leftPanelTab === "tools"} onClick={() => setLeftPanelTab("tools")}>Tools</button>
            <button className={leftPanelTab === "layers" ? "loyalty-studio-tabs__button loyalty-studio-tabs__button--active" : "loyalty-studio-tabs__button"} type="button" role="tab" aria-selected={leftPanelTab === "layers"} onClick={() => setLeftPanelTab("layers")}>Layers</button>
          </div>

          {leftPanelTab === "tools" ? (
            <div className="loyalty-studio-tab-panel" role="tabpanel" aria-label="Tools">
              <div className="loyalty-studio-panel-header">
                <span>Insert</span>
                <strong>{FACE_LABELS[activeFace]}</strong>
              </div>
              <div className="loyalty-studio-insert-sections" aria-label="Add card element">
                <div className="loyalty-studio-insert-section">
                  <span>Content</span>
                  <div className="loyalty-studio-insert-grid">
                    <button type="button" aria-label="Add text" title="Text" onClick={() => handleAddElement("text")}><Type size={18} /><span>Text</span></button>
                    <button type="button" aria-label="Add image" title="Image" onClick={() => handleAddElement("asset")}><Image size={18} /><span>Image</span></button>
                  </div>
                </div>
                <div className="loyalty-studio-insert-section">
                  <span>Shapes</span>
                  <div className="loyalty-studio-insert-grid loyalty-studio-insert-grid--compact">
                    <button type="button" aria-label="Add rectangle" title="Rectangle" onClick={() => handleAddElement("shape", { shape: "rect" })}><Square size={18} /><span>Rect</span></button>
                    <button type="button" aria-label="Add circle" title="Circle" onClick={() => handleAddElement("shape", { shape: "circle" })}><Circle size={18} /><span>Circle</span></button>
                    <button type="button" aria-label="Add blob" title="Blob" onClick={() => handleAddElement("shape", { shape: "blob" })}><Shapes size={18} /><span>Blob</span></button>
                    <button type="button" aria-label="Add line" title="Line" onClick={() => handleAddElement("line")}><Minus size={18} /><span>Line</span></button>
                  </div>
                </div>
                <div className="loyalty-studio-insert-section">
                  <span>Loyalty</span>
                  <div className="loyalty-studio-insert-grid">
                    <button type="button" aria-label="Add stamp grid" title="Stamp grid" onClick={() => handleAddElement("stampGrid")}><Grid3X3 size={18} /><span>Stamp grid</span></button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="loyalty-studio-tab-panel" role="tabpanel" aria-label="Layers">
              <div className="loyalty-studio-panel-header">
                <span>Layers</span>
                <strong>{activeElements.length}</strong>
              </div>
              <div className="loyalty-layer-list">
                {activeElements.map((element, index) => ({ element, index })).sort((a, b) => b.element.zIndex - a.element.zIndex || a.index - b.index).map(({ element }) => (
                  <div
                    key={element.id}
                    className={["loyalty-layer-list__item", selectedElementIds.includes(element.id) ? "loyalty-layer-list__item--active" : "", element.hidden ? "loyalty-layer-list__item--hidden" : "", element.locked ? "loyalty-layer-list__item--locked" : ""].filter(Boolean).join(" ")}
                    draggable={!element.locked}
                    onDragStart={(event) => {
                      if (element.locked) return;
                      setDraggedLayerId(element.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleLayerDrop(element.id);
                    }}
                    onDragEnd={() => setDraggedLayerId(null)}
                  >
                    <button className="loyalty-layer-list__drag" type="button" aria-label="Drag layer" title={element.locked ? "Unlock layer to reorder" : "Drag layer"} disabled={Boolean(element.locked)}><GripVertical size={14} aria-hidden="true" /></button>
                    <button className="loyalty-layer-list__select" type="button" onClick={(event) => handleSelectElement(element.id, event.shiftKey, event.altKey)}>
                      <strong>{elementLabel(element)}</strong>
                      <span>{element.type} · z {element.zIndex}</span>
                    </button>
                    <input
                      className="loyalty-layer-list__name"
                      defaultValue={element.name || ""}
                      placeholder="Layer name"
                      aria-label={`Rename ${elementLabel(element)}`}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          event.currentTarget.value = element.name || "";
                          event.currentTarget.blur();
                        }
                      }}
                      onBlur={(event) => {
                        const name = event.currentTarget.value.trim();
                        if (name === (element.name || "")) return;
                        updateLayerElement(element.id, (current) => ({ ...current, name }));
                      }}
                    />
                    <button className="loyalty-layer-list__icon" type="button" aria-pressed={!element.hidden} aria-label={element.hidden ? "Show layer" : "Hide layer"} title={element.hidden ? "Show layer" : "Hide layer"} onClick={() => updateLayerElement(element.id, (current) => ({ ...current, hidden: !current.hidden }))}>{element.hidden ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}</button>
                    <button className="loyalty-layer-list__icon" type="button" aria-pressed={Boolean(element.locked)} aria-label={element.locked ? "Unlock layer" : "Lock layer"} title={element.locked ? "Unlock layer" : "Lock layer"} onClick={() => updateLayerElement(element.id, (current) => ({ ...current, locked: !current.locked }))}>{element.locked ? <Lock size={14} aria-hidden="true" /> : <Unlock size={14} aria-hidden="true" />}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="loyalty-studio-workspace">
          <div className="loyalty-studio-workspace-header">
            <div>
              <span>Canvas</span>
              <h2>{selectedPreset.name}</h2>
            </div>
            <div className="loyalty-studio-workspace-controls">
              {selectedEditableElements.length > 0 ? (
                <div className="loyalty-align-toolbar" aria-label="Alignment tools">
                  <button type="button" title="Align left" aria-label="Align left" onClick={() => handleAlignElements("x", "start")}><AlignHorizontalJustifyStart size={15} aria-hidden="true" /></button>
                  <button type="button" title="Align horizontal center" aria-label="Align horizontal center" onClick={() => handleAlignElements("x", "center")}><AlignHorizontalJustifyCenter size={15} aria-hidden="true" /></button>
                  <button type="button" title="Align right" aria-label="Align right" onClick={() => handleAlignElements("x", "end")}><AlignHorizontalJustifyEnd size={15} aria-hidden="true" /></button>
                  <span aria-hidden="true" />
                  <button type="button" title="Align top" aria-label="Align top" onClick={() => handleAlignElements("y", "start")}><AlignVerticalJustifyStart size={15} aria-hidden="true" /></button>
                  <button type="button" title="Align vertical middle" aria-label="Align vertical middle" onClick={() => handleAlignElements("y", "center")}><AlignVerticalJustifyCenter size={15} aria-hidden="true" /></button>
                  <button type="button" title="Align bottom" aria-label="Align bottom" onClick={() => handleAlignElements("y", "end")}><AlignVerticalJustifyEnd size={15} aria-hidden="true" /></button>
                  <span aria-hidden="true" />
                  <button type="button" title="Distribute horizontal spacing" aria-label="Distribute horizontal spacing" disabled={selectedEditableElements.length < 3} onClick={() => handleDistributeElements("x")}><AlignHorizontalSpaceBetween size={15} aria-hidden="true" /></button>
                  <button type="button" title="Distribute vertical spacing" aria-label="Distribute vertical spacing" disabled={selectedEditableElements.length < 3} onClick={() => handleDistributeElements("y")}><AlignVerticalSpaceBetween size={15} aria-hidden="true" /></button>
                  <button type="button" title="Center selection to canvas" aria-label="Center selection to canvas" onClick={() => handleCenterElementsOnCanvas("both")}><Crosshair size={15} aria-hidden="true" /></button>
                </div>
              ) : null}
              <button
                type="button"
                aria-pressed={snapEnabled}
                title="Toggle snapping (Shift + S). Hold Alt/Option while dragging to temporarily disable snapping. Hold Alt/Option while resizing to resize from center."
                className={snapEnabled ? "loyalty-snap-toggle loyalty-snap-toggle--active" : "loyalty-snap-toggle"}
                onClick={() => setSnapEnabled((current) => !current)}
              >
                <span>{snapEnabled ? "Snap On" : "Snap Off"}</span>
                <kbd>Shift S</kbd>
              </button>
              <div className="view-toggle" role="tablist" aria-label="Card face">
                {faceKeys.map((face) => (
                  <button key={face} className={activeFace === face ? "loyalty-studio-tabs__button loyalty-studio-tabs__button--active" : "loyalty-studio-tabs__button"} type="button" onClick={() => setActiveFace(face)}>{FACE_LABELS[face]}</button>
                ))}
              </div>
            </div>
          </div>

          <LoyaltyCardDesignCanvas
            schema={selectedPreset.designSchema}
            face={activeFace}
            selectedElementIds={selectedElementIds}
            tokens={tokens}
            snapEnabled={snapEnabled}
            onSelectElement={handleSelectElement}
            onBeginInteraction={recordHistorySnapshot}
            onChangeElement={(elementId, nextElement, options) => {
              commit((preset) => normalizeLoyaltyCardPreset({
                ...preset,
                designSchema: updateElement(preset.designSchema, activeFace, elementId, () => nextElement),
              }), options);
            }}
            onChangeElements={(nextElements, options) => {
              commit((preset) => normalizeLoyaltyCardPreset({
                ...preset,
                designSchema: withFace(preset.designSchema, activeFace, nextElements),
              }), options);
            }}
          />
        </main>

        <aside className="loyalty-studio-inspector" aria-label="Preset inspector">
          {inspectorPane === "fontPicker" && selectedElement?.type === "text" ? (
            <section className="loyalty-inspector-card loyalty-inspector-card--font-picker">
              <div className="loyalty-font-browser-header">
                <button type="button" onClick={() => setInspectorPane("properties")}><ArrowLeft size={15} />Back</button>
                <div>
                  <span>Font family</span>
                  <strong style={{ fontFamily: `"${selectedElement.fontFamily || findLoyaltyCardFont(getTextFontKey(selectedElement))?.family || "Outfit"}", sans-serif`, fontWeight: 400 }}>{selectedElement.fontFamily || findLoyaltyCardFont(getTextFontKey(selectedElement))?.family || "Outfit"}</strong>
                </div>
              </div>
              <label className="field"><span>Search fonts</span><input autoFocus value={fontSearch} onChange={(event) => setFontSearch(event.target.value)} /></label>
              <div className="loyalty-font-browser-count">{visibleFontCount} fonts</div>
              <div className="loyalty-font-browser-list">
                {fontOptionsByCategory.map((group) => (
                  <div key={group.category} className="loyalty-font-browser-group">
                    <span>{getLoyaltyCardFontCategoryLabel(group.category)}</span>
                    {group.fonts.map((font) => {
                      const isActive = font.key === getTextFontKey(selectedElement);
                      return <FontBrowserItem key={font.key} font={font} isActive={isActive} onSelect={applyCatalogFont} />;
                    })}
                  </div>
                ))}
                {visibleFontCount === 0 ? <div className="loyalty-inspector-empty">No matching fonts.</div> : null}
              </div>
            </section>
          ) : (
            <>
              <section className="loyalty-inspector-card loyalty-inspector-card--preset">
                <div className="loyalty-studio-panel-header">
                  <span>Design</span>
                </div>
                <div className="loyalty-inspector-form">
                  {renderMeta ? renderMeta({ record: value, update: (updater) => commit(updater) }) : null}
                  <label className="field"><span>Card radius</span><input type="number" value={selectedPreset.designSchema.canvas.borderRadius ?? 32} onChange={(event) => commit((preset) => ({ ...preset, designSchema: { ...preset.designSchema, canvas: { ...preset.designSchema.canvas, borderRadius: clampNumber(Number(event.target.value), 0, 160) } } }))} /></label>
                  {activeBackground ? (
                    <>
                      <label className="field"><span>{FACE_LABELS[activeFace]} background</span><select value={activeBackground.type} onChange={(event) => updateBackground(defaultBackground(event.target.value as LoyaltyCardBackground["type"], activeBackground))}><option value="solid">Solid</option><option value="gradient">Gradient</option><option value="image">Image</option></select></label>
                      {activeBackground.type === "solid" ? (
                        <ColorField label="Color" value={activeBackground.color} onChange={(color) => updateBackground({ ...activeBackground, color })} fallback="#111827" />
                      ) : null}
                      {activeBackground.type === "gradient" ? (
                        <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                          <ColorField label="Color 1" value={activeBackground.colors[0] || "#111827"} onChange={(color) => updateBackground({ ...activeBackground, colors: [color, activeBackground.colors[1] || "#F97316", activeBackground.colors[2], activeBackground.colors[3]].filter(Boolean) as string[] })} fallback="#111827" />
                          <ColorField label="Color 2" value={activeBackground.colors[1] || "#F97316"} onChange={(color) => updateBackground({ ...activeBackground, colors: [activeBackground.colors[0] || "#111827", color, activeBackground.colors[2], activeBackground.colors[3]].filter(Boolean) as string[] })} fallback="#F97316" />
                          <label className="field"><span>Angle</span><input type="number" value={activeBackground.angle} onChange={(event) => updateBackground({ ...activeBackground, angle: clampNumber(Number(event.target.value), 0, 360) })} /></label>
                        </div>
                      ) : null}
                      {activeBackground.type === "image" ? (
                        <div className="loyalty-inspector-form">
                          <ImageUrlField label="Image URL" value={activeBackground.imageUrl} context={{ face: activeFace, field: "background.imageUrl", currentUrl: activeBackground.imageUrl }} onChange={(imageUrl) => updateBackground({ ...activeBackground, imageUrl })} onUploadImage={onUploadImage} onImportImageUrl={onImportImageUrl} />
                          <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                            <ColorField label="Base color" value={activeBackground.color} onChange={(color) => updateBackground({ ...activeBackground, color })} fallback="#111827" />
                            <label className="field"><span>Opacity</span><input type="number" min="0" max="1" step="0.05" value={activeBackground.opacity ?? 1} onChange={(event) => updateBackground({ ...activeBackground, opacity: clampNumber(Number(event.target.value), 0, 1) })} /></label>
                            <label className="field"><span>Fit</span><select value={activeBackground.fit} onChange={(event) => updateBackground({ ...activeBackground, fit: event.target.value as "cover" | "contain" | "fill" | "manual" })}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option><option value="manual">Manual</option></select></label>
                            <label className="field"><span>Align X</span><select value={activeBackground.alignX || "center"} onChange={(event) => updateBackground({ ...activeBackground, alignX: event.target.value as "left" | "center" | "right" })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
                            <label className="field"><span>Align Y</span><select value={activeBackground.alignY || "center"} onChange={(event) => updateBackground({ ...activeBackground, alignY: event.target.value as "top" | "center" | "bottom" })}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label>
                          </div>
                          {activeBackground.fit === "manual" ? (
                            <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                              <label className="field"><span>Image X</span><input type="number" value={activeBackground.x ?? 0} onChange={(event) => updateBackgroundField((background) => background.type === "image" ? { ...background, x: clampNumber(Number(event.target.value), -CANVAS_WIDTH, CANVAS_WIDTH) } : background)} /></label>
                              <label className="field"><span>Image Y</span><input type="number" value={activeBackground.y ?? 0} onChange={(event) => updateBackgroundField((background) => background.type === "image" ? { ...background, y: clampNumber(Number(event.target.value), -CANVAS_HEIGHT, CANVAS_HEIGHT) } : background)} /></label>
                              <label className="field"><span>Image W</span><input type="number" value={activeBackground.width ?? CANVAS_WIDTH} onChange={(event) => updateBackgroundField((background) => background.type === "image" ? { ...background, width: clampNumber(Number(event.target.value), 1, CANVAS_WIDTH * 3) } : background)} /></label>
                              <label className="field"><span>Image H</span><input type="number" value={activeBackground.height ?? CANVAS_HEIGHT} onChange={(event) => updateBackgroundField((background) => background.type === "image" ? { ...background, height: clampNumber(Number(event.target.value), 1, CANVAS_HEIGHT * 3) } : background)} /></label>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </section>

              <section className="loyalty-inspector-card loyalty-inspector-card--element">
                <div className="loyalty-studio-panel-header">
                  <span>Element</span>
                  <strong>{selectedElement ? selectedElement.type : selectedElementIds.length > 1 ? `${selectedElementIds.length} selected` : "None"}</strong>
                </div>
                {selectedElementIds.length > 1 ? (
                  <>
                    <div className="loyalty-inspector-empty">{selectedElementIds.length} elements selected. Drag any selected element to move them together.</div>
                    <div className="loyalty-layer-actions">
                      <button type="button" onClick={handleGroupSelected}>Group</button>
                      <button type="button" onClick={handleUngroupSelected} disabled={selectedGroupIds.length === 0}>Ungroup</button>
                      <button type="button" className="loyalty-danger-button" onClick={handleDeleteElement}><Trash2 size={14} />Delete</button>
                    </div>
                  </>
                ) : selectedElement ? (
                  <>
                    <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                      <label className="field field--icon"><IconLabel icon={Move01Icon} label="X position" /><input type="number" value={selectedElement.x} onChange={(event) => updateSelectedElement((element) => ({ ...element, x: clampNumber(Number(event.target.value), -CANVAS_WIDTH, CANVAS_WIDTH) }))} /></label>
                      <label className="field field--icon"><IconLabel icon={Move01Icon} label="Y position" /><input type="number" value={selectedElement.y} onChange={(event) => updateSelectedElement((element) => ({ ...element, y: clampNumber(Number(event.target.value), -CANVAS_HEIGHT, CANVAS_HEIGHT) }))} /></label>
                      <label className="field field--icon"><IconLabel icon={Resize01Icon} label="Width" /><input type="number" value={selectedElement.width} onChange={(event) => updateSelectedElement((element) => ({ ...element, width: clampNumber(Number(event.target.value), 1, CANVAS_WIDTH * 3) }))} /></label>
                      <label className="field field--icon"><IconLabel icon={Resize01Icon} label="Height" /><input type="number" value={selectedElement.height} onChange={(event) => updateSelectedElement((element) => ({ ...element, height: clampNumber(Number(event.target.value), 1, CANVAS_HEIGHT * 3) }))} /></label>
                      <label className="field field--icon"><IconLabel icon={Rotate01Icon} label="Rotate" /><input type="number" value={selectedElement.rotation} onChange={(event) => updateSelectedElement((element) => ({ ...element, rotation: Number(event.target.value) || 0 }))} /></label>
                      <label className="field field--icon"><IconLabel icon={CircleIcon} label="Opacity" /><input type="number" min="0" max="1" step="0.05" value={selectedElement.opacity} onChange={(event) => updateSelectedElement((element) => ({ ...element, opacity: clampNumber(Number(event.target.value), 0, 1) }))} /></label>
                    </div>

                    {selectedElement.type === "text" ? (
                      <div className="loyalty-inspector-form">
                        <InspectorSection icon={TextIcon} label="Text" />
                        <label className="field field--icon field--icon-textarea"><IconLabel icon={TypeCursorIcon} label="Text" /><textarea rows={3} value={selectedElement.token} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, token: event.target.value } : element)} /></label>
                        <div className="loyalty-token-row" aria-label="Insert text token">
                          {textTokens.map((token) => (
                            <button key={token} type="button" onClick={() => updateSelectedElement((element) => element.type === "text" ? { ...element, token: `${element.token}${element.token ? " " : ""}${token}` } : element)}>{token}</button>
                          ))}
                        </div>
                        <label className="field field--icon"><IconLabel icon={TextFontIcon} label="Font source" /><select value={selectedElement.fontSource || "catalog"} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, fontSource: event.target.value as "preset" | "catalog" | "customUrl" } : element)}><option value="catalog">Catalog</option><option value="customUrl">Custom URL</option><option value="preset">Legacy preset</option></select></label>
                        {(selectedElement.fontSource || "catalog") === "customUrl" ? (
                          <>
                            <label className="field field--icon"><IconLabel icon={TextFontIcon} label="Font family" /><input value={selectedElement.fontFamily} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, fontFamily: event.target.value, fontKey: event.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") } : element)} /></label>
                            <label className="field field--icon"><IconLabel icon={Link01Icon} label="Font URL" /><input type="url" placeholder="https://.../font.woff2" value={selectedElement.fontUrl || ""} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, fontUrl: event.target.value } : element)} /></label>
                          </>
                        ) : (
                          <div className="field">
                            <span>Font family</span>
                            <button className="loyalty-font-family-trigger" type="button" onClick={() => {
                              setFontSearch("");
                              setInspectorPane("fontPicker");
                            }}>
                              <strong>{selectedElement.fontFamily || findLoyaltyCardFont(getTextFontKey(selectedElement))?.family || "Outfit"}</strong>
                              <small>Browse fonts</small>
                            </button>
                          </div>
                        )}
                        <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                          <label className="field field--icon"><IconLabel icon={TextBoldIcon} label="Weight" /><select value={String(getTextFontWeight(selectedElement))} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, fontWeight: Number(event.target.value) } : element)}>{fontWeights.map((weight) => <option key={weight} value={String(weight)}>{weight}</option>)}</select></label>
                          <label className="field field--icon"><IconLabel icon={TextFontIcon} label="Style" /><select value={getTextFontStyle(selectedElement)} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, fontStyle: event.target.value as "normal" | "italic" } : element)}><option value="normal">Normal</option><option value="italic">Italic</option></select></label>
                          <label className="field field--icon"><IconLabel icon={TextFontIcon} label="Font size" /><input type="number" value={selectedElement.fontSize} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, fontSize: clampNumber(Number(event.target.value), 1, 220) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={TextIcon} label="Line height" /><input type="number" step="0.05" value={selectedElement.lineHeight} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, lineHeight: clampNumber(Number(event.target.value), 0.7, 2.5) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={LetterSpacingIcon} label="Letter spacing" /><input type="number" value={selectedElement.letterSpacing || 0} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, letterSpacing: clampNumber(Number(event.target.value), -20, 80) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={CaseSensitiveIcon} label="Transform" /><select value={selectedElement.textTransform || "none"} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, textTransform: event.target.value as "none" | "uppercase" | "lowercase" | "capitalize" } : element)}><option value="none">None</option><option value="uppercase">Uppercase</option><option value="lowercase">Lowercase</option><option value="capitalize">Capitalize</option></select></label>
                          <label className="field field--icon"><IconLabel icon={AlignLeftIcon} label="Align" /><select value={selectedElement.align} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, align: event.target.value as "left" | "center" | "right" } : element)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
                          <label className="field field--icon"><IconLabel icon={AlignVerticalCenterIcon} label="Vertical align" /><select value={selectedElement.verticalAlign || "center"} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, verticalAlign: event.target.value as "top" | "center" | "bottom" } : element)}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label>
                          <ColorField label="Fill" value={selectedElement.color} onChange={(color) => updateSelectedElement((element) => element.type === "text" ? { ...element, color } : element)} fallback="#111827" />
                          <ColorField label="Stroke" value={selectedElement.textStrokeColor || "#000000"} onChange={(color) => updateSelectedElement((element) => element.type === "text" ? { ...element, textStrokeColor: color } : element)} fallback="#000000" />
                          <label className="field field--icon"><IconLabel icon={BorderFullIcon} label="Stroke width" /><input type="number" value={selectedElement.textStrokeWidth || 0} onChange={(event) => updateSelectedElement((element) => element.type === "text" ? { ...element, textStrokeWidth: clampNumber(Number(event.target.value), 0, 20) } : element)} /></label>
                        </div>
                      </div>
                    ) : null}

                    {selectedElement.type === "shape" ? (
                      <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                        <label className="field field--icon"><IconLabel icon={ShapeCollectionIcon} label="Shape" /><select value={selectedElement.shape} onChange={(event) => updateSelectedElement((element) => {
                          if (element.type !== "shape") return element;
                          const nextShape = event.target.value as "rect" | "circle" | "blob";
                          const squareSize = Math.max(1, Math.min(element.width, element.height));
                          const wasAspectShape = element.shape === "circle" || element.shape === "blob";
                          const lockAspectRatio = nextShape === "rect" ? false : wasAspectShape ? element.lockAspectRatio ?? true : true;
                          return { ...element, shape: nextShape, width: nextShape === "rect" ? element.width : squareSize, height: nextShape === "rect" ? element.height : squareSize, radius: nextShape === "circle" ? 999 : element.radius || 24, lockAspectRatio };
                        })}><option value="rect">Rectangle</option><option value="circle">Circle</option><option value="blob">Blob</option></select></label>
                        <div className="field field--icon"><IconLabel icon={Resize01Icon} label="Aspect ratio" /><RatioLockButton locked={selectedElement.lockAspectRatio ?? (selectedElement.shape === "circle" || selectedElement.shape === "blob")} onToggle={() => updateSelectedElement((element) => element.type === "shape" ? { ...element, lockAspectRatio: !(element.lockAspectRatio ?? (element.shape === "circle" || element.shape === "blob")) } : element)} /></div>
                        <ColorField label="Fill" value={selectedElement.fill} onChange={(color) => updateSelectedElement((element) => element.type === "shape" ? { ...element, fill: color } : element)} fallback="#F97316" />
                        <ColorField label="Stroke" value={selectedElement.stroke || "#000000"} onChange={(color) => updateSelectedElement((element) => element.type === "shape" ? { ...element, stroke: color } : element)} fallback="#000000" />
                        <label className="field field--icon"><IconLabel icon={BorderFullIcon} label="Stroke width" /><input type="number" value={selectedElement.strokeWidth} onChange={(event) => updateSelectedElement((element) => element.type === "shape" ? { ...element, strokeWidth: clampNumber(Number(event.target.value), 0, 80) } : element)} /></label>
                        {selectedElement.shape === "rect" ? (
                          <>
                            <label className="field field--icon"><IconLabel icon={RadiusIcon} label="Corner radius" /><input type="number" min="0" max="500" step="1" value={selectedElement.radius} onChange={(event) => updateSelectedElement((element) => element.type === "shape" ? { ...element, radius: clampNumber(Number(event.target.value), 0, 500) } : element)} /></label>
                            <label className="field field--icon"><IconLabel icon={RadiusIcon} label="Corner radius slider" /><input type="range" min="0" max="500" step="1" value={clampNumber(selectedElement.radius, 0, 500)} onChange={(event) => updateSelectedElement((element) => element.type === "shape" ? { ...element, radius: clampNumber(Number(event.target.value), 0, 500) } : element)} /></label>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    {selectedElement.type === "line" ? (
                      <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                        <ColorField label="Color" value={selectedElement.color} onChange={(color) => updateSelectedElement((element) => element.type === "line" ? { ...element, color } : element)} fallback="#111827" />
                        <label className="field field--icon"><IconLabel icon={StrokeCenterIcon} label="Stroke" /><input type="number" value={selectedElement.strokeWidth} onChange={(event) => updateSelectedElement((element) => element.type === "line" ? { ...element, strokeWidth: clampNumber(Number(event.target.value), 1, 60) } : element)} /></label>
                      </div>
                    ) : null}

                    {selectedElement.type === "asset" ? (
                      <div className="loyalty-inspector-form">
                        <InspectorSection icon={ImageAdd01Icon} label="Asset" />
                        <label className="field field--icon"><IconLabel icon={ImageAdd01Icon} label="Asset ID" /><input value={selectedElement.assetId} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, assetId: event.target.value } : element)} /></label>
                        <ImageUrlField label="Image URL" value={selectedElement.imageUrl} context={{ face: activeFace, field: "asset.imageUrl", elementId: selectedElement.id, currentUrl: selectedElement.imageUrl }} onChange={(imageUrl) => updateSelectedElement((element) => element.type === "asset" ? { ...element, imageUrl } : element)} onUploadImage={onUploadImage} onImportImageUrl={onImportImageUrl} />
                        <label className="field field--icon"><IconLabel icon={Resize01Icon} label="Fit" /><select value={selectedElement.fit} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, fit: event.target.value as "cover" | "contain" | "crop", cropX: element.cropX || 0, cropY: element.cropY || 0, cropScale: element.cropScale || 1 } : element)}><option value="contain">Contain</option><option value="cover">Cover</option><option value="crop">Crop</option></select></label>
                        <div className="field field--icon"><IconLabel icon={Resize01Icon} label="Aspect ratio" /><RatioLockButton locked={selectedElement.lockAspectRatio ?? true} onToggle={() => updateSelectedElement((element) => element.type === "asset" ? { ...element, lockAspectRatio: !(element.lockAspectRatio ?? true) } : element)} /></div>
                        {selectedElement.fit === "crop" ? (
                          <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                            <label className="field field--icon"><IconLabel icon={Move01Icon} label="Crop X" /><input type="number" value={selectedElement.cropX || 0} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, cropX: clampNumber(Number(event.target.value), -CANVAS_WIDTH, CANVAS_WIDTH) } : element)} /></label>
                            <label className="field field--icon"><IconLabel icon={Move01Icon} label="Crop Y" /><input type="number" value={selectedElement.cropY || 0} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, cropY: clampNumber(Number(event.target.value), -CANVAS_HEIGHT, CANVAS_HEIGHT) } : element)} /></label>
                            <label className="field field--icon"><IconLabel icon={Resize01Icon} label="Crop scale" /><input type="number" step="0.05" value={selectedElement.cropScale || 1} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, cropScale: clampNumber(Number(event.target.value), 0.1, 5) } : element)} /></label>
                          </div>
                        ) : null}
                        <InspectorSection icon={SparklesIcon} label="Image effects" />
                        <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                          <label className="field field--icon"><IconLabel icon={SparklesIcon} label="Preset" /><select value={selectedElement.filterPreset || "none"} onChange={(event) => updateSelectedElement((element) => {
                            if (element.type !== "asset") return element;
                            const presetKey = event.target.value as ImageFilterPresetKey;
                            const preset = imageFilterPresets[presetKey] || imageFilterPresets.none;
                            return { ...element, filterPreset: presetKey, filterBrightness: preset.filterBrightness, filterContrast: preset.filterContrast, filterSaturation: preset.filterSaturation, filterHue: preset.filterHue, filterSepia: preset.filterSepia, filterGrayscale: preset.filterGrayscale, filterInvert: preset.filterInvert, filterBlur: preset.filterBlur };
                          })}>{Object.entries(imageFilterPresets).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}</select></label>
                          <label className="field field--icon"><IconLabel icon={Sun02Icon} label="Brightness" /><input type="number" step="0.05" value={selectedElement.filterBrightness ?? 1} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, filterPreset: "none", filterBrightness: clampNumber(Number(event.target.value), 0, 2) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={ContrastIcon} label="Contrast" /><input type="number" step="0.05" value={selectedElement.filterContrast ?? 1} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, filterPreset: "none", filterContrast: clampNumber(Number(event.target.value), 0, 2) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={DropletsIcon} label="Saturation" /><input type="number" step="0.05" value={selectedElement.filterSaturation ?? 1} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, filterPreset: "none", filterSaturation: clampNumber(Number(event.target.value), 0, 3) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={Rotate01Icon} label="Hue" /><input type="number" value={selectedElement.filterHue ?? 0} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, filterPreset: "none", filterHue: clampNumber(Number(event.target.value), -180, 180) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={ColorPickerIcon} label="Sepia" /><input type="number" step="0.05" value={selectedElement.filterSepia ?? 0} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, filterPreset: "none", filterSepia: clampNumber(Number(event.target.value), 0, 1) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={ColorsIcon} label="Grayscale" /><input type="number" step="0.05" value={selectedElement.filterGrayscale ?? 0} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, filterPreset: "none", filterGrayscale: clampNumber(Number(event.target.value), 0, 1) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={FilterResetIcon} label="Invert" /><input type="number" step="0.05" value={selectedElement.filterInvert ?? 0} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, filterPreset: "none", filterInvert: clampNumber(Number(event.target.value), 0, 1) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={BlurIcon} label="Blur" /><input type="number" step="0.5" value={selectedElement.filterBlur ?? 0} onChange={(event) => updateSelectedElement((element) => element.type === "asset" ? { ...element, filterPreset: "none", filterBlur: clampNumber(Number(event.target.value), 0, 20) } : element)} /></label>
                        </div>
                        <ColorField label="Tint" value={selectedElement.tint} onChange={(color) => updateSelectedElement((element) => element.type === "asset" ? { ...element, tint: color } : element)} fallback="#111827" />
                      </div>
                    ) : null}

                    {selectedElement.type === "stampGrid" ? (
                      <div className="loyalty-inspector-form">
                        <InspectorSection icon={GridTableIcon} label="Stamp grid" />
                        <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                          <label className="field field--icon"><IconLabel icon={RowInsertIcon} label="Rows" /><input type="number" value={Math.max(1, Math.ceil(selectedElement.count / selectedElement.columns))} onChange={(event) => updateSelectedElement((element) => {
                            if (element.type !== "stampGrid") return element;
                            const rows = clampNumber(Number(event.target.value), 1, 12);
                            const count = clampNumber(rows * element.columns, 1, 100);
                            return { ...element, count };
                          })} /></label>
                          <label className="field field--icon"><IconLabel icon={ColumnInsertIcon} label="Columns" /><input type="number" value={selectedElement.columns} onChange={(event) => updateSelectedElement((element) => {
                            if (element.type !== "stampGrid") return element;
                            const columns = clampNumber(Number(event.target.value), 1, 12);
                            return { ...element, columns };
                          })} /></label>
                          <label className="field field--icon"><IconLabel icon={GridTableIcon} label="Preview count" /><input type="number" value={selectedElement.count} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, count: clampNumber(Number(event.target.value), 1, 100) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={GridTableIcon} label="Gap" /><input type="number" value={selectedElement.gap} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, gap: clampNumber(Number(event.target.value), 0, 80) } : element)} /></label>
                        </div>

                        <label className="field field--icon"><IconLabel icon={TypeCursorIcon} label="Total token" /><input value={selectedElement.countToken} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, countToken: event.target.value } : element)} /></label>
                        <label className="field field--icon"><IconLabel icon={TypeCursorIcon} label="Filled token" /><input value={selectedElement.filledToken || "{{stampsCollected}}"} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, filledToken: event.target.value } : element)} /></label>
                        <label className="field field--icon"><IconLabel icon={TypeCursorIcon} label="Stamp data token" /><input value={selectedElement.stampDataToken || "{{stamps}}"} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, stampDataToken: event.target.value } : element)} /></label>

                        <InspectorSection icon={CircleIcon} label="Empty" />
                        <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                          <label className="field field--icon"><IconLabel icon={ShapeCollectionIcon} label="Empty mode" /><select value={selectedElement.emptyMode || "shape"} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, emptyMode: event.target.value as "shape" | "image" } : element)}><option value="shape">Shape</option><option value="image">Image/SVG</option></select></label>
                          <label className="field field--icon"><IconLabel icon={CircleIcon} label="Empty shape" /><select value={selectedElement.emptyShape || selectedElement.shape} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, emptyShape: event.target.value as "circle" | "rounded_square" | "heart", shape: event.target.value as "circle" | "rounded_square" | "heart" } : element)}><option value="circle">Circle</option><option value="rounded_square">Rounded square</option><option value="heart">Heart</option></select></label>
                          <ColorField label="Empty fill" value={selectedElement.emptyFill || selectedElement.fill} onChange={(color) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, emptyFill: color, fill: color } : element)} fallback="#FFFFFF" />
                          <ColorField label="Empty stroke" value={selectedElement.emptyStroke || selectedElement.stroke} onChange={(color) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, emptyStroke: color, stroke: color } : element)} fallback="#111827" />
                          <label className="field field--icon"><IconLabel icon={BorderFullIcon} label="Empty stroke width" /><input type="number" value={selectedElement.emptyStrokeWidth ?? 2} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, emptyStrokeWidth: clampNumber(Number(event.target.value), 0, 24) } : element)} /></label>
                          <ImageUrlField label="Empty image URL" value={selectedElement.emptyImageUrl || ""} context={{ face: activeFace, field: "stampGrid.emptyImageUrl", elementId: selectedElement.id, currentUrl: selectedElement.emptyImageUrl || "" }} onChange={(emptyImageUrl) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, emptyImageUrl, emptyMode: emptyImageUrl.trim() ? "image" : element.emptyMode } : element)} onUploadImage={onUploadImage} onImportImageUrl={onImportImageUrl} />
                        </div>

                        <InspectorSection icon={SparklesIcon} label="Filled" />
                        <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                          <label className="field field--icon"><IconLabel icon={ShapeCollectionIcon} label="Filled mode" /><select value={selectedElement.filledMode || "shape"} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, filledMode: event.target.value as "shape" | "image" } : element)}><option value="shape">Shape</option><option value="image">Image/SVG</option></select></label>
                          <label className="field field--icon"><IconLabel icon={CircleIcon} label="Filled shape" /><select value={selectedElement.filledShape || selectedElement.shape} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, filledShape: event.target.value as "circle" | "rounded_square" | "heart" } : element)}><option value="circle">Circle</option><option value="rounded_square">Rounded square</option><option value="heart">Heart</option></select></label>
                          <ColorField label="Filled fill" value={selectedElement.filledFill || selectedElement.stroke} onChange={(color) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, filledFill: color } : element)} fallback="#F97316" />
                          <ColorField label="Filled stroke" value={selectedElement.filledStroke || selectedElement.stroke} onChange={(color) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, filledStroke: color } : element)} fallback="#F97316" />
                          <label className="field field--icon"><IconLabel icon={BorderFullIcon} label="Filled stroke width" /><input type="number" value={selectedElement.filledStrokeWidth ?? 2} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, filledStrokeWidth: clampNumber(Number(event.target.value), 0, 24) } : element)} /></label>
                          <ImageUrlField label="Filled image URL" value={selectedElement.filledImageUrl || ""} context={{ face: activeFace, field: "stampGrid.filledImageUrl", elementId: selectedElement.id, currentUrl: selectedElement.filledImageUrl || "" }} onChange={(filledImageUrl) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, filledImageUrl, filledMode: filledImageUrl.trim() ? "image" : element.filledMode } : element)} onUploadImage={onUploadImage} onImportImageUrl={onImportImageUrl} />
                        </div>

                        <InspectorSection icon={Timer01Icon} label="Metadata & motion" />
                        <div className="loyalty-inspector-form loyalty-inspector-form--grid">
                          <label className="field field--icon"><IconLabel icon={Resize01Icon} label="Image fit" /><select value={selectedElement.imageFit || "contain"} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, imageFit: event.target.value as "contain" | "cover" | "fill" } : element)}><option value="contain">Contain</option><option value="cover">Cover</option><option value="fill">Fill</option></select></label>
                          <label className="field field--icon"><IconLabel icon={RadiusIcon} label="Image inset" /><input type="number" value={selectedElement.imageInset ?? 0} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, imageInset: clampNumber(Number(event.target.value), 0, 80) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={CalendarCheckIcon} label="Show dates" /><select value={selectedElement.showStampDates === false ? "false" : "true"} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, showStampDates: event.target.value === "true" } : element)}><option value="true">Yes</option><option value="false">No</option></select></label>
                          <label className="field field--icon"><IconLabel icon={Clock01Icon} label="Date format" /><select value={selectedElement.dateFormat || "short"} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, dateFormat: event.target.value as "short" | "medium" | "relative" } : element)}><option value="short">Short</option><option value="medium">Medium</option><option value="relative">Relative</option></select></label>
                          <label className="field field--icon"><IconLabel icon={SparklesIcon} label="Animation" /><select value={selectedElement.animation || "none"} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, animation: event.target.value as "none" | "pop" | "stamp" | "bounce" } : element)}><option value="none">None</option><option value="pop">Pop</option><option value="stamp">Stamp</option><option value="bounce">Bounce</option></select></label>
                          <label className="field field--icon"><IconLabel icon={Timer01Icon} label="Duration ms" /><input type="number" value={selectedElement.animationDuration ?? 420} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, animationDuration: clampNumber(Number(event.target.value), 0, 3000) } : element)} /></label>
                          <label className="field field--icon"><IconLabel icon={Timer01Icon} label="Stagger ms" /><input type="number" value={selectedElement.animationStagger ?? 45} onChange={(event) => updateSelectedElement((element) => element.type === "stampGrid" ? { ...element, animationStagger: clampNumber(Number(event.target.value), 0, 500) } : element)} /></label>
                        </div>
                      </div>
                    ) : null}

                    <div className="loyalty-layer-actions">
                      <button type="button" onClick={handleUngroupSelected} disabled={selectedGroupIds.length === 0}>Ungroup</button>
                      <button type="button" onClick={() => handleLayerEdge("front")} disabled={Boolean(selectedElement.locked)}><BringToFront size={14} />Front</button>
                      <button type="button" onClick={() => handleLayerStep("up")} disabled={Boolean(selectedElement.locked)}><ArrowUp size={14} />Forward</button>
                      <button type="button" onClick={() => handleLayerStep("down")} disabled={Boolean(selectedElement.locked)}><ArrowDown size={14} />Back</button>
                      <button type="button" onClick={() => handleLayerEdge("back")} disabled={Boolean(selectedElement.locked)}><SendToBack size={14} />Behind</button>
                      <button type="button" className="loyalty-danger-button" onClick={handleDeleteElement} disabled={Boolean(selectedElement.locked)}><Trash2 size={14} />Delete</button>
                    </div>
                  </>
                ) : (
                  <div className="loyalty-inspector-empty">Select an item on the card to edit it.</div>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
