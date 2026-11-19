import {
  Add01Icon,
  AlignBottomIcon,
  AlignHorizontalCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignVerticalCenterIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  BracesIcon,
  CircleIcon,
  Copy01Icon,
  Delete02Icon,
  DistributeHorizontalCenterIcon,
  DistributeVerticalCenterIcon,
  DragDropVerticalIcon,
  GiftIcon,
  Image01Icon,
  InformationCircleIcon,
  LayerBringForwardIcon,
  LayerBringToFrontIcon,
  LayerSendBackwardIcon,
  LayerSendToBackIcon,
  Layers01Icon,
  LockKeyIcon,
  MagnetIcon,
  MinusSignIcon,
  Moon02Icon,
  MoreHorizontalIcon,
  Note01Icon,
  PlayIcon,
  PlusSignIcon,
  Redo02Icon,
  ShapesIcon,
  SquareIcon,
  SquareUnlock01Icon,
  StampIcon,
  StarSquareIcon,
  Store01Icon,
  Sun03Icon,
  TextFontIcon,
  Ticket01Icon,
  Undo02Icon,
  ViewIcon,
  ViewOffSlashIcon,
  CenterFocusIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { normalizeLoyaltyCardLayerOrder, normalizeLoyaltyCardPreset } from "../normalize.js";
import { LoyaltyCardRenderer } from "../react/LoyaltyCardRenderer.js";
import { LOYALTY_CARD_FACE_KEYS } from "../schema.js";
import type {
  LoyaltyCardBackground,
  LoyaltyCardElement,
  LoyaltyCardFaceKey,
  LoyaltyCardPresetRecord,
  LoyaltyCardStampGridElement,
  LoyaltyCardTextElement,
  LoyaltyCardTokens,
} from "../schema.js";
import { resolveStampGridCount } from "../stampGridLayout.js";
import { LoyaltyCardDesignCanvas } from "./LoyaltyCardDesignCanvas.js";
import {
  alignElements,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  centerElementsOnCanvas,
  clampNumber,
  collectFaceColors,
  contrastingTextColor,
  createElement,
  distributeElements,
  elementLabel,
  elementsMoved,
  elementSubtitle,
  FACE_LABELS,
  FACE_SIDE_LABELS,
  formatRelativeTime,
  HISTORY_LIMIT,
  lockedLayerOrderChanged,
  MAX_FILLED_STAMP_PRESETS,
  moveLayer,
  moveLayerToEdge,
  parseColor,
  reorderLayer,
  singleTokenKey,
  textFieldTag,
  updateElement,
  withFace,
} from "./editorUtils.js";
import type { MediaResult } from "./editorUtils.js";
import {
  applyCatalogFontToText,
  applyTextVariant,
  applyUploadedFontToText,
  chooseUploadedFontVariant,
  FontPickerPanel,
  FontUploadDialog,
  getAvailableTextStyles,
  getAvailableTextWeights,
  getUploadedFontUrl,
  groupUploadedFonts,
  selectedTextStyle,
  selectedTextWeight,
  UploadedFontsList,
} from "./fontsUi.js";
import type { LoyaltyCardEditorUploadedFont, UploadFontHandler } from "./fontsUi.js";
import {
  CardSettingsBody,
  cardSettingsHeader,
  categoryLabel,
  ImageInspectorBody,
  imageHeader,
  InspectorHeader,
  LineInspectorBody,
  lineHeader,
  LockedNotice,
  MultiSelectionBody,
  OpacitySection,
  PositionSection,
  ShapeInspectorBody,
  shapeHeader,
  StampGridInspectorBody,
  stampGridHeader,
  StampGridTabs,
  TextInspectorBody,
  textHeader,
} from "./inspectors.js";
import type { ImportImageHandler, LoyaltyCardEditorImageContext, SampleData, StampGridTab, StampPreviewState, UploadImageHandler } from "./inspectors.js";
import { LibraryFontsSection, LibraryPanel } from "./libraryUi.js";
import type { LibraryKind, LoyaltyCardEditorLibraryAsset, StampTarget, UploadLibraryAssetHandler } from "./libraryUi.js";
import { Icon, IconButton, Menu, Modal, Segmented, Switch, Tile, cx } from "./ui.js";
import type { IconType, MenuItem } from "./ui.js";

export type { LoyaltyCardEditorImageContext } from "./inspectors.js";
export type { LoyaltyCardEditorLibraryAsset } from "./libraryUi.js";
export type { LoyaltyCardEditorUploadedFont } from "./fontsUi.js";

export type LoyaltyCardEditorMediaResult = MediaResult;

export type LoyaltyCardEditorMetaContext = {
  record: LoyaltyCardPresetRecord;
  update: (updater: (record: LoyaltyCardPresetRecord) => LoyaltyCardPresetRecord) => void;
};

/** An extra item for the top bar's “…” menu. */
export type LoyaltyCardEditorMenuAction = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: IconType;
};

export type LoyaltyCardEditorProps = {
  value: LoyaltyCardPresetRecord;
  onChange: (record: LoyaltyCardPresetRecord) => void;
  title?: string;
  tokens: LoyaltyCardTokens;
  faces?: LoyaltyCardFaceKey[];
  /** Extra buttons for the right side of the top bar. */
  actions?: ReactNode;
  /** Extra fields shown in Card settings (when nothing is selected). */
  renderMeta?: (context: LoyaltyCardEditorMetaContext) => ReactNode;
  /** Called by Ctrl/Cmd + S. */
  onSave?: () => void;
  toast?: string | null;
  error?: string | null;
  onUploadImage?: (file: File, context: LoyaltyCardEditorImageContext) => Promise<LoyaltyCardEditorMediaResult>;
  onImportImageUrl?: (url: string, context: LoyaltyCardEditorImageContext) => Promise<LoyaltyCardEditorMediaResult>;
  assetLibrary?: LoyaltyCardEditorLibraryAsset[];
  uploadedFonts?: LoyaltyCardEditorUploadedFont[];
  onUploadLibraryAsset?: (file: File, meta: { name: string; category: string }) => Promise<LoyaltyCardEditorLibraryAsset>;
  onArchiveLibraryAsset?: (assetId: string) => Promise<void>;
  onRestoreLibraryAsset?: (assetId: string) => Promise<void>;
  onDeleteLibraryAsset?: (assetId: string) => Promise<void>;
  onUploadFont?: (file: File, meta: { name: string; fontFamily: string; fontWeight: number; fontStyle: "normal" | "italic" }) => Promise<LoyaltyCardEditorUploadedFont>;
  onArchiveFont?: (fontId: string) => Promise<void>;
  onDeleteFont?: (fontId: string) => Promise<void>;
  /** Shows the round back button in the top bar. */
  onBack?: () => void;
  backLabel?: string;
  /** Shows a “Save draft” button in the top bar. */
  onSaveDraft?: () => void;
  saveDraftLabel?: string;
  /** Shows the dark “Publish” button in the top bar. */
  onPublish?: () => void;
  publishLabel?: string;
  isSaving?: boolean;
  /** When the record was last saved, for “Changes saved 2 min ago”. */
  savedAt?: string | number | Date | null;
  hasUnsavedChanges?: boolean;
  /** Extra items for the top bar's “…” menu, such as duplicate and archive. */
  menuActions?: LoyaltyCardEditorMenuAction[];
  /** Shows the preset name, category, note for venues and slug in Card settings. */
  showPresetDetails?: boolean;
};

type EditorChromeTheme = "light" | "dark";
type LeftTab = "add" | "layers" | "library";

