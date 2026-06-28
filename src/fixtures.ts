import type { LoyaltyCardDesignSchema, LoyaltyCardTokens } from "./schema.js";
import { LOYALTY_CARD_CANVAS_HEIGHT, LOYALTY_CARD_CANVAS_WIDTH, LOYALTY_CARD_SCHEMA_VERSION } from "./schema.js";

export const sampleLoyaltyCardTokens: LoyaltyCardTokens = {
  venueName: "Cake Shop",
  tierName: "VIP",
  rewardTitle: "10th cup free",
  rewardDescription: "Enjoy this reward on your next visit.",
  rewardType: "free_item",
  menuItemName: "Small coffee",
  rewardQuantity: 1,
  discountValue: 15,
  discountKind: "percent",
  maxDiscountAmount: 200,
  minOrderAmount: 799,
  expiresAt: "2026-07-17",
  stampsRequired: 10,
  stampsCollected: 6,
  stamps: [
    { awardedAt: "2026-06-01T10:30:00.000Z" },
    { awardedAt: "2026-06-04T14:10:00.000Z" },
    { awardedAt: "2026-06-07T09:45:00.000Z" },
    { awardedAt: "2026-06-09T18:20:00.000Z" },
    { awardedAt: "2026-06-12T12:05:00.000Z" },
    { awardedAt: "2026-06-17T16:40:00.000Z" },
  ],
};

