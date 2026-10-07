"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LineItem, Product, Warehouse } from "@/lib/types";
import type { StockAll } from "@/lib/hooks";
import { num, qty as fq, rp } from "@/lib/format";
import { Button, Input, NumInput, Select, cx } from "./ui";

type PriceFn = (p: Product, unit: string) => Promise<number> | number;

export function newKey() {
  return Math.random().toString(36).slice(2);
}

/** Pencarian barang dengan keyboard (ketik nama / kode, Enter untuk pilih) */
export function ProductSearch({
  products,
  onPick,
  onNew,
  inputRef,
  placeholder = "Cari & tambah barang… (ketik nama / kode)",
}: {
  products: Product[];
  onPick: (p: Product) => void;
  /** jika diisi: nama yang belum ada di daftar bisa ditambahkan sebagai barang baru */
  onNew?: (name: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products.slice(0, 30);
    const words = s.split(/\s+/);
    return products.filter((p) => words.every((w) => p.name.toLowerCase().includes(w) || (p.sku ?? "").toLowerCase().includes(w))).slice(0, 30);
  }, [q, products]);

  const typed = q.trim();
  const canNew = !!onNew && typed !== "" && !products.some((p) => p.name.trim().toLowerCase() === typed.toLowerCase());
  const total = results.length + (canNew ? 1 : 0);

  function pick(p: Product) {
    onPick(p);
    setQ("");
    setHi(0);
    setOpen(false);
    if (!inputRef) ref.current?.focus(); // di ItemsEditor kursor pindah ke kolom Jumlah
  }
  function pickNew() {
    onNew?.(typed.replace(/\s+/g, " "));
    setQ("");
    setHi(0);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        value={q}
        placeholder={placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        // daftar dibuka saat diketuk / diketik, bukan saat kursor dikembalikan otomatis setelah isi harga
        onClick={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            setOpen(true);
            e.preventDefault();
            setHi((h) => Math.min(h + 1, total - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[hi]) pick(results[hi]);
            else if (canNew) pickNew();
          }
        }}
        className="w-full rounded-lg border border-brand/40 bg-brand-soft/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
      />
      {open && total > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-line bg-white shadow-lg">
          {results.map((p, i) => (
            <button
              type="button"
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setHi(i)}
              className={cx("w-full text-left px-3 py-2 text-sm flex justify-between gap-3", i === hi && "bg-brand-soft")}
            >
              <span>
                {p.name} {p.sku && <span className="text-muted text-xs">· {p.sku}</span>}
              </span>
              <span className="text-xs text-muted whitespace-nowrap">
                stok {fq(p.stock_total)} {p.base_unit}
              </span>
            </button>
          ))}
          {canNew && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pickNew();
              }}
              onMouseEnter={() => setHi(results.length)}
              className={cx("w-full text-left px-3 py-2.5 text-sm border-t border-line text-amber-800", hi === results.length && "bg-amber-50")}
            >
              ＋ Tambah barang baru: <b>“{typed}”</b>
              <span className="block text-xs text-muted">Otomatis masuk daftar barang saat disimpan</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ItemsEditor({
  items,
  setItems,
  products,
  priceFor,
  warehouses,
  stockAll,
  checkStock = false,
  priceLabel = "Harga",
  hint,
  allowNew = false,
  showPrice = true,
  showWarehouse = true,
}: {
  items: LineItem[];
  setItems: (f: (items: LineItem[]) => LineItem[]) => void;
  products: Product[];
  priceFor: PriceFn;
  /** Daftar gudang; barang baru otomatis memakai gudang pertama (Gudang 1-P) */
  warehouses: Warehouse[];
  /** stockAll[productId][warehouseId] dalam satuan dasar */
  stockAll?: StockAll;
  /** true = barang keluar (nota, retur pembelian): tandai kuning jika stok gudang kurang (Wibowo: tetap boleh disimpan, stok jadi minus) */
  checkStock?: boolean;
  priceLabel?: string;
  hint?: (it: LineItem) => React.ReactNode;
  /** true = barang yang belum ada di daftar bisa diketik (tersimpan otomatis saat dokumen disimpan) */
  allowNew?: boolean;
  /** false = tanpa harga & subtotal (Surat Jalan) */
  showPrice?: boolean;
  /** false = tanpa pilihan gudang (Surat Jalan) */
  showWarehouse?: boolean;
}) {
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const defaultWh = warehouses[0]?.id ?? "";

  // Total kebutuhan per barang per gudang (baris ganda dijumlahkan)
  const needBy = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[`${it.product_id}|${it.warehouse_id}`] = (m[`${it.product_id}|${it.warehouse_id}`] ?? 0) + it.qty * it.factor;
    return m;
  }, [items]);

  // Setelah memilih barang: kursor langsung ke Jumlah → Enter ke Harga → Enter kembali ke pencarian
  const searchRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  useEffect(() => {
    if (!focusKey) return;
    const el = boxRef.current?.querySelector<HTMLInputElement>(`[data-qty="${focusKey}"]`);
    if (el) {
      el.focus();
      el.select();
      el.closest("[data-row]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setFocusKey(null);
    }
  }, [focusKey, items]);

  const focusField = (attr: "qty" | "price" | "unit", key: string) => {
    const el = boxRef.current?.querySelector<HTMLInputElement>(`[data-${attr}="${key}"]`);
    el?.focus();
    el?.select?.();
  };
  const next = (from: "qty" | "unit" | "price", it: LineItem) => {
    const isNew = !it.product_id;
    if (from === "qty" && isNew) return focusField("unit", it.key);
    if ((from === "qty" || from === "unit") && showPrice) return focusField("price", it.key);
    searchRef.current?.focus();
  };
  const onEnter = (from: "qty" | "unit" | "price", it: LineItem) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      next(from, it);
    }
  };

  async function add(p: Product) {
    const unit = p.base_unit;
    const u = p.product_units?.find((x) => x.unit === unit);
    const price = showPrice ? await priceFor(p, unit) : 0;
    const key = newKey();
    setItems((its) => [...its, { key, product_id: p.id, name: p.name, unit, factor: Number(u?.factor ?? 1), qty: 1, price, warehouse_id: defaultWh }]);
    setFocusKey(key);
  }

  function addNew(name: string) {
    const key = newKey();
    setItems((its) => [...its, { key, product_id: "", name, unit: "pcs", factor: 1, qty: 1, price: 0, warehouse_id: defaultWh }]);
    setFocusKey(key);
  }

  const unitOptions = useMemo(() => Array.from(new Set(products.flatMap((p) => (p.product_units ?? []).map((u) => u.unit.toLowerCase())))).sort(), [products]);

  async function changeUnit(it: LineItem, unit: string) {
    const p = byId[it.product_id];
    const u = p?.product_units?.find((x) => x.unit === unit);
    const price = p ? await priceFor(p, unit) : it.price;
    setItems((its) => its.map((x) => (x.key === it.key ? { ...x, unit, factor: Number(u?.factor ?? 1), price } : x)));
  }

  const update = (key: string, patch: Partial<LineItem>) => setItems((its) => its.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const whCode = (id: string) => warehouses.find((w) => w.id === id)?.code ?? "?";

  return (
    <div className="space-y-3" ref={boxRef}>
      <ProductSearch products={products} onPick={add} onNew={allowNew ? addNew : undefined} inputRef={searchRef} placeholder={allowNew ? "Cari / ketik nama barang… (barang baru boleh)" : undefined} />
      <datalist id="unit-options">
        {unitOptions.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it, i) => {
            const p = byId[it.product_id];
            const units = p?.product_units?.length ? p.product_units : [{ unit: it.unit, factor: it.factor }];
            const st = stockAll?.[it.product_id] ?? {};
            const avail = st[it.warehouse_id] ?? 0;
            const need = needBy[`${it.product_id}|${it.warehouse_id}`] ?? 0;
            const isNew = !it.product_id;
            const short = !isNew && checkStock && stockAll !== undefined && need > avail;
            return (
              <div key={it.key} data-row className={cx("rounded-lg border bg-white p-3", short ? "border-amber-300" : isNew ? "border-brand/40" : "border-line")}>
                {/* Baris 1: nomor, nama barang, info stok, hapus */}
                <div className="flex items-start gap-2">
                  <span className="mt-1 w-6 shrink-0 text-sm text-muted tabular-nums">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <input
                      value={it.name}
                      onChange={(e) => update(it.key, { name: e.target.value })}
                      aria-label="Nama barang"
                      className="w-full bg-transparent text-sm font-medium border-b border-transparent focus:border-brand focus:outline-none"
                    />
                    <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {isNew && <span className="rounded bg-amber-50 px-1.5 text-amber-800 font-medium">barang baru — otomatis masuk daftar barang saat disimpan</span>}
                      {!isNew && stockAll !== undefined && (
                        <span>
                          stok:{" "}
                          {warehouses.map((w, j) => (
                            <span key={w.id} className={cx(w.id === it.warehouse_id && "font-semibold text-ink", w.id === it.warehouse_id && short && "text-amber-600")}>
                              {j > 0 && " · "}
                              {w.code} {fq(st[w.id] ?? 0)}
                            </span>
                          ))}{" "}
                          {p?.base_unit}
                        </span>
                      )}
                      {short && <span className="text-amber-600 font-medium">stok {whCode(it.warehouse_id)} kurang {fq(need - avail)} — tetap bisa disimpan (stok jadi minus)</span>}
                      {it.factor !== 1 && (
                        <span>
                          = {fq(it.qty * it.factor)} {p?.base_unit}
                        </span>
                      )}
                      {hint?.(it)}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0 text-red-600" onClick={() => setItems((its) => its.filter((x) => x.key !== it.key))} aria-label="Hapus barang">
                    ✕
                  </Button>
                </div>
                {/* Baris 2: isian — 2 kolom di layar sempit, 5 kolom di layar lebar */}
                <div
                  className={cx(
                    "mt-2 grid grid-cols-2 gap-2 sm:pl-8",
                    showPrice && showWarehouse && "sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]",
                    showPrice && !showWarehouse && "sm:grid-cols-[minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]",
                    !showPrice && "sm:max-w-md",
                  )}
                >
                  {showWarehouse && (
                  <label className="block">
                    <span className="block text-[11px] font-medium text-muted mb-0.5">Gudang</span>
                    <Select value={it.warehouse_id} onChange={(e) => update(it.key, { warehouse_id: e.target.value })} className={cx("py-1.5", short && "border-amber-400")}>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code}
                        </option>
                      ))}
                    </Select>
                  </label>
                  )}
                  <label className="block">
                    <span className="block text-[11px] font-medium text-muted mb-0.5">Jumlah</span>
                    <NumInput value={it.qty} onChange={(n) => update(it.key, { qty: n })} className="py-1.5" data-qty={it.key} enterKeyHint="next" onKeyDown={onEnter("qty", it)} />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-medium text-muted mb-0.5">Satuan</span>
                    {isNew ? (
                      <Input
                        value={it.unit}
                        list="unit-options"
                        onChange={(e) => update(it.key, { unit: e.target.value })}
                        className="py-1.5"
                        data-unit={it.key}
                        enterKeyHint="next"
                        onKeyDown={onEnter("unit", it)}
                        autoCapitalize="none"
                      />
                    ) : (
                      <Select value={it.unit} onChange={(e) => changeUnit(it, e.target.value)} className="py-1.5">
                        {units.map((u) => (
                          <option key={u.unit} value={u.unit}>
                            {u.unit}
                          </option>
                        ))}
                      </Select>
                    )}
                  </label>
                  {showPrice && (
                    <>
                      <label className="block">
                        <span className="block text-[11px] font-medium text-muted mb-0.5">{priceLabel}</span>
                        <NumInput value={it.price} onChange={(n) => update(it.key, { price: n })} className="py-1.5" data-price={it.key} enterKeyHint="done" onKeyDown={onEnter("price", it)} />
                      </label>
                      <div className="col-span-2 sm:col-span-1 flex sm:block items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 sm:bg-transparent sm:p-0">
                        <span className="block text-[11px] font-medium text-muted sm:mb-0.5">Subtotal</span>
                        <span className="block text-right font-semibold tabular-nums sm:py-2">{num(it.qty * it.price)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {items.length === 0 && <div className="text-sm text-muted text-center py-6 border border-dashed border-line rounded-lg">Belum ada barang. Cari barang di atas untuk menambahkan.</div>}
      {items.length > 0 && showWarehouse && warehouses.length > 1 && (
        <p className="text-xs text-muted">Gudang default {warehouses[0]?.name}. Untuk mengambil satu barang dari dua gudang, tambahkan barang yang sama sekali lagi dan pilih gudang lainnya.</p>
      )}
    </div>
  );
}

/** Stok + barang dari dokumen yang sedang diubah (supaya saat koreksi, jumlah lama dianggap tersedia) */
export function addBack(stockAll: StockAll, items: { product_id: string; warehouse_id: string; qty: number; factor: number }[], sign: 1 | -1 = 1): StockAll {
  const out: StockAll = Object.fromEntries(Object.entries(stockAll).map(([k, v]) => [k, { ...v }]));
  for (const it of items) {
    out[it.product_id] ??= {};
    out[it.product_id][it.warehouse_id] = (out[it.product_id][it.warehouse_id] ?? 0) + sign * it.qty * it.factor;
  }
  return out;
}

export const itemsSubtotal = (items: LineItem[]) => items.reduce((s, it) => s + Math.round(it.qty * it.price * 100) / 100, 0);
export const itemsPayload = (items: LineItem[]) =>
  items
    .filter((it) => it.qty > 0)
    .map(({ product_id, name, qty, unit, factor, price, warehouse_id }) => ({ product_id, name, qty, unit, factor, price, warehouse_id }));
export { rp };
