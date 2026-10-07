"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sb, errMsg } from "@/lib/supabase";
import { loadCustomers, loadProducts, loadStockAll, loadSuppliers, useAsync, type StockAll } from "@/lib/hooks";
import { num, rp, tglPendek, today } from "@/lib/format";
import type { LineItem, Product } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { NameCombo, type ComboOption } from "@/components/NameCombo";
import { ItemsEditor, itemsPayload, itemsSubtotal, newKey } from "@/components/ItemsEditor";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal, PageHeader, Select, Table } from "@/components/ui";

type Ret = { id: string; number: string; kind: "sale" | "purchase"; date: string; party_name: string | null; total: number; sale_id: string | null; purchase_id: string | null; notes: string | null; sales: { number: string } | null; purchases: { number: string } | null };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <ReturPage />
    </Suspense>
  );
}

function ReturPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const saleId = sp.get("sale");
  const purchaseId = sp.get("purchase");
  const [open, setOpen] = useState(Boolean(saleId || purchaseId));

  const { data, error, loading, reload } = useAsync(async () => {
    const { data, error } = await sb().from("returns").select("*, sales(number), purchases(number)").eq("status", "aktif").order("date", { ascending: false }).limit(300);
    if (error) throw error;
    return data as Ret[];
  }, []);

  async function del(r: Ret) {
    if (!confirm(`Batalkan retur ${r.number}? Stok dan saldo akan dikembalikan.`)) return;
    const { error } = await sb().rpc("void_return", { p_id: r.id });
    if (error) alert(error.message);
    reload();
  }

  return (
    <>
      <PageHeader title="Retur" subtitle="Retur penjualan (barang kembali dari pelanggan) dan retur pembelian (barang dikembalikan ke supplier)." actions={<Button onClick={() => setOpen(true)}>+ Retur</Button>} />
      <Card>
        <ErrorBox error={error} />
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <Empty>Belum ada retur.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Pihak</th>
                <th>Dokumen asal</th>
                <th className="text-right">Nilai</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-[13px]">{r.number}</td>
                  <td>{tglPendek(r.date)}</td>
                  <td>{r.kind === "sale" ? <Badge tone="info">Retur penjualan</Badge> : <Badge>Retur pembelian</Badge>}</td>
                  <td>
                    {r.party_name}
                    {r.notes && <div className="text-xs text-muted">{r.notes}</div>}
                  </td>
                  <td>
                    {r.sale_id && (
                      <Link href={`/nota/${r.sale_id}`} className="text-brand hover:underline">
                        {r.sales?.number}
                      </Link>
                    )}
                    {r.purchase_id && (
                      <Link href={`/barang-masuk/${r.purchase_id}`} className="text-brand hover:underline">
                        {r.purchases?.number}
                      </Link>
                    )}
                  </td>
                  <td className="num">{num(r.total)}</td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => del(r)}>
                      Batalkan
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {open && (
        <ReturnModal
          saleId={saleId}
          purchaseId={purchaseId}
          onClose={() => {
            setOpen(false);
            if (saleId || purchaseId) router.replace("/retur");
          }}
          onSaved={() => {
            setOpen(false);
            if (saleId || purchaseId) router.replace("/retur");
            reload();
          }}
        />
      )}
    </>
  );
}

