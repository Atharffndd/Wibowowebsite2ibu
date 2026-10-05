"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sb, errMsg } from "@/lib/supabase";
import { loadCustomers, loadProducts, loadStockAll, type StockAll } from "@/lib/hooks";
import { addDays, num, rp, tglPendek, today } from "@/lib/format";
import type { Customer, LineItem, Product, Sale, SaleItem } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { MobileSaveBar } from "@/components/MobileSaveBar";
import { ItemsEditor, addBack, itemsPayload, itemsSubtotal, newKey } from "@/components/ItemsEditor";
import { Button, Card, ErrorBox, Field, Input, Loading, NumInput, PageHeader, Select, Textarea } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <NotaForm />
    </Suspense>
  );
}

type LastPrice = { price: number; date: string };

function NotaForm() {
  const router = useRouter();
  const editId = useSearchParams().get("id");
  const { settings, warehouses } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [specialPrices, setSpecialPrices] = useState<Record<string, number>>({});
  const [lastPrices, setLastPrices] = useState<Record<string, LastPrice>>({});
  const [stockAll, setStockAll] = useState<StockAll>({});
  const [ready, setReady] = useState(false);

  const [number, setNumber] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [taxOn, setTaxOn] = useState(settings.tax_enabled);
  const [taxPercent, setTaxPercent] = useState(Number(settings.tax_percent) || 11);
  const [paidNow, setPaidNow] = useState(0);
  const [method, setMethod] = useState("transfer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const customer = customers.find((c) => c.id === customerId);

  useEffect(() => {
    (async () => {
      try {
        const [p, c, st] = await Promise.all([loadProducts(), loadCustomers(), loadStockAll()]);
        setProducts(p);
        setCustomers(c);
        setStockAll(st);
        if (editId) {
          const [{ data: s, error: e1 }, { data: its, error: e2 }] = await Promise.all([
            sb().from("sales").select("*").eq("id", editId).single(),
            sb().from("sale_items").select("*").eq("sale_id", editId).eq("active", true),
          ]);
          if (e1 || e2) throw e1 || e2;
          const sale = s as Sale;
          setNumber(sale.number);
          setDate(sale.date);
          setCustomerId(sale.customer_id ?? "");
          setCustomerName(sale.customer_name);
          setDueDate(sale.due_date ?? "");
          setNotes(sale.notes ?? "");
          setDiscount(Number(sale.discount));
          setShipping(Number(sale.shipping));
          setTaxOn(Number(sale.tax_percent) > 0);
          if (Number(sale.tax_percent) > 0) setTaxPercent(Number(sale.tax_percent));
          const rows = (its as SaleItem[]).map((it) => ({
            key: newKey(),
            product_id: it.product_id,
            name: it.name,
            unit: it.unit,
            factor: Number(it.factor),
            qty: Number(it.qty),
            price: Number(it.price),
            warehouse_id: it.warehouse_id ?? sale.warehouse_id,
          }));
          setItems(rows);
          // barang di nota ini sudah mengurangi stok; saat diubah, jumlah lamanya dianggap tersedia lagi
          setStockAll(addBack(st, rows));
        }
        setReady(true);
      } catch (e) {
        setError(errMsg(e));
      }
    })();
  }, [editId]);


  // Harga khusus & harga terakhir untuk pelanggan terpilih
  useEffect(() => {
    if (!customerId) {
      setSpecialPrices({});
      setLastPrices({});
      return;
    }
    (async () => {
      const [{ data: sp }, { data: last }] = await Promise.all([
        sb().from("customer_prices").select("product_id, unit, price").eq("customer_id", customerId),
        sb()
          .from("sale_items")
          .select("product_id, unit, price, sales!inner(date, customer_id, status)")
          .eq("active", true)
          .eq("sales.customer_id", customerId)
          .eq("sales.status", "aktif")
          .order("date", { ascending: false, referencedTable: "sales" })
          .limit(500),
      ]);
      setSpecialPrices(Object.fromEntries((sp ?? []).map((r) => [`${r.product_id}|${r.unit}`, Number(r.price)])));
      const lp: Record<string, LastPrice> = {};
      for (const r of (last ?? []) as unknown as { product_id: string; unit: string; price: number; sales: { date: string } }[]) {
        const k = `${r.product_id}|${r.unit}`;
        if (!lp[k] || lp[k].date < r.sales.date) lp[k] = { price: Number(r.price), date: r.sales.date };
      }
      setLastPrices(lp);
    })();
  }, [customerId]);

  function pickCustomer(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.name);
      setDueDate(c.term_days > 0 ? addDays(date, c.term_days) : "");
    }
  }

  const priceFor = useCallback(
    (p: Product, unit: string) => {
      const sp = specialPrices[`${p.id}|${unit}`];
      if (sp !== undefined) return sp;
      const u = p.product_units?.find((x) => x.unit === unit);
      if (!u) return 0;
      return Number(customer?.price_type === "grosir" ? u.price_wholesale || u.price_retail : u.price_retail || u.price_wholesale);
    },
    [specialPrices, customer],
  );

  const subtotal = itemsSubtotal(items);
  const tax = taxOn ? Math.round(((subtotal - discount) * taxPercent) / 100) : 0;
  const total = subtotal - discount + tax + shipping;

  const hint = useMemo(
    () => (it: LineItem) => {
      const k = `${it.product_id}|${it.unit}`;
      const lp = lastPrices[k];
      const sp = specialPrices[k];
      return (
        <>
          {sp !== undefined && <span className="text-brand">harga khusus: {num(sp)}</span>}
          {lp && (
            <button type="button" className="text-brand hover:underline" onClick={() => setItems((its) => its.map((x) => (x.key === it.key ? { ...x, price: lp.price } : x)))}>
              terakhir {num(lp.price)} ({tglPendek(lp.date)})
            </button>
          )}
        </>
      );
    },
    [lastPrices, specialPrices],
  );

  async function save() {
    setError(null);
    if (!customerName.trim()) return setError("Isi nama pelanggan.");
    if (itemsPayload(items).length === 0) return setError("Tambahkan minimal 1 barang.");
    setBusy(true);
    const { data, error } = await sb().rpc("save_sale", {
      p: {
        id: editId,
        date,
        customer_id: customerId || null,
        customer_name: customerName.trim(),
        due_date: dueDate || null,
        notes: notes || null,
        discount,
        shipping,
        tax_percent: taxOn ? taxPercent : 0,
        paid_now: editId ? 0 : paidNow,
        payment_method: method,
        items: itemsPayload(items),
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.push(`/nota/${data}?saved=1`);
  }

  if (!ready) return error ? <ErrorBox error={error} /> : <Loading />;

  return (
    <>
      <PageHeader
        title={editId ? `Ubah Nota ${number}` : "Nota Baru"}
        subtitle={editId ? "Perubahan akan memperbarui stok otomatis." : `Nomor otomatis: ${settings.invoice_prefix}/${date.slice(0, 4)}/${date.slice(5, 7)}/xxxx`}
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Pelanggan terdaftar">
                <Select value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
                  <option value="">— Pelanggan baru / umum —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.price_type === "grosir" ? "(grosir)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nama di nota (Kepada)">
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nama pelanggan" />
              </Field>
              <Field label="Tanggal">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
          </Card>
          <Card title="Barang">
            <ItemsEditor items={items} setItems={setItems} products={products} priceFor={priceFor} warehouses={warehouses} stockAll={stockAll} checkStock priceLabel="Harga jual" hint={hint} />
            {customer && (
              <p className="text-xs text-muted mt-3">
                Harga otomatis: harga khusus pelanggan → harga {customer.price_type}. Harga tetap bisa diubah manual per nota.
              </p>
            )}
          </Card>
          <Card>
            <Field label="Catatan (tampil di nota)">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Ringkasan" className="lg:sticky lg:top-6">
            <div className="space-y-3 text-sm">
              <Row label="Subtotal" value={rp(subtotal)} />
              <Field label="Diskon (Rp)">
                <NumInput value={discount} onChange={setDiscount} />
              </Field>
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
                  <input type="checkbox" checked={taxOn} onChange={(e) => setTaxOn(e.target.checked)} /> PPN / Pajak
                </label>
                {taxOn && (
                  <div className="flex items-center gap-2">
                    <NumInput value={taxPercent} onChange={setTaxPercent} className="w-24" />
                    <span>%</span>
                    <span className="ml-auto tabular-nums">{rp(tax)}</span>
                  </div>
                )}
              </div>
              <Field label="Ongkir (Rp)">
                <NumInput value={shipping} onChange={setShipping} />
              </Field>
              <div className="flex justify-between items-baseline border-t border-line pt-3">
                <span className="font-semibold">TOTAL</span>
                <span className="text-xl font-bold tabular-nums">{rp(total)}</span>
              </div>
              <Field label="Jatuh tempo (kosongkan jika tunai)">
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
                  <Row label="Sisa tagihan" value={rp(Math.max(total - paidNow, 0))} />
                </>
              )}
              <ErrorBox error={error} />
              <Button className="w-full" onClick={save} disabled={busy}>
                {busy ? "Menyimpan…" : editId ? "Simpan perubahan" : "Simpan nota"}
              </Button>
              <Button className="w-full" variant="secondary" onClick={() => router.back()}>
                Batal
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <MobileSaveBar total={total} label={editId ? "Simpan perubahan" : "Simpan nota"} busy={busy} onSave={save} error={error} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}
