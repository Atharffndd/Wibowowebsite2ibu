"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cx, inputCls } from "./ui";

export type SearchOption = { id: string; name: string };

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Pilihan yang bisa dicari: ketik sebagian nama untuk menyaring, lalu klik atau tekan Enter.
 * Pengganti dropdown biasa untuk daftar panjang (pelanggan, kategori, barang).
 * `allLabel` menambahkan baris pertama untuk "tanpa pilihan" (mis. "Semua pelanggan"), nilainya "".
 */
export function SearchSelect({
  value,
  onChange,
  options,
  allLabel,
  placeholder = "Ketik untuk mencari…",
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  options: SearchOption[];
  allLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);
  const rows = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const found = (words.length ? options.filter((o) => words.every((w) => o.name.toLowerCase().includes(w))) : options).slice(0, 60);
    return allLabel && !words.length ? [{ id: "", name: allLabel }, ...found] : found;
  }, [options, q, allLabel]);

  // tutup bila klik di luar
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // jaga baris yang disorot tetap terlihat saat navigasi keyboard
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQ("");
  }

  const shown = open ? q : selected?.name ?? "";
  return (
    <div className={cx("relative", className)} ref={box}>
      <input
        value={shown}
        placeholder={selected || !allLabel ? placeholder : allLabel}
        autoComplete="off"
        onFocus={(e) => {
          setOpen(true);
          setQ("");
          setHi(0);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHi((h) => Math.min(h + 1, rows.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && rows[hi]) pick(rows[hi].id);
          } else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
        }}
        className={cx(inputCls, "pr-9", !selected && allLabel && !open && "text-ink")}
      />
      {value && (
        <button
          type="button"
          aria-label="Hapus pilihan"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-lg leading-none px-1"
        >
          ×
        </button>
      )}
      {open && (
        <div ref={list} className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-white shadow-lg">
          {rows.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted">Tidak ada yang cocok.</div>
          ) : (
            rows.map((o, i) => (
              <button
                type="button"
                key={o.id || "__all"}
                data-i={i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.id)}
                onMouseEnter={() => setHi(i)}
                className={cx("block w-full text-left px-3 py-2 text-sm", i === hi && "bg-brand/10", o.id === value && "font-semibold", !o.id && "text-muted")}
              >
                {o.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