export const defaultLoyaltyCardDesignSchema: LoyaltyCardDesignSchema = {
  version: LOYALTY_CARD_SCHEMA_VERSION,
  canvas: {
    width: LOYALTY_CARD_CANVAS_WIDTH,
    height: LOYALTY_CARD_CANVAS_HEIGHT,
    aspectRatio: "16:9",
    borderRadius: 32,
    safeArea: { x: 48, y: 48, width: 904, height: 466.5 },
  },
  faces: {
    front: {
      background: { type: "solid", color: "#3F7D20" },
      elements: [
        { id: "venue-name", type: "text", token: "{{venueName}}", fallbackText: "Cake Shop", x: 70, y: 70, width: 520, height: 120, rotation: 0, opacity: 1, zIndex: 1, fontSource: "catalog", fontKey: "playfair-display", fontFamily: "Playfair Display", fontUrl: "", fontStyle: "normal", fontSize: 74, fontWeight: 800, lineHeight: 0.95, letterSpacing: -1, textTransform: "none", color: "#FFF9D7", align: "left", verticalAlign: "center", textStrokeColor: "#000000", textStrokeWidth: 0 },
        { id: "card-title", type: "text", token: "Loyalty Card", fallbackText: "", x: 72, y: 190, width: 430, height: 90, rotation: 0, opacity: 1, zIndex: 2, fontSource: "catalog", fontKey: "playfair-display", fontFamily: "Playfair Display", fontUrl: "", fontStyle: "normal", fontSize: 54, fontWeight: 700, lineHeight: 1, letterSpacing: 0, textTransform: "none", color: "#FFF9D7", align: "left", verticalAlign: "center", textStrokeColor: "#000000", textStrokeWidth: 0 },
        { id: "hero-art", type: "asset", assetId: "line-art", imageUrl: "", x: 610, y: 120, width: 310, height: 260, rotation: 0, opacity: 0.9, zIndex: 3, fit: "contain", tint: "#FFF9D7" },
      ],
    },
    back: {
      background: { type: "solid", color: "#FFF9D7" },
      elements: [
        { id: "reward-title", type: "text", token: "{{rewardTitle}}", fallbackText: "10th cup free", x: 70, y: 76, width: 460, height: 120, rotation: 0, opacity: 1, zIndex: 1, fontSource: "catalog", fontKey: "playfair-display", fontFamily: "Playfair Display", fontUrl: "", fontStyle: "normal", fontSize: 58, fontWeight: 800, lineHeight: 0.95, letterSpacing: -0.5, textTransform: "none", color: "#3F7D20", align: "left", verticalAlign: "center", textStrokeColor: "#000000", textStrokeWidth: 0 },
        { id: "stamp-grid", type: "stampGrid", x: 690, y: 72, width: 220, height: 410, rotation: 0, opacity: 1, zIndex: 2, columns: 2, count: 10, countToken: "", filledToken: "", stampDataToken: "{{stamps}}", shape: "circle", emptyMode: "shape", emptyShape: "circle", emptyFill: "#FFF9D7", emptyStroke: "#3F7D20", emptyStrokeWidth: 2, emptyImageUrl: "", filledMode: "shape", filledShape: "circle", filledFill: "#3F7D20", filledStroke: "#3F7D20", filledStrokeWidth: 2, filledImageUrl: "", filledImageUrls: [], filledScale: 1, filledComposition: "overlay", filledRandomRotation: 45, stampSize: 100, previewFilledCount: 6, autoFitContainer: false, horizontalAlign: "center", verticalAlign: "top", imageFit: "contain", imageInset: 6, showStampDates: true, dateFormat: "short", animation: "stamp", animationDuration: 420, animationStagger: 45, stroke: "#3F7D20", fill: "#FFF9D7", gap: 18 },
      ],
    },
    reward: {
      background: { type: "gradient", colors: ["#153B2E", "#3F7D20"], angle: 135 },
      elements: [
        { id: "reward-eyebrow", type: "text", token: "Reward unlocked", fallbackText: "", x: 78, y: 74, width: 470, height: 58, rotation: 0, opacity: 1, zIndex: 1, fontSource: "catalog", fontKey: "outfit", fontFamily: "Outfit", fontUrl: "", fontStyle: "normal", fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: 3, textTransform: "uppercase", color: "#DDF7C2", align: "left", verticalAlign: "center", textStrokeColor: "#000000", textStrokeWidth: 0 },
        { id: "reward-title-unlock", type: "text", token: "{{rewardTitle}}", fallbackText: "10th cup free", x: 76, y: 144, width: 560, height: 138, rotation: 0, opacity: 1, zIndex: 2, fontSource: "catalog", fontKey: "playfair-display", fontFamily: "Playfair Display", fontUrl: "", fontStyle: "normal", fontSize: 72, fontWeight: 850, lineHeight: 0.95, letterSpacing: -1.2, textTransform: "none", color: "#FFF9D7", align: "left", verticalAlign: "center", textStrokeColor: "#000000", textStrokeWidth: 0 },
        { id: "reward-description", type: "text", token: "{{rewardDescription}}", fallbackText: "Enjoy this reward on your next visit.", x: 80, y: 310, width: 520, height: 82, rotation: 0, opacity: 0.92, zIndex: 3, fontSource: "catalog", fontKey: "outfit", fontFamily: "Outfit", fontUrl: "", fontStyle: "normal", fontSize: 31, fontWeight: 600, lineHeight: 1.16, letterSpacing: 0, textTransform: "none", color: "#FFF9D7", align: "left", verticalAlign: "center", textStrokeColor: "#000000", textStrokeWidth: 0 },
        { id: "reward-badge", type: "shape", x: 672, y: 106, width: 220, height: 220, rotation: -8, opacity: 1, zIndex: 4, shape: "circle", fill: "#FFF9D7", stroke: "#DDF7C2", strokeWidth: 8, radius: 999 },
        { id: "reward-badge-text", type: "text", token: "{{tierName}}", fallbackText: "VIP", x: 704, y: 166, width: 160, height: 96, rotation: -8, opacity: 1, zIndex: 5, fontSource: "catalog", fontKey: "outfit", fontFamily: "Outfit", fontUrl: "", fontStyle: "normal", fontSize: 36, fontWeight: 900, lineHeight: 0.95, letterSpacing: 1.2, textTransform: "uppercase", color: "#3F7D20", align: "center", verticalAlign: "center", textStrokeColor: "#000000", textStrokeWidth: 0 },
      ],
    },
  },
};
