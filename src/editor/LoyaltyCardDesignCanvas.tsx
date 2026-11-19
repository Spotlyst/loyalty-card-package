import { LoyaltyCardRenderer } from "../react/LoyaltyCardRenderer.js";
import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { resolveLoyaltyCardToken, type LoyaltyCardDesignSchema, type LoyaltyCardElement, type LoyaltyCardFaceKey, type LoyaltyCardStampGridElement, type LoyaltyCardStampSlot, type LoyaltyCardTokens } from "../schema.js";
import { resolveFittedStampGridLayout } from "../stampGridLayout.js";

type LoyaltyCardDesignCanvasProps = {
  schema: LoyaltyCardDesignSchema;
  face: LoyaltyCardFaceKey;
  selectedElementIds: string[];
  tokens?: LoyaltyCardTokens;
  snapEnabled?: boolean;
  onSelectElement: (elementId: string, additive?: boolean, isolate?: boolean) => void;
  onBeginInteraction?: () => void;
  onChangeElement: (elementId: string, nextElement: LoyaltyCardElement, options?: { recordHistory?: boolean }) => void;
  onChangeElements: (nextElements: LoyaltyCardElement[], options?: { recordHistory?: boolean }) => void;
  /** Fixed card width in pixels (used for zoom). Defaults to filling the container. */
  cardWidth?: number;
  /** Small label drawn above the selected element, such as the card field it shows. */
  renderSelectionTag?: (element: LoyaltyCardElement) => ReactNode;
  /** Changing this replays the stamp animations. */
  replayKey?: number;
};

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type SnapGuides = { x?: number; y?: number };
type Frame = ReturnType<typeof constrainFrame>;
type SnapCandidate = { delta: number; guide: number; distance: number };
type StampEditorPointer = { elementId: string; x: number; y: number } | null;
type StampContextMenu = { elementId: string; row: number; column: number; stampIndex: number; x: number; y: number; closing?: boolean } | null;

const SNAP_THRESHOLD = 6;
const STAMP_CONTROL_FULL_RADIUS = 34;
const STAMP_CONTROL_FADE_RADIUS = 112;
const STAMP_CONTEXT_MENU_EXIT_MS = 120;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function roundUnit(value: number) {
  return Math.round(value * 10) / 10;
}

function rotatedBounds(width: number, height: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
}

function constrainFrame(x: number, y: number, width: number, height: number, rotation: number, schema: LoyaltyCardDesignSchema) {
  const nextWidth = clamp(finiteNumber(width, 1), 1, schema.canvas.width * 3);
  const nextHeight = clamp(finiteNumber(height, 1), 1, schema.canvas.height * 3);
  const nextRotation = finiteNumber(rotation, 0);

  return {
    x: clamp(finiteNumber(x, 0), -nextWidth, schema.canvas.width),
    y: clamp(finiteNumber(y, 0), -nextHeight, schema.canvas.height),
    width: nextWidth,
    height: nextHeight,
    rotation: nextRotation,
  };
}

function elementTransform(x: number, y: number, rotation: number, scale: number) {
  return `translate(${x * scale}px, ${y * scale}px) rotate(${rotation || 0}deg)`;
}

function overlayElementStyle(element: LoyaltyCardElement, scale: number): CSSProperties {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: element.width * scale,
    height: element.height * scale,
    transform: elementTransform(element.x, element.y, element.rotation, scale),
    zIndex: element.zIndex,
  };
}

