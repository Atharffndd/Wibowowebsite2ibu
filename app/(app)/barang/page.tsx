"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { sb, fetchAll, errMsg } from "@/lib/supabase";
import { loadProducts, useAsync } from "@/lib/hooks";
import { exportXlsx, pick, readXlsx } from "@/lib/excel";
import { num, qty } from "@/lib/format";
import type { Category, Product, ProductUnit } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal, NumInput, PageHeader, Select, Table, Textarea } from "@/components/ui";

export default function BarangPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [edit, setEdit] = useState<Product | "new" | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, error, loading, reload } = useAsync(async () => {
    const [products, cats] = await Promise.all([
      loadProducts(true),
      fetchAll<Category>((f, t) => sb().from("categories").select("*").order("name").range(f, t)),
    ]);
    return { products, cats };
  }, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.products ?? []).filter(
      (p) =>
        (showInactive || p.active) &&
        (!cat || p.category_id === cat) &&
        (!s || p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s)),
    );
  }, [data, q, cat, showInactive]);

  async function doExport() {
    const out: Record<string, unknown>[] = [];
    for (const p of rows)
      for (const u of p.product_units ?? [])
        out.push({
          kode: p.sku,
          nama: p.name,
          kategori: p.category_name,
          satuan: u.unit,
          isi: Number(u.factor),
          satuan_dasar: p.base_unit,
          harga_eceran: Number(u.price_retail),
          harga_grosir: Number(u.price_wholesale),
          hpp: Math.round(Number(p.avg_cost) * Number(u.factor)),
          stok: Number(p.stock_total),
          stok_minimal: Number(p.min_stock),
        });
    await exportXlsx("daftar-barang", "Barang", [
      { header: "Kode", key: "kode", width: 12 },
      { header: "Nama Barang", key: "nama", width: 32 },
      { header: "Kategori", key: "kategori" },
      { header: "Satuan", key: "satuan", width: 10 },
      { header: "Isi (x satuan dasar)", key: "isi", width: 10 },
      { header: "Satuan Dasar", key: "satuan_dasar", width: 10 },
      { header: "Harga Eceran", key: "harga_eceran", numFmt: "#,##0" },
      { header: "Harga Grosir", key: "harga_grosir", numFmt: "#,##0" },
      { header: "HPP", key: "hpp", numFmt: "#,##0" },
      { header: "Stok (satuan dasar)", key: "stok" },
      { header: "Stok Minimal", key: "stok_minimal" },
    ], out);
  }

  async function doImport(file: File) {
    setImportMsg("Membaca file…");
    try {
      const raw = await readXlsx(file);
      const cats = new Map((data?.cats ?? []).map((c) => [c.name.toLowerCase(), c.id]));
      const existing = new Map((data?.products ?? []).map((p) => [p.name.toLowerCase(), p]));
      let created = 0,
        updated = 0;
      for (const r of raw) {
        const name = String(pick(r, "nama barang", "nama", "barang") ?? "").trim();
        if (!name) continue;
        const unit = String(pick(r, "satuan", "sat", "unit") ?? "pcs").trim() || "pcs";
        const factor = Number(pick(r, "isi", "isi (x satuan dasar)", "konversi") ?? 1) || 1;
        const retail = Number(pick(r, "harga eceran", "harga standar", "harga", "harga jual") ?? 0) || 0;
        const wholesale = Number(pick(r, "harga grosir") ?? retail) || 0;
        const catName = String(pick(r, "kategori") ?? "").trim();
        const sku = pick(r, "kode", "sku");
        const minStock = Number(pick(r, "stok minimal", "min stok") ?? 0) || 0;

        let catId: string | null = null;
        if (catName) {
          catId = cats.get(catName.toLowerCase()) ?? null;
          if (!catId) {
            const { data: c, error } = await sb().from("categories").insert({ name: catName }).select().single();
            if (error) throw error;
            catId = c.id;
            cats.set(catName.toLowerCase(), c.id);
          }
        }
        let p = existing.get(name.toLowerCase());
        if (!p) {
          const { data: np, error } = await sb()
            .from("products")
            .insert({ name, base_unit: factor === 1 ? unit : unit, sku: sku ? String(sku) : null, category_id: catId, min_stock: minStock })
            .select()
            .single();
          if (error) throw error;
          p = { ...(np as Product), product_units: [] };
          existing.set(name.toLowerCase(), p);
          created++;
        } else {
          const patch: Record<string, unknown> = {};
          if (catId) patch.category_id = catId;
          if (sku) patch.sku = String(sku);
          if (minStock) patch.min_stock = minStock;
          if (Object.keys(patch).length) await sb().from("products").update(patch).eq("id", p.id);
          updated++;
        }
        const { error: ue } = await sb()
          .from("product_units")
          .upsert({ product_id: p.id, unit, factor, price_retail: retail, price_wholesale: wholesale }, { onConflict: "product_id,unit" });
        if (ue) throw ue;
      }
      setImportMsg(`Import selesai: ${created} barang baru, ${updated} barang diperbarui.`);
      reload();
    } catch (e) {
      setImportMsg("Gagal import: " + errMsg(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Barang & Harga"
        subtitle="Daftar barang, satuan (dus, pcs, kg, …), harga eceran / grosir, dan HPP rata-rata."
        actions={
          <>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              Import Excel
            </Button>
            <Button variant="secondary" onClick={doExport}>
              Export Excel
            </Button>
            <Button onClick={() => setEdit("new")}>+ Barang</Button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) doImport(f);
          e.target.value = "";
        }}
      />
      {importMsg && (
        <div className="mb-3 rounded-lg bg-brand-soft text-brand-dark text-sm px-3 py-2 flex justify-between">
          <span>{importMsg}</span>
          <button onClick={() => setImportMsg(null)}>×</button>
        </div>
      )}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 items-end">
          <Field label="Cari nama / kode" className="md:col-span-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <Field label="Kategori">
            <Select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Semua</option>
              {data?.cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Tampilkan nonaktif
          </label>
        </div>
        <ErrorBox error={error} />
        {loading && !data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Belum ada barang.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Barang</th>
                <th>Satuan & harga (eceran / grosir)</th>
                <th className="text-right">HPP / sat. dasar</th>
                <th className="text-right">Stok</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const low = Number(p.min_stock) > 0 && Number(p.stock_total) <= Number(p.min_stock);
                return (
                  <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                    <td className="min-w-44">
                      <Link href={`/barang/${p.id}`} className="font-medium text-brand hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {[p.sku, p.category_name].filter(Boolean).join(" · ")}
                        {!p.active && " · nonaktif"}
                      </div>
                    </td>
                    <td>
                      {(p.product_units ?? [])
                        .slice()
                        .sort((a, b) => Number(a.factor) - Number(b.factor))
                        .map((u) => (
                          <div key={u.unit} className="whitespace-nowrap">
                            <span className="inline-block min-w-12 font-medium">{u.unit}</span>
                            {Number(u.factor) !== 1 && <span className="text-xs text-muted"> ({qty(u.factor)} {p.base_unit}) </span>}
                            <span className="tabular-nums">
                              {num(u.price_retail)} / {num(u.price_wholesale)}
                            </span>
                          </div>
                        ))}
                    </td>
                    <td className="num">{num(p.avg_cost)}</td>
                    <td className="num">
                      {qty(p.stock_total)} {p.base_unit} {low && <Badge tone="warn">menipis</Badge>}
                    </td>
                    <td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEdit(p)}>
                        Ubah
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <p className="text-xs text-muted mt-4">
          Format import Excel: kolom <b>Nama Barang</b>, <b>Satuan</b>, <b>Harga Eceran</b> (atau Harga Standar), opsional <b>Harga Grosir</b>, <b>Isi</b> (konversi ke satuan dasar), <b>Kategori</b>, <b>Kode</b>, <b>Stok Minimal</b>. Barang dengan nama sama akan diperbarui.
        </p>
      </Card>
      {edit && (
        <ProductModal
          product={edit === "new" ? null : edit}
          cats={data?.cats ?? []}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function ProductModal({ product, cats, onClose, onSaved }: { product: Product | null; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [newCat, setNewCat] = useState("");
  const [baseUnit, setBaseUnit] = useState(product?.base_unit ?? "pcs");
  const [minStock, setMinStock] = useState(Number(product?.min_stock ?? 0));
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [units, setUnits] = useState<ProductUnit[]>(
    product?.product_units?.length
      ? product.product_units.map((u) => ({ ...u, factor: Number(u.factor), price_retail: Number(u.price_retail), price_wholesale: Number(u.price_wholesale) }))
      : [{ unit: product?.base_unit ?? "pcs", factor: 1, price_retail: 0, price_wholesale: 0 }],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setU = (i: number, patch: Partial<ProductUnit>) => setUnits((us) => us.map((u, j) => (j === i ? { ...u, ...patch } : u)));

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Nama barang wajib diisi.");
    const clean = units.filter((u) => u.unit.trim());
    if (!clean.some((u) => u.unit.trim() === baseUnit.trim())) return setError(`Satuan dasar "${baseUnit}" harus ada di daftar satuan (isi = 1).`);
    if (new Set(clean.map((u) => u.unit.trim())).size !== clean.length) return setError("Nama satuan tidak boleh dobel.");
    setBusy(true);
    try {
      let catId = categoryId || null;
      if (newCat.trim()) {
        const { data, error } = await sb().from("categories").upsert({ name: newCat.trim() }, { onConflict: "name" }).select().single();
        if (error) throw error;
        catId = data.id;
      }
      const row = { name: name.trim(), sku: sku.trim() || null, category_id: catId, base_unit: baseUnit.trim(), min_stock: minStock, notes: notes || null, active, updated_at: new Date().toISOString() };
      let id = product?.id;
      if (id) {
        const { error } = await sb().from("products").update(row).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await sb().from("products").insert(row).select().single();
        if (error) throw error;
        id = data.id;
      }
      const keep = clean.map((u) => u.unit.trim());
      const removed = (product?.product_units ?? []).filter((u) => !keep.includes(u.unit));
      if (removed.length) {
        const { error } = await sb().from("product_units").delete().in("id", removed.map((u) => u.id!));
        if (error) throw error;
      }
      const { error: ue } = await sb()
        .from("product_units")
        .upsert(
          clean.map((u) => ({
            product_id: id,
            unit: u.unit.trim(),
            factor: u.unit.trim() === baseUnit.trim() ? 1 : u.factor,
            price_retail: u.price_retail,
            price_wholesale: u.price_wholesale,
          })),
          { onConflict: "product_id,unit" },
        );
      if (ue) throw ue;
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={product ? `Ubah: ${product.name}` : "Barang baru"} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Nama barang" className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Kode / SKU (opsional)">
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </Field>
          <Field label="Kategori">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Tanpa kategori —</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="…atau kategori baru">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="mis. Bumbu" />
          </Field>
          <Field label="Satuan dasar (untuk stok)" hint="Stok & HPP dihitung dalam satuan ini">
            <Input value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} />
          </Field>
          <Field label="Stok minimal (peringatan)">
            <NumInput value={minStock} onChange={setMinStock} />
          </Field>
          <Field label="Catatan" className="sm:col-span-2">
            <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">Satuan & harga jual</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm data-table">
              <thead>
                <tr>
                  <th>Satuan</th>
                  <th className="text-right">Isi ({baseUnit})</th>
                  <th className="text-right">Harga eceran</th>
                  <th className="text-right">Harga grosir</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {units.map((u, i) => {
                  const isBase = u.unit.trim() === baseUnit.trim();
                  return (
                    <tr key={i}>
                      <td>
                        <Input value={u.unit} onChange={(e) => setU(i, { unit: e.target.value })} className="py-1.5 min-w-20" placeholder="dus" />
                      </td>
                      <td>
                        <NumInput value={isBase ? 1 : u.factor} disabled={isBase} onChange={(n) => setU(i, { factor: n })} className="py-1.5 min-w-20" />
                      </td>
                      <td>
                        <NumInput value={u.price_retail} onChange={(n) => setU(i, { price_retail: n })} className="py-1.5 min-w-28" />
                      </td>
                      <td>
                        <NumInput value={u.price_wholesale} onChange={(n) => setU(i, { price_wholesale: n })} className="py-1.5 min-w-28" />
                      </td>
                      <td>
                        {!isBase && (
                          <Button variant="ghost" size="sm" onClick={() => setUnits((us) => us.filter((_, j) => j !== i))}>
                            ✕
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setUnits((us) => [...us, { unit: "", factor: 1, price_retail: 0, price_wholesale: 0 }])}>
            + Tambah satuan (mis. dus isi 24)
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Barang aktif (muncul di nota)
        </label>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
