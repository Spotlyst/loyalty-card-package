import { LoyaltyCardRenderer } from "../react/LoyaltyCardRenderer.js";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { LoyaltyCardDesignSchema, LoyaltyCardElement, LoyaltyCardFaceKey, LoyaltyCardTokens } from "../schema.js";

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
};

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type SnapGuides = { x?: number; y?: number };
type Frame = ReturnType<typeof constrainFrame>;
type SnapCandidate = { delta: number; guide: number; distance: number };

const SNAP_THRESHOLD = 6;

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
}: LoyaltyCardDesignCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const autoFitRef = useRef<Record<string, string>>({});
  const [canvasWidth, setCanvasWidth] = useState(900);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({});
  const [assetRatios, setAssetRatios] = useState<Record<string, number>>({});
  const activeFace = schema.faces[face] || schema.faces.front;
  const selectedElement = selectedElementIds.length === 1 ? activeFace.elements.find((element) => element.id === selectedElementIds[0]) || null : null;
  const scale = canvasWidth / schema.canvas.width;
  const selectedGroups = (activeFace.groups || []).filter((group) => group.elementIds.length > 1 && group.elementIds.every((id) => selectedElementIds.includes(id)));
  const groupSelectedElementIds = new Set(selectedGroups.flatMap((group) => group.elementIds));

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth) setCanvasWidth(nextWidth);
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

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
    const dragIds = event.altKey ? [element.id] : isSelected || isGroupSelected ? selectedElementIds : groupElementIds;
    const starts = activeFace.elements.filter((item) => dragIds.includes(item.id)).map((item) => ({ ...item }));
    const movingIds = new Set(starts.map((item) => item.id));
    const targets = snapTargets(schema, activeFace.elements, movingIds);

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
    const targets = snapTargets(schema, activeFace.elements, movingIds);

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

  const startGroupRotate = (event: ReactPointerEvent, elementIds: string[]) => {
    event.preventDefault();
    event.stopPropagation();
    onBeginInteraction?.();
    if (!canvasRef.current) return;
    const starts = activeFace.elements.filter((element) => elementIds.includes(element.id)).map((element) => ({ ...element }));
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
    const elements = activeFace.elements.filter((element) => group.elementIds.includes(element.id));
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
      <div ref={canvasRef} className="loyalty-design-canvas" onPointerDown={(event) => {
        event.stopPropagation();
        onSelectElement("");
      }}>
        <LoyaltyCardRenderer schema={schema} face={face} tokens={tokens} className="loyalty-design-canvas__surface" />
        <div className="loyalty-design-canvas__overlay" aria-label="Card editor overlay">
          {snapGuides.x !== undefined ? <span className="loyalty-design-canvas__snap-guide loyalty-design-canvas__snap-guide--vertical" style={{ left: snapGuides.x * scale }} /> : null}
          {snapGuides.y !== undefined ? <span className="loyalty-design-canvas__snap-guide loyalty-design-canvas__snap-guide--horizontal" style={{ top: snapGuides.y * scale }} /> : null}
          {activeFace.elements.map((element) => (
            <div
              key={element.id}
              role="button"
              tabIndex={0}
              className={selectedElementIds.includes(element.id) && !groupSelectedElementIds.has(element.id) ? "loyalty-design-canvas__element loyalty-design-canvas__element--selected" : "loyalty-design-canvas__element"}
              style={overlayElementStyle(element, scale)}
              onPointerDown={(event) => startDrag(event, element)}
            >
              {renderHandles(element)}
            </div>
          ))}
          {selectedGroups.map(renderGroupOverlay)}
        </div>
      </div>
    </div>
  );
}
