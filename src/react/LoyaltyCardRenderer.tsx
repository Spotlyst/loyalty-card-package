import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { findLoyaltyCardFont, legacyLoyaltyCardFontMap } from "../fonts.js";
import { resolveLoyaltyCardToken, resolveLoyaltyCardTokenValue, type LoyaltyCardDesignSchema, type LoyaltyCardElement, type LoyaltyCardFaceKey, type LoyaltyCardStampGridElement, type LoyaltyCardTokens } from "../schema.js";
import { resolveFittedStampGridLayout } from "../stampGridLayout.js";

export type LoyaltyCardRendererProps = {
  schema: LoyaltyCardDesignSchema;
  face: LoyaltyCardFaceKey;
  tokens?: LoyaltyCardTokens;
  className?: string;
  style?: CSSProperties;
  animateStampGridLayout?: boolean;
};

type StampGridRenderItem = {
  key: string;
  stampIndex: number;
  filled: boolean;
  stamp: unknown;
  x: number;
  y: number;
  cellSize: number;
  stampSize: number;
};

const loadedFontKeys = new Set<string>();
let stampAnimationStylesLoaded = false;
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const assetFilterPresets = {
  none: { filterBrightness: 1, filterContrast: 1, filterSaturation: 1, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  monochrome: { filterBrightness: 1, filterContrast: 1, filterSaturation: 0, filterHue: 0, filterSepia: 0, filterGrayscale: 1, filterInvert: 0, filterBlur: 0 },
  invert: { filterBrightness: 1, filterContrast: 1, filterSaturation: 1, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 1, filterBlur: 0 },
  warm: { filterBrightness: 1, filterContrast: 1, filterSaturation: 1.12, filterHue: 8, filterSepia: 0.12, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  cool: { filterBrightness: 1, filterContrast: 1, filterSaturation: 1.08, filterHue: -12, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  vintage: { filterBrightness: 1, filterContrast: 0.92, filterSaturation: 0.72, filterHue: 0, filterSepia: 0.35, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
  dramatic: { filterBrightness: 0.92, filterContrast: 1.28, filterSaturation: 1.12, filterHue: 0, filterSepia: 0, filterGrayscale: 0, filterInvert: 0, filterBlur: 0 },
} as const;

function clampFilter(value: number | undefined, min: number, max: number, fallback: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

function assetImageFilter(element: Extract<LoyaltyCardElement, { type: "asset" }>) {
  const preset = assetFilterPresets[element.filterPreset || "none"] || assetFilterPresets.none;
  const brightness = clampFilter(element.filterBrightness ?? preset.filterBrightness, 0, 2, 1);
  const contrast = clampFilter(element.filterContrast ?? preset.filterContrast, 0, 2, 1);
  const saturation = clampFilter(element.filterSaturation ?? preset.filterSaturation, 0, 3, 1);
  const hue = clampFilter(element.filterHue ?? preset.filterHue, -180, 180, 0);
  const sepia = clampFilter(element.filterSepia ?? preset.filterSepia, 0, 1, 0);
  const grayscale = clampFilter(element.filterGrayscale ?? preset.filterGrayscale, 0, 1, 0);
  const invert = clampFilter(element.filterInvert ?? preset.filterInvert, 0, 1, 0);
  const blur = clampFilter(element.filterBlur ?? preset.filterBlur, 0, 20, 0);
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hue}deg) sepia(${sepia}) grayscale(${grayscale}) invert(${invert}) blur(${blur}px)`;
}

const fallbackByCategory: Record<string, string> = {
  serif: "serif",
  luxury: "serif",
  script: "cursive",
  handwritten: "cursive",
  condensed: "sans-serif",
  display: "sans-serif",
  poster: "sans-serif",
  retro: "sans-serif",
  multilingual: "sans-serif",
  sans: "sans-serif",
};

function quoteFontFamily(family: string) {
  return `"${family.replace(/["\\]/g, "").trim() || "Outfit"}"`;
}

function cssString(value: string) {
  return JSON.stringify(value.replace(/[\u0000-\u001F\u007F]/g, ""));
}

