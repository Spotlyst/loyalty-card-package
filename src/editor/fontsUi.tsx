import { Archive02Icon, ArrowLeft01Icon, CloudUploadIcon, Delete02Icon, MoreHorizontalIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { findLoyaltyCardFont, getLoyaltyCardFontCategoryLabel, loyaltyCardFontCatalog } from "../fonts.js";
import type { LoyaltyCardFontCatalogItem } from "../fonts.js";
import type { LoyaltyCardTextElement } from "../schema.js";
import {
  clampNumber,
  closestFontWeight,
  FONT_WEIGHTS,
  getFontPreviewWeight,
  getTextFontFamily,
  getTextFontKey,
  getTextFontStyle,
  getTextFontWeight,
  getVariableFontWeightOptions,
  withCurrentFontStyle,
  withCurrentFontWeight,
} from "./editorUtils.js";
import { Icon, IconButton, Menu, Modal, NumberInput, SelectField, TextInput, cx } from "./ui.js";

export type LoyaltyCardEditorUploadedFont = {
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

export type UploadFontHandler = (file: File, meta: { name: string; fontFamily: string; fontWeight: number; fontStyle: "normal" | "italic" }) => Promise<LoyaltyCardEditorUploadedFont>;

export type UploadedFontGroup = {
  id: string;
  family: string;
  fonts: LoyaltyCardEditorUploadedFont[];
};

const FONT_CATEGORIES = ["sans", "serif", "display", "script", "handwritten", "condensed", "retro", "luxury", "poster", "multilingual"] as const;
const loadedPreviewFontKeys = new Set<string>();
let previewFontPreconnectLoaded = false;

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

export function loadPreviewFont(font: LoyaltyCardFontCatalogItem) {
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

export function getUploadedFontUrl(font: LoyaltyCardEditorUploadedFont) {
  return font.fontUrl || font.cdnUrl || "";
}

function cssString(value: string) {
  return JSON.stringify(value.replace(/[\u0000-\u001F\u007F]/g, ""));
}

export function loadUploadedFontPreview(font: LoyaltyCardEditorUploadedFont) {
  const fontUrl = getUploadedFontUrl(font);
  if (!fontUrl || typeof document === "undefined") return;
  const key = `uploaded:${font.id}:${fontUrl}`;
  if (loadedPreviewFontKeys.has(key)) return;
  loadedPreviewFontKeys.add(key);
  const style = document.createElement("style");
  style.setAttribute("data-spotlyst-uploaded-font", font.id);
  const weightDescriptor = font.isVariable ? `${font.fontWeightMin || 100} ${font.fontWeightMax || 900}` : String(font.fontWeight || 400);
  style.textContent = `@font-face{font-family:${cssString(font.fontFamily)};src:url(${cssString(fontUrl)});font-style:${font.fontStyle || "normal"};font-weight:${weightDescriptor};font-display:swap;}`;
  document.head.appendChild(style);
}

function sortUploadedFontVariants(fonts: LoyaltyCardEditorUploadedFont[]) {
  return [...fonts].sort((a, b) => (a.fontStyle || "normal").localeCompare(b.fontStyle || "normal") || (a.fontWeight || 400) - (b.fontWeight || 400) || a.fontFamily.localeCompare(b.fontFamily));
}

function uploadedFontVariantLabel(font: LoyaltyCardEditorUploadedFont) {
  if (font.isVariable) return `Variable · ${font.fontWeightMin || 100}–${font.fontWeightMax || 900}${font.fontStyle === "italic" ? " italic" : ""}`;
  const weight = font.fontWeight || 400;
  const names: Record<number, string> = { 100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra Bold", 900: "Black" };
  const name = names[weight] || String(weight);
  return font.fontStyle === "italic" ? (weight === 400 ? "Italic" : `${name} Italic`) : name;
}

export function uploadedFontGroupSummary(fonts: LoyaltyCardEditorUploadedFont[]) {
  const variants = Array.from(new Set(sortUploadedFontVariants(fonts).map(uploadedFontVariantLabel)));
  if (variants.length <= 3) return variants.join(", ");
  return `${variants.slice(0, 3).join(", ")} +${variants.length - 3}`;
}

function normalizeFontName(value: string) {
  return String(value || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim() || "Uploaded font";
}

function stripTrailingFontVariant(value: string) {
  let next = normalizeFontName(value).replace(/\b(variable|vf)\b$/i, "").trim();
  const variantSuffix = /\s+(extra\s*light|ultra\s*light|extralight|ultralight|thin|hairline|light|regular|normal|medium|semi\s*bold|demi\s*bold|semibold|demibold|extra\s*bold|ultra\s*bold|extrabold|ultrabold|bold|black|heavy|italic|oblique)$/i;
  while (variantSuffix.test(next)) next = next.replace(variantSuffix, "").trim();
  return next || normalizeFontName(value);
}

export function uploadedFontFamilyKey(value: string) {
  // Keep letters and numbers from any script, so "明朝" and "ゴシック" stay separate families.
  return normalizeFontName(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "uploaded-font";
}

export function groupUploadedFonts(uploadedFonts: LoyaltyCardEditorUploadedFont[]): UploadedFontGroup[] {
  const groupsByKey = new Map<string, UploadedFontGroup>();
  const exactKeys = new Set(uploadedFonts.map((font) => uploadedFontFamilyKey(normalizeFontName(font.fontFamily || font.name))));
  const strippedCounts = new Map<string, number>();
  uploadedFonts.forEach((font) => {
    const strippedKey = uploadedFontFamilyKey(stripTrailingFontVariant(font.fontFamily || font.name));
    strippedCounts.set(strippedKey, (strippedCounts.get(strippedKey) || 0) + 1);
  });
  uploadedFonts.forEach((font) => {
    const exactFamily = normalizeFontName(font.fontFamily || font.name);
    const strippedFamily = stripTrailingFontVariant(exactFamily);
    const strippedKey = uploadedFontFamilyKey(strippedFamily);
    const exactKey = uploadedFontFamilyKey(exactFamily);
    const shouldGroupByStrippedFamily = strippedKey !== exactKey && ((strippedCounts.get(strippedKey) || 0) > 1 || exactKeys.has(strippedKey));
    const family = shouldGroupByStrippedFamily ? strippedFamily : exactFamily;
    const key = uploadedFontFamilyKey(family);
    const group = groupsByKey.get(key) || { id: key, family, fonts: [] };
    group.fonts.push(font);
    groupsByKey.set(key, group);
  });
  return Array.from(groupsByKey.values())
    .map((group) => ({ ...group, fonts: sortUploadedFontVariants(group.fonts) }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

export function chooseUploadedFontVariant(group: UploadedFontGroup, preferredWeight = 400, preferredStyle: "normal" | "italic" = "normal") {
  const sameStyle = group.fonts.filter((font) => (font.fontStyle || "normal") === preferredStyle);
  const candidates = sameStyle.length ? sameStyle : group.fonts;
  const variable = candidates.find((font) => font.isVariable && preferredWeight >= (font.fontWeightMin || 100) && preferredWeight <= (font.fontWeightMax || 900));
  if (variable) return variable;
  return candidates.reduce((nearest, font) => (Math.abs((font.fontWeight || 400) - preferredWeight) < Math.abs((nearest.fontWeight || 400) - preferredWeight) ? font : nearest), candidates[0]);
}

export function findUploadedFontGroupForElement(groups: UploadedFontGroup[], element: LoyaltyCardTextElement) {
  if (element.fontSource !== "customUrl") return null;
  return groups.find((group) => group.fonts.some((font) => font.id === element.fontKey) || uploadedFontFamilyKey(element.fontFamily) === group.id) || null;
}

export function getAvailableTextWeights(groups: UploadedFontGroup[], element: LoyaltyCardTextElement) {
  const currentWeight = getTextFontWeight(element);
  if (element.fontSource === "customUrl") {
    const group = findUploadedFontGroupForElement(groups, element);
    const preferredStyle = getTextFontStyle(element);
    const selectedFont = group?.fonts.find((font) => font.id === element.fontKey);
    const styleFonts = group?.fonts.filter((font) => (font.fontStyle || "normal") === preferredStyle) || [];
    const candidates = styleFonts.length ? styleFonts : group?.fonts || [];
    const variableFont = selectedFont?.isVariable ? selectedFont : candidates.find((font) => font.isVariable);
    if (variableFont || element.fontIsVariable) {
      const variableWeights = getVariableFontWeightOptions(variableFont?.fontWeightMin ?? element.fontWeightMin ?? 100, variableFont?.fontWeightMax ?? element.fontWeightMax ?? 900, currentWeight);
      // Static files of the same style (say a separate Bold) add the weights the variable file doesn't cover.
      const extraWeights = candidates.filter((font) => !font.isVariable).map((font) => Math.round(Number(font.fontWeight || 400))).filter((weight) => Number.isFinite(weight));
      return withCurrentFontWeight([...variableWeights, ...extraWeights], currentWeight, false);
    }
    const staticWeights = candidates.map((font) => Math.round(Number(font.fontWeight || 400))).filter((weight) => Number.isFinite(weight));
    if (staticWeights.length) return withCurrentFontWeight(staticWeights, currentWeight, staticWeights.includes(currentWeight));
  }
  const catalogFont = findLoyaltyCardFont(getTextFontKey(element));
  if (catalogFont) return withCurrentFontWeight(catalogFont.weights, currentWeight, catalogFont.weights.includes(currentWeight));
  return withCurrentFontWeight(FONT_WEIGHTS, currentWeight);
}

export function getAvailableTextStyles(groups: UploadedFontGroup[], element: LoyaltyCardTextElement): Array<"normal" | "italic"> {
  const currentStyle = getTextFontStyle(element);
  if (element.fontSource === "customUrl") {
    const group = findUploadedFontGroupForElement(groups, element);
    const selectedFontExists = group?.fonts.some((font) => font.id === element.fontKey);
    if (!group || !selectedFontExists) return [currentStyle];
    const styles: Array<"normal" | "italic"> = group.fonts.map((font) => font.fontStyle === "italic" ? "italic" : "normal");
    return withCurrentFontStyle(styles, currentStyle, styles.includes(currentStyle));
  }
  const catalogFont = findLoyaltyCardFont(getTextFontKey(element));
  if (catalogFont) return withCurrentFontStyle(catalogFont.styles, currentStyle, catalogFont.styles.includes(currentStyle));
  return [currentStyle];
}

export function selectedTextWeight(element: LoyaltyCardTextElement, options: number[]) {
  const currentWeight = getTextFontWeight(element);
  return options.includes(currentWeight) ? currentWeight : closestFontWeight(options, currentWeight);
}

export function selectedTextStyle(element: LoyaltyCardTextElement, options: Array<"normal" | "italic">) {
  const currentStyle = getTextFontStyle(element);
  return options.includes(currentStyle) ? currentStyle : options[0] || "normal";
}

export function applyCatalogFontToText(element: LoyaltyCardTextElement, font: LoyaltyCardFontCatalogItem): LoyaltyCardTextElement {
  return {
    ...element,
    fontSource: "catalog",
    fontKey: font.key,
    fontFamily: font.family,
    fontUrl: "",
    fontIsVariable: undefined,
    fontWeightMin: undefined,
    fontWeightMax: undefined,
    fontWeightDefault: undefined,
    fontWeight: font.weights.includes(element.fontWeight) ? element.fontWeight : getFontPreviewWeight(font),
    fontStyle: font.styles.includes(element.fontStyle || "normal") ? element.fontStyle : "normal",
  };
}

export function applyUploadedFontToText(element: LoyaltyCardTextElement, font: LoyaltyCardEditorUploadedFont, weight: number): LoyaltyCardTextElement {
  const fontUrl = getUploadedFontUrl(font);
  loadUploadedFontPreview(font);
  return {
    ...element,
    fontSource: "customUrl",
    fontKey: font.id,
    fontFamily: font.fontFamily,
    fontUrl,
    fontIsVariable: Boolean(font.isVariable),
    fontWeightMin: font.fontWeightMin,
    fontWeightMax: font.fontWeightMax,
    fontWeightDefault: font.fontWeightDefault,
    fontWeight: font.isVariable ? clampNumber(weight, font.fontWeightMin || 100, font.fontWeightMax || 900) : font.fontWeight || weight || 400,
    fontStyle: font.fontStyle || "normal",
  };
}

export function applyTextVariant(groups: UploadedFontGroup[], element: LoyaltyCardTextElement, weight: number, style: "normal" | "italic"): LoyaltyCardTextElement {
  const group = findUploadedFontGroupForElement(groups, element);
  if (!group) return { ...element, fontWeight: weight, fontStyle: style };
  const font = chooseUploadedFontVariant(group, weight, style);
  if (!font || !getUploadedFontUrl(font)) return { ...element, fontWeight: weight, fontStyle: style };
  const next = applyUploadedFontToText(element, font, weight);
  return { ...next, fontStyle: font.fontStyle || style };
}

function CatalogFontRow({ font, active, onSelect }: { font: LoyaltyCardFontCatalogItem; active: boolean; onSelect: (font: LoyaltyCardFontCatalogItem) => void }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      loadPreviewFont(font);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadPreviewFont(font);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [font]);
  return (
    <button ref={ref} type="button" className={cx("lce-font-row", active && "lce-font-row--active")} aria-pressed={active} onClick={() => onSelect(font)}>
      <span style={{ fontFamily: `"${font.family}", sans-serif`, fontWeight: getFontPreviewWeight(font) }}>{font.family}</span>
      <small>{font.weights.length > 1 ? `${font.weights.length} weights` : "1 weight"}</small>
    </button>
  );
}

function UploadedFontRow({ group, active, onSelect }: { group: UploadedFontGroup; active: boolean; onSelect: (group: UploadedFontGroup) => void }) {
  const preview = group.fonts.find((font) => font.fontWeight === 400 && font.fontStyle !== "italic") || group.fonts[0];
  useEffect(() => {
    group.fonts.forEach(loadUploadedFontPreview);
  }, [group.fonts]);
  return (
    <button type="button" className={cx("lce-font-row", active && "lce-font-row--active")} aria-pressed={active} onClick={() => onSelect(group)}>
      <span style={{ fontFamily: `"${preview?.fontFamily || group.family}", sans-serif`, fontWeight: preview?.fontWeight || 400 }}>{group.family}</span>
      <small>{uploadedFontGroupSummary(group.fonts)}</small>
    </button>
  );
}

export function FontPickerPanel({ element, groups, onPickCatalog, onPickUploaded, onClose }: { element: LoyaltyCardTextElement; groups: UploadedFontGroup[]; onPickCatalog: (font: LoyaltyCardFontCatalogItem) => void; onPickUploaded: (group: UploadedFontGroup) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | "uploaded" | (typeof FONT_CATEGORIES)[number]>("all");
  const normalizedQuery = query.trim().toLowerCase();
  const catalogGroups = useMemo(() => {
    const matching = loyaltyCardFontCatalog.filter((font) => !normalizedQuery || font.family.toLowerCase().includes(normalizedQuery) || font.category.includes(normalizedQuery));
    return FONT_CATEGORIES.filter((item) => category === "all" || category === item).map((item) => ({ category: item, fonts: matching.filter((font) => font.category === item) })).filter((group) => group.fonts.length > 0);
  }, [normalizedQuery, category]);
  const uploadedMatches = groups.filter((group) => (category === "all" || category === "uploaded") && (!normalizedQuery || group.family.toLowerCase().includes(normalizedQuery)));
  const total = (category === "uploaded" ? 0 : catalogGroups.reduce((sum, group) => sum + group.fonts.length, 0)) + uploadedMatches.length;
  const activeKey = getTextFontKey(element);
  const family = getTextFontFamily(element);

  return (
    <div className="lce-font-picker">
      <div className="lce-font-picker__header">
        <IconButton icon={ArrowLeft01Icon} label="Back to text settings" variant="soft" size="sm" onClick={onClose} />
        <div>
          <span className="lce-section__label">Font</span>
          <strong style={{ fontFamily: `"${family}", sans-serif` }}>{family}</strong>
        </div>
      </div>
      <label className="lce-search">
        <Icon icon={Search01Icon} size={16} />
        <input autoFocus value={query} placeholder="Search fonts" aria-label="Search fonts" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="lce-chip-row lce-chip-row--scroll" role="radiogroup" aria-label="Font kind">
        {(["all", ...(groups.length ? ["uploaded" as const] : []), ...FONT_CATEGORIES] as const).map((item) => (
          <button key={item} type="button" role="radio" aria-checked={category === item} className={cx("lce-filter-chip", category === item && "lce-filter-chip--active")} onClick={() => setCategory(item)}>
            {item === "all" ? "All" : item === "uploaded" ? "Uploaded" : getLoyaltyCardFontCategoryLabel(item)}
          </button>
        ))}
      </div>
      <div className="lce-font-picker__count">{total} font{total === 1 ? "" : "s"}</div>
      <div className="lce-font-picker__list">
        {uploadedMatches.length ? (
          <div className="lce-font-picker__group">
            <span className="lce-section__label">Uploaded fonts</span>
            {uploadedMatches.map((group) => <UploadedFontRow key={group.id} group={group} active={element.fontSource === "customUrl" && (group.fonts.some((font) => font.id === element.fontKey) || uploadedFontFamilyKey(element.fontFamily) === group.id)} onSelect={onPickUploaded} />)}
          </div>
        ) : null}
        {category === "uploaded" ? null : catalogGroups.map((group) => (
          <div key={group.category} className="lce-font-picker__group">
            <span className="lce-section__label">{getLoyaltyCardFontCategoryLabel(group.category)}</span>
            {group.fonts.map((font) => <CatalogFontRow key={font.key} font={font} active={element.fontSource !== "customUrl" && font.key === activeKey} onSelect={onPickCatalog} />)}
          </div>
        ))}
        {total === 0 ? <p className="lce-empty">No fonts match “{query}”.</p> : null}
      </div>
    </div>
  );
}

type FontUploadDraft = {
  id: string;
  file: File;
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  isLikelyVariable: boolean;
};

function fontNameFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Uploaded font";
}

function inferFontWeight(name: string) {
  const normalized = name.toLowerCase();
  if (/thin|hairline/.test(normalized)) return 100;
  if (/extra\s*light|ultra\s*light/.test(normalized)) return 200;
  if (/light/.test(normalized)) return 300;
  if (/regular|normal|book|roman/.test(normalized)) return 400;
  if (/medium/.test(normalized)) return 500;
  if (/semi\s*bold|demi\s*bold/.test(normalized)) return 600;
  if (/extra\s*bold|ultra\s*bold/.test(normalized)) return 800;
  if (/black|heavy/.test(normalized)) return 900;
  if (/bold/.test(normalized)) return 700;
  return 400;
}

function createFontUploadDraft(file: File, index: number): FontUploadDraft {
  const fallbackName = fontNameFromFile(file.name);
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
    file,
    name: fallbackName,
    fontFamily: stripTrailingFontVariant(fallbackName),
    fontWeight: inferFontWeight(fallbackName),
    fontStyle: /italic|oblique/i.test(fallbackName) ? "italic" : "normal",
    isLikelyVariable: /(^|[\s_-])(variable|vf)([\s_.-]|$)/i.test(fallbackName),
  };
}

export function FontUploadDialog({ onUpload, onClose }: { onUpload: UploadFontHandler; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [drafts, setDrafts] = useState<FontUploadDraft[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (id: string, patch: Partial<Omit<FontUploadDraft, "id" | "file">>) => setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));

  const handleUpload = async () => {
    if (!drafts.length) {
      setError("Choose one or more font files first.");
      return;
    }
    setIsUploading(true);
    setError(null);
    let remaining = drafts;
    try {
      for (const draft of drafts) {
        const fallbackName = fontNameFromFile(draft.file.name);
        await onUpload(draft.file, {
          name: draft.name.trim() || fallbackName,
          fontFamily: draft.fontFamily.trim() || draft.name.trim() || fallbackName,
          fontWeight: draft.fontWeight,
          fontStyle: draft.fontStyle,
        });
        remaining = remaining.filter((item) => item.id !== draft.id);
        setDrafts(remaining);
      }
      onClose();
    } catch (uploadError) {
      setDrafts(remaining);
      setError(uploadError instanceof Error ? uploadError.message : "Font upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      title="Upload fonts"
      subtitle="WOFF2, WOFF, TTF or OTF. Variable weight ranges are detected after upload."
      busy={isUploading}
      onClose={onClose}
      className="lce-modal--wide"
      footer={(
        <>
          <button type="button" className="lce-button" disabled={isUploading} onClick={onClose}>Cancel</button>
          <button type="button" className="lce-button lce-button--ink" disabled={isUploading || !drafts.length} onClick={handleUpload}>{isUploading ? "Uploading…" : drafts.length > 1 ? `Upload ${drafts.length} fonts` : "Upload"}</button>
        </>
      )}
    >
      <input ref={inputRef} className="lce-file-input" type="file" multiple accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" onChange={(event) => {
        const files = Array.from(event.target.files || []);
        if (files.length) setDrafts(files.map(createFontUploadDraft));
        setError(null);
        event.target.value = "";
      }} />
      <button type="button" className="lce-dropzone" disabled={isUploading} onClick={() => inputRef.current?.click()}>
        <Icon icon={CloudUploadIcon} size={22} />
        <strong>{drafts.length ? `${drafts.length} file${drafts.length === 1 ? "" : "s"} chosen` : "Choose font files"}</strong>
        <small>Names, weights and italic are filled in from the file names.</small>
      </button>
      {drafts.map((draft) => (
        <div key={draft.id} className="lce-upload-row">
          <div className="lce-upload-row__header">
            <span><strong>{draft.file.name}</strong><small>{Math.ceil(draft.file.size / 1024)} KB{draft.isLikelyVariable ? " · probably variable" : ""}</small></span>
            <button type="button" className="lce-link-button" disabled={isUploading} onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}>Remove</button>
          </div>
          <div className="lce-grid-2">
            <TextInput label="Font name" value={draft.name} onChange={(name) => updateDraft(draft.id, { name })} />
            <TextInput label="Font family" value={draft.fontFamily} onChange={(fontFamily) => updateDraft(draft.id, { fontFamily })} />
            <NumberInput label={draft.isLikelyVariable ? "Preview weight" : "Weight"} value={draft.fontWeight} min={1} max={1000} step={100} decimals={0} onChange={(fontWeight) => updateDraft(draft.id, { fontWeight: Math.round(fontWeight) })} />
            <SelectField label="Style" value={draft.fontStyle} options={[{ value: "normal", label: "Normal" }, { value: "italic", label: "Italic" }]} onChange={(fontStyle) => updateDraft(draft.id, { fontStyle })} />
          </div>
        </div>
      ))}
      {error ? <p className="lce-error" role="alert">{error}</p> : null}
    </Modal>
  );
}

function UploadedFontListItem({ group, onArchive, onDelete }: { group: UploadedFontGroup; onArchive?: (fontId: string) => Promise<void>; onDelete?: (fontId: string) => Promise<void> }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = group.fonts.find((font) => font.fontWeight === 400 && font.fontStyle !== "italic") || group.fonts[0];
  useEffect(() => {
    group.fonts.forEach(loadUploadedFontPreview);
  }, [group.fonts]);

  const runForAll = async (action: (fontId: string) => Promise<void>, verb: string) => {
    setBusy(true);
    setError(null);
    try {
      const results = await Promise.allSettled(group.fonts.map((font) => action(font.id)));
      const failed = results.filter((result) => result.status === "rejected").length;
      if (failed > 0) setError(`${verb} ${group.fonts.length - failed} of ${group.fonts.length}. ${failed} failed.`);
    } finally {
      setBusy(false);
    }
  };

  const items = [
    ...(onArchive ? [{ id: "archive", label: "Archive", icon: Archive02Icon, disabled: busy, onSelect: () => runForAll(onArchive, "Archived") }] : []),
    ...(onDelete ? [{ id: "delete", label: "Delete", icon: Delete02Icon, danger: true, disabled: busy, onSelect: () => {
      if (typeof window !== "undefined" && !window.confirm(`Delete ${group.family}? This removes ${group.fonts.length} uploaded file${group.fonts.length === 1 ? "" : "s"}. Cards that already use it keep rendering.`)) return;
      void runForAll(onDelete, "Deleted");
    } }] : []),
  ];

  return (
    <div className="lce-font-item">
      <span className="lce-font-item__well" style={{ fontFamily: `"${preview?.fontFamily || group.family}", sans-serif` }}>Aa</span>
      <span className="lce-font-item__text">
        <strong>{group.family}</strong>
        <small>{busy ? "Working…" : uploadedFontGroupSummary(group.fonts)}</small>
        {error ? <small className="lce-error">{error}</small> : null}
      </span>
      {items.length ? (
        <span className="lce-menu-anchor">
          <IconButton icon={MoreHorizontalIcon} label={`More for ${group.family}`} size="sm" onClick={() => setMenuOpen((open) => !open)} />
          {menuOpen ? <Menu label={`${group.family} actions`} items={items} onClose={() => setMenuOpen(false)} /> : null}
        </span>
      ) : null}
    </div>
  );
}

export function UploadedFontsList({ groups, onArchive, onDelete }: { groups: UploadedFontGroup[]; onArchive?: (fontId: string) => Promise<void>; onDelete?: (fontId: string) => Promise<void> }) {
  if (!groups.length) return <p className="lce-hint">No fonts uploaded yet. Uploaded fonts show up in the font picker.</p>;
  return <div className="lce-font-list">{groups.map((group) => <UploadedFontListItem key={group.id} group={group} onArchive={onArchive} onDelete={onDelete} />)}</div>;
}
