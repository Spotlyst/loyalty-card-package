import {
  LOYALTY_CARD_CANVAS_HEIGHT,
  LOYALTY_CARD_CANVAS_WIDTH,
  LOYALTY_CARD_SCHEMA_VERSION,
  type LoyaltyCardDesignSchema,
  type LoyaltyCardElement,
  type LoyaltyCardGroup,
  type LoyaltyCardPresetRecord,
} from "./schema.js";

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

export function normalizeLoyaltyCardElement(element: LoyaltyCardElement): LoyaltyCardElement {
  const width = clampNumber(finiteNumber(element.width, 1), 1, LOYALTY_CARD_CANVAS_WIDTH * 3);
  const height = clampNumber(finiteNumber(element.height, 1), 1, LOYALTY_CARD_CANVAS_HEIGHT * 3);
  const rotation = clampNumber(finiteNumber(element.rotation, 0), -360, 360);

  return {
    ...element,
    x: clampNumber(finiteNumber(element.x, 0), -width, LOYALTY_CARD_CANVAS_WIDTH),
    y: clampNumber(finiteNumber(element.y, 0), -height, LOYALTY_CARD_CANVAS_HEIGHT),
    width,
    height,
    rotation,
    opacity: clampNumber(finiteNumber(element.opacity, 1), 0, 1),
    zIndex: Math.max(1, Math.round(finiteNumber(element.zIndex, 1))),
  } as LoyaltyCardElement;
}

export function normalizeLoyaltyCardLayerOrder(elements: LoyaltyCardElement[]) {
  const ordered = elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => a.element.zIndex - b.element.zIndex || a.index - b.index)
    .map((entry) => entry.element);
  const zIndexById = new Map(ordered.map((element, index) => [element.id, index + 1]));
  return elements.map((element) => normalizeLoyaltyCardElement({ ...element, zIndex: zIndexById.get(element.id) || 1 } as LoyaltyCardElement));
}

export function normalizeLoyaltyCardGroups(groups: LoyaltyCardGroup[] | undefined, elements: LoyaltyCardElement[]) {
  const elementIds = new Set(elements.map((element) => element.id));
  return (groups || [])
    .map((group, index) => ({
      id: group.id || `group-${index + 1}`,
      name: group.name || `Group ${index + 1}`,
      elementIds: Array.from(new Set((group.elementIds || []).filter((id) => elementIds.has(id)))),
      collapsed: Boolean(group.collapsed),
    }))
    .filter((group) => group.elementIds.length > 0);
}

export function normalizeLoyaltyCardSchema(schema: LoyaltyCardDesignSchema): LoyaltyCardDesignSchema {
  const frontFace = schema.faces.front;
  const backFace = schema.faces.back;
  const rewardFace = schema.faces.reward || schema.faces.back;
  return {
    ...schema,
    version: LOYALTY_CARD_SCHEMA_VERSION,
    canvas: {
      width: LOYALTY_CARD_CANVAS_WIDTH,
      height: LOYALTY_CARD_CANVAS_HEIGHT,
      aspectRatio: "16:9",
      borderRadius: clampNumber(finiteNumber(schema.canvas.borderRadius ?? 32, 32), 0, 160),
      safeArea: { x: 48, y: 48, width: 904, height: 466.5 },
    },
    faces: {
      front: {
        ...frontFace,
        elements: normalizeLoyaltyCardLayerOrder(frontFace.elements),
        groups: normalizeLoyaltyCardGroups(frontFace.groups, frontFace.elements),
      },
      back: {
        ...backFace,
        elements: normalizeLoyaltyCardLayerOrder(backFace.elements),
        groups: normalizeLoyaltyCardGroups(backFace.groups, backFace.elements),
      },
      reward: {
        ...rewardFace,
        elements: normalizeLoyaltyCardLayerOrder(rewardFace.elements),
        groups: normalizeLoyaltyCardGroups(rewardFace.groups, rewardFace.elements),
      },
    },
  };
}

export function normalizeLoyaltyCardPreset(preset: LoyaltyCardPresetRecord): LoyaltyCardPresetRecord {
  return {
    ...preset,
    aspectRatio: "16:9",
    designSchema: normalizeLoyaltyCardSchema(preset.designSchema),
  };
}