function googleFontsUrl(families: string[]) {
  const familyParams = families.map((family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:ital,wght@0,100..900;1,100..900`);
  return `https://fonts.googleapis.com/css2?${familyParams.join("&")}&display=swap`;
}

function getTextFont(element: Extract<LoyaltyCardElement, { type: "text" }>) {
  const legacy = legacyLoyaltyCardFontMap[element.fontFamily];
  const family = element.fontFamily && !legacy ? element.fontFamily : legacy?.family || "Outfit";
  const key = element.fontKey || legacy?.key || family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "outfit";
  const source = element.fontSource || legacy?.source || "catalog";
  const catalogFont = findLoyaltyCardFont(key) || findLoyaltyCardFont(family);
  const fallback = fallbackByCategory[catalogFont?.category || "sans"] || "sans-serif";
  return { family, key, source, fontUrl: element.fontUrl || "", fallback };
}

function useLoyaltyCardFonts(elements: LoyaltyCardElement[]) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const textElements = elements.filter((element): element is Extract<LoyaltyCardElement, { type: "text" }> => element.type === "text");
    const catalogFamilies = new Map<string, string>();

    textElements.forEach((element) => {
      const font = getTextFont(element);
      if (font.source === "customUrl" && font.fontUrl && !loadedFontKeys.has(`custom:${font.key}:${font.fontUrl}`)) {
        const style = document.createElement("style");
        style.setAttribute("data-spotlyst-font", font.key);
        style.textContent = `@font-face{font-family:${cssString(font.family)};src:url(${cssString(font.fontUrl)});font-display:swap;}`;
        document.head.appendChild(style);
        loadedFontKeys.add(`custom:${font.key}:${font.fontUrl}`);
        return;
      }
      if (font.source === "catalog" && !loadedFontKeys.has(`catalog:${font.family}`)) {
        catalogFamilies.set(font.family, font.key);
      }
    });

    if (catalogFamilies.size > 0) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = googleFontsUrl(Array.from(catalogFamilies.keys()));
      link.setAttribute("data-spotlyst-fonts", Array.from(catalogFamilies.values()).join(","));
      document.head.appendChild(link);
      catalogFamilies.forEach((key, family) => loadedFontKeys.add(`catalog:${family}`));
    }
  }, [elements]);
}

function useStampAnimationStyles() {
  useEffect(() => {
    if (typeof document === "undefined" || stampAnimationStylesLoaded) return;
    const style = document.createElement("style");
    style.setAttribute("data-spotlyst-stamp-animations", "true");
    style.textContent = `
@keyframes spotlyst-stamp-pop{0%{transform:scale(.82);opacity:.35}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes spotlyst-stamp-stamp{0%{transform:translateY(-12%) scale(1.35) rotate(-8deg);opacity:0}55%{transform:translateY(2%) scale(.94) rotate(2deg);opacity:1}100%{transform:translateY(0) scale(1) rotate(0);opacity:1}}
@keyframes spotlyst-stamp-bounce{0%{transform:scale(.9);opacity:.5}45%{transform:scale(1.18);opacity:1}70%{transform:scale(.96)}100%{transform:scale(1)}}
@keyframes spotlyst-stamp-slot-enter{0%{transform:scale(.82);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes spotlyst-stamp-slot-exit{0%{transform:scale(1);opacity:1}100%{transform:scale(.72);opacity:0}}
.spotlyst-stamp-grid-slot--motion{transition:left 210ms cubic-bezier(.22,1,.36,1),top 210ms cubic-bezier(.22,1,.36,1),width 210ms cubic-bezier(.22,1,.36,1),height 210ms cubic-bezier(.22,1,.36,1),opacity 150ms ease,transform 210ms cubic-bezier(.22,1,.36,1);will-change:left,top,width,height,opacity,transform;}
.spotlyst-stamp-grid-slot--enter{animation:spotlyst-stamp-slot-enter 180ms cubic-bezier(.22,1,.36,1) both;}
.spotlyst-stamp-grid-slot--exit{animation:spotlyst-stamp-slot-exit 160ms ease both;pointer-events:none;}
@media (prefers-reduced-motion: reduce){.spotlyst-stamp-grid-slot--motion,.spotlyst-stamp-grid-slot--motion *{transition:none!important;animation:none!important}}`;
    document.head.appendChild(style);
    stampAnimationStylesLoaded = true;
  }, []);
}

