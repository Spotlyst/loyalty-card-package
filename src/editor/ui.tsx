import { ArrowDown01Icon, Cancel01Icon, MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { clampNumber, expandHexColor, formatColor, hexToAlpha, parseColor } from "./editorUtils.js";

export type IconType = IconSvgElement;

export function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}

export function Icon({ icon, size = 16, className, style }: { icon: IconType; size?: number; className?: string; style?: CSSProperties }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.5} className={className} style={style} aria-hidden="true" />;
}

type IconButtonProps = {
  icon: IconType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: "default" | "danger";
  variant?: "outline" | "soft" | "ghost";
  size?: "lg" | "md" | "sm";
  iconSize?: number;
  className?: string;
};

export function IconButton({ icon, label, onClick, disabled, active, tone = "default", variant = "ghost", size = "md", iconSize, className }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cx("lce-icon-button", `lce-icon-button--${variant}`, `lce-icon-button--${size}`, active && "lce-icon-button--active", tone === "danger" && "lce-icon-button--danger", className)}
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon icon={icon} size={iconSize ?? (size === "sm" ? 15 : 17)} />
    </button>
  );
}

export function Section({ label, aside, children, className }: { label?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("lce-section", className)}>
      {label || aside ? (
        <div className="lce-section__header">
          {label ? <span className="lce-section__label">{label}</span> : <span />}
          {aside ? <span className="lce-section__aside">{aside}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Field({ label, children, className, htmlFor }: { label: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cx("lce-field", className)}>
      {htmlFor ? <label className="lce-field__label" htmlFor={htmlFor}>{label}</label> : <span className="lce-field__label">{label}</span>}
      {children}
    </div>
  );
}

export function TextInput({ label, value, onChange, placeholder, type = "text", disabled, autoFocus, onBlur }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; disabled?: boolean; autoFocus?: boolean; onBlur?: () => void }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <input id={id} className="lce-input" type={type} value={value} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export function TextArea({ label, value, onChange, placeholder, rows = 2, disabled }: { label: ReactNode; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number; disabled?: boolean }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <textarea id={id} className="lce-input lce-input--area" rows={rows} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function formatNumber(value: number, decimals: number) {
  if (!Number.isFinite(value)) return "";
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}

type NumberInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  decimals?: number;
  disabled?: boolean;
  hideLabel?: boolean;
};

export function NumberInput({ label, value, onChange, min = -Infinity, max = Infinity, step = 1, suffix, decimals = 2, disabled, hideLabel }: NumberInputProps) {
  const id = useId();
  const [draft, setDraft] = useState(formatNumber(value, decimals));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(formatNumber(value, decimals));
  }, [value, decimals, focused]);
  const commit = (raw: string) => {
    if (raw.trim() === "" || raw === "-") return;
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    onChange(clampNumber(next, min, max));
  };
  const nudge = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const delta = (event.key === "ArrowUp" ? 1 : -1) * step * (event.shiftKey ? 10 : 1);
    const next = clampNumber(Math.round((value + delta) * 1000) / 1000, min, max);
    setDraft(formatNumber(next, decimals));
    onChange(next);
  };
  const control = (
    <span className={cx("lce-number", disabled && "lce-number--disabled")}>
      <input
        id={id}
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        aria-label={hideLabel ? label : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDraft(formatNumber(value, decimals));
        }}
        onKeyDown={nudge}
        onChange={(event) => {
          setDraft(event.target.value);
          commit(event.target.value);
        }}
      />
      {suffix ? <span className="lce-number__suffix">{suffix}</span> : null}
    </span>
  );
  if (hideLabel) return control;
  return <Field label={label} htmlFor={id}>{control}</Field>;
}

export type SegmentOption<T extends string> = { value: T; label: ReactNode; icon?: IconType; title?: string; disabled?: boolean };

