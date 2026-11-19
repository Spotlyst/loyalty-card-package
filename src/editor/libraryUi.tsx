import { Archive02Icon, CloudUploadIcon, Delete02Icon, MoreHorizontalIcon, PlusSignIcon, Refresh01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon, IconButton, Menu, Modal, Segmented, TextInput, cx } from "./ui.js";
import type { MenuItem } from "./ui.js";

export type LoyaltyCardEditorLibraryAsset = {
  id: string;
  name: string;
  category: string;
  status?: "active" | "hidden" | "archived";
  cdnUrl: string;
  width?: number;
  height?: number;
  tags?: string[];
};

export type UploadLibraryAssetHandler = (file: File, meta: { name: string; category: string }) => Promise<LoyaltyCardEditorLibraryAsset>;

export type LibraryKind = "stamps" | "icons" | "patterns";
export type StampTarget = "empty" | "filled";

const KIND_CATEGORIES: Record<LibraryKind, string[]> = {
  stamps: ["stamp_empty", "stamp_filled"],
  icons: ["icon", "sticker", "badge"],
  patterns: ["pattern", "floral", "decorative", "border", "frame", "background"],
};

const KIND_LABELS: Record<LibraryKind, string> = { stamps: "Stamps", icons: "Icons", patterns: "Patterns" };

function AssetTile({ asset, active, onSelect, onArchive, onRestore, onDelete }: { asset: LoyaltyCardEditorLibraryAsset; active: boolean; onSelect: (asset: LoyaltyCardEditorLibraryAsset) => void; onArchive?: (id: string) => Promise<void>; onRestore?: (id: string) => Promise<void>; onDelete?: (id: string) => Promise<void> }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const archived = asset.status === "archived";
  const run = async (action: (id: string) => Promise<void>) => {
    setBusy(true);
    try {
      await action(asset.id);
    } finally {
      setBusy(false);
    }
  };
  const items: MenuItem[] = [
    ...(onArchive && !archived ? [{ id: "archive", label: "Archive", icon: Archive02Icon, disabled: busy, onSelect: () => void run(onArchive) }] : []),
    ...(onRestore && archived ? [{ id: "restore", label: "Restore", icon: Refresh01Icon, disabled: busy, onSelect: () => void run(onRestore) }] : []),
    ...(onDelete ? [{ id: "delete", label: "Delete for good", icon: Delete02Icon, danger: true, disabled: busy, onSelect: () => {
      if (typeof window !== "undefined" && !window.confirm(`Delete “${asset.name}” from the library for good? Cards that already use it keep rendering.`)) return;
      void run(onDelete);
    } }] : []),
  ];
  return (
    <div className={cx("lce-asset", active && "lce-asset--active", archived && "lce-asset--archived")}>
      <button type="button" className="lce-asset__button" title={asset.name} aria-label={archived ? `${asset.name} (archived)` : `Use ${asset.name}`} aria-pressed={active} disabled={archived || busy} onClick={() => onSelect(asset)}>
        <img src={asset.cdnUrl} alt="" loading="lazy" />
      </button>
      {items.length ? (
        <span className="lce-asset__more lce-menu-anchor">
          <IconButton icon={MoreHorizontalIcon} label={`More for ${asset.name}`} size="sm" variant="soft" onClick={() => setMenuOpen((open) => !open)} />
          {menuOpen ? <Menu label={`${asset.name} actions`} items={items} onClose={() => setMenuOpen(false)} /> : null}
        </span>
      ) : null}
    </div>
  );
}

const UPLOAD_CATEGORIES = [
  { value: "stamp_empty", label: "Empty stamp" },
  { value: "stamp_filled", label: "Filled stamp" },
  { value: "icon", label: "Icon" },
  { value: "pattern", label: "Pattern" },
] as const;

export function AssetUploadDialog({ onUpload, onClose, defaultCategory = "stamp_empty" }: { onUpload: UploadLibraryAssetHandler; onClose: () => void; defaultCategory?: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(UPLOAD_CATEGORIES.some((item) => item.value === defaultCategory) ? defaultCategory : "stamp_empty");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleUpload = async () => {
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      await onUpload(file, { name: name.trim() || file.name.replace(/\.[^.]+$/, ""), category });
      onClose();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      title="Upload images"
      subtitle="A safe SVG, or a square PNG, JPG or WebP of at least 512 × 512 px."
      busy={isUploading}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="lce-button" disabled={isUploading} onClick={onClose}>Cancel</button>
          <button type="button" className="lce-button lce-button--ink" disabled={isUploading || !file} onClick={handleUpload}>{isUploading ? "Uploading…" : "Upload"}</button>
        </>
      )}
    >
      <input ref={inputRef} className="lce-file-input" type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" onChange={(event) => {
        setFile(event.target.files?.[0] || null);
        setError(null);
      }} />
      <button type="button" className="lce-dropzone" disabled={isUploading} onClick={() => inputRef.current?.click()}>
        {previewUrl ? <img src={previewUrl} alt="" /> : <Icon icon={CloudUploadIcon} size={22} />}
        <strong>{file ? file.name : "Choose an image"}</strong>
        <small>It uploads only when you click Upload.</small>
      </button>
      <TextInput label="Name" value={name} placeholder="Optional" onChange={setName} />
      <div className="lce-field">
        <span className="lce-field__label">Use it as</span>
        <Segmented label="Image kind" value={category} options={UPLOAD_CATEGORIES.map((item) => ({ value: item.value, label: item.label }))} onChange={setCategory} className="lce-segmented--wrap" />
      </div>
      {error ? <p className="lce-error" role="alert">{error}</p> : null}
    </Modal>
  );
}