function stampGridContentOffset(element: LoyaltyCardStampGridElement, width: number, height: number) {
  const x = element.horizontalAlign === "left" ? 0 : element.horizontalAlign === "right" ? element.width - width : (element.width - width) / 2;
  const y = element.verticalAlign === "center" ? (element.height - height) / 2 : element.verticalAlign === "bottom" ? element.height - height : 0;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

function compactStampSlots(slots: LoyaltyCardStampSlot[]) {
  const used = new Set<string>();
  const boundedSlots = slots.flatMap((slot) => {
    const row = clamp(Math.floor(Number(slot.row) || 0), 0, 19);
    const column = clamp(Math.floor(Number(slot.column) || 0), 0, 11);
    const key = `${row}:${column}`;
    if (used.has(key)) return [];
    used.add(key);
    return [{ ...slot, row, column }];
  });
  const rows = Array.from(new Set(boundedSlots.map((slot) => slot.row))).sort((a, b) => a - b);
  const rowIndexByOldRow = new Map(rows.map((row, index) => [row, index]));
  return boundedSlots
    .map((slot) => ({ ...slot, row: rowIndexByOldRow.get(slot.row) ?? slot.row }))
    .sort((a, b) => a.row - b.row || a.column - b.column)
    .map((slot, index) => ({ ...slot, id: slot.id || `slot-${index}` }));
}

function stampGridRuntimeCount(element: LoyaltyCardStampGridElement, tokens?: LoyaltyCardTokens) {
  return Math.max(1, Math.min(100, Number(resolveLoyaltyCardToken(element.countToken, tokens || {})) || element.count || 10));
}

function stampSlotsFromElement(element: LoyaltyCardStampGridElement, runtimeCount?: number) {
  const layout = resolveFittedStampGridLayout(element, runtimeCount);
  return layout.slots.map((slot) => {
    if (layout.usesExplicitSlots) return { id: slot.id, row: slot.row, column: slot.column };
    const rowCount = layout.rowCounts[slot.row] || 0;
    const align = layout.rowAlignments[slot.row] || "center";
    const shift = align === "right" ? layout.columns - rowCount : align === "left" ? 0 : Math.floor((layout.columns - rowCount) / 2);
    return { id: slot.id, row: slot.row, column: slot.column + Math.max(0, shift) };
  });
}

function stampRowsFromSlots(slots: LoyaltyCardStampSlot[], previousRows: LoyaltyCardStampGridElement["stampRows"]) {
  const rows = Array.from(new Set(slots.map((slot) => slot.row))).sort((a, b) => a - b);
  return rows.map((row) => ({
    count: slots.filter((slot) => slot.row === row).length,
    align: previousRows?.[row]?.align || "center",
  }));
}

function withStampSlots(element: LoyaltyCardStampGridElement, slots: LoyaltyCardStampSlot[], minColumns = 0): LoyaltyCardStampGridElement {
  const nextSlots = compactStampSlots(slots).slice(0, 100);
  const rows = stampRowsFromSlots(nextSlots, element.stampRows);
  const count = Math.max(1, nextSlots.length);
  return {
    ...element,
    stampSlots: nextSlots,
    stampRows: rows,
    count,
    columns: Math.max(1, minColumns, ...nextSlots.map((slot) => slot.column + 1), ...rows.map((row) => row.count)),
    previewFilledCount: element.previewFilledMode === "manual" ? Math.min(element.previewFilledCount || 0, count) : undefined,
    countToken: "",
    filledToken: "",
  };
}

function reflowStampSlotsByRowAlignment(element: LoyaltyCardStampGridElement, slots: LoyaltyCardStampSlot[]) {
  if (!slots.length) return element;
  const rows = Array.from(new Set(slots.map((slot) => slot.row))).sort((a, b) => a - b);
  const alignments = rows.map((oldRow) => element.stampRows?.[oldRow]?.align || "center");
  const rowSlots = rows.map((row) => slots.filter((slot) => slot.row === row).sort((a, b) => a.column - b.column));
  const columns = Math.max(1, ...rowSlots.map((items) => items.length));
  const shiftedSlots = rowSlots.flatMap((items, rowIndex) => {
    const oldRow = rows[rowIndex];
    const align = element.stampRows?.[oldRow]?.align || "center";
    const start = align === "right" ? columns - items.length : align === "left" ? 0 : Math.floor((columns - items.length) / 2);
    return items.map((slot, index) => ({ ...slot, row: rowIndex, column: Math.max(0, start) + index }));
  });
  const nextElement = withStampSlots(element, shiftedSlots, columns);
  return {
    ...nextElement,
    stampRows: nextElement.stampRows?.map((row, index) => ({ ...row, align: alignments[index] || row.align || "center" })),
  };
}

function insertStampInRow(element: LoyaltyCardStampGridElement, row: number, column: number, runtimeCount?: number) {
  const layout = resolveFittedStampGridLayout(element, runtimeCount);
  const slots = stampSlotsFromElement(element, runtimeCount);
  const rowSlots = slots.filter((slot) => slot.row === row);
  if (rowSlots.length >= 12) return element;
  const nextColumn = clamp(Math.floor(column), 0, 11);
  const shifted = slots.map((slot) => slot.row === row && slot.column >= nextColumn && slot.column < 11 ? { ...slot, column: slot.column + 1 } : slot);
  return withStampSlots(element, [...shifted, { id: `slot-${Date.now()}-${row}-${nextColumn}`, row, column: nextColumn }], Math.min(layout.columns, 12));
}

function stampRowAlignFromColumn(column: number, columns: number): "left" | "center" | "right" {
  if (column <= 0) return "left";
  if (column >= columns - 1) return "right";
  return "center";
}

function insertStampRow(element: LoyaltyCardStampGridElement, row: number, column = 0, runtimeCount?: number, align?: "left" | "center" | "right") {
  const layout = resolveFittedStampGridLayout(element, runtimeCount);
  if (layout.rows >= 20) return element;
  const slots = stampSlotsFromElement(element, runtimeCount).map((slot) => slot.row >= row ? { ...slot, row: slot.row + 1 } : slot);
  const nextAlign = align || stampRowAlignFromColumn(column, layout.columns);
  const nextElement = withStampSlots(element, [...slots, { id: `slot-${Date.now()}-${row}-0`, row, column: 0 }], Math.min(layout.columns, 12));
  return {
    ...nextElement,
    stampRows: nextElement.stampRows?.map((nextRow, index) => {
      if (index === row) return { ...nextRow, align: nextAlign };
      const oldIndex = index > row ? index - 1 : index;
      return { ...nextRow, align: element.stampRows?.[oldIndex]?.align || nextRow.align || "center" };
    }),
  };
}

function removeStampSlot(element: LoyaltyCardStampGridElement, row: number, column: number, runtimeCount?: number) {
  const slots = stampSlotsFromElement(element, runtimeCount);
  if (slots.length <= 1) return element;
  const remaining = slots
    .filter((slot) => !(slot.row === row && slot.column === column))
    .map((slot) => slot.row === row && slot.column > column ? { ...slot, column: slot.column - 1 } : slot);
  return reflowStampSlotsByRowAlignment(element, remaining);
}

function alignStampRow(element: LoyaltyCardStampGridElement, row: number, align: "left" | "center" | "right", runtimeCount?: number) {
  const layout = resolveFittedStampGridLayout(element, runtimeCount);
  const slots = stampSlotsFromElement(element, runtimeCount);
  const rowSlots = slots.filter((slot) => slot.row === row);
  if (!rowSlots.length) return element;
  const sortedRowSlots = rowSlots.sort((a, b) => a.column - b.column);
  const shiftedSlots = slots.map((slot) => {
    if (slot.row !== row) return slot;
    const column = Math.max(0, sortedRowSlots.findIndex((candidate) => candidate.id === slot.id));
    return { ...slot, column };
  });
  const nextElement = withStampSlots(element, shiftedSlots, layout.columns);
  const rows = stampRowsFromSlots(nextElement.stampSlots || [], nextElement.stampRows);
  return { ...nextElement, stampRows: rows.map((item, index) => index === row ? { ...item, align } : item) };
}

function getGroupElementIds(schema: LoyaltyCardDesignSchema, face: LoyaltyCardFaceKey, elementId: string) {
  return schema.faces[face]?.groups?.find((group) => group.elementIds.includes(elementId))?.elementIds || [elementId];
}

function elementBounds(element: LoyaltyCardElement) {
  const bounds = rotatedBounds(element.width, element.height, element.rotation || 0);
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  return {
    left: centerX - bounds.width / 2,
    top: centerY - bounds.height / 2,
    right: centerX + bounds.width / 2,
    bottom: centerY + bounds.height / 2,
  };
}

function groupFrame(elements: LoyaltyCardElement[]) {
  const bounds = elements.map(elementBounds);
  const left = Math.min(...bounds.map((bound) => bound.left));
  const top = Math.min(...bounds.map((bound) => bound.top));
  const right = Math.max(...bounds.map((bound) => bound.right));
  const bottom = Math.max(...bounds.map((bound) => bound.bottom));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function overlayGroupStyle(frame: ReturnType<typeof groupFrame>, scale: number): CSSProperties {
  return {
    position: "absolute",
    left: frame.x * scale,
    top: frame.y * scale,
    width: frame.width * scale,
    height: frame.height * scale,
    zIndex: 2000,
  };
}

function snapTargets(schema: LoyaltyCardDesignSchema, elements: LoyaltyCardElement[], movingIds: Set<string>) {
  const safeArea = schema.canvas.safeArea;
  const xTargets = [0, schema.canvas.width / 2, schema.canvas.width, safeArea.x, safeArea.x + safeArea.width / 2, safeArea.x + safeArea.width];
  const yTargets = [0, schema.canvas.height / 2, schema.canvas.height, safeArea.y, safeArea.y + safeArea.height / 2, safeArea.y + safeArea.height];

  elements.forEach((element) => {
    if (movingIds.has(element.id)) return;
    const bounds = elementBounds(element);
    xTargets.push(bounds.left, (bounds.left + bounds.right) / 2, bounds.right);
    yTargets.push(bounds.top, (bounds.top + bounds.bottom) / 2, bounds.bottom);
  });

  return { xTargets, yTargets };
}

function closestSnap(points: number[], targets: number[]) {
  let best: SnapCandidate | null = null;
  for (const point of points) {
    for (const target of targets) {
      const distance = Math.abs(target - point);
      if (distance > SNAP_THRESHOLD) continue;
      if (!best || distance < best.distance) best = { delta: target - point, guide: target, distance };
    }
  }
  return best;
}

function frameBounds(frame: Frame) {
  const bounds = rotatedBounds(frame.width, frame.height, frame.rotation || 0);
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  return {
    left: centerX - bounds.width / 2,
    top: centerY - bounds.height / 2,
    right: centerX + bounds.width / 2,
    bottom: centerY + bounds.height / 2,
    centerX,
    centerY,
  };
}

function snapDragFrame(frame: Frame, targets: ReturnType<typeof snapTargets>) {
  const bounds = frameBounds(frame);
  const xSnap = closestSnap([bounds.left, bounds.centerX, bounds.right], targets.xTargets);
  const ySnap = closestSnap([bounds.top, bounds.centerY, bounds.bottom], targets.yTargets);
  return {
    frame: {
      ...frame,
      x: frame.x + (xSnap?.delta || 0),
      y: frame.y + (ySnap?.delta || 0),
    },
    guides: { x: xSnap?.guide, y: ySnap?.guide } as SnapGuides,
  };
}

function snapGroupFrame(frame: { x: number; y: number; width: number; height: number }, targets: ReturnType<typeof snapTargets>) {
  const xSnap = closestSnap([frame.x, frame.x + frame.width / 2, frame.x + frame.width], targets.xTargets);
  const ySnap = closestSnap([frame.y, frame.y + frame.height / 2, frame.y + frame.height], targets.yTargets);
  return {
    dx: xSnap?.delta || 0,
    dy: ySnap?.delta || 0,
    guides: { x: xSnap?.guide, y: ySnap?.guide } as SnapGuides,
  };
}

function snapResizeFrame(frame: Frame, direction: ResizeDirection, targets: ReturnType<typeof snapTargets>) {
  const next = { ...frame };
  const guides: SnapGuides = {};

  if (direction.includes("w")) {
    const snap = closestSnap([next.x], targets.xTargets);
    if (snap) {
      next.x += snap.delta;
      next.width -= snap.delta;
      guides.x = snap.guide;
    }
  } else if (direction.includes("e")) {
    const snap = closestSnap([next.x + next.width], targets.xTargets);
    if (snap) {
      next.width += snap.delta;
      guides.x = snap.guide;
    }
  }

  if (direction.includes("n")) {
    const snap = closestSnap([next.y], targets.yTargets);
    if (snap) {
      next.y += snap.delta;
      next.height -= snap.delta;
      guides.y = snap.guide;
    }
  } else if (direction.includes("s")) {
    const snap = closestSnap([next.y + next.height], targets.yTargets);
    if (snap) {
      next.height += snap.delta;
      guides.y = snap.guide;
    }
  }

  return { frame: next, guides };
}

function snapCenteredResizeFrame(frame: Frame, direction: ResizeDirection, targets: ReturnType<typeof snapTargets>, centerX: number, centerY: number) {
  const next = { ...frame };
  const guides: SnapGuides = {};

  if (direction.includes("w")) {
    const snap = closestSnap([next.x], targets.xTargets);
    if (snap) {
      next.x += snap.delta;
      next.width -= snap.delta * 2;
      guides.x = snap.guide;
    }
  } else if (direction.includes("e")) {
    const snap = closestSnap([next.x + next.width], targets.xTargets);
    if (snap) {
      next.x -= snap.delta;
      next.width += snap.delta * 2;
      guides.x = snap.guide;
    }
  }

  if (direction.includes("n")) {
    const snap = closestSnap([next.y], targets.yTargets);
    if (snap) {
      next.y += snap.delta;
      next.height -= snap.delta * 2;
      guides.y = snap.guide;
    }
  } else if (direction.includes("s")) {
    const snap = closestSnap([next.y + next.height], targets.yTargets);
    if (snap) {
      next.y -= snap.delta;
      next.height += snap.delta * 2;
      guides.y = snap.guide;
    }
  }

  next.x = centerX - next.width / 2;
  next.y = centerY - next.height / 2;
  return { frame: next, guides };
}

export function LoyaltyCardDesignCanvas({
  schema,
  face,
  selectedElementIds,
  tokens = {},
  snapEnabled = true,
  onSelectElement,
  onBeginInteraction,
  onChangeElement,
  onChangeElements,
  cardWidth,
  renderSelectionTag,
  replayKey = 0,
}: LoyaltyCardDesignCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const stampContextMenuRef = useRef<HTMLDivElement | null>(null);
  const firstStampContextMenuItemRef = useRef<HTMLButtonElement | null>(null);
  const focusStampContextMenuOnOpenRef = useRef(false);
  const autoFitRef = useRef<Record<string, string>>({});
  const stampEditorClearTimeoutRef = useRef<number | null>(null);
  const stampContextMenuCloseTimeoutRef = useRef<number | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(900);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({});
  const [assetRatios, setAssetRatios] = useState<Record<string, number>>({});
  const [stampEditorPointer, setStampEditorPointer] = useState<StampEditorPointer>(null);
  const [stampContextMenu, setStampContextMenu] = useState<StampContextMenu>(null);
  const activeFace = schema.faces[face] || schema.faces.front;
  const visibleElements = activeFace.elements.filter((element) => !element.hidden);
  const selectedElement = selectedElementIds.length === 1 ? activeFace.elements.find((element) => element.id === selectedElementIds[0]) || null : null;
  const scale = canvasWidth / schema.canvas.width;
  const selectedGroups = (activeFace.groups || []).filter((group) => group.elementIds.length > 1 && group.elementIds.every((id) => selectedElementIds.includes(id)));
  const groupSelectedElementIds = new Set(selectedGroups.flatMap((group) => group.elementIds));

  function closeStampContextMenu(immediate = false) {
    focusStampContextMenuOnOpenRef.current = false;
    if (stampContextMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(stampContextMenuCloseTimeoutRef.current);
      stampContextMenuCloseTimeoutRef.current = null;
    }
    if (immediate) {
      setStampContextMenu(null);
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && stampContextMenuRef.current?.contains(activeElement)) activeElement.blur();
    setStampContextMenu((current) => current ? { ...current, closing: true } : null);
    stampContextMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setStampContextMenu(null);
      stampContextMenuCloseTimeoutRef.current = null;
    }, STAMP_CONTEXT_MENU_EXIT_MS);
  }

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth) setCanvasWidth(nextWidth);
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (stampEditorClearTimeoutRef.current !== null) window.clearTimeout(stampEditorClearTimeoutRef.current);
    if (stampContextMenuCloseTimeoutRef.current !== null) window.clearTimeout(stampContextMenuCloseTimeoutRef.current);
  }, []);

  useEffect(() => {
    closeStampContextMenu(true);
  }, [face, selectedElementIds.join(":")]);

  useEffect(() => {
    if (!stampContextMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (stampContextMenuRef.current?.contains(event.target as Node)) return;
      closeStampContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeStampContextMenu();
    };
    if (focusStampContextMenuOnOpenRef.current) {
      window.requestAnimationFrame(() => firstStampContextMenuItemRef.current?.focus());
      focusStampContextMenuOnOpenRef.current = false;
    }
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [stampContextMenu]);

  useEffect(() => {
    activeFace.elements.forEach((element) => {
      if (element.type !== "asset" || !element.imageUrl || assetRatios[element.imageUrl]) return;
      const image = new window.Image();
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        setAssetRatios((current) => ({ ...current, [element.imageUrl]: image.naturalWidth / image.naturalHeight }));
      };
      image.src = element.imageUrl;
    });
  }, [activeFace.elements, assetRatios]);

  useEffect(() => {
    activeFace.elements.forEach((element) => {
      if (element.type !== "asset" || !element.imageUrl || element.fit !== "contain") return;
      const ratio = assetRatios[element.imageUrl];
      if (!ratio) return;
      const autoFitKey = `${element.imageUrl}:${ratio}`;
      if (autoFitRef.current[element.id] === autoFitKey) return;
      autoFitRef.current[element.id] = autoFitKey;
      const currentRatio = element.width / element.height;
      if (Math.abs(currentRatio - ratio) < 0.02) return;
      let width = element.width;
      let height = width / ratio;
      if (height > schema.canvas.height * 3) {
        height = element.height;
        width = height * ratio;
      }
      const x = element.x + (element.width - width) / 2;
      const y = element.y + (element.height - height) / 2;
      const frame = constrainFrame(x, y, width, height, element.rotation, schema);
      commitFrame(element, frame);
    });
  }, [activeFace.elements, assetRatios, schema]);

  const commitFrame = (element: LoyaltyCardElement, frame: ReturnType<typeof constrainFrame>) => {
    onChangeElement(element.id, {
      ...element,
      x: roundUnit(frame.x),
      y: roundUnit(frame.y),
      width: roundUnit(frame.width),
      height: roundUnit(frame.height),
      rotation: roundUnit(frame.rotation),
    } as LoyaltyCardElement, { recordHistory: false });
  };

  const commitFrames = (framesById: Map<string, ReturnType<typeof constrainFrame>>) => {
    onChangeElements(activeFace.elements.map((element) => {
      const frame = framesById.get(element.id);
      if (!frame) return element;
      return {
        ...element,
        x: roundUnit(frame.x),
        y: roundUnit(frame.y),
        width: roundUnit(frame.width),
        height: roundUnit(frame.height),
        rotation: roundUnit(frame.rotation),
      } as LoyaltyCardElement;
    }), { recordHistory: false });
  };

  const startDrag = (event: ReactPointerEvent, element: LoyaltyCardElement) => {
    event.preventDefault();
    event.stopPropagation();
    onBeginInteraction?.();
    const groupElementIds = getGroupElementIds(schema, face, element.id);
    const isSelected = selectedElementIds.includes(element.id);
    const isGroupSelected = groupElementIds.every((id) => selectedElementIds.includes(id));
    if (!isSelected || event.shiftKey || event.altKey) onSelectElement(element.id, event.shiftKey, event.altKey);
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const dragIds = (event.altKey ? [element.id] : isSelected || isGroupSelected ? selectedElementIds : groupElementIds).filter((id) => {
      const item = activeFace.elements.find((candidate) => candidate.id === id);
      return item && !item.locked && !item.hidden;
    });
    const starts = activeFace.elements.filter((item) => dragIds.includes(item.id)).map((item) => ({ ...item }));
    if (starts.length === 0) return;
    const movingIds = new Set(starts.map((item) => item.id));
    const targets = snapTargets(schema, visibleElements, movingIds);

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startClientX) / scale;
      const dy = (moveEvent.clientY - startClientY) / scale;
      if (starts.length === 1) {
        const start = starts[0];
        const baseFrame = constrainFrame(start.x + dx, start.y + dy, start.width, start.height, start.rotation, schema);
        const snapped = !snapEnabled || moveEvent.altKey ? { frame: baseFrame, guides: {} } : snapDragFrame(baseFrame, targets);
        setSnapGuides(snapped.guides);
        commitFrame(start, constrainFrame(snapped.frame.x, snapped.frame.y, snapped.frame.width, snapped.frame.height, snapped.frame.rotation, schema));
        return;
      }
      const tentativeFrames = starts.map((start) => ({ ...start, x: start.x + dx, y: start.y + dy } as LoyaltyCardElement));
      const groupSnap = !snapEnabled || moveEvent.altKey ? { dx: 0, dy: 0, guides: {} } : snapGroupFrame(groupFrame(tentativeFrames), targets);
      setSnapGuides(groupSnap.guides);
      const framesById = new Map(starts.map((start) => [start.id, constrainFrame(start.x + dx + groupSnap.dx, start.y + dy + groupSnap.dy, start.width, start.height, start.rotation, schema)]));
      commitFrames(framesById);
    };

    const handleEnd = () => {
      setSnapGuides({});
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  };

  const startResize = (event: ReactPointerEvent, element: LoyaltyCardElement, direction: ResizeDirection) => {
    event.preventDefault();
    event.stopPropagation();
    onBeginInteraction?.();
    onSelectElement(element.id, false, true);
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const start = { ...element };
    const locksToSquare = element.type === "shape" && (element.lockAspectRatio ?? (element.shape === "circle" || element.shape === "blob"));
    const locksAssetRatio = element.type === "asset" && (element.lockAspectRatio ?? true);
    const aspectRatio = locksToSquare ? 1 : locksAssetRatio ? element.width / element.height : null;
    const lockAspectRatio = Boolean(aspectRatio);
    const centerX = start.x + start.width / 2;
    const centerY = start.y + start.height / 2;
    const movingIds = new Set([element.id]);
    const targets = snapTargets(schema, visibleElements, movingIds);

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startClientX) / scale;
      const dy = (moveEvent.clientY - startClientY) / scale;
      let nextX = start.x;
      let nextY = start.y;
      let nextWidth = start.width;
      let nextHeight = start.height;

      if (moveEvent.altKey) {
        const widthDelta = direction.includes("e") ? dx : direction.includes("w") ? -dx : 0;
        const heightDelta = direction.includes("s") ? dy : direction.includes("n") ? -dy : 0;
        nextWidth = start.width + widthDelta * 2;
        nextHeight = start.height + heightDelta * 2;
        nextX = centerX - nextWidth / 2;
        nextY = centerY - nextHeight / 2;
      } else {
        if (direction.includes("e")) nextWidth = start.width + dx;
        if (direction.includes("s")) nextHeight = start.height + dy;
        if (direction.includes("w")) {
          nextX = start.x + dx;
          nextWidth = start.width - dx;
        }
        if (direction.includes("n")) {
          nextY = start.y + dy;
          nextHeight = start.height - dy;
        }
      }

      if (lockAspectRatio && aspectRatio) {
        const horizontalOnly = direction === "e" || direction === "w";
        const verticalOnly = direction === "n" || direction === "s";
        if (horizontalOnly || (!verticalOnly && Math.abs(dx) >= Math.abs(dy))) {
          nextHeight = nextWidth / aspectRatio;
        } else {
          nextWidth = nextHeight * aspectRatio;
        }
        if (moveEvent.altKey) {
          nextX = centerX - nextWidth / 2;
          nextY = centerY - nextHeight / 2;
        } else {
          if (direction.includes("w")) nextX = start.x + start.width - nextWidth;
          if (direction.includes("n")) nextY = start.y + start.height - nextHeight;
          if (!direction.includes("n") && !direction.includes("s")) nextY = centerY - nextHeight / 2;
          if (!direction.includes("e") && !direction.includes("w")) nextX = centerX - nextWidth / 2;
        }
      }

      const baseFrame = constrainFrame(nextX, nextY, nextWidth, nextHeight, start.rotation, schema);
      const snapped = !snapEnabled ? { frame: baseFrame, guides: {} } : moveEvent.altKey ? snapCenteredResizeFrame(baseFrame, direction, targets, centerX, centerY) : snapResizeFrame(baseFrame, direction, targets);
      if (lockAspectRatio && aspectRatio) {
        if (snapped.guides.x !== undefined) {
          const width = snapped.frame.width;
          const height = width / aspectRatio;
          snapped.frame.height = height;
          if (moveEvent.altKey) {
            snapped.frame.x = centerX - width / 2;
            snapped.frame.y = centerY - height / 2;
          } else if (direction.includes("n")) snapped.frame.y = start.y + start.height - height;
          else if (!direction.includes("s")) snapped.frame.y = centerY - height / 2;
        } else if (snapped.guides.y !== undefined) {
          const height = snapped.frame.height;
          const width = height * aspectRatio;
          snapped.frame.width = width;
          if (moveEvent.altKey) {
            snapped.frame.x = centerX - width / 2;
            snapped.frame.y = centerY - height / 2;
          } else if (direction.includes("w")) snapped.frame.x = start.x + start.width - width;
          else if (!direction.includes("e")) snapped.frame.x = centerX - width / 2;
        }
      }
      setSnapGuides(snapped.guides);
      commitFrame(element, constrainFrame(snapped.frame.x, snapped.frame.y, snapped.frame.width, snapped.frame.height, snapped.frame.rotation, schema));
    };

    const handleEnd = () => {
      setSnapGuides({});
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  };

  const startRotate = (event: ReactPointerEvent, element: LoyaltyCardElement) => {
    event.preventDefault();
    event.stopPropagation();
    onBeginInteraction?.();
    onSelectElement(element.id, false, true);
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.left + (element.x + element.width / 2) * scale;
    const centerY = rect.top + (element.y + element.height / 2) * scale;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
    const startRotation = element.rotation || 0;

    const handleMove = (moveEvent: PointerEvent) => {
      const nextAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
      commitFrame(element, constrainFrame(element.x, element.y, element.width, element.height, startRotation + nextAngle - startAngle, schema));
    };

    const handleEnd = () => {
      setSnapGuides({});
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  };

  // Drawn in card coordinates above the layer's rotated bounds, so it stays on top whatever the rotation.
  const renderSelectionTagFor = (element: LoyaltyCardElement) => {
    if (!renderSelectionTag || element.id !== selectedElement?.id) return null;
    const tag = renderSelectionTag(element);
    if (tag === null || tag === undefined || tag === false) return null;
    const angle = ((element.rotation || 0) * Math.PI) / 180;
    const halfWidth = (element.width * Math.abs(Math.cos(angle)) + element.height * Math.abs(Math.sin(angle))) / 2;
    const halfHeight = (element.width * Math.abs(Math.sin(angle)) + element.height * Math.abs(Math.cos(angle))) / 2;
    const left = (element.x + element.width / 2 - halfWidth) * scale;
    const top = (element.y + element.height / 2 - halfHeight) * scale;
    return <span className="loyalty-design-canvas__tag" style={{ left, top }}>{tag}</span>;
  };

  const renderHandles = (element: LoyaltyCardElement) => {
    if (element.id !== selectedElement?.id) return null;
    const directions: ResizeDirection[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
    return (
      <>
        {directions.map((direction) => (
          <span key={direction} className={`loyalty-design-canvas__handle loyalty-design-canvas__handle--${direction}`} onPointerDown={(event) => startResize(event, element, direction)} />
        ))}
        <span className="loyalty-design-canvas__rotate" onPointerDown={(event) => startRotate(event, element)} />
      </>
    );
  };

  const updateStampGrid = (element: LoyaltyCardStampGridElement, nextElement: LoyaltyCardStampGridElement) => {
    onBeginInteraction?.();
    closeStampContextMenu();
    onChangeElement(element.id, nextElement as LoyaltyCardElement);
  };

  const openStampContextMenu = (element: LoyaltyCardStampGridElement, slot: { row: number; column: number; stampIndex: number }, x: number, y: number, focusMenu = false) => {
    if (stampContextMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(stampContextMenuCloseTimeoutRef.current);
      stampContextMenuCloseTimeoutRef.current = null;
    }
    focusStampContextMenuOnOpenRef.current = focusMenu;
    setStampContextMenu({
      elementId: element.id,
      row: slot.row,
      column: slot.column,
      stampIndex: slot.stampIndex,
      x,
      y,
    });
  };

  const handleStampContextMenu = (event: ReactMouseEvent<HTMLButtonElement>, element: LoyaltyCardStampGridElement, slot: { row: number; column: number; stampIndex: number }) => {
    event.preventDefault();
    event.stopPropagation();
    const host = event.currentTarget.closest(".loyalty-design-canvas__element") as HTMLElement | null;
    const rect = host?.getBoundingClientRect();
    if (!rect) return;
    openStampContextMenu(element, slot, (event.clientX - rect.left) / scale, (event.clientY - rect.top) / scale);
  };

  const handleStampContextKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, element: LoyaltyCardStampGridElement, slot: { row: number; column: number; stampIndex: number }, x: number, y: number) => {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    event.stopPropagation();
    openStampContextMenu(element, slot, x, y, true);
  };

  const updateStampEditorPointer = (event: ReactPointerEvent<HTMLDivElement>, element: LoyaltyCardElement) => {
    if (element.type !== "stampGrid" || element.id !== selectedElement?.id || element.locked) return;
    if (stampEditorClearTimeoutRef.current !== null) {
      window.clearTimeout(stampEditorClearTimeoutRef.current);
      stampEditorClearTimeoutRef.current = null;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setStampEditorPointer({
      elementId: element.id,
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    });
  };

  const clearStampEditorPointer = (element: LoyaltyCardElement) => {
    if (element.type !== "stampGrid" || stampEditorPointer?.elementId !== element.id) return;
    if (stampEditorClearTimeoutRef.current !== null) window.clearTimeout(stampEditorClearTimeoutRef.current);
    stampEditorClearTimeoutRef.current = window.setTimeout(() => {
      setStampEditorPointer(null);
      stampEditorClearTimeoutRef.current = null;
    }, 220);
  };

  const stampControlRevealStyle = (element: LoyaltyCardStampGridElement, centerX: number, centerY: number): CSSProperties => {
    const pointer = stampEditorPointer?.elementId === element.id ? stampEditorPointer : null;
    const distance = pointer ? Math.hypot(pointer.x - centerX, pointer.y - centerY) : Number.POSITIVE_INFINITY;
    const opacity = clamp((STAMP_CONTROL_FADE_RADIUS - distance) / (STAMP_CONTROL_FADE_RADIUS - STAMP_CONTROL_FULL_RADIUS), 0, 1);
    return {
      opacity,
      pointerEvents: opacity > 0.12 ? "auto" : "none",
      transform: `scale(${0.76 + opacity * 0.24})`,
    };
  };

  const renderStampGridInlineEditor = (element: LoyaltyCardElement) => {
    if (element.type !== "stampGrid" || element.id !== selectedElement?.id || element.locked) return null;
    const runtimeCount = stampGridRuntimeCount(element, tokens);
    const layout = resolveFittedStampGridLayout(element, runtimeCount);
    const offset = stampGridContentOffset(element, layout.contentWidth, layout.contentHeight);
    const rowSlots = Array.from({ length: layout.rows }).map((_, row) => layout.slots.filter((slot) => slot.row === row).sort((a, b) => a.column - b.column));
    const rowStartX = (row: number) => {
      const slots = rowSlots[row] || [];
      const rowWidth = slots.length * layout.cellSize + Math.max(0, slots.length - 1) * layout.gap;
      const align = layout.rowAlignments[row] || element.horizontalAlign || "center";
      if (align === "left") return offset.x;
      if (align === "right") return offset.x + layout.contentWidth - rowWidth;
      return offset.x + (layout.contentWidth - rowWidth) / 2;
    };
    const columnX = (column: number) => offset.x + column * (layout.cellSize + layout.gap);
    const slotPosition = (row: number, position: number) => ({
      x: rowStartX(row) + position * (layout.cellSize + layout.gap),
      y: offset.y + row * (layout.cellSize + layout.gap),
    });
    const handlePointer = (event: ReactPointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const activeMenu = stampContextMenu?.elementId === element.id ? stampContextMenu : null;
    return (
      <div className="loyalty-stamp-inline-editor" style={{ inset: 0 }}>
        {rowSlots.map((slots, row) => {
          const y = offset.y + row * (layout.cellSize + layout.gap) + layout.cellSize / 2;
          return (
            <div key={`row-${row}`}>
              {Array.from({ length: slots.length + 1 }).map((_, position) => {
                const column = position >= slots.length ? Math.min(11, (slots[slots.length - 1]?.column ?? -1) + 1) : slots[position].column;
                const x = rowStartX(row) + position * (layout.cellSize + layout.gap) - (position === 0 ? 14 : layout.gap / 2 + 7);
                if (slots.length >= 12) return null;
                return <button key={`insert-${row}-${position}`} type="button" className="loyalty-stamp-inline-editor__insert" style={{ left: x * scale, top: (y - 11) * scale, ...stampControlRevealStyle(element, x + 11, y) }} onPointerDown={handlePointer} onClick={() => updateStampGrid(element, insertStampInRow(element, row, column, runtimeCount))} aria-label={`Insert stamp in row ${row + 1}`} />;
              })}
              <div className="loyalty-stamp-inline-editor__row-toolbar" style={{ left: (offset.x + layout.contentWidth + 8) * scale, top: (y - 12) * scale, ...stampControlRevealStyle(element, offset.x + layout.contentWidth + 47, y) }} onPointerDown={handlePointer}>
                {(["left", "center", "right"] as const).map((align) => <button key={align} type="button" className={layout.rowAlignments[row] === align ? "loyalty-stamp-inline-editor__align loyalty-stamp-inline-editor__align--active" : "loyalty-stamp-inline-editor__align"} onClick={() => updateStampGrid(element, alignStampRow(element, row, align, runtimeCount))} aria-label={`Align row ${align}`}>{align === "left" ? "←" : align === "right" ? "→" : "•"}</button>)}
              </div>
            </div>
          );
        })}
        {layout.slots.map((slot) => {
          const row = slot.row;
          const slots = rowSlots[row] || [];
          const position = Math.max(0, slots.findIndex((candidate) => candidate.id === slot.id));
          const point = slotPosition(row, position);
          return (
            <button
              key={slot.id}
              type="button"
              className="loyalty-stamp-inline-editor__stamp-target"
              style={{ left: point.x * scale, top: point.y * scale, width: layout.cellSize * scale, height: layout.cellSize * scale }}
              onPointerDown={(event) => {
                if (event.button === 2) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              onClick={(event) => {
                if (event.detail !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                openStampContextMenu(element, slot, point.x + layout.cellSize * 0.72, point.y + layout.cellSize * 0.42, true);
              }}
              onContextMenu={(event) => handleStampContextMenu(event, element, slot)}
              onKeyDown={(event) => handleStampContextKeyDown(event, element, slot, point.x + layout.cellSize * 0.72, point.y + layout.cellSize * 0.42)}
              aria-label={`Open stamp ${slot.stampIndex + 1} menu`}
            />
          );
        })}
        {activeMenu ? (
          <div ref={stampContextMenuRef} className={activeMenu.closing ? "loyalty-stamp-context-menu loyalty-stamp-context-menu--closing" : "loyalty-stamp-context-menu"} style={{ left: activeMenu.x * scale, top: activeMenu.y * scale }} role="menu" aria-hidden={activeMenu.closing || undefined} onPointerDown={handlePointer}>
            <button ref={firstStampContextMenuItemRef} type="button" className="loyalty-stamp-context-menu__item loyalty-stamp-context-menu__item--danger" disabled={activeMenu.closing} onClick={() => updateStampGrid(element, removeStampSlot(element, activeMenu.row, activeMenu.column, runtimeCount))} role="menuitem">
              Delete stamp
            </button>
            <div className="loyalty-stamp-context-menu__item loyalty-stamp-context-menu__item--submenu" role="menuitem" tabIndex={activeMenu.closing ? -1 : 0} aria-haspopup="menu">
              <span>Row alignment</span>
              <span aria-hidden="true">›</span>
              <div className="loyalty-stamp-context-menu__submenu" role="menu">
                {(["left", "center", "right"] as const).map((align) => (
                  <button key={align} type="button" className={layout.rowAlignments[activeMenu.row] === align ? "loyalty-stamp-context-menu__item loyalty-stamp-context-menu__item--active" : "loyalty-stamp-context-menu__item"} disabled={activeMenu.closing} onClick={() => updateStampGrid(element, alignStampRow(element, activeMenu.row, align, runtimeCount))} role="menuitem">
                    {align[0].toUpperCase() + align.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {Array.from({ length: layout.columns }).map((_, column) => {
          const x = offset.x + column * (layout.cellSize + layout.gap) + layout.cellSize / 2;
          const align = stampRowAlignFromColumn(column, layout.columns);
          return (
            <div key={`column-${column}`}>
              <button type="button" className="loyalty-stamp-inline-editor__insert loyalty-stamp-inline-editor__insert--column" style={{ left: (x - 11) * scale, top: (offset.y - 24) * scale, ...stampControlRevealStyle(element, x, offset.y - 13) }} onPointerDown={handlePointer} onClick={() => updateStampGrid(element, insertStampRow(element, 0, column, runtimeCount, align))} aria-label={`Insert ${align} aligned stamp row above`} />
              <button type="button" className="loyalty-stamp-inline-editor__insert loyalty-stamp-inline-editor__insert--column" style={{ left: (x - 11) * scale, top: (offset.y + layout.contentHeight + 2) * scale, ...stampControlRevealStyle(element, x, offset.y + layout.contentHeight + 13) }} onPointerDown={handlePointer} onClick={() => updateStampGrid(element, insertStampRow(element, layout.rows, column, runtimeCount, align))} aria-label={`Insert ${align} aligned stamp row below`} />
            </div>
          );
        })}
      </div>
    );
  };

  const startGroupRotate = (event: ReactPointerEvent, elementIds: string[]) => {
    event.preventDefault();
    event.stopPropagation();
    onBeginInteraction?.();
    if (!canvasRef.current) return;
    const starts = activeFace.elements.filter((element) => elementIds.includes(element.id) && !element.locked && !element.hidden).map((element) => ({ ...element }));
    if (starts.length === 0) return;
    const frame = groupFrame(starts);
    const center = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.left + center.x * scale;
    const centerY = rect.top + center.y * scale;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);

    const handleMove = (moveEvent: PointerEvent) => {
      const nextAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
      const delta = nextAngle - startAngle;
      const radians = (delta * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const framesById = new Map(starts.map((start) => {
        const startCenterX = start.x + start.width / 2;
        const startCenterY = start.y + start.height / 2;
        const relativeX = startCenterX - center.x;
        const relativeY = startCenterY - center.y;
        const nextCenterX = center.x + relativeX * cos - relativeY * sin;
        const nextCenterY = center.y + relativeX * sin + relativeY * cos;
        return [start.id, constrainFrame(nextCenterX - start.width / 2, nextCenterY - start.height / 2, start.width, start.height, (start.rotation || 0) + delta, schema)];
      }));
      commitFrames(framesById);
    };

    const handleEnd = () => {
      setSnapGuides({});
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  };

  const renderGroupOverlay = (group: NonNullable<LoyaltyCardDesignSchema["faces"]["front"]["groups"]>[number]) => {
    const elements = activeFace.elements.filter((element) => group.elementIds.includes(element.id) && !element.hidden);
    if (elements.length === 0) return null;
    const frame = groupFrame(elements);
    return (
      <div key={group.id} className="loyalty-design-canvas__group" style={overlayGroupStyle(frame, scale)}>
        <span className="loyalty-design-canvas__group-label">{group.name}</span>
        <span className="loyalty-design-canvas__rotate loyalty-design-canvas__rotate--group" onPointerDown={(event) => startGroupRotate(event, group.elementIds)} />
      </div>
    );
  };

  return (
    <div className="loyalty-design-canvas-wrap" onPointerDown={() => onSelectElement("")}>
      <div ref={canvasRef} className="loyalty-design-canvas" style={cardWidth ? { width: cardWidth, maxWidth: "none" } : undefined} onPointerDown={(event) => {
        event.stopPropagation();
        onSelectElement("");
      }}>
        <LoyaltyCardRenderer key={replayKey} schema={schema} face={face} tokens={tokens} className="loyalty-design-canvas__surface" animateStampGridLayout />
        <div className="loyalty-design-canvas__overlay" aria-label="Card editor overlay">
          {snapGuides.x !== undefined ? <span className="loyalty-design-canvas__snap-guide loyalty-design-canvas__snap-guide--vertical" style={{ left: snapGuides.x * scale }} /> : null}
          {snapGuides.y !== undefined ? <span className="loyalty-design-canvas__snap-guide loyalty-design-canvas__snap-guide--horizontal" style={{ top: snapGuides.y * scale }} /> : null}
          {visibleElements.map((element) => (
            <div
              key={element.id}
              role="button"
              tabIndex={0}
              className={["loyalty-design-canvas__element", selectedElementIds.includes(element.id) && !groupSelectedElementIds.has(element.id) ? "loyalty-design-canvas__element--selected" : "", element.locked ? "loyalty-design-canvas__element--locked" : ""].filter(Boolean).join(" ")}
              style={overlayElementStyle(element, scale)}
              onPointerMove={(event) => updateStampEditorPointer(event, element)}
              onPointerLeave={() => clearStampEditorPointer(element)}
              onPointerDown={(event) => element.locked ? event.stopPropagation() : startDrag(event, element)}
            >
              {element.locked ? null : renderHandles(element)}
              {renderStampGridInlineEditor(element)}
            </div>
          ))}
          {visibleElements.filter((element) => element.id === selectedElement?.id).map((element) => <Fragment key={`tag-${element.id}`}>{renderSelectionTagFor(element)}</Fragment>)}
          {selectedGroups.map(renderGroupOverlay)}
        </div>
      </div>
    </div>
  );
}