export function Segmented<T extends string>({ value, options, onChange, label, className, iconOnly }: { value: T; options: Array<SegmentOption<T>>; onChange: (value: T) => void; label: string; className?: string; iconOnly?: boolean }) {
  const enabled = options.filter((option) => !option.disabled);
  // One tab stop for the group (the chosen option); arrow keys move the choice, like native radio buttons.
  const tabStop = enabled.some((option) => option.value === value) ? value : enabled[0]?.value;
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, current: T) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    const edge = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : -1;
    if (!step && edge < 0) return;
    event.preventDefault();
    const index = enabled.findIndex((option) => option.value === current);
    const nextIndex = edge >= 0 ? edge : (index + step + enabled.length) % enabled.length;
    const next = enabled[nextIndex];
    if (!next) return;
    const buttons = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') || []);
    buttons[nextIndex]?.focus();
    if (next.value !== value) onChange(next.value);
  };
  return (
    <div className={cx("lce-segmented", iconOnly && "lce-segmented--icons", className)} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={option.value === tabStop ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, option.value)}
            aria-label={iconOnly ? String(option.title || option.value) : undefined}
            title={option.title}
            disabled={option.disabled}
            className={cx("lce-segmented__option", active && "lce-segmented__option--active")}
            onClick={() => onChange(option.value)}
          >
            {option.icon ? <Icon icon={option.icon} size={16} /> : null}
            {iconOnly ? null : <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 100, disabled }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; disabled?: boolean }) {
  return (
    <div className="lce-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer: ${label}`} disabled={disabled || value <= min} onClick={() => onChange(clampNumber(value - 1, min, max))}><Icon icon={MinusSignIcon} size={15} /></button>
      <span className="lce-stepper__value" aria-live="polite">{value}</span>
      <button type="button" aria-label={`More: ${label}`} disabled={disabled || value >= max} onClick={() => onChange(clampNumber(value + 1, min, max))}><Icon icon={PlusSignIcon} size={15} /></button>
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format, disabled }: { label: ReactNode; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; format?: (value: number) => ReactNode; disabled?: boolean }) {
  const id = useId();
  const safeValue = clampNumber(Number.isFinite(value) ? value : min, min, max);
  const percent = max > min ? ((safeValue - min) / (max - min)) * 100 : 0;
  return (
    <div className={cx("lce-slider", disabled && "lce-slider--disabled")}>
      <div className="lce-slider__header">
        <label htmlFor={id}>{label}</label>
        <span>{format ? format(safeValue) : safeValue}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={safeValue} disabled={disabled} style={{ "--lce-slider-fill": `${percent}%` } as CSSProperties} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

export function Switch({ label, checked, onChange, disabled, hideLabel }: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; hideLabel?: boolean }) {
  const id = useId();
  return (
    <div className="lce-switch-row">
      {hideLabel ? null : <label htmlFor={id}>{label}</label>}
      <button id={id} type="button" role="switch" aria-checked={checked} aria-label={hideLabel ? String(label) : undefined} disabled={disabled} className={cx("lce-switch", checked && "lce-switch--on")} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange, hideLabel }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; hideLabel?: boolean }) {
  const id = useId();
  const control = (
    <span className="lce-select">
      <select id={id} value={value} aria-label={hideLabel ? label : undefined} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <Icon icon={ArrowDown01Icon} size={15} />
    </span>
  );
  if (hideLabel) return control;
  return <Field label={label} htmlFor={id}>{control}</Field>;
}

