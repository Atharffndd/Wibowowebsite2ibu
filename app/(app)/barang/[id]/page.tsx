"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { sb } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { MOVEMENT_LABEL, num, qty, tglPendek } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { Card, ErrorBox, Loading, PageHeader, Stat, Table } from "@/components/ui";

type Mv = { id: number; date: string; type: string; qty_base: number; unit_cost: number | null; unit_price: number | null; warehouse_id: string; ref_type: string | null; ref_id: string | null; notes: string | null };
type Ph = { id: number; unit: string; price_retail: number; price_wholesale: number; changed_at: string };

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { warehouses } = useApp();

  const { data, error, loading } = useAsync(async () => {
    const [p, st, mv, ph, cp] = await Promise.all([
      sb().from("v_products").select("*, product_units(*)").eq("id", id).single(),
      sb().from("v_stock").select("*").eq("product_id", id),
      sb().from("stock_movements").select("*").eq("product_id", id).eq("void", false).order("date", { ascending: false }).order("id", { ascending: false }).limit(200),
      sb().from("price_history").select("*").eq("product_id", id).order("changed_at", { ascending: false }).limit(50),
      sb().from("customer_prices").select("*, customers(name)").eq("product_id", id),
    ]);
    if (p.error) throw p.error;
    return {
      p: p.data as Product,
      stock: (st.data as { warehouse_id: string; qty: number }[]) ?? [],
      mv: (mv.data as Mv[]) ?? [],
      ph: (ph.data as Ph[]) ?? [],
      cp: (cp.data as { id: string; unit: string; price: number; customers: { name: string } }[]) ?? [],
    };
  }, [id]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "Tidak ditemukan"} />;
  const { p, stock, mv, ph, cp } = data;
  const whName = (wid: string) => warehouses.find((w) => w.id === wid)?.name ?? "-";
  const refLink = (m: Mv) =>
    m.ref_type === "sale" ? `/nota/${m.ref_id}` : m.ref_type === "purchase" ? `/barang-masuk/${m.ref_id}` : m.ref_type === "return" ? `/retur` : null;

  return (
    <>
      <Link href="/barang" className="text-sm text-brand hover:underline">
        ‹ Barang
      </Link>
      <PageHeader title={p.name} subtitle={[p.sku, p.category_name, `satuan dasar: ${p.base_unit}`].filter(Boolean).join(" · ")} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Stok total" value={`${qty(p.stock_total)} ${p.base_unit}`} tone={Number(p.min_stock) > 0 && Number(p.stock_total) <= Number(p.min_stock) ? "warn" : undefined} />
        {stock.map((s) => (
          <Stat key={s.warehouse_id} label={whName(s.warehouse_id)} value={`${qty(s.qty)} ${p.base_unit}`} />
        ))}
        <Stat label={`HPP rata-rata / ${p.base_unit}`} value={`Rp ${num(p.avg_cost)}`} sub={`Nilai stok: Rp ${num(Number(p.avg_cost) * Number(p.stock_total))}`} />
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-4 items-start">
        <Card title="Riwayat mutasi stok (barang masuk & keluar)">
          <Table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Gudang</th>
                <th className="text-right">Masuk</th>
                <th className="text-right">Keluar</th>
                <th className="text-right">Harga / {p.base_unit}</th>
              </tr>
            </thead>
            <tbody>
              {mv.map((m) => {
                const link = refLink(m);
                const q = Number(m.qty_base);
                const price = m.unit_price ?? m.unit_cost;
                return (
                  <tr key={m.id}>
                    <td>{tglPendek(m.date)}</td>
                    <td>
                      {link ? (
                        <Link href={link} className="text-brand hover:underline">
                          {MOVEMENT_LABEL[m.type] ?? m.type}
                        </Link>
                      ) : (
                        MOVEMENT_LABEL[m.type] ?? m.type
                      )}
                      {m.notes && <div className="text-xs text-muted">{m.notes}</div>}
                    </td>
                    <td>{whName(m.warehouse_id)}</td>
                    <td className="num text-emerald-700">{q > 0 ? qty(q) : ""}</td>
                    <td className="num text-red-700">{q < 0 ? qty(-q) : ""}</td>
                    <td className="num">{price != null ? num(price) : "-"}</td>
                  </tr>
                );
              })}
              {mv.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-6">
                    Belum ada mutasi.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-4">
          <Card title="Harga khusus pelanggan">
            {cp.length === 0 ? (
              <div className="text-sm text-muted">Belum ada. Atur di halaman Pelanggan.</div>
            ) : (
              <Table>
                <tbody>
                  {cp.map((c) => (
                    <tr key={c.id}>
                      <td>{c.customers?.name}</td>
                      <td>{c.unit}</td>
                      <td className="num">{num(c.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card title="Riwayat perubahan harga">
            <Table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Sat.</th>
                  <th className="text-right">Harga jual</th>
                </tr>
              </thead>
              <tbody>
                {ph.map((h) => (
                  <tr key={h.id}>
                    <td>{tglPendek(h.changed_at)}</td>
                    <td>{h.unit}</td>
                    <td className="num">{num(Number(h.price_wholesale) || Number(h.price_retail))}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
