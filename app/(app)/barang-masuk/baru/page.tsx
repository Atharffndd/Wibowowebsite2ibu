"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sb, errMsg } from "@/lib/supabase";
import { loadProducts, loadStockAll, loadSuppliers, type StockAll } from "@/lib/hooks";
import { num, rp, today } from "@/lib/format";
import type { LineItem, Product, Purchase, Supplier } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { ItemsEditor, addBack, itemsPayload, itemsSubtotal, newKey } from "@/components/ItemsEditor";
import { Button, Card, ErrorBox, Field, Input, Loading, NumInput, PageHeader, Select, Textarea } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PurchaseForm />
    </Suspense>
  );
}

function PurchaseForm() {
  const router = useRouter();
  const editId = useSearchParams().get("id");
  const { warehouses } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ready, setReady] = useState(false);
  const [number, setNumber] = useState<string | null>(null);

  const [date, setDate] = useState(today());
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [stockAll, setStockAll] = useState<StockAll>({});
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [paidNow, setPaidNow] = useState(0);
  const [method, setMethod] = useState("transfer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, s, st] = await Promise.all([loadProducts(), loadSuppliers(), loadStockAll()]);
        setProducts(p);
        setSuppliers(s);
        setStockAll(st);
        if (editId) {
          const [{ data: h, error: e1 }, { data: its, error: e2 }] = await Promise.all([
            sb().from("purchases").select("*").eq("id", editId).single(),
            sb().from("purchase_items").select("*").eq("purchase_id", editId).eq("active", true),
          ]);
          if (e1 || e2) throw e1 || e2;
          const pu = h as Purchase;
          setNumber(pu.number);
          setDate(pu.date);
          setSupplierId(pu.supplier_id ?? "");
          setSupplierName(pu.supplier_name ?? "");
          setSupplierRef(pu.supplier_ref ?? "");
          setDueDate(pu.due_date ?? "");
          setNotes(pu.notes ?? "");
          setDiscount(Number(pu.discount));
          setShipping(Number(pu.shipping));
          const rows = (its as (LineItem & { warehouse_id: string | null })[]).map((it) => ({
            key: newKey(),
            product_id: it.product_id,
            name: it.name,
            unit: it.unit,
            factor: Number(it.factor),
            qty: Number(it.qty),
            price: Number(it.price),
            warehouse_id: it.warehouse_id ?? pu.warehouse_id,
          }));
          setItems(rows);
          // tampilkan stok tanpa barang masuk ini (yang akan diganti oleh koreksi)
          setStockAll(addBack(st, rows, -1));
        }
        setReady(true);
      } catch (e) {
        setError(errMsg(e));
      }
    })();
  }, [editId]);

  // Harga beli default = HPP rata-rata saat ini x faktor satuan
  const priceFor = useCallback((p: Product, unit: string) => {
    const u = p.product_units?.find((x) => x.unit === unit);
    return Math.round(Number(p.avg_cost) * Number(u?.factor ?? 1));
  }, []);

  const subtotal = itemsSubtotal(items);
  const total = subtotal - discount + shipping;

  async function save() {
    setError(null);
    if (itemsPayload(items).length === 0) return setError("Tambahkan minimal 1 barang.");
    setBusy(true);
    const { data, error } = await sb().rpc("save_purchase", {
      p: {
        id: editId,
        date,
        supplier_id: supplierId || null,
        supplier_name: supplierName || null,
        supplier_ref: supplierRef || null,
        due_date: dueDate || null,
        notes: notes || null,
        discount,
        shipping,
        paid_now: editId ? 0 : paidNow,
        payment_method: method,
        items: itemsPayload(items),
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.push(`/barang-masuk/${data}`);
  }

  if (!ready) return error ? <ErrorBox error={error} /> : <Loading />;

  return (
    <>
      <PageHeader title={editId ? `Koreksi Barang Masuk ${number}` : "Barang Masuk Baru"} subtitle="Stok gudang bertambah & HPP rata-rata tertimbang diperbarui otomatis." />
      {editId && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Perhatian:</b> koreksi ini <b>mengganti</b> jumlah & gudang pada {number}, bukan menambah. Jika barang datang lagi, batalkan koreksi ini dan buat{" "}
          <a href="/barang-masuk/baru" className="font-semibold underline">Barang Masuk baru</a>.
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Supplier">
                <Select
                  value={supplierId}
                  onChange={(e) => {
                    setSupplierId(e.target.value);
                    setSupplierName(suppliers.find((s) => s.id === e.target.value)?.name ?? "");
                  }}
                >
                  <option value="">— Tanpa supplier / lainnya —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {!supplierId && (
                <Field label="Nama supplier (bebas)">
                  <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
                </Field>
              )}
              <Field label="No. faktur / nota supplier">
                <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} />
              </Field>
              <Field label="Tanggal">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
          </Card>
          <Card title="Barang">
            <ItemsEditor
              items={items}
              setItems={setItems}
              products={products}
              priceFor={priceFor}
              warehouses={warehouses}
              stockAll={stockAll}
              priceLabel="Harga beli"
              hint={(it) => {
                const p = products.find((x) => x.id === it.product_id);
                return p && Number(p.avg_cost) > 0 ? <span>HPP saat ini: {num(Number(p.avg_cost) * it.factor)}/{it.unit}</span> : null;
              }}
            />
          </Card>
          <Card>
            <Field label="Catatan">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </Card>
        </div>
        <div>
          <Card title="Ringkasan" className="lg:sticky lg:top-6">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="tabular-nums">{rp(subtotal)}</span>
              </div>
              <Field label="Diskon (Rp)">
                <NumInput value={discount} onChange={setDiscount} />
              </Field>
              <Field label="Ongkir / biaya lain (Rp)">
                <NumInput value={shipping} onChange={setShipping} />
              </Field>
              <div className="flex justify-between items-baseline border-t border-line pt-3">
                <span className="font-semibold">TOTAL</span>
                <span className="text-xl font-bold tabular-nums">{rp(total)}</span>
              </div>
              <Field label="Jatuh tempo (jika hutang)">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              {!editId && (
                <>
                  <Field label="Dibayar sekarang (Rp)">
                    <div className="flex gap-2">
                      <NumInput value={paidNow} onChange={setPaidNow} />
                      <Button type="button" variant="secondary" size="sm" onClick={() => setPaidNow(total)}>
                        Lunas
                      </Button>
                    </div>
                  </Field>
                  {paidNow > 0 && (
                    <Field label="Metode bayar">
                      <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="transfer">Transfer</option>
                        <option value="tunai">Tunai</option>
                        <option value="lainnya">Lainnya</option>
                      </Select>
                    </Field>
                  )}
                </>
              )}
              <ErrorBox error={error} />
              <Button className="w-full" onClick={save} disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </Button>
              <Button className="w-full" variant="secondary" onClick={() => router.back()}>
                Batal
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
