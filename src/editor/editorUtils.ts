import { findLoyaltyCardFont, legacyLoyaltyCardFontMap } from "../fonts.js";
import type { LoyaltyCardFontCatalogItem } from "../fonts.js";
import { normalizeLoyaltyCardLayerOrder } from "../normalize.js";
import { LOYALTY_CARD_CANVAS_HEIGHT, LOYALTY_CARD_CANVAS_WIDTH, LOYALTY_CARD_FACE_KEYS, resolveLoyaltyCardToken } from "../schema.js";
import type {
  LoyaltyCardBackground,
  LoyaltyCardDesignSchema,
  LoyaltyCardElement,
  LoyaltyCardFaceKey,
  LoyaltyCardPresetRecord,
  LoyaltyCardStampGridElement,
  LoyaltyCardTextElement,
  LoyaltyCardTokens,
} from "../schema.js";
import { resolveStampGridCount, resolveStampGridRows } from "../stampGridLayout.js";

export const CANVAS_WIDTH = LOYALTY_CARD_CANVAS_WIDTH;
export const CANVAS_HEIGHT = LOYALTY_CARD_CANVAS_HEIGHT;
export const HISTORY_LIMIT = 80;
export const MAX_FILLED_STAMP_PRESETS = 5;
export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
export const CSS_FONT_WEIGHT_MIN = 1;
export const CSS_FONT_WEIGHT_MAX = 1000;

export const FACE_LABELS: Record<LoyaltyCardFaceKey, string> = {
  front: "Front",
  back: "Back",
  reward: "Reward",
};

export const FACE_SIDE_LABELS: Record<LoyaltyCardFaceKey, string> = {
  front: "Front of the card",
  back: "Back of the card",
  reward: "Reward side",
};