type LibraryPanelProps = {
  assets: LoyaltyCardEditorLibraryAsset[];
  target: StampTarget;
  onTargetChange: (target: StampTarget) => void;
  stampMode: boolean;
  activeUrls: string[];
  onPick: (asset: LoyaltyCardEditorLibraryAsset, kind: LibraryKind) => void;
  onUpload?: UploadLibraryAssetHandler;
  onArchive?: (id: string) => Promise<void>;
  onRestore?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  fontsSection: ReactNode;
};

export function LibraryPanel({ assets, target, onTargetChange, stampMode, activeUrls, onPick, onUpload, onArchive, onRestore, onDelete, fontsSection }: LibraryPanelProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LibraryKind>("stamps");
  const [showArchived, setShowArchived] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const kindAssets = useMemo(() => assets.filter((asset) => KIND_CATEGORIES[kind].includes(asset.category)), [assets, kind]);
  const archivedCount = kindAssets.filter((asset) => asset.status === "archived").length;
  const visibleAssets = useMemo(() => {
    const matching = kindAssets
      .filter((asset) => (showArchived ? asset.status === "archived" : asset.status !== "archived"))
      .filter((asset) => !normalizedQuery || asset.name.toLowerCase().includes(normalizedQuery) || (asset.tags || []).some((tag) => tag.toLowerCase().includes(normalizedQuery)));
    if (kind !== "stamps") return matching;
    const preferred = target === "empty" ? "stamp_empty" : "stamp_filled";
    return [...matching].sort((a, b) => Number(b.category === preferred) - Number(a.category === preferred));
  }, [kindAssets, showArchived, normalizedQuery, kind, target]);

  useEffect(() => {
    if (archivedCount === 0) setShowArchived(false);
  }, [archivedCount]);

  const usesStampTarget = stampMode && (kind === "stamps" || kind === "icons");

  return (
    <div className="lce-panel-body">
      <label className="lce-search">
        <Icon icon={Search01Icon} size={16} />
        <input value={query} placeholder="Search images" aria-label="Search images" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="lce-chip-row lce-chip-row--wrap" role="radiogroup" aria-label="Image kind">
        {(Object.keys(KIND_LABELS) as LibraryKind[]).map((item) => (
          <button key={item} type="button" role="radio" aria-checked={kind === item} className={cx("lce-filter-chip", kind === item && "lce-filter-chip--active")} onClick={() => setKind(item)}>{KIND_LABELS[item]}</button>
        ))}
        {archivedCount > 0 ? <button type="button" aria-pressed={showArchived} className={cx("lce-filter-chip", "lce-filter-chip--quiet", showArchived && "lce-filter-chip--active")} onClick={() => setShowArchived((current) => !current)}>Archived · {archivedCount}</button> : null}
      </div>
      {usesStampTarget ? (
        <div className="lce-target-box">
          <span>Click an image to use it as the</span>
          <Segmented label="Use the image as" value={target} options={[{ value: "empty", label: "Empty stamp" }, { value: "filled", label: "Filled stamp" }]} onChange={onTargetChange} />
        </div>
      ) : (
        <p className="lce-hint">{kind === "stamps" ? "Select a stamp grid on the back of the card to use these as stamps." : "Click an image to add it to the card."}</p>
      )}
      {visibleAssets.length ? (
        <div className="lce-asset-grid">
          {visibleAssets.map((asset) => <AssetTile key={asset.id} asset={asset} active={activeUrls.includes(asset.cdnUrl)} onSelect={(picked) => onPick(picked, kind)} onArchive={onArchive} onRestore={onRestore} onDelete={onDelete} />)}
        </div>
      ) : (
        <p className="lce-empty">{showArchived ? "Nothing archived here." : normalizedQuery ? `No images match “${query}”.` : `No ${KIND_LABELS[kind].toLowerCase()} yet.`}</p>
      )}
      {onUpload ? (
        <button type="button" className="lce-button lce-button--block" onClick={() => setUploadOpen(true)}><Icon icon={CloudUploadIcon} size={17} />Upload images</button>
      ) : null}
      {fontsSection}
      {uploadOpen && onUpload ? <AssetUploadDialog onUpload={onUpload} defaultCategory={kind === "stamps" ? (target === "empty" ? "stamp_empty" : "stamp_filled") : kind === "icons" ? "icon" : "pattern"} onClose={() => setUploadOpen(false)} /> : null}
    </div>
  );
}

export function LibraryFontsSection({ children, onUpload }: { children: ReactNode; onUpload?: () => void }) {
  return (
    <div className="lce-library-fonts">
      <div className="lce-section__header">
        <span className="lce-section__label">Uploaded fonts</span>
        {onUpload ? <button type="button" className="lce-link-button" onClick={onUpload}><Icon icon={PlusSignIcon} size={14} />Upload</button> : null}
      </div>
      {children}
    </div>
  );
}
