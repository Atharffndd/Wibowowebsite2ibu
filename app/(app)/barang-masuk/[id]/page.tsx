"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { num, qty, rp, tanggal } from "@/lib/format";
import { balance, type Purchase, type SaleItem } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { PaymentList, PaymentModal, type Payment } from "@/components/Payments";
import { payStatus } from "@/components/status";
import { Button, Card, ErrorBox, Loading, Table } from "@/components/ui";

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { warehouses } = useApp();
  const [payOpen, setPayOpen] = useState(false);

  const { data, error, loading, reload } = useAsync(async () => {
    const [h, it, pay] = await Promise.all([
      sb().from("purchases").select("*").eq("id", id).single(),
      sb().from("purchase_items").select("*").eq("purchase_id", id).eq("active", true),
      sb().from("payments").select("*").eq("purchase_id", id).order("date"),
    ]);
    if (h.error) throw h.error;
    return { p: h.data as Purchase, items: (it.data as SaleItem[]) ?? [], payments: (pay.data as Payment[]) ?? [] };
  }, [id]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "Tidak ditemukan"} />;
  const { p, items, payments } = data;
  const remaining = balance(p);
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "-";

  async function cancel() {
    if (!confirm(`Batalkan ${p.number}? Stok yang masuk akan dikurangi kembali.`)) return;
    const { error } = await sb().rpc("cancel_document", { p_kind: "purchase", p_id: p.id });
    if (error) alert(error.message);
    else reload();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Link href="/barang-masuk" className="text-sm text-brand hover:underline">
            ‹ Barang masuk
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-xl font-bold font-mono">{p.number}</h1>
            {payStatus(p)}
          </div>
        </div>
        {p.status === "aktif" && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push(`/barang-masuk/baru`)}>+ Barang masuk baru</Button>
            <Button
              variant="secondary"
              onClick={() => router.push(`/barang-masuk/baru?id=${p.id}`)}
              title="Hanya untuk membetulkan salah input. Barang yang datang lagi dicatat sebagai Barang masuk baru."
            >
              Koreksi data
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/retur?purchase=${p.id}`)}>
              Retur ke supplier
            </Button>
            <Button variant="danger" onClick={cancel}>
              Batalkan
            </Button>
          </div>
        )}
      </div>
      <div className="grid xl:grid-cols-[1fr_320px] gap-4 items-start">
        <Card>
          <div className="grid sm:grid-cols-4 gap-3 text-sm mb-4">
            <Info label="Tanggal" value={tanggal(p.date)} />
            <Info label="Supplier" value={p.supplier_name || "-"} />
            <Info label="No. faktur supplier" value={p.supplier_ref || "-"} />
            <Info label="Gudang" value={[...new Set(items.map((it) => it.warehouse_id ?? p.warehouse_id))].map(whName).join(", ") || "-"} />
          </div>
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>Barang</th>
                <th>Gudang</th>
                <th className="text-right">Jumlah</th>
                <th>Satuan</th>
                <th className="text-right">Harga beli</th>
                <th className="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td>{i + 1}</td>
                  <td>{it.name}</td>
                  <td>{whName(it.warehouse_id ?? p.warehouse_id)}</td>
                  <td className="num">{qty(it.qty)}</td>
                  <td>{it.unit}</td>
                  <td className="num">{num(it.price)}</td>
                  <td className="num">{num(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-medium">
              {Number(p.discount) > 0 && (
                <tr>
                  <td colSpan={6} className="text-right">Diskon</td>
                  <td className="num">-{num(p.discount)}</td>
                </tr>
              )}
              {Number(p.shipping) > 0 && (
                <tr>
                  <td colSpan={6} className="text-right">Ongkir</td>
                  <td className="num">{num(p.shipping)}</td>
                </tr>
              )}
              <tr className="font-bold">
                <td colSpan={6} className="text-right">TOTAL</td>
                <td className="num">{num(p.total)}</td>
              </tr>
            </tfoot>
          </Table>
          {p.notes && <p className="text-sm mt-3">Catatan: {p.notes}</p>}
        </Card>
        <Card title="Pembayaran ke supplier" actions={p.status === "aktif" && remaining > 0 && <Button size="sm" onClick={() => setPayOpen(true)}>+ Bayar</Button>}>
          <div className="text-sm space-y-1 mb-3">
            <Row label="Total" value={rp(p.total)} />
            {Number(p.return_amount) > 0 && <Row label="Retur" value={"-" + rp(p.return_amount)} />}
            <Row label="Dibayar" value={rp(p.paid_amount)} />
            <Row label="Sisa hutang" value={rp(Math.max(remaining, 0))} />
            {p.due_date && <Row label="Jatuh tempo" value={tanggal(p.due_date)} />}
          </div>
          <PaymentList payments={payments} onDeleted={reload} />
        </Card>
      </div>
      {payOpen && <PaymentModal open onClose={() => setPayOpen(false)} kind="purchase" docId={p.id} docLabel={p.number} remaining={remaining} onSaved={reload} />}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