export function ColorField({ label, value, fallback = "#000000", onChange, hideLabel, compact }: { label: string; value: string | undefined; fallback?: string; onChange: (value: string) => void; hideLabel?: boolean; compact?: boolean }) {
  const id = useId();
  const parsed = parseColor(value, fallback);
  const [draft, setDraft] = useState(parsed.hex.slice(1));
  const [alphaDraft, setAlphaDraft] = useState(String(parsed.alpha));
  // While a field has focus, keep what the person typed ("123" stays "123", not "112233"); tidy it on blur or Enter.
  const hexFocused = useRef(false);
  const alphaFocused = useRef(false);
  useEffect(() => {
    if (!hexFocused.current) setDraft(parsed.hex.slice(1));
  }, [parsed.hex]);
  useEffect(() => {
    if (!alphaFocused.current) setAlphaDraft(String(parsed.alpha));
  }, [parsed.alpha]);

  const commitHex = (raw: string) => {
    const expanded = expandHexColor(raw);
    if (!expanded) return;
    const alpha = expanded.length === 8 ? hexToAlpha(expanded.slice(6, 8)) : parsed.alpha;
    onChange(formatColor(`#${expanded.slice(0, 6)}`, alpha));
  };

  const control = (
    <span className={cx("lce-color", compact && "lce-color--compact")}>
      <span className="lce-color__swatch" style={{ background: parsed.value }}>
        <input type="color" value={parsed.hex} aria-label={`${label}: pick a colour`} onChange={(event) => onChange(formatColor(event.target.value, parsed.alpha))} />
      </span>
      <input
        id={id}
        className="lce-color__hex"
        value={draft}
        spellCheck={false}
        maxLength={9}
        aria-label={hideLabel ? `${label} hex code` : undefined}
        onChange={(event) => {
          const next = event.target.value.replace(/^#/, "").toUpperCase();
          setDraft(next);
          commitHex(next);
        }}
        onFocus={() => {
          hexFocused.current = true;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") setDraft(parsed.hex.slice(1));
        }}
        onBlur={() => {
          hexFocused.current = false;
          setDraft(parsed.hex.slice(1));
        }}
      />
      <span className="lce-color__alpha">
        <input
          inputMode="numeric"
          value={alphaDraft}
          aria-label={`${label} opacity`}
          onChange={(event) => {
            setAlphaDraft(event.target.value);
            const next = Number(event.target.value);
            if (event.target.value.trim() !== "" && Number.isFinite(next)) onChange(formatColor(parsed.hex, clampNumber(next, 0, 100)));
          }}
          onFocus={() => {
            alphaFocused.current = true;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") setAlphaDraft(String(parsed.alpha));
          }}
          onBlur={() => {
            alphaFocused.current = false;
            setAlphaDraft(String(parsed.alpha));
          }}
        />
        <span>%</span>
      </span>
    </span>
  );
  if (hideLabel) return control;
  return <Field label={label} htmlFor={id}>{control}</Field>;
}

export function Tile({ icon, label, active, disabled, onClick, children, title, className }: { icon?: IconType; label: ReactNode; active?: boolean; disabled?: boolean; onClick?: () => void; children?: ReactNode; title?: string; className?: string }) {
  return (
    <button type="button" className={cx("lce-tile", active && "lce-tile--active", className)} aria-pressed={active === undefined ? undefined : active} disabled={disabled} title={title} onClick={onClick}>
      {children || (icon ? <Icon icon={icon} size={22} /> : null)}
      <span>{label}</span>
    </button>
  );
}

export function Chip({ children, tone = "neutral", icon, onRemove, removeLabel }: { children: ReactNode; tone?: "neutral" | "primary" | "warning" | "success"; icon?: IconType; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className={cx("lce-chip", `lce-chip--${tone}`)}>
      {icon ? <Icon icon={icon} size={13} /> : null}
      <span>{children}</span>
      {onRemove ? <button type="button" aria-label={removeLabel || "Remove"} onClick={onRemove}><Icon icon={Cancel01Icon} size={12} /></button> : null}
    </span>
  );
}

export type MenuItem = { id: string; label: string; icon?: IconType; onSelect: () => void; disabled?: boolean; danger?: boolean; active?: boolean } | { id: string; divider: true };

export function Menu({ items, onClose, align = "end", className, label }: { items: MenuItem[]; onClose: () => void; align?: "start" | "end" | "center"; className?: string; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    // The control that opened the menu (focused by the click or key press), to return focus to on Escape.
    const opener = document.activeElement instanceof HTMLElement && !ref.current?.contains(document.activeElement) ? document.activeElement : null;
    const handlePointerDown = (event: PointerEvent) => {
      const parent = ref.current?.parentElement;
      if (parent && parent.contains(event.target as Node)) return;
      onCloseRef.current();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        if (opener?.isConnected) opener.focus();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKey, true);
    window.requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKey, true);
    };
  }, []);
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []);
    const index = buttons.findIndex((button) => button === document.activeElement);
    const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  return (
    <div ref={ref} className={cx("lce-menu", `lce-menu--${align}`, className)} role="menu" aria-label={label} onKeyDown={handleKeyDown}>
      {items.map((item) => "divider" in item ? <span key={item.id} className="lce-menu__divider" role="separator" /> : (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={cx("lce-menu__item", item.danger && "lce-menu__item--danger", item.active && "lce-menu__item--active")}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.icon ? <Icon icon={item.icon} size={16} /> : null}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, busy, className, footer }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; busy?: boolean; className?: string; footer?: ReactNode }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<Element | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement;
    window.requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("input, button:not(:disabled), select, textarea")?.focus());
    return () => {
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
    };
  }, []);
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <div className="lce-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div ref={ref} className={cx("lce-modal", className)} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKeyDown}>
        <div className="lce-modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <IconButton icon={Cancel01Icon} label="Close" variant="soft" size="sm" disabled={busy} onClick={onClose} />
        </div>
        <div className="lce-modal__body">{children}</div>
        {footer ? <div className="lce-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Collapsible({ summary, label, children, defaultOpen = false }: { summary: ReactNode; label: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cx("lce-section", "lce-collapsible", open && "lce-collapsible--open")}>
      <button type="button" className="lce-collapsible__toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>
          <span className="lce-section__label">{label}</span>
          {open ? null : <span className="lce-collapsible__summary">{summary}</span>}
        </span>
        <Icon icon={ArrowDown01Icon} size={16} />
      </button>
      {open ? <div className="lce-collapsible__body">{children}</div> : null}
    </section>
  );
}