function getBackgroundStyle(background: LoyaltyCardDesignSchema["faces"]["front"]["background"]): CSSProperties {
  if (background.type === "gradient") {
    return { background: `linear-gradient(${background.angle}deg, ${background.colors.join(", ")})` };
  }
  if (background.type === "image") {
    return { background: background.color };
  }
  return { background: background.color };
}

function backgroundObjectPosition(background: Extract<LoyaltyCardDesignSchema["faces"]["front"]["background"], { type: "image" }>) {
  return `${background.alignX || "center"} ${background.alignY || "center"}`;
}

function renderBackgroundLayer(background: LoyaltyCardDesignSchema["faces"]["front"]["background"], schema: LoyaltyCardDesignSchema) {
  if (background.type !== "image" || !background.imageUrl) return null;
  const opacity = Math.max(0, Math.min(1, background.opacity ?? 1));
  if (background.fit === "manual") {
    return (
      <img
        src={background.imageUrl}
        alt=""
        style={{
          position: "absolute",
          left: `${((background.x || 0) / schema.canvas.width) * 100}%`,
          top: `${((background.y || 0) / schema.canvas.height) * 100}%`,
          width: `${((background.width || schema.canvas.width) / schema.canvas.width) * 100}%`,
          height: `${((background.height || schema.canvas.height) / schema.canvas.height) * 100}%`,
          objectFit: "fill",
          opacity,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
    );
  }
  return (
    <img
      src={background.imageUrl}
      alt=""
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: background.fit === "fill" ? "fill" : background.fit,
        objectPosition: backgroundObjectPosition(background),
        opacity,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}

function elementFrame(element: LoyaltyCardElement, schema: LoyaltyCardDesignSchema, scale: number): CSSProperties {
  return {
    position: "absolute",
    left: `${(element.x / schema.canvas.width) * 100}%`,
    top: `${(element.y / schema.canvas.height) * 100}%`,
    width: `${(element.width / schema.canvas.width) * 100}%`,
    height: `${(element.height / schema.canvas.height) * 100}%`,
    transform: `rotate(${element.rotation || 0}deg)`,
    opacity: element.opacity,
    zIndex: element.zIndex,
    overflow: "hidden",
    pointerEvents: "none",
    fontSize: scale,
  };
}

function stampGridAlignItems(align: LoyaltyCardStampGridElement["horizontalAlign"]): CSSProperties["alignItems"] {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

function stampGridJustifyContent(align: LoyaltyCardStampGridElement["verticalAlign"]): CSSProperties["justifyContent"] {
  if ((align || "top") === "top") return "flex-start";
  if (align === "bottom") return "flex-end";
  return "center";
}

function stampRowJustifyContent(align: "left" | "center" | "right"): CSSProperties["justifyContent"] {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

function buildStampGridRenderItems(element: LoyaltyCardStampGridElement, stampLayout: ReturnType<typeof resolveFittedStampGridLayout>, filled: number, stamps: unknown[]) {
  const slotsByRow = Array.from({ length: stampLayout.rows }).map((_, row) => stampLayout.slots.filter((slot) => slot.row === row).sort((a, b) => a.column - b.column));
  const rowStartX = (row: number) => {
    const slots = slotsByRow[row] || [];
    const rowWidth = slots.length * stampLayout.cellSize + Math.max(0, slots.length - 1) * stampLayout.gap;
    const align = stampLayout.rowAlignments[row] || element.horizontalAlign || "center";
    if (align === "left") return 0;
    if (align === "right") return stampLayout.contentWidth - rowWidth;
    return (stampLayout.contentWidth - rowWidth) / 2;
  };

  return stampLayout.slots.map((slot): StampGridRenderItem => {
    const rowSlots = slotsByRow[slot.row] || [];
    const position = Math.max(0, rowSlots.findIndex((candidate) => candidate.id === slot.id));
    const x = rowStartX(slot.row) + position * (stampLayout.cellSize + stampLayout.gap);
    const y = slot.row * (stampLayout.cellSize + stampLayout.gap);
    return {
      key: stampLayout.usesExplicitSlots ? slot.id : String(slot.stampIndex),
      stampIndex: slot.stampIndex,
      filled: slot.stampIndex < filled,
      stamp: stamps[slot.stampIndex],
      x,
      y,
      cellSize: stampLayout.cellSize,
      stampSize: stampLayout.stampSize,
    };
  });
}

function LoyaltyCardStampGridElementView({ element, schema, scale, tokens, animateLayout }: { element: LoyaltyCardStampGridElement; schema: LoyaltyCardDesignSchema; scale: number; tokens: LoyaltyCardTokens; animateLayout?: boolean }) {
  const frame = elementFrame(element, schema, scale);
  const count = Math.max(1, Math.min(100, Number(resolveLoyaltyCardToken(element.countToken, tokens)) || element.count || 10));
  const stampData = resolveLoyaltyCardTokenValue(element.stampDataToken || "{{stamps}}", tokens);
  const stamps = Array.isArray(stampData) ? stampData : [];
  const filled = Math.max(0, Math.min(count, element.filledToken ? Number(resolveLoyaltyCardToken(element.filledToken, tokens)) || 0 : stamps.length));
  const stampLayout = resolveFittedStampGridLayout(element, count);
  const currentItems = buildStampGridRenderItems(element, stampLayout, filled, stamps);
  const [leavingItems, setLeavingItems] = useState<StampGridRenderItem[]>([]);
  const previousItemsRef = useRef<StampGridRenderItem[]>(currentItems);
  const timeoutsRef = useRef<number[]>([]);
  const itemSignature = currentItems.map((item) => `${item.key}:${item.x}:${item.y}:${item.cellSize}:${item.stampSize}`).join("|");

  useIsomorphicLayoutEffect(() => {
    if (!animateLayout) {
      previousItemsRef.current = currentItems;
      return;
    }
    const currentKeys = new Set(currentItems.map((item) => item.key));
    const removedItems = previousItemsRef.current.filter((item) => !currentKeys.has(item.key));
    if (removedItems.length) {
      setLeavingItems((items) => [...items.filter((item) => !removedItems.some((removed) => removed.key === item.key)), ...removedItems]);
      const timeout = window.setTimeout(() => {
        setLeavingItems((items) => items.filter((item) => !removedItems.some((removed) => removed.key === item.key)));
      }, 190);
      timeoutsRef.current.push(timeout);
    }
    previousItemsRef.current = currentItems;
  }, [animateLayout, itemSignature]);

  useEffect(() => () => {
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
  }, []);

  let stampIndex = 0;
  const rows = stampLayout.rowCounts.map((rowCount, rowIndex) => ({
    align: stampLayout.rowAlignments[rowIndex] || "center",
    indexes: Array.from({ length: Math.max(0, rowCount) }).map(() => stampIndex++),
  }));
  const slotStyle = stampLayout.usesExplicitSlots ? {
    display: "grid",
    gridTemplateColumns: `repeat(${stampLayout.columns}, ${stampLayout.cellSize * scale}px)`,
    gridTemplateRows: `repeat(${stampLayout.rows}, ${stampLayout.cellSize * scale}px)`,
    gap: stampLayout.gap * scale,
  } : {
    display: "flex",
    flexDirection: "column" as const,
    gap: stampLayout.gap * scale,
  };

  return (
    <div
      key={element.id}
      style={{
        ...frame,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: stampGridAlignItems(element.horizontalAlign),
        justifyContent: stampGridJustifyContent(element.verticalAlign),
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: stampLayout.contentWidth * scale,
          height: stampLayout.contentHeight * scale,
          ...(animateLayout || stampLayout.usesExplicitSlots ? { position: "relative" as const } : slotStyle),
        }}
      >
        {animateLayout || stampLayout.usesExplicitSlots ? (
          <>
            {currentItems.map((item) => renderStampSlot(element, item.stampIndex, item.filled, item.stamp, scale, item.stampSize, item.cellSize, {
              position: "absolute",
              left: item.x * scale,
              top: item.y * scale,
            }, item.key, animateLayout ? "spotlyst-stamp-grid-slot--motion spotlyst-stamp-grid-slot--enter" : undefined, Boolean(animateLayout)))}
            {animateLayout ? leavingItems.map((item) => renderStampSlot(element, item.stampIndex, item.filled, item.stamp, scale, item.stampSize, item.cellSize, {
              position: "absolute",
              left: item.x * scale,
              top: item.y * scale,
            }, `leaving-${item.key}`, "spotlyst-stamp-grid-slot--motion spotlyst-stamp-grid-slot--exit", true)) : null}
          </>
        ) : rows.map((row, rowIndex) => (
          <div key={`${element.id}-row-${rowIndex}`} style={{ display: "flex", justifyContent: stampRowJustifyContent(row.align), gap: stampLayout.gap * scale, height: stampLayout.cellSize * scale }}>
            {row.indexes.map((index) => renderStampSlot(element, index, index < filled, stamps[index], scale, stampLayout.stampSize, stampLayout.cellSize))}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderElement(element: LoyaltyCardElement, schema: LoyaltyCardDesignSchema, scale: number, tokens: LoyaltyCardTokens, options?: { animateStampGridLayout?: boolean }) {
  const frame = elementFrame(element, schema, scale);

  if (element.type === "text") {
    const font = getTextFont(element);
    const verticalAlign = element.verticalAlign || "center";
    const strokeWidth = Math.max(0, element.textStrokeWidth || 0) * scale;
    return (
      <div
        key={element.id}
        style={{
          ...frame,
          overflow: "visible",
          color: element.color,
          fontFamily: `${quoteFontFamily(font.family)}, ${font.fallback}`,
          fontSize: element.fontSize * scale,
          fontWeight: element.fontWeight,
          fontStyle: element.fontStyle || "normal",
          lineHeight: element.lineHeight,
          letterSpacing: `${(element.letterSpacing || 0) * scale}px`,
          textTransform: element.textTransform || "none",
          textAlign: element.align,
          display: "flex",
          alignItems: verticalAlign === "top" ? "flex-start" : verticalAlign === "bottom" ? "flex-end" : "center",
          whiteSpace: "pre-wrap",
          WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px ${element.textStrokeColor || "#000000"}` : undefined,
          paintOrder: strokeWidth > 0 ? "stroke fill" : undefined,
        }}
      >
        {resolveLoyaltyCardToken(element.token || element.fallbackText, tokens)}
      </div>
    );
  }

  if (element.type === "asset") {
    return (
      <div key={element.id} style={{ ...frame, overflow: element.fit === "crop" ? "hidden" : frame.overflow }}>
        {element.imageUrl ? (
          <img
            src={element.imageUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: element.fit === "crop" ? "cover" : element.fit,
              transform: element.fit === "crop" ? `translate(${(element.cropX || 0) * scale}px, ${(element.cropY || 0) * scale}px) scale(${element.cropScale || 1})` : undefined,
              transformOrigin: "center center",
              filter: assetImageFilter(element),
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              border: "2px solid currentColor",
              borderRadius: 999,
              color: element.tint || "currentColor",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.5,
            }}
          >
            {element.assetId || "asset"}
          </div>
        )}
      </div>
    );
  }

  if (element.type === "shape") {
    return (
      <div
        key={element.id}
        style={{
          ...frame,
          background: element.fill,
          border: element.stroke ? `${element.strokeWidth * scale}px solid ${element.stroke}` : undefined,
          borderRadius: element.shape === "circle" ? "999px" : element.shape === "blob" ? "42% 58% 61% 39% / 46% 34% 66% 54%" : element.radius * scale,
        }}
      />
    );
  }

  if (element.type === "line") {
    return <div key={element.id} style={{ ...frame, height: element.strokeWidth * scale, background: element.color }} />;
  }

  if (element.type === "stampGrid") {
    return <LoyaltyCardStampGridElementView key={element.id} element={element} schema={schema} scale={scale} tokens={tokens} animateLayout={options?.animateStampGridLayout} />;
  }

  return null;
}

function getStampDateLabel(stamp: unknown, format: LoyaltyCardStampGridElement["dateFormat"]) {
  if (!stamp || typeof stamp !== "object") return "";
  const value = "awardedAt" in stamp ? (stamp as { awardedAt?: unknown }).awardedAt : "createdAt" in stamp ? (stamp as { createdAt?: unknown }).createdAt : "";
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  if (format === "relative") {
    const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
    if (days === 0) return "Earned today";
    if (days === 1) return "Earned yesterday";
    return `Earned ${days} days ago`;
  }
  const options: Intl.DateTimeFormatOptions = format === "medium" ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return `Earned ${new Intl.DateTimeFormat(undefined, options).format(date)}`;
}

function stampBorderRadius(shape: LoyaltyCardStampGridElement["shape"], scale: number) {
  if (shape === "rounded_square") return 10 * scale;
  if (shape === "heart") return "50% 50% 45% 45%";
  return "999px";
}

function stampAnimation(element: LoyaltyCardStampGridElement, index: number): CSSProperties {
  const animation = element.animation || "none";
  if (animation === "none") return {};
  return {
    animationName: `spotlyst-stamp-${animation}`,
    animationDuration: `${element.animationDuration || 420}ms`,
    animationDelay: `${index * (element.animationStagger || 45)}ms`,
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    animationFillMode: "both",
  };
}

function stableStampHash(elementId: string, index: number, salt: number) {
  let hash = 2166136261;
  for (let charIndex = 0; charIndex < elementId.length; charIndex += 1) {
    hash ^= elementId.charCodeAt(charIndex);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= Math.imul(index + 1, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash ^= Math.imul(salt, 0xc2b2ae35);
  hash = Math.imul(hash ^ (hash >>> 13), 0x27d4eb2d);
  return hash >>> 0;
}

function stableStampUnit(elementId: string, index: number, salt: number) {
  return stableStampHash(elementId, index, salt) / 4294967295;
}

function filledStampImageUrl(element: LoyaltyCardStampGridElement, index: number) {
  const imageUrls = Array.from(new Set([...(element.filledImageUrls || []), element.filledImageUrl || ""].filter(Boolean)));
  if (!imageUrls.length) return "";
  const imageIndex = (index + stableStampHash(element.id, 0, 101)) % imageUrls.length;
  return imageUrls[imageIndex] || imageUrls[0] || "";
}

function filledStampRotation(element: LoyaltyCardStampGridElement, index: number) {
  const maxRotation = Math.max(0, Math.min(45, element.filledRandomRotation ?? 45));
  if (maxRotation === 0) return 0;
  return (stableStampUnit(element.id, index, 211) * 2 - 1) * maxRotation;
}

function renderStampSlot(element: LoyaltyCardStampGridElement, index: number, filled: boolean, stamp: unknown, scale: number, stampSize: number, cellSize: number, position?: CSSProperties, slotKey: string | number = index, className?: string, suppressCellAnimation = false) {
  return (
    <span
      key={`${element.id}-${slotKey}`}
      className={className}
      aria-hidden="true"
      style={{
        width: cellSize * scale,
        height: cellSize * scale,
        display: "grid",
        placeItems: "center",
        minWidth: 0,
        minHeight: 0,
        overflow: "visible",
        ...position,
      }}
    >
      {renderStampCell(element, index, filled, stamp, scale, stampSize, suppressCellAnimation)}
    </span>
  );
}

function renderStampCell(element: LoyaltyCardStampGridElement, index: number, filled: boolean, stamp: unknown, scale: number, stampSize: number, suppressAnimation = false) {
  const dateLabel = filled && element.showStampDates !== false ? getStampDateLabel(stamp, element.dateFormat || "short") : "";
  const label = dateLabel || (filled ? `Stamp ${index + 1} earned` : `Stamp ${index + 1} empty`);
  const baseStyle: CSSProperties = {
    width: stampSize * scale,
    height: stampSize * scale,
    flex: "0 0 auto",
    position: "relative",
    display: "block",
    overflow: "visible",
    ...(suppressAnimation ? {} : stampAnimation(element, index)),
  };
  const composition = element.filledComposition || "overlay";
  const emptyLayer = {
    mode: element.emptyMode || "shape",
    shape: element.emptyShape || element.shape,
    fill: element.emptyFill || element.fill,
    stroke: element.emptyStroke || element.stroke,
    strokeWidth: element.emptyStrokeWidth ?? 2,
    imageUrl: element.emptyImageUrl || "",
    layerScale: element.emptyScale ?? 1,
  };
  const filledLayer = {
    mode: element.filledMode || "shape",
    shape: element.filledShape || element.shape,
    fill: element.filledFill || element.stroke,
    stroke: element.filledStroke || element.stroke,
    strokeWidth: element.filledStrokeWidth ?? 2,
    imageUrl: filledStampImageUrl(element, index),
    layerScale: element.filledScale ?? 1,
  };

  const renderLayer = (layer: typeof emptyLayer, key: string, zIndex: number, rotation = 0) => {
    const hasPresetImage = layer.mode === "image" && Boolean(layer.imageUrl);
    const layerStyle: CSSProperties = {
      position: "absolute",
      inset: 0,
      boxSizing: "border-box",
      zIndex,
      overflow: "visible",
      border: hasPresetImage ? "none" : `${Math.max(1, layer.strokeWidth * scale)}px solid ${layer.stroke}`,
      background: hasPresetImage ? "transparent" : layer.fill,
      borderRadius: hasPresetImage ? 0 : stampBorderRadius(layer.shape, scale),
      pointerEvents: "none",
      transform: `scale(${Math.max(0.25, Math.min(2.5, layer.layerScale))}) rotate(${rotation}deg)`,
      transformOrigin: "center center",
    };
    return (
      <span key={key} aria-hidden="true" style={layerStyle}>
        {hasPresetImage ? (
          <img
            src={layer.imageUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: element.imageFit === "fill" ? "fill" : element.imageFit || "contain",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </span>
    );
  };

  return (
    <span key={`${element.id}-${index}`} title={dateLabel} aria-label={label} style={baseStyle}>
      {filled && composition === "replace" ? renderLayer(filledLayer, "filled", 1, filledStampRotation(element, index)) : renderLayer(emptyLayer, "empty", 1)}
      {filled && composition !== "replace" ? renderLayer(filledLayer, "filled", 2, filledStampRotation(element, index)) : null}
    </span>
  );
}

export function LoyaltyCardRenderer({ schema, face, tokens = {}, className = "", style, animateStampGridLayout = false }: LoyaltyCardRendererProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(720);
  const activeFace = schema.faces[face] || schema.faces.front;
  const visibleElements = activeFace.elements.filter((element) => !element.hidden);
  const scale = width / schema.canvas.width;
  const borderRadius = Math.max(0, schema.canvas.borderRadius ?? 32) * scale;
  useLoyaltyCardFonts(visibleElements);
  useStampAnimationStyles();

  useEffect(() => {
    if (!rootRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect.width) setWidth(entry.contentRect.width);
    });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        borderRadius,
        border: "1px solid rgba(148, 163, 184, 0.22)",
        boxShadow: "0 24px 80px rgba(0, 0, 0, 0.22)",
        isolation: "isolate",
        ...getBackgroundStyle(activeFace.background),
        ...style,
      }}
    >
      {renderBackgroundLayer(activeFace.background, schema)}
      {visibleElements.map((element) => renderElement(element, schema, scale, tokens, { animateStampGridLayout }))}
    </div>
  );
}
