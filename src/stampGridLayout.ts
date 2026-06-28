import type { LoyaltyCardStampGridElement } from "./schema.js";

export type FittedStampGridLayout = {
  count: number;
  columns: number;
  rows: number;
  rowCounts: number[];
  rowAlignments: Array<"left" | "center" | "right">;
  columnAlignments: Array<"top" | "center" | "bottom">;
  slots: FittedStampGridSlot[];
  usesExplicitSlots: boolean;
  cellSize: number;
  stampSize: number;
  gap: number;
  contentWidth: number;
  contentHeight: number;
};

export type FittedStampGridSlot = {
  id: string;
  stampIndex: number;
  row: number;
  column: number;
};

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

export function resolveStampGridCount(element: LoyaltyCardStampGridElement, runtimeCount?: number) {
  const preferredCount = runtimeCount !== undefined && Number.isFinite(runtimeCount) && runtimeCount > 0 ? runtimeCount : element.count;
  return Math.floor(clampNumber(Number(preferredCount), 1, 100, 1));
}

export function resolveStampGridColumns(element: LoyaltyCardStampGridElement) {
  return Math.floor(clampNumber(Number(element.columns), 1, 12, 1));
}

export function resolveStampGridScale(element: LoyaltyCardStampGridElement) {
  return clampNumber(Number(element.stampSize), 16, 220, 56);
}

function sanitizeStampRows(element: LoyaltyCardStampGridElement) {
  if (!Array.isArray(element.stampRows)) return [];
  let total = 0;
  const rows: Array<{ count: number; align: "left" | "center" | "right" }> = [];
  for (const row of element.stampRows) {
    const count = Math.floor(clampNumber(Number(row?.count), 0, 12, 0));
    if (count <= 0) continue;
    const align = row?.align === "left" || row?.align === "right" ? row.align : "center";
    const nextCount = Math.min(count, 100 - total);
    if (nextCount <= 0) break;
    rows.push({ count: nextCount, align });
    total += nextCount;
    if (total >= 100 || rows.length >= 20) break;
  }
  return rows;
}

function sanitizeStampSlots(element: LoyaltyCardStampGridElement) {
  if (!Array.isArray(element.stampSlots)) return [];
  const used = new Set<string>();
  const slots: FittedStampGridSlot[] = [];
  for (const slot of element.stampSlots) {
    if (slots.length >= 100) break;
    const row = Math.floor(clampNumber(Number(slot?.row), 0, 19, 0));
    const column = Math.floor(clampNumber(Number(slot?.column), 0, 11, 0));
    const key = `${row}:${column}`;
    if (used.has(key)) continue;
    used.add(key);
    const id = typeof slot?.id === "string" && slot.id.trim() ? slot.id.trim().slice(0, 80) : `slot-${row}-${column}`;
    slots.push({ id, row, column, stampIndex: 0 });
  }
  return slots.sort((a, b) => a.row - b.row || a.column - b.column).map((slot, stampIndex) => ({ ...slot, stampIndex }));
}

export function resolveStampGridColumnAlignments(element: LoyaltyCardStampGridElement, columns: number) {
  return Array.from({ length: columns }).map((_, index) => {
    const align = element.stampColumns?.[index]?.align;
    return align === "top" || align === "bottom" ? align : "center";
  });
}

export function resolveStampGridRows(element: LoyaltyCardStampGridElement, runtimeCount?: number) {
  const designRows = sanitizeStampRows(element);
  const designCount = designRows.reduce((sum, row) => sum + row.count, 0);
  const hasRuntimeOverride = runtimeCount !== undefined && Number.isFinite(runtimeCount) && runtimeCount > 0 && Math.floor(runtimeCount) !== designCount;
  if (designRows.length > 0 && !hasRuntimeOverride) return designRows;

  const count = resolveStampGridCount(element, runtimeCount);
  const columns = Math.min(count, resolveStampGridColumns(element));
  const rows = Math.max(1, Math.ceil(count / columns));
  return Array.from({ length: rows }).map((_, rowIndex) => {
    const remaining = count - rowIndex * columns;
    return { count: Math.min(columns, remaining), align: element.horizontalAlign || "center" };
  }).filter((row) => row.count > 0);
}

