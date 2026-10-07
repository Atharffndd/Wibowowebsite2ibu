"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { sb } from "@/lib/supabase";
import { loadProducts, useAsync } from "@/lib/hooks";
import { num, tglPendek } from "@/lib/format";
import { balance, type Customer, type Product, type Sale } from "@/lib/types";
import { CustomerModal } from "@/components/CustomerModal";
import { ProductSearch } from "@/components/ItemsEditor";
import { payStatus } from "@/components/status";
import { Button, Card, ErrorBox, Loading, NumInput, PageHeader, Select, Stat, Table } from "@/components/ui";

type CP = { id: string; product_id: string; unit: string; price: number; products: { name: string } };

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadProducts().then(setProducts);
  }, []);

  const { data, error, loading, reload } = useAsync(async () => {
    const [c, s, cp] = await Promise.all([
      sb().from("customers").select("*").eq("id", id).single(),
      sb().from("sales").select("*").eq("customer_id", id).order("date", { ascending: false }).limit(300),
      sb().from("customer_prices").select("*, products(name)").eq("customer_id", id).order("updated_at", { ascending: false }),
    ]);
    if (c.error) throw c.error;
    return { c: c.data as Customer, sales: (s.data as Sale[]) ?? [], cp: (cp.data as CP[]) ?? [] };
  }, [id]);

  const stats = useMemo(() => {
    const active = (data?.sales ?? []).filter((s) => s.status === "aktif");
    return {
      omzet: active.reduce((a, s) => a + Number(s.total), 0),
      piutang: active.reduce((a, s) => a + Math.max(balance(s), 0), 0),
      count: active.length,
      last: active[0]?.date,
    };
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "Tidak ditemukan"} />;
  const { c, sales, cp } = data;

  async function addSpecial(p: Product) {
    const u = p.product_units?.find((x) => x.unit === p.base_unit);
    const price = Number(u?.price_wholesale || u?.price_retail) || 0;
    const { error } = await sb().from("customer_prices").upsert({ customer_id: c.id, product_id: p.id, unit: p.base_unit, price }, { onConflict: "customer_id,product_id,unit" });
    if (error) alert(error.message);
    reload();
  }
  async function updateSpecial(row: CP, patch: Partial<CP>) {
    const { error } = await sb().from("customer_prices").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) alert(error.message);
    reload();
  }
  async function delSpecial(row: CP) {
    await sb().from("customer_prices").delete().eq("id", row.id);
    reload();
  }

  return (
    <>
      <Link href="/pelanggan" className="text-sm text-brand hover:underline">
        ‹ Pelanggan
      </Link>
      <PageHeader
        title={c.name}
        subtitle={
          <>
            {c.phone} {c.address && `· ${c.address}`} {c.term_days > 0 && `· tempo ${c.term_days} hari`}
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Ubah data
            </Button>
            <Link href="/nota/baru">
              <Button>+ Nota</Button>
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Total belanja" value={`Rp ${num(stats.omzet)}`} />
        <Stat label="Piutang" value={`Rp ${num(stats.piutang)}`} tone={stats.piutang > 0 ? "warn" : undefined} />
        <Stat label="Jumlah nota" value={num(stats.count)} />
        <Stat label="Transaksi terakhir" value={stats.last ? tglPendek(stats.last) : "-"} />
      </div>
      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <Card title="Riwayat nota">
          <Table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th className="text-right">Total</th>
                <th className="text-right">Sisa</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/nota/${s.id}`} className="text-brand hover:underline font-mono text-[13px]">
                      {s.number}
                    </Link>
                  </td>
                  <td>{tglPendek(s.date)}</td>
                  <td className="num">{num(s.total)}</td>
                  <td className="num">{s.status === "aktif" ? num(Math.max(balance(s), 0)) : "-"}</td>
                  <td>{payStatus(s)}</td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-6">
                    Belum ada nota.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
        <Card title="Harga khusus pelanggan ini">
          <p className="text-xs text-muted mb-3">Harga ini otomatis dipakai saat membuat nota untuk pelanggan ini (tetap bisa diubah per nota).</p>
          <ProductSearch products={products} onPick={addSpecial} placeholder="Tambah barang dengan harga khusus…" />
          {cp.length > 0 && (
            <Table className="mt-3">
              <thead>
                <tr>
                  <th>Barang</th>
                  <th>Satuan</th>
                  <th className="text-right">Harga</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cp.map((r) => {
                  const p = products.find((x) => x.id === r.product_id);
                  return (
                    <tr key={r.id}>
                      <td>{r.products?.name}</td>
                      <td>
                        <Select value={r.unit} onChange={(e) => updateSpecial(r, { unit: e.target.value })} className="py-1">
                          {(p?.product_units ?? [{ unit: r.unit }]).map((u) => (
                            <option key={u.unit}>{u.unit}</option>
                          ))}
                        </Select>
                      </td>
                      <td>
                        <SpecialPrice value={Number(r.price)} onCommit={(n) => updateSpecial(r, { price: n })} />
                      </td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => delSpecial(r)}>
                          ✕
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
      {editOpen && <CustomerModal customer={c} onClose={() => setEditOpen(false)} onSaved={() => (setEditOpen(false), reload())} />}
    </>
  );
}

function SpecialPrice({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [v, setV] = useState(value);
  return <NumInput value={v} onChange={setV} onBlur={() => v !== value && onCommit(v)} className="py-1 min-w-28" />;
}