function ReturnModal({ saleId, purchaseId, onClose, onSaved }: { saleId: string | null; purchaseId: string | null; onClose: () => void; onSaved: () => void }) {
  const { warehouses } = useApp();
  const [kind, setKind] = useState<"sale" | "purchase">(purchaseId ? "purchase" : "sale");
  const [party, setParty] = useState("");
  const [docLabel, setDocLabel] = useState<string | null>(null);
  const [stockAll, setStockAll] = useState<StockAll>({});
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [maxQty, setMaxQty] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<ComboOption[]>([]);
  const [suppliers, setSuppliers] = useState<ComboOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadProducts().then(setProducts);
    loadStockAll().then(setStockAll);
    if (!saleId && !purchaseId) {
      loadCustomers().then((c) => setCustomers(c.map((x) => ({ id: x.id, name: x.name }))));
      loadSuppliers().then((s) => setSuppliers(s.map((x) => ({ id: x.id, name: x.name }))));
    }
    (async () => {
      if (saleId) {
        const [{ data: s }, { data: its }] = await Promise.all([sb().from("sales").select("*").eq("id", saleId).single(), sb().from("sale_items").select("*").eq("sale_id", saleId).eq("active", true)]);
        if (s) {
          setParty(s.customer_name);
          setDocLabel(s.number);
        }
        setItemsFromDoc(its ?? [], s?.warehouse_id);
      } else if (purchaseId) {
        const [{ data: p }, { data: its }] = await Promise.all([sb().from("purchases").select("*").eq("id", purchaseId).single(), sb().from("purchase_items").select("*").eq("purchase_id", purchaseId).eq("active", true)]);
        if (p) {
          setParty(p.supplier_name ?? "");
          setDocLabel(p.number);
        }
        setItemsFromDoc(its ?? [], p?.warehouse_id);
      }
    })();
    function setItemsFromDoc(its: { product_id: string; name: string; unit: string; factor: number; qty: number; price: number; warehouse_id: string | null }[], docWh?: string) {
      const rows = its.map((it) => ({
        key: newKey(),
        product_id: it.product_id,
        name: it.name,
        unit: it.unit,
        factor: Number(it.factor),
        qty: 0,
        price: Number(it.price),
        warehouse_id: it.warehouse_id ?? docWh ?? warehouses[0]?.id ?? "",
      }));
      setItems(rows);
      setMaxQty(Object.fromEntries(rows.map((r, i) => [r.key, Number(its[i].qty)])));
    }
  }, [saleId, purchaseId, warehouses]);

  const fromDoc = Boolean(saleId || purchaseId);
  const total = itemsSubtotal(items);

  async function save() {
    setError(null);
    const payload = itemsPayload(items);
    if (!payload.length) return setError("Isi jumlah barang yang diretur.");
    for (const it of items) if (maxQty[it.key] !== undefined && it.qty > maxQty[it.key]) return setError(`Jumlah retur ${it.name} melebihi jumlah di dokumen (${maxQty[it.key]}).`);
    setBusy(true);
    try {
      // retur tanpa dokumen: pelanggan/supplier & barang baru otomatis tersimpan
      const { error } = await sb().rpc(fromDoc ? "save_return" : "save_return_ex", {
        p: { kind, date, sale_id: saleId, purchase_id: purchaseId, party_name: party.trim() || null, notes: notes || null, items: payload },
      });
      if (error) throw error;
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={docLabel ? `Retur dari ${docLabel}` : "Retur baru"} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Jenis">
            <Select value={kind} onChange={(e) => setKind(e.target.value as "sale" | "purchase")} disabled={fromDoc}>
              <option value="sale">Retur penjualan (stok masuk)</option>
              <option value="purchase">Retur pembelian (stok keluar)</option>
            </Select>
          </Field>
          <Field label={kind === "sale" ? "Pelanggan" : "Supplier"}>
            {fromDoc ? (
              <Input value={party} onChange={(e) => setParty(e.target.value)} />
            ) : (
              <NameCombo
                value={party}
                options={kind === "sale" ? customers : suppliers}
                onChange={(name) => setParty(name)}
                placeholder={kind === "sale" ? "Ketik nama pelanggan…" : "Ketik nama supplier…"}
                newLabel={kind === "sale" ? "Pelanggan baru" : "Supplier baru"}
              />
            )}
          </Field>
          <Field label="Tanggal">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {fromDoc ? (
          <table className="w-full text-sm data-table">
            <thead>
              <tr>
                <th>Barang</th>
                <th className="w-40">Gudang</th>
                <th className="text-right">Di dokumen</th>
                <th className="text-right w-32">Jumlah retur</th>
                <th className="text-right">Harga</th>
                <th className="text-right">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key}>
                  <td>{it.name}</td>
                  <td>
                    <Select
                      value={it.warehouse_id}
                      onChange={(e) => setItems((its) => its.map((x) => (x.key === it.key ? { ...x, warehouse_id: e.target.value } : x)))}
                      className="py-1"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="num">
                    {maxQty[it.key]} {it.unit}
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      max={maxQty[it.key]}
                      value={it.qty || ""}
                      onChange={(e) => setItems((its) => its.map((x) => (x.key === it.key ? { ...x, qty: Number(e.target.value) || 0 } : x)))}
                      className="w-full rounded border border-line px-2 py-1 text-right"
                    />
                  </td>
                  <td className="num">{num(it.price)}</td>
                  <td className="num">{num(it.qty * it.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ItemsEditor items={items} setItems={setItems} products={products} priceFor={(p, unit) => Number(p.product_units?.find((u) => u.unit === unit)?.price_retail ?? 0)} warehouses={warehouses} stockAll={stockAll} checkStock={kind === "purchase"} priceLabel="Nilai / unit" allowNew />
        )}
        <Field label="Alasan / catatan">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="mis. barang rusak" />
        </Field>
        <div className="flex justify-between items-center">
          <div className="text-sm">
            Nilai retur: <b>{rp(total)}</b>
            {fromDoc && <span className="text-muted"> — akan mengurangi {kind === "sale" ? "piutang nota" : "hutang ke supplier"}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button onClick={save} disabled={busy}>
              Simpan retur
            </Button>
          </div>
        </div>
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}