function resolveStampArtExpansion(element: LoyaltyCardStampGridElement) {
  const hasEmptyImage = element.emptyMode === "image" && Boolean(element.emptyImageUrl);
  const hasFilledImage = element.filledMode === "image" && Boolean(element.filledImageUrl || element.filledImageUrls?.length);
  const emptyScale = hasEmptyImage ? clampNumber(Number(element.emptyScale), 0.25, 2.5, 1) : 1;
  const filledScale = hasFilledImage ? clampNumber(Number(element.filledScale), 0.25, 2.5, 1) : 1;
  const rotation = clampNumber(Number(element.filledRandomRotation), 0, 45, 45) * (Math.PI / 180);
  const rotationExpansion = hasFilledImage ? Math.abs(Math.cos(rotation)) + Math.abs(Math.sin(rotation)) : 1;
  return Math.max(1, emptyScale, filledScale * rotationExpansion);
}

export function resolveFittedStampGridLayout(element: LoyaltyCardStampGridElement, runtimeCount?: number): FittedStampGridLayout {
  const slotLayout = sanitizeStampSlots(element);
  const slotCount = slotLayout.length;
  const hasRuntimeSlotOverride = runtimeCount !== undefined && Number.isFinite(runtimeCount) && runtimeCount > 0 && Math.floor(runtimeCount) !== slotCount;
  const stampRows = slotLayout.length > 0 && !hasRuntimeSlotOverride ? [] : resolveStampGridRows(element, runtimeCount);
  const slots = slotLayout.length > 0 && !hasRuntimeSlotOverride
    ? slotLayout
    : stampRows.flatMap((row, rowIndex) => Array.from({ length: row.count }).map((_, columnIndex) => ({ id: `slot-${rowIndex}-${columnIndex}`, row: rowIndex, column: columnIndex, stampIndex: 0 }))).map((slot, stampIndex) => ({ ...slot, stampIndex }));
  const slotRows = Math.max(1, ...slots.map((slot) => slot.row + 1));
  const slotColumns = Math.max(1, ...slots.map((slot) => slot.column + 1));
  const rowCounts = stampRows.map((row) => row.count);
  const count = slots.length || rowCounts.reduce((sum, rowCount) => sum + rowCount, 0) || 1;
  const columns = slotLayout.length > 0 && !hasRuntimeSlotOverride ? slotColumns : Math.max(1, ...rowCounts);
  const rows = slotLayout.length > 0 && !hasRuntimeSlotOverride ? slotRows : Math.max(1, rowCounts.length);
  const effectiveRowCounts = Array.from({ length: rows }).map((_, rowIndex) => slots.filter((slot) => slot.row === rowIndex).length || rowCounts[rowIndex] || 0);
  const rowAlignments = Array.from({ length: rows }).map((_, rowIndex) => stampRows[rowIndex]?.align || element.stampRows?.[rowIndex]?.align || element.horizontalAlign || "center");
  const columnAlignments = resolveStampGridColumnAlignments(element, columns);
  const stampScale = resolveStampGridScale(element);
  const gapScale = clampNumber(Number(element.gap), 0, 80, 0);
  const boxWidth = Math.max(1, clampNumber(Number(element.width), 1, Number.MAX_SAFE_INTEGER, 1));
  const boxHeight = Math.max(1, clampNumber(Number(element.height), 1, Number.MAX_SAFE_INTEGER, 1));
  const visualExpansion = resolveStampArtExpansion(element);
  const gapRatio = stampScale > 0 ? gapScale / stampScale : 0;
  const widthDenominator = columns + Math.max(0, columns - 1) * gapRatio;
  const heightDenominator = rows + Math.max(0, rows - 1) * gapRatio;
  const fittedCellSize = Math.min(boxWidth / widthDenominator, boxHeight / heightDenominator);
  const cellSize = Number.isFinite(fittedCellSize) ? Math.max(0, fittedCellSize) : 0;
  const stampSize = visualExpansion > 0 ? cellSize / visualExpansion : cellSize;
  const gap = cellSize * gapRatio;

  return {
    count,
    columns,
    rows,
    rowCounts: effectiveRowCounts,
    rowAlignments,
    columnAlignments,
    slots,
    usesExplicitSlots: slotLayout.length > 0 && !hasRuntimeSlotOverride,
    cellSize,
    stampSize,
    gap,
    contentWidth: columns * cellSize + Math.max(0, columns - 1) * gap,
    contentHeight: rows * cellSize + Math.max(0, rows - 1) * gap,
  };
}
