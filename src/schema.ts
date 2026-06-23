export const LOYALTY_CARD_SCHEMA_VERSION = 1;
export const LOYALTY_CARD_CANVAS_WIDTH = 1000;
export const LOYALTY_CARD_CANVAS_HEIGHT = 562.5;
export const LOYALTY_CARD_ASPECT_RATIO = "16:9" as const;

export const LOYALTY_CARD_ELEMENT_TYPES = ["text", "asset", "shape", "line", "stampGrid"] as const;
export const LOYALTY_CARD_FACE_KEYS = ["front", "back", "reward"] as const;
export const LOYALTY_CARD_BACKGROUND_TYPES = ["solid", "gradient", "image"] as const;
export const LOYALTY_CARD_BACKGROUND_IMAGE_FITS = ["cover", "contain", "fill", "manual"] as const;
export const LOYALTY_CARD_BACKGROUND_ALIGN_X = ["left", "center", "right"] as const;
export const LOYALTY_CARD_BACKGROUND_ALIGN_Y = ["top", "center", "bottom"] as const;
export const LOYALTY_CARD_ASSET_FILTER_PRESETS = ["none", "monochrome", "invert", "warm", "cool", "vintage", "dramatic"] as const;
export const LOYALTY_CARD_FONT_FAMILIES = ["sans", "display_serif", "condensed", "handwritten"] as const;
export const LOYALTY_CARD_FONT_SOURCES = ["preset", "catalog", "customUrl"] as const;
export const LOYALTY_CARD_FONT_STYLES = ["normal", "italic"] as const;
export const LOYALTY_CARD_TEXT_TRANSFORMS = ["none", "uppercase", "lowercase", "capitalize"] as const;
export const LOYALTY_CARD_VERTICAL_ALIGNS = ["top", "center", "bottom"] as const;
export const LOYALTY_CARD_SHAPES = ["rect", "circle", "blob"] as const;
export const LOYALTY_CARD_STAMP_SHAPES = ["circle", "rounded_square", "heart"] as const;
export const LOYALTY_CARD_STAMP_RENDER_MODES = ["shape", "image"] as const;
export const LOYALTY_CARD_STAMP_IMAGE_FITS = ["contain", "cover", "fill"] as const;
export const LOYALTY_CARD_STAMP_ANIMATIONS = ["none", "pop", "stamp", "bounce"] as const;
export const LOYALTY_CARD_STAMP_DATE_FORMATS = ["short", "medium", "relative"] as const;
export const LOYALTY_CARD_PRESET_STATUSES = ["draft", "published", "archived"] as const;
export const LOYALTY_CARD_PRESET_CATEGORIES = ["coffee", "bakery", "restaurant", "bar", "generic"] as const;

export type LoyaltyCardPresetStatus = (typeof LOYALTY_CARD_PRESET_STATUSES)[number];
export type LoyaltyCardPresetCategory = (typeof LOYALTY_CARD_PRESET_CATEGORIES)[number];
export type LoyaltyCardFaceKey = (typeof LOYALTY_CARD_FACE_KEYS)[number];
export type LoyaltyCardFontSource = (typeof LOYALTY_CARD_FONT_SOURCES)[number];
export type LoyaltyCardFontStyle = (typeof LOYALTY_CARD_FONT_STYLES)[number];
export type LoyaltyCardTextTransform = (typeof LOYALTY_CARD_TEXT_TRANSFORMS)[number];
export type LoyaltyCardVerticalAlign = (typeof LOYALTY_CARD_VERTICAL_ALIGNS)[number];
export type LoyaltyCardBackgroundImageFit = (typeof LOYALTY_CARD_BACKGROUND_IMAGE_FITS)[number];
export type LoyaltyCardBackgroundAlignX = (typeof LOYALTY_CARD_BACKGROUND_ALIGN_X)[number];
export type LoyaltyCardBackgroundAlignY = (typeof LOYALTY_CARD_BACKGROUND_ALIGN_Y)[number];
export type LoyaltyCardAssetFilterPreset = (typeof LOYALTY_CARD_ASSET_FILTER_PRESETS)[number];
export type LoyaltyCardStampRenderMode = (typeof LOYALTY_CARD_STAMP_RENDER_MODES)[number];
export type LoyaltyCardStampImageFit = (typeof LOYALTY_CARD_STAMP_IMAGE_FITS)[number];
export type LoyaltyCardStampAnimation = (typeof LOYALTY_CARD_STAMP_ANIMATIONS)[number];
export type LoyaltyCardStampDateFormat = (typeof LOYALTY_CARD_STAMP_DATE_FORMATS)[number];

export type LoyaltyCardBackground =
  | { type: "solid"; color: string }
  | { type: "gradient"; colors: string[]; angle: number }
  | {
      type: "image";
      color: string;
      imageUrl: string;
      fit: LoyaltyCardBackgroundImageFit;
      alignX?: LoyaltyCardBackgroundAlignX;
      alignY?: LoyaltyCardBackgroundAlignY;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      opacity?: number;
    };