const EDITOR_THEME_STORAGE_KEY = "spotlyst.loyaltyCardEditor.theme";
const BASE_CARD_WIDTH = 640;
const HISTORY_COALESCE_MS = 600;
const ZOOM_STEPS = [25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300];
const DAY_MS = 24 * 60 * 60 * 1000;

function getStoredEditorTheme(): EditorChromeTheme {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(EDITOR_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

const EDITOR_FONT_LINK_ID = "lce-editor-fonts";

/** Loads the editor's own font (and the heading sample's font) once, so every host gets the same look. */
function ensureEditorFonts() {
  if (typeof document === "undefined" || document.getElementById(EDITOR_FONT_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = EDITOR_FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap";
  document.head.appendChild(link);
}

const recordKeys = new WeakMap<LoyaltyCardPresetRecord, string>();

/** A cached JSON key per record object, to tell whether two history steps are the same. */
function recordKey(record: LoyaltyCardPresetRecord) {
  let key = recordKeys.get(record);
  if (key === undefined) {
    key = JSON.stringify(record);
    recordKeys.set(record, key);
  }
  return key;
}

/** Drops history steps at the top of the stack that look exactly like the current record. */
function dropUnchanged(stack: LoyaltyCardPresetRecord[], current: LoyaltyCardPresetRecord) {
  const currentKey = recordKey(current);
  while (stack.length && recordKey(stack[stack.length - 1]) === currentKey) stack.pop();
  return stack;
}

function autoPreviewCount(total: number) {
  return Math.min(Math.max(0, total - 1), Math.max(0, Math.floor(total * 0.75)));
}

function firstStampGrid(record: LoyaltyCardPresetRecord, preferredFace?: LoyaltyCardFaceKey) {
  const faces = preferredFace ? [preferredFace, ...LOYALTY_CARD_FACE_KEYS.filter((face) => face !== preferredFace)] : [...LOYALTY_CARD_FACE_KEYS];
  for (const face of faces) {
    const grid = record.designSchema.faces[face]?.elements.find((element): element is LoyaltyCardStampGridElement => element.type === "stampGrid");
    if (grid) return grid;
  }
  return null;
}

function initialPreviewState(record: LoyaltyCardPresetRecord): StampPreviewState {
  const grid = firstStampGrid(record, "back");
  if (grid?.previewFilledMode === "manual") return { mode: "manual", count: Math.max(0, Math.floor(Number(grid.previewFilledCount) || 0)) };
  return { mode: "auto", count: grid ? autoPreviewCount(resolveStampGridCount(grid)) : 0 };
}

function tokenKey(value: string | undefined) {
  return singleTokenKey(value);
}

function elementIcon(element: LoyaltyCardElement): IconType {
  if (element.type === "text") return TextFontIcon;
  if (element.type === "asset") return Image01Icon;
  if (element.type === "line") return MinusSignIcon;
  if (element.type === "stampGrid") return StampIcon;
  if (element.shape === "circle") return CircleIcon;
  if (element.shape === "blob") return ShapesIcon;
  return SquareIcon;
}

function backgroundSummary(background: LoyaltyCardBackground | null | undefined) {
  if (!background) return "None";
  if (background.type === "solid") return `Solid · ${parseColor(background.color).hex.slice(1)}`;
  if (background.type === "gradient") return `Gradient · ${background.colors.map((color) => parseColor(color).hex.slice(1)).join(" → ")}`;
  return background.imageUrl ? "Image" : "Image · none chosen";
}

function backgroundSwatch(background: LoyaltyCardBackground | null | undefined): CSSProperties {
  if (!background) return {};
  if (background.type === "gradient") return { background: `linear-gradient(${background.angle}deg, ${background.colors.join(", ")})` };
  if (background.type === "image" && background.imageUrl) return { backgroundColor: background.color, backgroundImage: `url("${background.imageUrl}")`, backgroundSize: "cover", backgroundPosition: "center" };
  return { background: background.color };
}

const STATUS_LABELS: Record<string, string> = { draft: "Draft", published: "Published", archived: "Archived" };

const TEXT_PRESETS: Array<{ id: "heading" | "subheading" | "body"; label: string }> = [
  { id: "heading", label: "Add a heading" },
  { id: "subheading", label: "Add a subheading" },
  { id: "body", label: "Add body text" },
];

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
  assetLibrary = [],
  uploadedFonts = [],
  onUploadLibraryAsset,
  onArchiveLibraryAsset,
  onRestoreLibraryAsset,
  onDeleteLibraryAsset,
  onUploadFont,
  onArchiveFont,
  onDeleteFont,
  onBack,
  backLabel = "Back",
  onSaveDraft,
  saveDraftLabel = "Save draft",
  onPublish,
  publishLabel = "Publish",
  isSaving = false,
  savedAt,
  hasUnsavedChanges = false,
  menuActions = [],
  showPresetDetails = false,
}: LoyaltyCardEditorProps) {
  const faceKeys = faces && faces.length ? faces : [...LOYALTY_CARD_FACE_KEYS];
  const [activeFace, setActiveFace] = useState<LoyaltyCardFaceKey>(faceKeys[0]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [leftTab, setLeftTab] = useState<LeftTab>("add");
  const [libraryTarget, setLibraryTarget] = useState<StampTarget>("filled");
  const [inspectorPane, setInspectorPane] = useState<"properties" | "fontPicker">("properties");
  const [stampTab, setStampTab] = useState<StampGridTab>("layout");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [editorTheme, setEditorTheme] = useState<EditorChromeTheme>(() => getStoredEditorTheme());
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | "auto" | "fit">("auto");
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [preview, setPreview] = useState<StampPreviewState>(() => initialPreviewState(value));
  const [sample, setSample] = useState<SampleData>(() => ({ venueName: String(tokens.venueName ?? ""), rewardTitle: String(tokens.rewardTitle ?? "") }));
  const [replayKey, setReplayKey] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFace, setPreviewFace] = useState<LoyaltyCardFaceKey>(faceKeys[0]);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [orderMenuOpen, setOrderMenuOpen] = useState(false);
  const [fontUploadOpen, setFontUploadOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const undoStackRef = useRef<LoyaltyCardPresetRecord[]>([]);
  const lastCommitAtRef = useRef(0);
  const redoStackRef = useRef<LoyaltyCardPresetRecord[]>([]);
  const clipboardElementsRef = useRef<LoyaltyCardElement[]>([]);
  const lastSyncedIdRef = useRef<string>(value.id);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const stampDatesBaseRef = useRef(Date.now());

  const record = value;
  const activeFaceData = record.designSchema.faces[activeFace];
  const activeElements = activeFaceData?.elements || [];
  const activeBackground = activeFaceData?.background || null;
  const activeGroups = activeFaceData?.groups || [];
  const selectedElements = activeElements.filter((element) => selectedElementIds.includes(element.id));
  const selectedEditableElements = selectedElements.filter((element) => !element.locked && !element.hidden);
  const selectedElement = selectedElementIds.length === 1 ? activeElements.find((element) => element.id === selectedElementIds[0]) || null : null;
  const selectedGroupIds = activeGroups.filter((group) => group.elementIds.some((id) => selectedElementIds.includes(id))).map((group) => group.id);
  const fontGroups = useMemo(() => groupUploadedFonts(uploadedFonts), [uploadedFonts]);

  const previewGrid = selectedElement?.type === "stampGrid" ? selectedElement : activeElements.find((element): element is LoyaltyCardStampGridElement => element.type === "stampGrid") || firstStampGrid(record, "back");
  const previewTotal = previewGrid ? resolveStampGridCount(previewGrid) : Number(tokens.stampsRequired) || 10;
  const effectivePreviewCount = previewGrid ? (preview.mode === "manual" ? clampNumber(preview.count, 0, previewTotal) : autoPreviewCount(previewTotal)) : Number(tokens.stampsCollected) || 0;

  const editorTokens = useMemo<LoyaltyCardTokens>(() => {
    const base: LoyaltyCardTokens = {
      ...tokens,
      ...(sample.venueName ? { venueName: sample.venueName } : {}),
      ...(sample.rewardTitle ? { rewardTitle: sample.rewardTitle } : {}),
    };
    if (!previewGrid) return base;
    const stamps = Array.from({ length: effectivePreviewCount }).map((_, index) => ({ awardedAt: new Date(stampDatesBaseRef.current - (effectivePreviewCount - index) * 3 * DAY_MS).toISOString() }));
    const stampDataKey = tokenKey(previewGrid.stampDataToken || "{{stamps}}");
    const filledKey = tokenKey(previewGrid.filledToken);
    return {
      ...base,
      stamps,
      stampsCollected: effectivePreviewCount,
      ...(stampDataKey ? { [stampDataKey]: stamps } : {}),
      ...(filledKey ? { [filledKey]: effectivePreviewCount } : {}),
    };
  }, [tokens, sample, previewGrid, effectivePreviewCount, previewTotal]);

  /* ----- effects ----- */

  useEffect(() => {
    ensureEditorFonts();
  }, []);

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
      setPreview(initialPreviewState(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.id]);

  useEffect(() => {
    setSelectedElementIds((current) => {
      const ids = new Set((value.designSchema.faces[activeFace]?.elements || []).map((element) => element.id));
      const valid = current.filter((id) => ids.has(id));
      return valid.length === current.length ? current : valid;
    });
  }, [value.id, activeFace, value.designSchema]);

  // Follow the host's sample tokens when they change (for example another venue's name).
  useEffect(() => {
    setSample({ venueName: String(tokens.venueName ?? ""), rewardTitle: String(tokens.rewardTitle ?? "") });
  }, [tokens.venueName, tokens.rewardTitle]);

  useEffect(() => {
    setInspectorPane("properties");
    setRenamingLayerId(null);
  }, [selectedElementIds.join(","), activeFace]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setNow(Date.now());
  }, [savedAt]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setStageSize({ width: rect.width, height: rect.height });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  /* ----- history ----- */

  const pushUndo = () => {
    const stack = dropUnchanged([...undoStackRef.current], value);
    undoStackRef.current = [...stack.slice(-(HISTORY_LIMIT - 1)), structuredClone(value)];
    redoStackRef.current = [];
    lastCommitAtRef.current = 0;
  };

  // Edits that arrive in a quick run (typing a number, dragging a slider) share one undo step.
  const commit = (updater: (preset: LoyaltyCardPresetRecord) => LoyaltyCardPresetRecord, options: { recordHistory?: boolean } = {}) => {
    if (options.recordHistory !== false) {
      const now = Date.now();
      const inRun = now - lastCommitAtRef.current < HISTORY_COALESCE_MS && undoStackRef.current.length > 0;
      if (!inRun) pushUndo();
      lastCommitAtRef.current = now;
    }
    onChange(updater(value));
  };

  const commitElements = (nextElements: LoyaltyCardElement[], options?: { recordHistory?: boolean }) => {
    commit((preset) => normalizeLoyaltyCardPreset({ ...preset, designSchema: withFace(preset.designSchema, activeFace, nextElements) }), options);
  };

  const keepValidSelection = (next: LoyaltyCardPresetRecord) => setSelectedElementIds((current) => current.filter((id) => next.designSchema.faces[activeFace]?.elements.some((element) => element.id === id)));

  const handleUndo = () => {
    const previous = dropUnchanged(undoStackRef.current, value).pop();
    if (!previous) return;
    lastCommitAtRef.current = 0;
    redoStackRef.current = [...redoStackRef.current.slice(-(HISTORY_LIMIT - 1)), structuredClone(value)];
    keepValidSelection(previous);
    onChange(previous);
  };

  const handleRedo = () => {
    const next = dropUnchanged(redoStackRef.current, value).pop();
    if (!next) return;
    lastCommitAtRef.current = 0;
    undoStackRef.current = [...undoStackRef.current.slice(-(HISTORY_LIMIT - 1)), structuredClone(value)];
    keepValidSelection(next);
    onChange(next);
  };

  /* ----- selection and element edits ----- */

  const handleSelectElement = (elementId: string, additive = false, isolate = false) => {
    if (!elementId) {
      setSelectedElementIds([]);
      return;
    }
    const groupElementIds = isolate ? [elementId] : activeGroups.find((group) => group.elementIds.includes(elementId))?.elementIds || [elementId];
    setSelectedElementIds((current) => {
      if (!additive) return groupElementIds;
      const groupSet = new Set(groupElementIds);
      if (groupElementIds.every((id) => current.includes(id))) return current.filter((id) => !groupSet.has(id));
      return Array.from(new Set([...current, ...groupElementIds]));
    });
  };

  const updateLayerElement = (elementId: string, updater: (element: LoyaltyCardElement) => LoyaltyCardElement) => {
    commit((preset) => normalizeLoyaltyCardPreset({ ...preset, designSchema: updateElement(preset.designSchema, activeFace, elementId, updater) }));
  };

  const updateSelectedElement = (updater: (element: LoyaltyCardElement) => LoyaltyCardElement) => {
    if (!selectedElement || selectedElement.locked) return;
    updateLayerElement(selectedElement.id, updater);
  };

  function typedUpdater<T extends LoyaltyCardElement["type"]>(type: T) {
    return (updater: (element: Extract<LoyaltyCardElement, { type: T }>) => Extract<LoyaltyCardElement, { type: T }>) => updateSelectedElement((element) => (element.type === type ? updater(element as Extract<LoyaltyCardElement, { type: T }>) : element));
  }

  const handleAddElement = (type: LoyaltyCardElement["type"], options: Parameters<typeof createElement>[2] = {}) => {
    if (type === "stampGrid" && activeFace !== "back") return;
    const element = createElement(type, activeElements.length + 1, { ...options, color: options.color || (type === "text" ? contrastingTextColor(activeBackground) : undefined) });
    commit((preset) => normalizeLoyaltyCardPreset({ ...preset, designSchema: withFace(preset.designSchema, activeFace, [...preset.designSchema.faces[activeFace].elements, element]) }));
    setSelectedElementIds([element.id]);
    if (type === "stampGrid") setStampTab("layout");
  };

  const handleDeleteElement = () => {
    const selectedIds = new Set(activeElements.filter((element) => selectedElementIds.includes(element.id) && !element.locked).map((element) => element.id));
    if (selectedIds.size === 0) return;
    const nextElements = normalizeLoyaltyCardLayerOrder(activeElements.filter((element) => !selectedIds.has(element.id)));
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: {
        ...preset.designSchema,
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
    setSelectedElementIds([]);
  };

  const handleLayerStep = (direction: "up" | "down") => {
    if (!selectedElement || selectedElement.locked) return;
    const nextElements = moveLayer(activeElements, selectedElement.id, direction);
    if (lockedLayerOrderChanged(activeElements, nextElements)) return;
    commitElements(nextElements);
  };

  const handleLayerEdge = (edge: "front" | "back") => {
    if (!selectedElement || selectedElement.locked) return;
    const nextElements = moveLayerToEdge(activeElements, selectedElement.id, edge);
    if (lockedLayerOrderChanged(activeElements, nextElements)) return;
    commitElements(nextElements);
  };

  const handleLayerDrop = (targetElementId: string) => {
    if (!draggedLayerId || draggedLayerId === targetElementId) return;
    const dragged = activeElements.find((element) => element.id === draggedLayerId);
    if (!dragged || dragged.locked) return;
    const nextElements = reorderLayer(activeElements, draggedLayerId, targetElementId);
    if (nextElements === activeElements || lockedLayerOrderChanged(activeElements, nextElements)) return;
    commitElements(nextElements);
    setDraggedLayerId(null);
  };

  const editableIds = () => new Set(selectedEditableElements.map((element) => element.id));

  const handleAlign = (axis: "x" | "y", position: "start" | "center" | "end") => {
    if (selectedEditableElements.length === 0) return;
    const nextElements = alignElements(activeElements, editableIds(), axis, position);
    if (elementsMoved(activeElements, nextElements)) commitElements(nextElements);
  };

  const handleCenter = () => {
    if (selectedEditableElements.length === 0) return;
    const nextElements = centerElementsOnCanvas(activeElements, editableIds());
    if (elementsMoved(activeElements, nextElements)) commitElements(nextElements);
  };

  const handleDistribute = (axis: "x" | "y") => {
    if (selectedEditableElements.length < 3) return;
    const nextElements = distributeElements(activeElements, editableIds(), axis);
    if (elementsMoved(activeElements, nextElements)) commitElements(nextElements);
  };

  const setFaceGroups = (updater: (groups: NonNullable<typeof activeGroups>) => NonNullable<typeof activeGroups>) => {
    commit((preset) => normalizeLoyaltyCardPreset({
      ...preset,
      designSchema: {
        ...preset.designSchema,
        faces: {
          ...preset.designSchema.faces,
          [activeFace]: { ...preset.designSchema.faces[activeFace], groups: updater(preset.designSchema.faces[activeFace].groups || []) },
        },
      },
    }));
  };

  const handleGroupSelected = () => {
    if (selectedElementIds.length < 2) return;
    const selectedIds = new Set(selectedElementIds);
    setFaceGroups((groups) => [
      ...groups.map((group) => ({ ...group, elementIds: group.elementIds.filter((id) => !selectedIds.has(id)) })).filter((group) => group.elementIds.length > 1),
      { id: `group-${Date.now().toString(36)}`, name: `Group ${groups.length + 1}`, elementIds: [...selectedElementIds], collapsed: false },
    ]);
  };

  const handleUngroupSelected = () => {
    if (selectedElementIds.length === 0) return;
    const selectedIds = new Set(selectedElementIds);
    setFaceGroups((groups) => groups.filter((group) => !group.elementIds.some((id) => selectedIds.has(id))));
  };

  const moveSelectedElements = (dx: number, dy: number) => {
    if (selectedEditableElements.length === 0) return;
    const ids = editableIds();
    commitElements(activeElements.map((element) => ids.has(element.id)
      ? { ...element, x: clampNumber(element.x + dx, -element.width, CANVAS_WIDTH), y: clampNumber(element.y + dy, -element.height, CANVAS_HEIGHT) } as LoyaltyCardElement
      : element));
  };

  const insertCopies = (sources: LoyaltyCardElement[], suffix: string) => {
    const stamp = Date.now().toString(36);
    const copies = sources
      .map((element, index) => ({
        ...structuredClone(element),
        id: `${element.id}-${suffix}-${stamp}-${index}`,
        locked: false,
        x: clampNumber(element.x + 24, -element.width, CANVAS_WIDTH),
        y: clampNumber(element.y + 24, -element.height, CANVAS_HEIGHT),
        zIndex: activeElements.length + index + 1,
      } as LoyaltyCardElement))
      .filter((element) => activeFace === "back" || element.type !== "stampGrid");
    if (copies.length === 0) return [];
    commitElements([...activeElements, ...copies]);
    setSelectedElementIds(copies.map((copy) => copy.id));
    return copies;
  };

  const duplicateSelectedElements = () => {
    insertCopies(activeElements.filter((element) => selectedElementIds.includes(element.id) && !element.locked), "copy");
  };

  const copySelectedElements = () => {
    clipboardElementsRef.current = activeElements.filter((element) => selectedElementIds.includes(element.id) && !element.locked).map((element) => structuredClone(element));
  };

  const pasteCopiedElements = () => {
    const copies = insertCopies(clipboardElementsRef.current, "paste");
    if (copies.length) clipboardElementsRef.current = copies.map((copy) => structuredClone(copy));
  };

  const toggleSelectionLock = () => {
    if (selectedElements.length === 0) return;
    const lock = selectedElements.some((element) => !element.locked);
    const ids = new Set(selectedElements.map((element) => element.id));
    commitElements(activeElements.map((element) => ids.has(element.id) ? { ...element, locked: lock } as LoyaltyCardElement : element));
  };

  const updateBackground = (background: LoyaltyCardBackground) => {
    commit((preset) => ({
      ...preset,
      designSchema: {
        ...preset.designSchema,
        faces: { ...preset.designSchema.faces, [activeFace]: { ...preset.designSchema.faces[activeFace], background } },
      },
    }));
  };

  const applyColor = (hex: string) => {
    const color = parseColor(hex).hex;
    const targets = selectedElements.filter((element) => !element.locked);
    if (targets.length === 0) {
      if (selectedElements.length > 0 || !activeBackground) return;
      if (activeBackground.type === "gradient") updateBackground({ ...activeBackground, colors: [color, ...activeBackground.colors.slice(1)] });
      else updateBackground({ ...activeBackground, color });
      return;
    }
    const ids = new Set(targets.map((element) => element.id));
    commitElements(activeElements.map((element) => {
      if (!ids.has(element.id)) return element;
      if (element.type === "text") return { ...element, color };
      if (element.type === "shape") return { ...element, fill: color };
      if (element.type === "line") return { ...element, color };
      if (element.type === "stampGrid") return { ...element, filledFill: color };
      return { ...element, tint: color };
    }));
  };

  /* ----- fonts ----- */

  const updateText = typedUpdater("text");
  const textWeightOptions = selectedElement?.type === "text" ? getAvailableTextWeights(fontGroups, selectedElement) : [];
  const textWeight = selectedElement?.type === "text" ? selectedTextWeight(selectedElement, textWeightOptions) : 400;
  const textStyleOptions = selectedElement?.type === "text" ? getAvailableTextStyles(fontGroups, selectedElement) : ["normal" as const];
  const textStyle = selectedElement?.type === "text" ? selectedTextStyle(selectedElement, textStyleOptions) : "normal";

  /* ----- library ----- */

  const stampTargetGrid = selectedElement?.type === "stampGrid" ? selectedElement : selectedElementIds.length === 0 && activeFace === "back" ? activeElements.find((element): element is LoyaltyCardStampGridElement => element.type === "stampGrid") || null : null;
  const stampMode = Boolean(stampTargetGrid && !stampTargetGrid.locked);
  const filledUrlsOf = (grid: LoyaltyCardStampGridElement) => Array.from(new Set([...(grid.filledImageUrls || []), grid.filledImageUrl || ""].filter(Boolean)));
  const libraryActiveUrls = stampMode && stampTargetGrid ? (libraryTarget === "empty" ? [stampTargetGrid.emptyImageUrl || ""].filter(Boolean) : filledUrlsOf(stampTargetGrid)) : [];

  const handleLibraryPick = (asset: LoyaltyCardEditorLibraryAsset, kind: LibraryKind) => {
    if (stampMode && stampTargetGrid && kind !== "patterns") {
      updateLayerElement(stampTargetGrid.id, (element) => {
        if (element.type !== "stampGrid") return element;
        if (libraryTarget === "empty") return { ...element, emptyMode: "image", emptyImageUrl: asset.cdnUrl };
        const currentUrls = filledUrlsOf(element);
        const nextUrls = currentUrls.includes(asset.cdnUrl) ? currentUrls.filter((url) => url !== asset.cdnUrl) : currentUrls.length < MAX_FILLED_STAMP_PRESETS ? [...currentUrls, asset.cdnUrl] : currentUrls;
        return { ...element, filledMode: nextUrls.length ? "image" : "shape", filledImageUrl: nextUrls[0] || "", filledImageUrls: nextUrls };
      });
      setSelectedElementIds([stampTargetGrid.id]);
      setStampTab("stamps");
      return;
    }
    if (kind === "stamps") return;
    handleAddElement("asset", { imageUrl: asset.cdnUrl });
  };

  const openLibraryFor = (target: StampTarget) => {
    setLibraryTarget(target);
    setLeftTab("library");
  };

  /* ----- keyboard ----- */

  useEffect(() => {
    // Shortcuts stay with text fields; sliders, switches and colour pickers pass them to the editor.
    const NON_TEXT_INPUTS = new Set(["range", "checkbox", "radio", "color", "button", "submit", "file"]);
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      if (tagName === "input") return !NON_TEXT_INPUTS.has((target as HTMLInputElement).type);
      return tagName === "textarea" || tagName === "select" || target.isContentEditable;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (isModifier && key === "s") {
        event.preventDefault();
        (onSave || onSaveDraft)?.();
        return;
      }
      if (isEditableTarget(event.target) || previewOpen || fontUploadOpen) return;
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
        if (inspectorPane !== "properties") setInspectorPane("properties");
        else setSelectedElementIds([]);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedElementIds.length === 0) return;
        event.preventDefault();
        handleDeleteElement();
        return;
      }
      if (event.key.startsWith("Arrow")) {
        if (selectedElementIds.length === 0) return;
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
  }, [activeElements, activeFace, inspectorPane, selectedElementIds, value, previewOpen, fontUploadOpen, onSave, onSaveDraft]);

  /* ----- zoom ----- */

  const availableWidth = Math.max(160, stageSize.width - 72);
  const availableHeight = Math.max(90, stageSize.height - 84 - 108);
  const fitWidth = Math.max(160, Math.min(availableWidth, availableHeight * (16 / 9)));
  const fitPercent = Math.max(10, Math.floor((fitWidth / BASE_CARD_WIDTH) * 100));
  const zoomPercent = zoom === "fit" ? fitPercent : zoom === "auto" ? Math.min(100, fitPercent) : zoom;
  const cardWidth = Math.round((BASE_CARD_WIDTH * zoomPercent) / 100);
  const stepZoom = (direction: 1 | -1) => {
    const next = direction > 0 ? ZOOM_STEPS.find((step) => step > zoomPercent) : [...ZOOM_STEPS].reverse().find((step) => step < zoomPercent);
    if (next) setZoom(next);
  };

  /* ----- derived labels ----- */

  const statusLabel = STATUS_LABELS[record.status] || record.status;
  const showStatus = showPresetDetails || Boolean(onPublish);
  const saveText = isSaving ? "Saving…" : hasUnsavedChanges ? "Unsaved changes" : savedAt ? `Changes saved ${formatRelativeTime(savedAt, now)}` : "";
  const subtitleParts = [showPresetDetails ? categoryLabel(record.category) : title && title !== record.name ? title : "", saveText].filter(Boolean);
  const faceColors = collectFaceColors(activeBackground, activeElements);
  const canUndo = undoStackRef.current.some((entry) => recordKey(entry) !== recordKey(value));
  const canRedo = redoStackRef.current.some((entry) => recordKey(entry) !== recordKey(value));
  const hasSelection = selectedElementIds.length > 0;
  const selectionLocked = selectedElements.length > 0 && selectedElements.every((element) => element.locked);
  const layersTopFirst = activeElements.map((element, index) => ({ element, index })).sort((a, b) => b.element.zIndex - a.element.zIndex || a.index - b.index).map(({ element }) => element);
  const stampsCollectedSample = Number(editorTokens.stampsCollected ?? 0);
  const stampsRequiredSample = Number(editorTokens.stampsRequired ?? 10);

  const cardFieldChips: Array<{ id: string; label: string; icon: IconType; token: string; fallback: string; name: string }> = [
    { id: "venue", label: "Venue name", icon: Store01Icon, token: "{{venueName}}", fallback: "Your café", name: "Venue name" },
    { id: "tier", label: "Tier", icon: StarSquareIcon, token: "{{tierName}}", fallback: "Member", name: "Tier" },
    { id: "reward", label: "Reward", icon: GiftIcon, token: "{{rewardTitle}}", fallback: "Free coffee", name: "Reward" },
    { id: "reward-details", label: "Reward details", icon: Note01Icon, token: "{{rewardDescription}}", fallback: "Enjoy this reward on your next visit.", name: "Reward details" },
    { id: "progress", label: `Stamps ${stampsCollectedSample}/${stampsRequiredSample}`, icon: StampIcon, token: "{{stampsCollected}}/{{stampsRequired}}", fallback: "", name: "Progress" },
    { id: "total", label: "Stamp total", icon: Ticket01Icon, token: "{{stampsRequired}}", fallback: "10", name: "Stamp total" },
  ];

  const moreItems: MenuItem[] = [
    ...menuActions.map((action) => ({ id: action.id, label: action.label, icon: action.icon, onSelect: action.onSelect, disabled: action.disabled, danger: action.danger })),
    ...(menuActions.length ? [{ id: "divider-theme", divider: true as const }] : []),
    { id: "theme", label: editorTheme === "light" ? "Dark editor" : "Light editor", icon: editorTheme === "light" ? Moon02Icon : Sun03Icon, onSelect: () => setEditorTheme((current) => current === "light" ? "dark" : "light") },
  ];

  const orderItems: MenuItem[] = [
    { id: "front", label: "Bring to front", icon: LayerBringToFrontIcon, disabled: !selectedElement || Boolean(selectedElement.locked), onSelect: () => handleLayerEdge("front") },
    { id: "forward", label: "Bring forward", icon: LayerBringForwardIcon, disabled: !selectedElement || Boolean(selectedElement.locked), onSelect: () => handleLayerStep("up") },
    { id: "backward", label: "Send backward", icon: LayerSendBackwardIcon, disabled: !selectedElement || Boolean(selectedElement.locked), onSelect: () => handleLayerStep("down") },
    { id: "back", label: "Send to back", icon: LayerSendToBackIcon, disabled: !selectedElement || Boolean(selectedElement.locked), onSelect: () => handleLayerEdge("back") },
    { id: "divider-arrange", divider: true },
    { id: "center", label: "Centre on the card", icon: CenterFocusIcon, disabled: selectedEditableElements.length === 0, onSelect: handleCenter },
    { id: "distribute-x", label: "Space evenly across", icon: DistributeHorizontalCenterIcon, disabled: selectedEditableElements.length < 3, onSelect: () => handleDistribute("x") },
    { id: "distribute-y", label: "Space evenly down", icon: DistributeVerticalCenterIcon, disabled: selectedEditableElements.length < 3, onSelect: () => handleDistribute("y") },
    { id: "divider-group", divider: true },
    { id: "group", label: "Group", icon: Layers01Icon, disabled: selectedElementIds.length < 2, onSelect: handleGroupSelected },
    { id: "ungroup", label: "Ungroup", disabled: selectedGroupIds.length === 0, onSelect: handleUngroupSelected },
  ];

  const renderSelectionTag = (element: LoyaltyCardElement) => {
    if (element.type === "text") {
      const tag = textFieldTag(element);
      return tag ? <><Icon icon={BracesIcon} size={11} />{tag}</> : null;
    }
    if (element.type === "stampGrid") return <><Icon icon={StampIcon} size={11} />Stamp grid · {resolveStampGridCount(element)}</>;
    return null;
  };

  /* ----- inspector ----- */

  const renderInspector = () => {
    if (inspectorPane === "fontPicker" && selectedElement?.type === "text") {
      return (
        <FontPickerPanel
          element={selectedElement}
          groups={fontGroups}
          onClose={() => setInspectorPane("properties")}
          onPickCatalog={(font) => {
            updateText((element) => applyCatalogFontToText(element, font));
            setInspectorPane("properties");
          }}
          onPickUploaded={(group) => {
            const font = chooseUploadedFontVariant(group, textWeight, textStyle);
            if (!font || !getUploadedFontUrl(font)) return;
            updateText((element) => applyUploadedFontToText(element, font, textWeight));
            setInspectorPane("properties");
          }}
        />
      );
    }

    if (selectedElementIds.length > 1) {
      return (
        <>
          <InspectorHeader icon={Layers01Icon} title={`${selectedElementIds.length} items selected`} subtitle={selectedGroupIds.length ? "Grouped items move together" : "Drag any of them to move them together"} />
          <div className="lce-inspector__sections">
            <MultiSelectionBody count={selectedElementIds.length} editableCount={selectedEditableElements.length} canUngroup={selectedGroupIds.length > 0} onAlign={handleAlign} onDistribute={handleDistribute} onCenter={handleCenter} onGroup={handleGroupSelected} onUngroup={handleUngroupSelected} onDelete={handleDeleteElement} />
          </div>
        </>
      );
    }

    if (selectedElement) {
      const header = selectedElement.type === "text" ? textHeader(selectedElement)
        : selectedElement.type === "stampGrid" ? stampGridHeader(selectedElement)
          : selectedElement.type === "asset" ? imageHeader(selectedElement)
            : selectedElement.type === "shape" ? shapeHeader(selectedElement)
              : lineHeader(selectedElement);
      const toggleHidden = () => updateLayerElement(selectedElement.id, (element) => ({ ...element, hidden: !element.hidden }));
      const toggleLocked = () => updateLayerElement(selectedElement.id, (element) => ({ ...element, locked: !element.locked }));
      return (
        <>
          <InspectorHeader icon={header.icon} title={header.title} subtitle={header.subtitle} element={selectedElement} onToggleHidden={toggleHidden} onToggleLocked={toggleLocked}>
            {selectedElement.type === "stampGrid" ? <StampGridTabs tab={stampTab} onChange={setStampTab} /> : null}
          </InspectorHeader>
          <div className="lce-inspector__sections">
            {selectedElement.locked ? <LockedNotice onUnlock={toggleLocked} /> : null}
            <fieldset className="lce-fieldset" disabled={Boolean(selectedElement.locked)}>
              {selectedElement.type === "text" ? (
                <TextInspectorBody
                  element={selectedElement}
                  update={updateText}
                  tokens={editorTokens}
                  weightOptions={textWeightOptions}
                  weight={textWeight}
                  styleOptions={textStyleOptions}
                  style={textStyle}
                  onVariantChange={(weight, style) => updateText((element) => applyTextVariant(fontGroups, element, weight, style) as LoyaltyCardTextElement)}
                  onOpenFontPicker={() => setInspectorPane("fontPicker")}
                />
              ) : null}
              {selectedElement.type === "stampGrid" ? (
                <StampGridInspectorBody
                  element={selectedElement}
                  update={typedUpdater("stampGrid")}
                  tab={stampTab}
                  preview={preview}
                  effectivePreviewCount={effectivePreviewCount}
                  onPreviewChange={setPreview}
                  onPlay={() => setReplayKey((key) => key + 1)}
                  onOpenLibrary={openLibraryFor}
                  face={activeFace}
                  onUploadImage={onUploadImage as UploadImageHandler | undefined}
                  onImportImageUrl={onImportImageUrl as ImportImageHandler | undefined}
                />
              ) : null}
              {selectedElement.type === "asset" ? <ImageInspectorBody element={selectedElement} update={typedUpdater("asset")} face={activeFace} onUploadImage={onUploadImage as UploadImageHandler | undefined} onImportImageUrl={onImportImageUrl as ImportImageHandler | undefined} /> : null}
              {selectedElement.type === "shape" ? <ShapeInspectorBody element={selectedElement} update={typedUpdater("shape")} /> : null}
              {selectedElement.type === "line" ? <LineInspectorBody element={selectedElement} update={typedUpdater("line")} /> : null}
              {selectedElement.type !== "stampGrid" || stampTab === "layout" ? (
                <>
                  <PositionSection element={selectedElement} update={updateSelectedElement} />
                  <OpacitySection element={selectedElement} update={updateSelectedElement} />
                </>
              ) : null}
            </fieldset>
          </div>
        </>
      );
    }

    const header = cardSettingsHeader();
    return (
      <>
        <InspectorHeader icon={header.icon} title={header.title} subtitle={header.subtitle} tone="ink" />
        <div className="lce-inspector__sections">
          <CardSettingsBody
            record={record}
            commit={commit}
            face={activeFace}
            background={activeBackground}
            onBackgroundChange={updateBackground}
            showPresetDetails={showPresetDetails}
            meta={renderMeta ? renderMeta({ record: value, update: (updater) => commit(updater) }) : null}
            sample={sample}
            onSampleChange={setSample}
            previewCount={effectivePreviewCount}
            previewTotal={previewTotal}
            hasStampGrid={Boolean(previewGrid)}
            onPreviewCountChange={(count) => setPreview({ mode: "manual", count })}
            onUploadImage={onUploadImage as UploadImageHandler | undefined}
            onImportImageUrl={onImportImageUrl as ImportImageHandler | undefined}
          />
        </div>
      </>
    );
  };

  /* ----- left panel ----- */

  const renderAddPanel = () => (
    <div className="lce-panel-body">
      <section className="lce-panel-section">
        <span className="lce-section__label">Text</span>
        {TEXT_PRESETS.map((preset) => (
          <button key={preset.id} type="button" className={cx("lce-text-preset", `lce-text-preset--${preset.id}`)} onClick={() => handleAddElement("text", { textPreset: preset.id })}>
            <span>{preset.label}</span>
            <Icon icon={Add01Icon} size={16} />
          </button>
        ))}
      </section>
      <section className="lce-panel-section">
        <div className="lce-section__header">
          <span className="lce-section__label">Card fields</span>
          <span className="lce-hint-inline">Fill in per venue</span>
        </div>
        <div className="lce-field-chips">
          {cardFieldChips.map((chip) => (
            <button key={chip.id} type="button" className="lce-field-chip" title={`Add ${chip.name.toLowerCase()} text`} onClick={() => handleAddElement("text", { textPreset: chip.id === "reward-details" ? "body" : "subheading", token: chip.token, fallbackText: chip.fallback, name: chip.name })}>
              <Icon icon={chip.icon} size={14} />
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="lce-panel-section">
        <span className="lce-section__label">Shapes and media</span>
        <div className="lce-tiles-3">
          <Tile icon={SquareIcon} label="Rectangle" onClick={() => handleAddElement("shape", { shape: "rect" })} />
          <Tile icon={CircleIcon} label="Circle" onClick={() => handleAddElement("shape", { shape: "circle" })} />
          <Tile icon={ShapesIcon} label="Blob" onClick={() => handleAddElement("shape", { shape: "blob" })} />
          <Tile icon={MinusSignIcon} label="Line" onClick={() => handleAddElement("line")} />
          <Tile icon={Image01Icon} label="Image" onClick={() => handleAddElement("asset")} />
          <Tile icon={StampIcon} label="Stamps" disabled={activeFace !== "back" || !faceKeys.includes("back")} title={activeFace !== "back" ? "Stamps go on the back of the card" : "Add a stamp grid"} onClick={() => handleAddElement("stampGrid")} />
        </div>
        {activeFace !== "back" ? <p className="lce-hint lce-hint--icon"><Icon icon={InformationCircleIcon} size={14} />Stamps go on the back of the card.</p> : null}
      </section>
      <section className="lce-panel-section">
        <span className="lce-section__label">Colours in this card</span>
        <div className="lce-swatches">
          {faceColors.map((color) => <button key={color} type="button" className="lce-swatch" style={{ background: color }} aria-label={`Use ${color}`} title={color} onClick={() => applyColor(color)} />)}
          <span className="lce-swatch lce-swatch--add">
            <Icon icon={PlusSignIcon} size={14} />
            <input ref={colorInputRef} type="color" aria-label="Pick another colour" onChange={(event) => applyColor(event.target.value)} />
          </span>
        </div>
        <p className="lce-hint">{hasSelection ? "Click a colour to use it on the selected item." : "Click a colour to use it as the background, or select an item first."}</p>
      </section>
    </div>
  );

  const renderLayersPanel = () => (
    <div className="lce-panel-body">
      <div className="lce-section__header">
        <span className="lce-section__label">{FACE_SIDE_LABELS[activeFace]}</span>
        <span className="lce-hint-inline">{activeElements.length} layer{activeElements.length === 1 ? "" : "s"}</span>
      </div>
      <div className="lce-layers" role="list">
        {layersTopFirst.map((element) => {
          const label = elementLabel(element, editorTokens);
          const selected = selectedElementIds.includes(element.id);
          const renaming = renamingLayerId === element.id;
          return (
            <div
              key={element.id}
              role="listitem"
              className={cx("lce-layer", selected && "lce-layer--active", element.hidden && "lce-layer--hidden", draggedLayerId === element.id && "lce-layer--dragging")}
              draggable={!element.locked && !renaming}
              onClick={(event) => handleSelectElement(element.id, event.shiftKey, event.altKey)}
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
              <span className="lce-layer__grip" aria-hidden="true" title={element.locked ? "Unlock to reorder" : "Drag to reorder"}><Icon icon={DragDropVerticalIcon} size={14} /></span>
              <span className="lce-layer__well"><Icon icon={elementIcon(element)} size={15} /></span>
              <span className="lce-layer__text">
                {renaming ? (
                  <input
                    className="lce-layer__rename"
                    autoFocus
                    defaultValue={element.name || label}
                    aria-label={`Rename ${label}`}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") setRenamingLayerId(null);
                      event.stopPropagation();
                    }}
                    onBlur={(event) => {
                      const name = event.currentTarget.value.trim();
                      setRenamingLayerId(null);
                      if (name === (element.name || "") || (!element.name && name === label)) return;
                      updateLayerElement(element.id, (current) => ({ ...current, name }));
                    }}
                  />
                ) : (
                  <strong onDoubleClick={(event) => { event.stopPropagation(); setRenamingLayerId(element.id); }} title="Double-click to rename">{label}</strong>
                )}
                <small>{elementSubtitle(element, editorTokens)}</small>
              </span>
              <button type="button" className="lce-layer__action" aria-label={element.hidden ? `Show ${label}` : `Hide ${label}`} title={element.hidden ? "Show" : "Hide"} aria-pressed={Boolean(element.hidden)} onClick={(event) => { event.stopPropagation(); updateLayerElement(element.id, (current) => ({ ...current, hidden: !current.hidden })); }}>
                <Icon icon={element.hidden ? ViewOffSlashIcon : ViewIcon} size={15} />
              </button>
              <button type="button" className={cx("lce-layer__action", element.locked && "lce-layer__action--on")} aria-label={element.locked ? `Unlock ${label}` : `Lock ${label}`} title={element.locked ? "Unlock" : "Lock"} aria-pressed={Boolean(element.locked)} onClick={(event) => { event.stopPropagation(); updateLayerElement(element.id, (current) => ({ ...current, locked: !current.locked })); }}>
                <Icon icon={element.locked ? LockKeyIcon : SquareUnlock01Icon} size={15} />
              </button>
            </div>
          );
        })}
        <div role="listitem" className={cx("lce-layer", "lce-layer--background", selectedElementIds.length === 0 && "lce-layer--current")} onClick={() => setSelectedElementIds([])}>
          <span className="lce-layer__grip" aria-hidden="true" />
          <span className="lce-layer__swatch" style={backgroundSwatch(activeBackground)} aria-hidden="true" />
          <span className="lce-layer__text">
            <strong>Background</strong>
            <small>{backgroundSummary(activeBackground)}</small>
          </span>
          <span className="lce-layer__action lce-layer__action--static" title="The background always stays at the bottom"><Icon icon={LockKeyIcon} size={15} /></span>
        </div>
      </div>
      <p className="lce-hint lce-hint--box"><Icon icon={InformationCircleIcon} size={14} />Drag to change the order. Shift-click two layers to select both, then group them. Double-click a name to rename it.</p>
    </div>
  );

  const renderLibraryPanel = () => (
    <LibraryPanel
      assets={assetLibrary}
      target={libraryTarget}
      onTargetChange={setLibraryTarget}
      stampMode={stampMode}
      activeUrls={libraryActiveUrls}
      onPick={handleLibraryPick}
      onUpload={onUploadLibraryAsset as UploadLibraryAssetHandler | undefined}
      onArchive={onArchiveLibraryAsset}
      onRestore={onRestoreLibraryAsset}
      onDelete={onDeleteLibraryAsset}
      fontsSection={(
        <LibraryFontsSection onUpload={onUploadFont ? () => setFontUploadOpen(true) : undefined}>
          <UploadedFontsList groups={fontGroups} onArchive={onArchiveFont} onDelete={onDeleteFont} />
        </LibraryFontsSection>
      )}
    />
  );

  /* ----- render ----- */

  return (
    <div className={cx("loyalty-studio-page", `loyalty-studio-page--theme-${editorTheme}`, "lce-root")} aria-label={title}>
      <header className="lce-topbar">
        <div className="lce-topbar__left">
          {onBack ? <IconButton icon={ArrowLeft01Icon} label={backLabel} variant="outline" size="lg" onClick={onBack} /> : null}
          <div className="lce-topbar__titles">
            <div className="lce-topbar__name">
              <h1>{record.name || title}</h1>
              {showStatus ? <span className={cx("lce-status", `lce-status--${record.status}`)}>{statusLabel}</span> : null}
            </div>
            {subtitleParts.length ? <p>{subtitleParts.join(" · ")}</p> : null}
          </div>
        </div>
        <div className="lce-topbar__right">
          <IconButton icon={Undo02Icon} label="Undo (Ctrl+Z)" variant="outline" size="lg" disabled={!canUndo} onClick={handleUndo} />
          <IconButton icon={Redo02Icon} label="Redo (Ctrl+Shift+Z)" variant="outline" size="lg" disabled={!canRedo} onClick={handleRedo} />
          <span className="lce-topbar__divider" aria-hidden="true" />
          <button type="button" className="lce-button" onClick={() => { setPreviewFace(activeFace); setPreviewOpen(true); }}><Icon icon={PlayIcon} size={16} />Preview</button>
          <span className="lce-menu-anchor">
            <IconButton icon={MoreHorizontalIcon} label="More actions" variant="outline" size="lg" onClick={() => setMoreMenuOpen((open) => !open)} />
            {moreMenuOpen ? <Menu label="More actions" items={moreItems} onClose={() => setMoreMenuOpen(false)} /> : null}
          </span>
          {actions || onSaveDraft || onPublish ? <span className="lce-topbar__divider" aria-hidden="true" /> : null}
          {actions ? <div className="lce-topbar__actions">{actions}</div> : null}
          {onSaveDraft ? <button type="button" className="lce-button" disabled={isSaving} onClick={onSaveDraft}>{saveDraftLabel}</button> : null}
          {onPublish ? <button type="button" className="lce-button lce-button--ink" disabled={isSaving} onClick={onPublish}>{publishLabel}</button> : null}
        </div>
      </header>

      {error ? <div className="lce-banner" role="alert"><Icon icon={InformationCircleIcon} size={16} />{error}</div> : null}
      {toast ? <div className="lce-toast" role="status" aria-live="polite">{toast}</div> : null}

      <div className="lce-body">
        <aside className="lce-panel lce-panel--left" aria-label="Add, layers and library">
          <Segmented label="Panel" className="lce-segmented--tabs lce-panel__tabs" value={leftTab} options={[{ value: "add", label: "Add" }, { value: "layers", label: "Layers" }, { value: "library", label: "Library" }]} onChange={setLeftTab} />
          <div className="lce-panel__scroll">
            {leftTab === "add" ? renderAddPanel() : leftTab === "layers" ? renderLayersPanel() : renderLibraryPanel()}
          </div>
        </aside>

        <main className="lce-canvas-area" aria-label="Card canvas">
          <div className="lce-arrange" role="toolbar" aria-label="Arrange">
            <IconButton icon={AlignLeftIcon} label="Align left" disabled={selectedEditableElements.length === 0} onClick={() => handleAlign("x", "start")} />
            <IconButton icon={AlignHorizontalCenterIcon} label="Align centre" disabled={selectedEditableElements.length === 0} onClick={() => handleAlign("x", "center")} />
            <IconButton icon={AlignRightIcon} label="Align right" disabled={selectedEditableElements.length === 0} onClick={() => handleAlign("x", "end")} />
            <span className="lce-arrange__divider" aria-hidden="true" />
            <IconButton icon={AlignTopIcon} label="Align top" disabled={selectedEditableElements.length === 0} onClick={() => handleAlign("y", "start")} />
            <IconButton icon={AlignVerticalCenterIcon} label="Align middle" disabled={selectedEditableElements.length === 0} onClick={() => handleAlign("y", "center")} />
            <IconButton icon={AlignBottomIcon} label="Align bottom" disabled={selectedEditableElements.length === 0} onClick={() => handleAlign("y", "end")} />
            <span className="lce-arrange__divider" aria-hidden="true" />
            <span className="lce-menu-anchor">
              <button type="button" className="lce-arrange__order" disabled={!hasSelection} aria-expanded={orderMenuOpen} onClick={() => setOrderMenuOpen((open) => !open)}>
                <Icon icon={Layers01Icon} size={16} />
                <span>Order</span>
                <Icon icon={ArrowDown01Icon} size={14} />
              </button>
              {orderMenuOpen && hasSelection ? <Menu label="Order" align="center" items={orderItems} onClose={() => setOrderMenuOpen(false)} /> : null}
            </span>
            <span className="lce-arrange__divider" aria-hidden="true" />
            <IconButton icon={Copy01Icon} label="Duplicate (Ctrl+D)" disabled={selectedEditableElements.length === 0} onClick={duplicateSelectedElements} />
            <IconButton icon={selectionLocked ? LockKeyIcon : SquareUnlock01Icon} label={selectionLocked ? "Unlock" : "Lock"} active={selectionLocked} disabled={!hasSelection} onClick={toggleSelectionLock} />
            <IconButton icon={Delete02Icon} label="Delete" tone="danger" disabled={selectedEditableElements.length === 0} onClick={handleDeleteElement} />
          </div>

          <div ref={stageRef} className="lce-stage">
            <LoyaltyCardDesignCanvas
              schema={record.designSchema}
              face={activeFace}
              selectedElementIds={selectedElementIds}
              tokens={editorTokens}
              snapEnabled={snapEnabled}
              cardWidth={cardWidth}
              replayKey={replayKey}
              renderSelectionTag={renderSelectionTag}
              onSelectElement={handleSelectElement}
              onBeginInteraction={pushUndo}
              onChangeElement={(elementId, nextElement, options) => {
                commit((preset) => normalizeLoyaltyCardPreset({ ...preset, designSchema: updateElement(preset.designSchema, activeFace, elementId, () => nextElement) }), options);
              }}
              onChangeElements={commitElements}
            />
          </div>

          <div className="lce-bottombar">
            <div className="lce-pill lce-zoom" role="group" aria-label="Zoom">
              <IconButton icon={MinusSignIcon} label="Zoom out" size="sm" disabled={zoomPercent <= ZOOM_STEPS[0]} onClick={() => stepZoom(-1)} />
              <button type="button" className="lce-zoom__value" title="Back to 100%" onClick={() => setZoom(100)}>{zoomPercent}%</button>
              <IconButton icon={PlusSignIcon} label="Zoom in" size="sm" disabled={zoomPercent >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} onClick={() => stepZoom(1)} />
              <button type="button" className={cx("lce-zoom__fit", zoom === "fit" && "lce-zoom__fit--active")} onClick={() => setZoom("fit")}>Fit</button>
            </div>
            <div className="lce-faces" role="tablist" aria-label="Card side">
              {faceKeys.map((face) => (
                <button key={face} type="button" role="tab" aria-selected={activeFace === face} className={cx("lce-face", activeFace === face && "lce-face--active")} onClick={() => setActiveFace(face)}>
                  <span className="lce-face__thumb">
                    <LoyaltyCardRenderer schema={record.designSchema} face={face} tokens={editorTokens} style={{ border: "none", boxShadow: "none" }} />
                  </span>
                  <span className="lce-face__label">{FACE_LABELS[face]}</span>
                </button>
              ))}
            </div>
            <div className="lce-pill lce-snap">
              <Icon icon={MagnetIcon} size={16} />
              <Switch label="Snap" checked={snapEnabled} onChange={setSnapEnabled} />
            </div>
          </div>
        </main>

        <aside className="lce-panel lce-panel--inspector lce-inspector" aria-label="Settings">
          {renderInspector()}
        </aside>
      </div>

      {previewOpen ? (
        <Modal title="Preview" subtitle="How the card looks with the sample data. Nothing here is saved." onClose={() => setPreviewOpen(false)} className="lce-modal--preview">
          <div className="lce-preview-card">
            <LoyaltyCardRenderer key={`${previewFace}-${replayKey}`} schema={record.designSchema} face={previewFace} tokens={editorTokens} animateStampGridLayout />
          </div>
          <div className="lce-preview-controls">
            <Segmented label="Card side" value={previewFace} options={faceKeys.map((face) => ({ value: face, label: FACE_LABELS[face] }))} onChange={setPreviewFace} />
            <button type="button" className="lce-button lce-button--small" onClick={() => setReplayKey((key) => key + 1)}><Icon icon={PlayIcon} size={15} />Replay stamps</button>
          </div>
        </Modal>
      ) : null}

      {fontUploadOpen && onUploadFont ? <FontUploadDialog onUpload={onUploadFont as UploadFontHandler} onClose={() => setFontUploadOpen(false)} /> : null}
    </div>
  );
}

