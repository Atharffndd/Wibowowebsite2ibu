"use client";

import { useMemo, useRef, useState } from "react";
import { cx, inputCls } from "./ui";

export type ComboOption = { id: string; name: string; sub?: string | null };

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Kolom nama yang bisa diketik bebas atau dipilih dari daftar (pelanggan / supplier).
 * Nama yang belum ada di daftar ditandai "baru" dan otomatis tersimpan saat dokumen disimpan.
 */
export function NameCombo({
  value,
  options,
  onChange,
  placeholder,
  newLabel = "baru",
  autoFocus,
}: {
  value: string;
  options: ComboOption[];
  /** id = data yang cocok di daftar, null = nama baru */
  onChange: (name: string, id: string | null) => void;
  placeholder?: string;
  /** contoh: "Pelanggan baru" */
  newLabel?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  const exact = useMemo(() => options.find((o) => norm(o.name) === norm(value)) ?? null, [options, value]);
  const results = useMemo(() => {
    const words = norm(value).split(/\s+/).filter(Boolean);
    const list = words.length ? options.filter((o) => words.every((w) => o.name.toLowerCase().includes(w))) : options;
    return list.slice(0, 30);
  }, [options, value]);

  function pick(o: ComboOption) {
    onChange(o.name, o.id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          const m = options.find((o) => norm(o.name) === norm(v));
          onChange(v, m?.id ?? null);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[hi] && value.trim() && !exact) pick(results[hi]);
            else setOpen(false);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className={cx(inputCls, "pr-16")}
      />
      {value.trim() !== "" && (
        <span className={cx("pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] font-medium", exact ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
          {exact ? "terdaftar" : "baru"}
        </span>
      )}
      {open && results.length > 0 && !exact && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-line bg-white shadow-lg">
          {results.map((o, i) => (
            <button
              type="button"
              key={o.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setHi(i)}
              className={cx("w-full text-left px-3 py-2 text-sm flex justify-between gap-3", i === hi && "bg-brand-soft")}
            >
              <span className="truncate">{o.name}</span>
              {o.sub && <span className="text-xs text-muted truncate">{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
      {value.trim() !== "" && !exact && (
        <p className="mt-1 text-xs text-amber-700">
          {newLabel} — otomatis tersimpan saat disimpan.
        </p>
      )}
    </div>
  );
}