export type LoyaltyCardElementBase = {
  id: string;
  type: (typeof LOYALTY_CARD_ELEMENT_TYPES)[number];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
};

export type LoyaltyCardTextElement = LoyaltyCardElementBase & {
  type: "text";
  token: string;
  fallbackText: string;
  fontSource?: LoyaltyCardFontSource;
  fontKey?: string;
  fontFamily: string;
  fontUrl?: string;
  fontStyle?: LoyaltyCardFontStyle;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: LoyaltyCardTextTransform;
  color: string;
  align: "left" | "center" | "right";
  verticalAlign?: LoyaltyCardVerticalAlign;
  textStrokeColor?: string;
  textStrokeWidth?: number;
};

export type LoyaltyCardAssetElement = LoyaltyCardElementBase & {
  type: "asset";
  assetId: string;
  imageUrl: string;
  fit: "cover" | "contain" | "crop";
  cropX?: number;
  cropY?: number;
  cropScale?: number;
  filterPreset?: LoyaltyCardAssetFilterPreset;
  filterBrightness?: number;
  filterContrast?: number;
  filterSaturation?: number;
  filterHue?: number;
  filterSepia?: number;
  filterGrayscale?: number;
  filterInvert?: number;
  filterBlur?: number;
  lockAspectRatio?: boolean;
  tint: string;
};

export type LoyaltyCardShapeElement = LoyaltyCardElementBase & {
  type: "shape";
  shape: (typeof LOYALTY_CARD_SHAPES)[number];
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  lockAspectRatio?: boolean;
};

export type LoyaltyCardLineElement = LoyaltyCardElementBase & {
  type: "line";
  color: string;
  strokeWidth: number;
};

export type LoyaltyCardStampGridElement = LoyaltyCardElementBase & {
  type: "stampGrid";
  columns: number;
  count: number;
  countToken: string;
  filledToken?: string;
  stampDataToken?: string;
  shape: (typeof LOYALTY_CARD_STAMP_SHAPES)[number];
  emptyMode?: LoyaltyCardStampRenderMode;
  emptyShape?: (typeof LOYALTY_CARD_STAMP_SHAPES)[number];
  emptyFill?: string;
  emptyStroke?: string;
  emptyStrokeWidth?: number;
  emptyImageUrl?: string;
  filledMode?: LoyaltyCardStampRenderMode;
  filledShape?: (typeof LOYALTY_CARD_STAMP_SHAPES)[number];
  filledFill?: string;
  filledStroke?: string;
  filledStrokeWidth?: number;
  filledImageUrl?: string;
  imageFit?: LoyaltyCardStampImageFit;
  imageInset?: number;
  showStampDates?: boolean;
  dateFormat?: LoyaltyCardStampDateFormat;
  animation?: LoyaltyCardStampAnimation;
  animationDuration?: number;
  animationStagger?: number;
  stroke: string;
  fill: string;
  gap: number;
};

export type LoyaltyCardElement =
  | LoyaltyCardTextElement
  | LoyaltyCardAssetElement
  | LoyaltyCardShapeElement
  | LoyaltyCardLineElement
  | LoyaltyCardStampGridElement;

export type LoyaltyCardGroup = {
  id: string;
  name: string;
  elementIds: string[];
  collapsed?: boolean;
};

export type LoyaltyCardFace = {
  background: LoyaltyCardBackground;
  elements: LoyaltyCardElement[];
  groups?: LoyaltyCardGroup[];
};

export type LoyaltyCardDesignSchema = {
  version: number;
  canvas: {
    width: number;
    height: number;
    aspectRatio: typeof LOYALTY_CARD_ASPECT_RATIO;
    borderRadius?: number;
    safeArea: { x: number; y: number; width: number; height: number };
  };
  faces: Record<LoyaltyCardFaceKey, LoyaltyCardFace>;
};

export type LoyaltyCardPresetRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: LoyaltyCardPresetCategory;
  status: LoyaltyCardPresetStatus;
  aspectRatio: typeof LOYALTY_CARD_ASPECT_RATIO;
  previewImage: string;
  designSchema: LoyaltyCardDesignSchema;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
};

export type LoyaltyCardTokenValue = string | number | boolean | null | undefined | LoyaltyCardTokenValue[] | { [key: string]: LoyaltyCardTokenValue };
export type LoyaltyCardTokens = Record<string, LoyaltyCardTokenValue>;

export function resolveLoyaltyCardToken(value: string | undefined, tokens: LoyaltyCardTokens) {
  const raw = String(value || "");
  return raw.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => String(tokens[key] ?? `{{${key}}}`));
}

export function resolveLoyaltyCardTokenValue(value: string | undefined, tokens: LoyaltyCardTokens) {
  const raw = String(value || "").trim();
  const match = raw.match(/^{{\s*([a-zA-Z0-9_]+)\s*}}$/);
  if (!match) return resolveLoyaltyCardToken(value, tokens);
  return tokens[match[1]];
}
