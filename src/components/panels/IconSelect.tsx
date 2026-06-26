import { useEffect, useRef, useState } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Icon } from "../Icon";

export interface SelectOption {
  value: string;
  label: string;
  icon?: IconDefinition;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

/** A small custom dropdown that shows an icon next to each option. */
export function IconSelect({ value, options, onChange, ariaLabel, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true); // capture: handle before modal's Esc
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const cur = options.find((o) => o.value === value);

  return (
    <div className="icon-select" ref={ref}>
      <button
        type="button"
        className="icon-select-btn"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="icon-select-cur">
          {cur?.icon ? <Icon icon={cur.icon} /> : <span className="icon-slot" />}
          <span>{cur?.label}</span>
        </span>
        <Icon name="chevron" size={11} />
      </button>
      {open && (
        <ul className="icon-select-menu" role="listbox">
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={`icon-select-item ${o.value === value ? "active" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.icon ? <Icon icon={o.icon} /> : <span className="icon-slot" />}
                <span>{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