export const imageFilterPresets = {
  none: { label: "None", filterBrightness: 1, filterContrast: 1, filterSaturation: 1, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  monochrome: { label: "Mono", filterBrightness: 1, filterContrast: 1, filterSaturation: 0, filterHue: 0, filterSepia: 0, filterGrayscale: 1, filterInvert: 0, filterBlur: 0 },
  invert: { label: "Invert", filterBrightness: 1, filterContrast: 1, filterSaturation: 1, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 1, filterBlur: 0 },
  warm: { label: "Warm", filterBrightness: 1, filterContrast: 1, filterSaturation: 1.12, filterHue: 8, filterSepia: 0.12, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  cool: { label: "Cool", filterBrightness: 1, filterContrast: 1, filterSaturation: 1.08, filterHue: -12, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  vintage: { label: "Vintage", filterBrightness: 1, filterContrast: 0.92, filterSaturation: 0.72, filterHue: 0, filterSepia: 0.35, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  dramatic: { label: "Drama", filterBrightness: 0.92, filterContrast: 1.28, filterSaturation: 1.12, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
} as const;
export type ImageFilterPresetKey = keyof typeof imageFilterPresets;

export function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function createElementId(type: string) {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------- Colours ---------- */

function clampColorAlpha(value: number) {
  return Math.round(clampNumber(value, 0, 100));
}

export function expandHexColor(value: string) {
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

export function hexToAlpha(hex: string | undefined) {
  if (!hex) return 100;
  return Math.round((parseInt(hex, 16) / 255) * 100);
}

export function parseColor(value: string | undefined, fallback = "#000000") {
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

export function formatColor(hex: string, alpha: number) {
  const parsed = parseColor(hex);
  const nextAlpha = clampColorAlpha(alpha);
  return nextAlpha >= 100 ? parsed.hex : `${parsed.hex}${alphaToHex(nextAlpha)}`;
}

export function colorLuminance(value: string | undefined) {
  const { hex } = parseColor(value, "#FFFFFF");
  const channel = (start: number) => {
    const c = parseInt(hex.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function backgroundBaseColor(background: LoyaltyCardBackground | null | undefined) {
  if (!background) return "#FFFFFF";
  if (background.type === "gradient") return background.colors[0] || "#111827";
  return background.color;
}

/** Text colour that reads well on the given face background. */
export function contrastingTextColor(background: LoyaltyCardBackground | null | undefined) {
  return colorLuminance(backgroundBaseColor(background)) < 0.4 ? "#FCE9D2" : "#181311";
}

export function collectFaceColors(background: LoyaltyCardBackground | null | undefined, elements: LoyaltyCardElement[]) {
  const colors: string[] = [];
  const push = (value: string | undefined) => {
    if (!value || !expandHexColor(value)) return;
    const hex = parseColor(value).hex;
    if (!colors.includes(hex)) colors.push(hex);
  };
  if (background?.type === "gradient") background.colors.forEach(push);
  else if (background) push(background.color);
  elements.forEach((element) => {
    if (element.type === "text") push(element.color);
    if (element.type === "shape") {
      push(element.fill);
      if (element.strokeWidth > 0) push(element.stroke);
    }
    if (element.type === "line") push(element.color);
    if (element.type === "stampGrid") {
      push(element.filledFill || element.stroke);
      push(element.emptyFill || element.fill);
      push(element.emptyStroke || element.stroke);
    }
  });
  return colors.slice(0, 8);
}

/* ---------- Faces and elements ---------- */

export function withFace(schema: LoyaltyCardDesignSchema, face: LoyaltyCardFaceKey, elements: LoyaltyCardElement[]): LoyaltyCardDesignSchema {
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

export function updateElement(schema: LoyaltyCardDesignSchema, face: LoyaltyCardFaceKey, elementId: string, updater: (element: LoyaltyCardElement) => LoyaltyCardElement) {
  return withFace(
    schema,
    face,
    schema.faces[face].elements.map((element) => (element.id === elementId ? updater(element) : element)),
  );
}

export function defaultBackground(type: LoyaltyCardBackground["type"], current?: LoyaltyCardBackground): LoyaltyCardBackground {
  if (type === "gradient") {
    if (current?.type === "gradient") return current;
    const baseColor = current?.type === "solid" || current?.type === "image" ? current.color : "#111827";
    return { type, colors: [baseColor, "#F45925"], angle: 135 };
  }
  if (type === "image") {
    if (current?.type === "image") return current;
    const baseColor = current?.type === "solid" ? current.color : current?.type === "gradient" ? current.colors[0] || "#111827" : "#111827";
    return { type, color: baseColor, imageUrl: "", fit: "cover", alignX: "center", alignY: "center", x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, opacity: 1 };
  }
  const color = current?.type === "solid" || current?.type === "image" ? current.color : current?.type === "gradient" ? current.colors[0] || "#111827" : "#111827";
  return { type: "solid", color };
}

export type CardField = {
  key: string;
  token: string;
  label: string;
  fallback: string;
  emptyLabel: string;
  describe: string;
};

export const CARD_FIELDS: CardField[] = [
  { key: "venueName", token: "{{venueName}}", label: "Venue name", fallback: "Your café", emptyLabel: "If the venue has no name, show", describe: "Shows the venue's name" },
  { key: "tierName", token: "{{tierName}}", label: "Tier", fallback: "Member", emptyLabel: "If there is no tier, show", describe: "Shows the member's tier" },
  { key: "rewardTitle", token: "{{rewardTitle}}", label: "Reward", fallback: "Free coffee", emptyLabel: "If there is no reward, show", describe: "Shows the reward" },
  { key: "rewardDescription", token: "{{rewardDescription}}", label: "Reward details", fallback: "Enjoy this reward on your next visit.", emptyLabel: "If there are no details, show", describe: "Shows the reward details" },
  { key: "stampsCollected", token: "{{stampsCollected}}", label: "Stamps collected", fallback: "0", emptyLabel: "If there is no count, show", describe: "Shows the stamps collected" },
  { key: "stampsRequired", token: "{{stampsRequired}}", label: "Stamp total", fallback: "10", emptyLabel: "If there is no total, show", describe: "Shows the stamps needed" },
];

const TOKEN_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function findCardField(key: string) {
  return CARD_FIELDS.find((field) => field.key === key) || null;
}

export function singleTokenKey(value: string | undefined) {
  return String(value || "").trim().match(/^{{\s*([a-zA-Z0-9_]+)\s*}}$/)?.[1] || "";
}

export function tokenKeysIn(value: string | undefined) {
  return Array.from(String(value || "").matchAll(TOKEN_PATTERN)).map((match) => match[1]);
}

export function tokenFieldLabel(key: string) {
  return findCardField(key)?.label || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
}

/** The small tag shown above selected text that comes from a card field. */
export function textFieldTag(element: LoyaltyCardTextElement) {
  const key = singleTokenKey(element.token);
  if (key) return tokenFieldLabel(key);
  const keys = tokenKeysIn(element.token);
  if (keys.length === 2 && keys.includes("stampsCollected") && keys.includes("stampsRequired")) return "Stamp progress";
  if (keys.length) return "Card fields";
  return "";
}

export function textSubtitle(element: LoyaltyCardTextElement) {
  const key = singleTokenKey(element.token);
  if (key) return findCardField(key)?.describe || `Shows ${tokenFieldLabel(key).toLowerCase()}`;
  if (tokenKeysIn(element.token).length) return "Text with card fields";
  return "Plain text";
}

export function previewText(value: string | undefined, tokens: LoyaltyCardTokens, max = 28) {
  const text = resolveLoyaltyCardToken(value, tokens).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function elementTypeLabel(element: LoyaltyCardElement) {
  if (element.type === "text") return "Text";
  if (element.type === "asset") return "Image";
  if (element.type === "line") return "Line";
  if (element.type === "stampGrid") return "Stamp grid";
  if (element.shape === "circle") return "Circle";
  if (element.shape === "blob") return "Blob";
  return "Rectangle";
}

export function stampGridSummary(element: LoyaltyCardStampGridElement) {
  const count = resolveStampGridCount(element);
  const rows = resolveStampGridRows(element).length;
  return `${count} stamp${count === 1 ? "" : "s"} in ${rows} row${rows === 1 ? "" : "s"}`;
}

export function elementLabel(element: LoyaltyCardElement, tokens: LoyaltyCardTokens) {
  if (element.name?.trim()) return element.name.trim();
  if (element.type === "text") {
    const key = singleTokenKey(element.token);
    if (key) return tokenFieldLabel(key);
    return previewText(element.token || element.fallbackText, tokens, 24) || "Text";
  }
  return elementTypeLabel(element);
}

export function elementSubtitle(element: LoyaltyCardElement, tokens: LoyaltyCardTokens) {
  if (element.type === "text") {
    const preview = previewText(element.token, tokens, 26);
    return element.name?.trim() || singleTokenKey(element.token) ? preview || textSubtitle(element) : textSubtitle(element);
  }
  if (element.type === "stampGrid") {
    const count = resolveStampGridCount(element);
    return `${count} stamp${count === 1 ? "" : "s"}`;
  }
  if (element.type === "asset") return element.name?.trim() ? "Image" : element.imageUrl ? "Picture" : "No picture yet";
  if (element.type === "shape" || element.type === "line") return element.name?.trim() ? elementTypeLabel(element) : "Shape";
  return "";
}

type TextPreset = "heading" | "subheading" | "body";

type CreateOptions = {
  shape?: "rect" | "circle" | "blob";
  textPreset?: TextPreset;
  token?: string;
  fallbackText?: string;
  name?: string;
  color?: string;
  imageUrl?: string;
};

function centered(width: number, height: number) {
  return { x: Math.round((CANVAS_WIDTH - width) / 2), y: Math.round((CANVAS_HEIGHT - height) / 2) };
}

const textPresets: Record<TextPreset, { token: string; fontKey: string; fontFamily: string; fontSize: number; fontWeight: number; lineHeight: number; letterSpacing: number; width: number; height: number }> = {
  heading: { token: "Add a heading", fontKey: "playfair-display", fontFamily: "Playfair Display", fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: -0.5, width: 560, height: 90 },
  subheading: { token: "Add a subheading", fontKey: "plus-jakarta-sans", fontFamily: "Plus Jakarta Sans", fontSize: 32, fontWeight: 600, lineHeight: 1.15, letterSpacing: 0, width: 440, height: 52 },
  body: { token: "Add body text", fontKey: "plus-jakarta-sans", fontFamily: "Plus Jakarta Sans", fontSize: 22, fontWeight: 400, lineHeight: 1.35, letterSpacing: 0, width: 420, height: 40 },
};

export function createElement(type: LoyaltyCardElement["type"], zIndex: number, options: CreateOptions = {}): LoyaltyCardElement {
  const id = createElementId(type);
  if (type === "text") {
    const preset = textPresets[options.textPreset || (options.token ? "subheading" : "body")];
    const position = centered(preset.width, preset.height);
    return {
      id,
      type,
      ...(options.name ? { name: options.name } : {}),
      ...position,
      width: preset.width,
      height: preset.height,
      rotation: 0,
      opacity: 1,
      zIndex,
      token: options.token ?? preset.token,
      fallbackText: options.fallbackText ?? "",
      fontSource: "catalog",
      fontKey: preset.fontKey,
      fontFamily: preset.fontFamily,
      fontUrl: "",
      fontStyle: "normal",
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      lineHeight: preset.lineHeight,
      letterSpacing: preset.letterSpacing,
      textTransform: "none",
      color: options.color || "#181311",
      align: "left",
      verticalAlign: "center",
      textStrokeColor: "#000000",
      textStrokeWidth: 0,
    };
  }

  if (type === "asset") {
    const size = { width: 220, height: 220 };
    return { id, type, ...centered(size.width, size.height), ...size, rotation: 0, opacity: 1, zIndex, assetId: "image", imageUrl: options.imageUrl || "", fit: "contain", cropX: 0, cropY: 0, cropScale: 1, filterPreset: "none", filterBrightness: 1, filterContrast: 1, filterSaturation: 1, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0, lockAspectRatio: true, tint: "#111827" };
  }

  if (type === "shape") {
    const shape = options.shape || "rect";
    const size = shape === "circle" ? { width: 160, height: 160 } : shape === "blob" ? { width: 180, height: 180 } : { width: 260, height: 120 };
    return { id, type, ...centered(size.width, size.height), ...size, rotation: 0, opacity: 1, zIndex, shape, fill: options.color || "#F45925", stroke: "", strokeWidth: 0, radius: shape === "circle" ? 999 : 24, lockAspectRatio: shape === "circle" || shape === "blob" };
  }

  if (type === "line") {
    const size = { width: 320, height: 8 };
    return { id, type, ...centered(size.width, size.height), ...size, rotation: 0, opacity: 1, zIndex, color: options.color || "#181311", strokeWidth: 4 };
  }

  const size = { width: 344, height: 160 };
  return { id, type: "stampGrid", ...centered(size.width, size.height), ...size, rotation: 0, opacity: 1, zIndex, columns: 5, count: 10, stampRows: [{ count: 5, align: "center" }, { count: 5, align: "center" }], countToken: "", filledToken: "", stampDataToken: "{{stamps}}", shape: "circle", emptyMode: "shape", emptyShape: "circle", emptyFill: "#FFFFFF", emptyStroke: "#181311", emptyStrokeWidth: 2, emptyImageUrl: "", filledMode: "shape", filledShape: "circle", filledFill: "#F45925", filledStroke: "#F45925", filledStrokeWidth: 2, filledImageUrl: "", filledImageUrls: [], filledScale: 1, filledComposition: "overlay", filledRandomRotation: 45, stampSize: 56, previewFilledMode: "auto", autoFitContainer: false, horizontalAlign: "center", verticalAlign: "top", imageFit: "contain", imageInset: 6, showStampDates: true, dateFormat: "short", animation: "stamp", animationDuration: 420, animationStagger: 45, stroke: "#181311", fill: "#FFFFFF", gap: 16 };
}

/* ---------- Layers ---------- */

function orderedBottomFirst(elements: LoyaltyCardElement[]) {
  return normalizeLoyaltyCardLayerOrder(elements).sort((a, b) => a.zIndex - b.zIndex || elements.findIndex((element) => element.id === a.id) - elements.findIndex((element) => element.id === b.id));
}

function applyOrder(elements: LoyaltyCardElement[], ordered: LoyaltyCardElement[]) {
  const zIndexById = new Map(ordered.map((element, index) => [element.id, index + 1]));
  return normalizeLoyaltyCardLayerOrder(elements.map((element) => ({ ...element, zIndex: zIndexById.get(element.id) || element.zIndex } as LoyaltyCardElement)));
}

export function moveLayer(elements: LoyaltyCardElement[], selectedElementId: string, direction: "up" | "down") {
  const ordered = orderedBottomFirst(elements);
  const selectedIndex = ordered.findIndex((element) => element.id === selectedElementId);
  const swapIndex = direction === "up" ? selectedIndex + 1 : selectedIndex - 1;
  if (selectedIndex < 0 || swapIndex < 0 || swapIndex >= ordered.length) return ordered;
  [ordered[selectedIndex], ordered[swapIndex]] = [ordered[swapIndex], ordered[selectedIndex]];
  return applyOrder(elements, ordered);
}

export function moveLayerToEdge(elements: LoyaltyCardElement[], selectedElementId: string, edge: "front" | "back") {
  const ordered = orderedBottomFirst(elements);
  const selectedIndex = ordered.findIndex((element) => element.id === selectedElementId);
  if (selectedIndex < 0) return ordered;
  const [selected] = ordered.splice(selectedIndex, 1);
  if (edge === "front") ordered.push(selected);
  else ordered.unshift(selected);
  return applyOrder(elements, ordered);
}

export function reorderLayer(elements: LoyaltyCardElement[], draggedElementId: string, targetElementId: string) {
  if (draggedElementId === targetElementId) return elements;
  const orderedTopFirst = normalizeLoyaltyCardLayerOrder(elements).sort((a, b) => b.zIndex - a.zIndex || elements.findIndex((element) => element.id === a.id) - elements.findIndex((element) => element.id === b.id));
  const draggedIndex = orderedTopFirst.findIndex((element) => element.id === draggedElementId);
  const targetIndex = orderedTopFirst.findIndex((element) => element.id === targetElementId);
  if (draggedIndex < 0 || targetIndex < 0) return elements;
  const [dragged] = orderedTopFirst.splice(draggedIndex, 1);
  orderedTopFirst.splice(targetIndex, 0, dragged);
  return applyOrder(elements, [...orderedTopFirst].reverse());
}

export function lockedLayerOrderChanged(currentElements: LoyaltyCardElement[], nextElements: LoyaltyCardElement[]) {
  const nextById = new Map(nextElements.map((element) => [element.id, element]));
  return currentElements.some((element) => element.locked && nextById.get(element.id)?.zIndex !== element.zIndex);
}

/* ---------- Alignment ---------- */

function rotatedElementBounds(element: LoyaltyCardElement) {
  const radians = ((element.rotation || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = element.width * cos + element.height * sin;
  const height = element.width * sin + element.height * cos;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  return { left: centerX - width / 2, top: centerY - height / 2, right: centerX + width / 2, bottom: centerY + height / 2, width, height };
}

function elementFrameBounds(elements: LoyaltyCardElement[]) {
  const bounds = elements.map(rotatedElementBounds);
  const left = Math.min(...bounds.map((bound) => bound.left));
  const top = Math.min(...bounds.map((bound) => bound.top));
  const right = Math.max(...bounds.map((bound) => bound.right));
  const bottom = Math.max(...bounds.map((bound) => bound.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function elementsMoved(currentElements: LoyaltyCardElement[], nextElements: LoyaltyCardElement[]) {
  return nextElements.some((element, index) => element.x !== currentElements[index]?.x || element.y !== currentElements[index]?.y);
}

export function alignElements(elements: LoyaltyCardElement[], selectedIds: Set<string>, axis: "x" | "y", position: "start" | "center" | "end") {
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

export function centerElementsOnCanvas(elements: LoyaltyCardElement[], selectedIds: Set<string>) {
  const selected = elements.filter((element) => selectedIds.has(element.id));
  if (selected.length === 0) return elements;
  const bounds = elementFrameBounds(selected);
  const dx = CANVAS_WIDTH / 2 - (bounds.left + bounds.width / 2);
  const dy = CANVAS_HEIGHT / 2 - (bounds.top + bounds.height / 2);
  return elements.map((element) => selectedIds.has(element.id) ? { ...element, x: Math.round((element.x + dx) * 10) / 10, y: Math.round((element.y + dy) * 10) / 10 } as LoyaltyCardElement : element);
}

export function distributeElements(elements: LoyaltyCardElement[], selectedIds: Set<string>, axis: "x" | "y") {
  const selected = elements.filter((element) => selectedIds.has(element.id));
  if (selected.length < 3) return elements;
  const sorted = [...selected].sort((a, b) => {
    const aBounds = rotatedElementBounds(a);
    const bBounds = rotatedElementBounds(b);
    return axis === "x" ? aBounds.left - bBounds.left : aBounds.top - bBounds.top;
  });
  const allBounds = sorted.map(rotatedElementBounds);
  const start = Math.min(...allBounds.map((bounds) => (axis === "x" ? bounds.left : bounds.top)));
  const end = Math.max(...allBounds.map((bounds) => (axis === "x" ? bounds.right : bounds.bottom)));
  const totalSize = allBounds.reduce((sum, bounds) => sum + (axis === "x" ? bounds.width : bounds.height), 0);
  const gap = (end - start - totalSize) / (sorted.length - 1);
  const positions = new Map<string, number>();
  const place = (element: LoyaltyCardElement, center: number) => {
    const position = center - (axis === "x" ? element.width : element.height) / 2;
    positions.set(element.id, Math.round(position * 10) / 10);
  };
  if (gap >= 0) {
    // Equal gaps between the boxes, inside the selection's full extent.
    let cursor = start;
    sorted.forEach((element, index) => {
      const size = axis === "x" ? allBounds[index].width : allBounds[index].height;
      place(element, cursor + size / 2);
      cursor += size + gap;
    });
  } else {
    // Not enough room for gaps (the boxes overlap): space their centres evenly instead, keeping their order.
    const byCenter = sorted.map((element, index) => ({ element, center: axis === "x" ? (allBounds[index].left + allBounds[index].right) / 2 : (allBounds[index].top + allBounds[index].bottom) / 2 })).sort((a, b) => a.center - b.center);
    const first = byCenter[0].center;
    const step = (byCenter[byCenter.length - 1].center - first) / (byCenter.length - 1);
    byCenter.forEach(({ element }, index) => place(element, first + step * index));
  }
  return elements.map((element) => {
    const position = positions.get(element.id);
    if (position === undefined) return element;
    return axis === "x" ? { ...element, x: position } as LoyaltyCardElement : { ...element, y: position } as LoyaltyCardElement;
  });
}

/* ---------- History ---------- */

const sameJson = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>, skip: string[] = []) {
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter((key) => !skip.includes(key) && !sameJson(before[key], after[key]));
}

/**
 * Names what an edit changed ("front.title.fontSize", "record.name"). Undo merges a quick run of edits
 * only when they change the same things, so typing or dragging a slider is one step, but
 * "add heading" then "add body text" stay two.
 */
export function describeRecordChange(before: LoyaltyCardPresetRecord, after: LoyaltyCardPresetRecord) {
  const parts = changedKeys(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, ["designSchema"]).map((key) => `record.${key}`);
  const beforeSchema = before.designSchema as unknown as Record<string, unknown>;
  const afterSchema = after.designSchema as unknown as Record<string, unknown>;
  parts.push(...changedKeys(beforeSchema, afterSchema, ["faces"]).map((key) => `schema.${key}`));
  LOYALTY_CARD_FACE_KEYS.forEach((face) => {
    const beforeFace = before.designSchema.faces[face];
    const afterFace = after.designSchema.faces[face];
    if (beforeFace === afterFace) return;
    if (!sameJson(beforeFace?.background, afterFace?.background)) parts.push(`${face}.background`);
    if (!sameJson(beforeFace?.groups, afterFace?.groups)) parts.push(`${face}.groups`);
    const beforeElements = beforeFace?.elements || [];
    const afterElements = afterFace?.elements || [];
    const beforeIds = beforeElements.map((element) => element.id).sort().join(",");
    const afterIds = afterElements.map((element) => element.id).sort().join(",");
    if (beforeIds !== afterIds) {
      parts.push(`${face}.elements:${afterIds}`);
      return;
    }
    const beforeById = new Map(beforeElements.map((element) => [element.id, element]));
    afterElements.forEach((element) => {
      const previous = beforeById.get(element.id);
      if (!previous || previous === element) return;
      changedKeys(previous as unknown as Record<string, unknown>, element as unknown as Record<string, unknown>).forEach((key) => parts.push(`${face}.${element.id}.${key}`));
    });
  });
  return parts.sort().join("|");
}

/* ---------- Stamp rows ---------- */

export type StampRowDraft = { count: number; align: "left" | "center" | "right" };

/**
 * Replaces the grid's rows. Live data links stay: `filledToken` always, and `countToken`
 * unless the caller sets a fixed total (`fixedTotal`), because a live total would override the rows.
 */
export function stampRowsPatch(rows: StampRowDraft[], options: { fixedTotal?: boolean } = {}): Partial<LoyaltyCardStampGridElement> {
  const sanitizedRows = rows
    .map((row) => ({ count: clampNumber(Math.floor(Number(row.count) || 0), 0, 12), align: row.align || "center" }))
    .filter((row) => row.count > 0)
    .slice(0, 20);
  const count = clampNumber(sanitizedRows.reduce((sum, row) => sum + row.count, 0), 1, 100);
  return {
    stampRows: sanitizedRows,
    stampSlots: undefined,
    count,
    columns: Math.max(1, ...sanitizedRows.map((row) => row.count)),
    ...(options.fixedTotal ? { countToken: "" } : {}),
  };
}

function splitEvenly(total: number, parts: number) {
  const base = Math.floor(total / parts);
  const extra = total % parts;
  return Array.from({ length: parts }).map((_, index) => base + (index < extra ? 1 : 0));
}

export type StampArrangement = { id: string; label: string; rows: number[] };

export function stampArrangements(total: number): StampArrangement[] {
  const options: StampArrangement[] = [];
  const add = (id: string, rows: number[]) => {
    if (rows.some((count) => count < 1 || count > 12) || rows.length > 20) return;
    if (options.some((option) => option.rows.join(",") === rows.join(","))) return;
    options.push({ id, label: rows.every((count) => count === rows[0]) && rows.length > 2 ? `${rows[0]} × ${rows.length}` : rows.join(" + "), rows });
  };
  if (total <= 6) add("one-row", [total]);
  add("two-rows", splitEvenly(total, 2));
  if (total >= 6) add("three-rows", splitEvenly(total, 3));
  if (total >= 4) add("pairs", Array.from({ length: Math.ceil(total / 2) }).map((_, index) => Math.min(2, total - index * 2)));
  if (total > 6 && total <= 12 && options.length < 3) add("one-row", [total]);
  return options.slice(0, 3);
}

export function resizeStampRows(rows: StampRowDraft[], total: number): StampRowDraft[] {
  const target = clampNumber(Math.floor(total), 1, 100);
  const current = rows.reduce((sum, row) => sum + row.count, 0);
  const arrangement = stampArrangements(current).find((option) => option.rows.join(",") === rows.map((row) => row.count).join(","));
  if (arrangement) {
    const next = stampArrangements(target).find((option) => option.id === arrangement.id) || stampArrangements(target)[0];
    if (next) return next.rows.map((count, index) => ({ count, align: rows[index]?.align || rows[rows.length - 1]?.align || "center" }));
  }
  const next = rows.map((row) => ({ ...row }));
  let difference = target - current;
  while (difference > 0) {
    const last = next[next.length - 1];
    if (last && last.count < 12) last.count += 1;
    else if (next.length < 20) next.push({ count: 1, align: last?.align || "center" });
    else {
      // 20 rows is the limit: fill the nearest row from the bottom that still has room.
      const roomy = [...next].reverse().find((row) => row.count < 12);
      if (!roomy) break;
      roomy.count += 1;
    }
    difference -= 1;
  }
  while (difference < 0 && next.length) {
    const last = next[next.length - 1];
    last.count -= 1;
    if (last.count <= 0) next.pop();
    difference += 1;
  }
  return next.length ? next : [{ count: 1, align: "center" }];
}

/* ---------- Media ---------- */

export type MediaResult = string | { url?: string; cdnUrl?: string };

export function resolveMediaResultUrl(result: MediaResult) {
  return typeof result === "string" ? result : result.cdnUrl || result.url || "";
}

/* ---------- Fonts ---------- */

export function getTextFontKey(element: LoyaltyCardTextElement) {
  return element.fontKey || legacyLoyaltyCardFontMap[element.fontFamily]?.key || findLoyaltyCardFont(element.fontFamily)?.key || "outfit";
}

/** The family name to show for a text element. Older presets store keys like "display_serif". */
export function getTextFontFamily(element: LoyaltyCardTextElement) {
  if (element.fontSource === "customUrl" && element.fontFamily) return element.fontFamily;
  return legacyLoyaltyCardFontMap[element.fontFamily]?.family || element.fontFamily || findLoyaltyCardFont(getTextFontKey(element))?.family || "Outfit";
}

export function getTextFontWeight(element: LoyaltyCardTextElement) {
  const weight = Math.round(Number(element.fontWeight));
  return Number.isFinite(weight) ? clampNumber(weight, CSS_FONT_WEIGHT_MIN, CSS_FONT_WEIGHT_MAX) : 700;
}

export function withCurrentFontWeight(options: number[], weight: number, includeCurrent = true) {
  const sanitized = options.map((option) => Math.round(option)).filter((option) => option >= CSS_FONT_WEIGHT_MIN && option <= CSS_FONT_WEIGHT_MAX);
  const next = includeCurrent && !sanitized.includes(weight) ? [...sanitized, weight] : sanitized;
  return Array.from(new Set(next)).sort((a, b) => a - b);
}

export function getVariableFontWeightOptions(min = 100, max = 900, currentWeight = 400) {
  const safeMin = clampNumber(Math.round(Number(min)), CSS_FONT_WEIGHT_MIN, CSS_FONT_WEIGHT_MAX);
  const safeMax = clampNumber(Math.round(Number(max)), safeMin, CSS_FONT_WEIGHT_MAX);
  const firstStep = Math.ceil(safeMin / 100) * 100;
  const options: number[] = [];
  if (safeMin !== firstStep) options.push(safeMin);
  for (let weight = firstStep; weight <= safeMax; weight += 100) options.push(weight);
  if (!options.includes(safeMax)) options.push(safeMax);
  return withCurrentFontWeight(options, currentWeight, currentWeight >= safeMin && currentWeight <= safeMax);
}

export function formatFontWeightOption(weight: number) {
  const labels: Record<number, string> = { 100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra Bold", 900: "Black", 1000: "Extra Black" };
  return labels[weight] ? `${weight} ${labels[weight]}` : String(weight);
}

export function closestFontWeight(options: number[], weight: number) {
  return options.reduce((nearest, option) => (Math.abs(option - weight) < Math.abs(nearest - weight) ? option : nearest), options[0] || weight);
}

export function getTextFontStyle(element: LoyaltyCardTextElement): "normal" | "italic" {
  return element.fontStyle === "italic" ? "italic" : "normal";
}

export function withCurrentFontStyle(options: Array<"normal" | "italic">, style: "normal" | "italic", includeCurrent = true): Array<"normal" | "italic"> {
  const sanitized = options.filter((option): option is "normal" | "italic" => option === "normal" || option === "italic");
  const next = includeCurrent && !sanitized.includes(style) ? [...sanitized, style] : sanitized;
  return Array.from(new Set(next.length ? next : ["normal" as const]));
}

export function getFontPreviewWeight(font: LoyaltyCardFontCatalogItem) {
  return font.weights.includes(400)
    ? 400
    : font.weights.reduce((nearest, weight) => (Math.abs(weight - 400) < Math.abs(nearest - 400) ? weight : nearest), font.weights[0] || 400);
}

/* ---------- Time ---------- */

export function formatRelativeTime(value: string | number | Date | null | undefined, now = Date.now()) {
  if (value === null || value === undefined || value === "") return "";
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(time));
}
