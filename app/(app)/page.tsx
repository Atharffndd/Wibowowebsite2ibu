"use client";

import { SearchSelect } from "@/components/SearchSelect";
import Link from "next/link";
import { useMemo, useState } from "react";
import { sb } from "@/lib/supabase";
import { loadCustomers, useAsync } from "@/lib/hooks";
import { addDays, firstOfMonth, num, qty as fq, tglPendek, today } from "@/lib/format";
import type { Sale } from "@/lib/types";
import dynamic from "next/dynamic";
// grafik (recharts) baru diunduh saat dibutuhkan, bukan saat halaman pertama dibuka
const BarChartRp = dynamic(() => import("@/components/BarChartRp").then((m) => m.BarChartRp), { ssr: false, loading: () => <div style={{ height: 260 }} /> });
import { payStatus } from "@/components/status";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Stat, Table, cx } from "@/components/ui";

type TopProd = { product_id: string; name: string; unit: string; qty: number; omzet: number; nota: number };
type Report = {
  summary: { nota: number; pelanggan: number; omzet: number; rata_rata: number; baris_item: number; jenis_barang: number; hpp: number };
  daily: { date: string; nota: number; total: number }[];
  top_qty: TopProd[];
  top_omzet: TopProd[];
  top_customers: { name: string; nota: number; omzet: number }[];
  kualitas: { baris_item: number; tanpa_harga_beli: number; harga_nol: number; nota_tanpa_pelanggan: number };
};
type Stats = { receivable: number; payable: number; overdue_count: number; low_stock: number; month_expenses: number };

function lastMonth(): [string, string] {
  const first = firstOfMonth();
  const to = addDays(first, -1);
  return [firstOfMonth(to), to];
}

export default function Dashboard() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [customerId, setCustomerId] = useState("");
  const [topBy, setTopBy] = useState<"qty" | "omzet">("qty");

  const { data: customers } = useAsync(() => loadCustomers(), []);
  const { data, error, loading } = useAsync(async () => {
    const { data, error } = await sb().rpc("dashboard_report", { p_from: from, p_to: to, p_customer: customerId || null });
    if (error) throw error;
    return data as Report;
  }, [from, to, customerId]);
  const { data: ops } = useAsync(async () => {
    const [st, recent, low] = await Promise.all([
      sb().rpc("dashboard_stats"),
      sb().from("sales").select("*").order("created_at", { ascending: false }).limit(8),
      sb().from("v_products").select("id, name, base_unit, stock_total, min_stock").eq("active", true).gt("min_stock", 0).order("stock_total").limit(50),
    ]);
    const lowRows = ((low.data ?? []) as { id: string; name: string; base_unit: string; stock_total: number; min_stock: number }[]).filter((p) => Number(p.stock_total) <= Number(p.min_stock)).slice(0, 8);
    return { stats: (st.data ?? {}) as Stats, recent: (recent.data as Sale[]) ?? [], low: lowRows };
  }, []);

  const preset = (a: string, b: string) => (setFrom(a), setTo(b));
  const chart = useMemo(() => {
    const map = new Map((data?.daily ?? []).map((d) => [d.date, Number(d.total)]));
    const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
    if (days > 0 && days <= 93) return Array.from({ length: days }, (_, i) => addDays(from, i)).map((d) => ({ label: tglPendek(d).slice(0, 5), total: map.get(d) ?? 0 }));
    return (data?.daily ?? []).map((d) => ({ label: tglPendek(d.date).slice(0, 5), total: Number(d.total) }));
  }, [data, from, to]);

  const s = data?.summary;
  const k = data?.kualitas;
  const noCostPct = k && k.baris_item > 0 ? Math.round((k.tanpa_harga_beli / k.baris_item) * 100) : 0;
  const laba = s ? Number(s.omzet) - Number(s.hpp) : 0;
  const warnings: string[] = [];
  if (k && noCostPct >= 20) warnings.push(`${noCostPct}% baris barang (${k.tanpa_harga_beli} dari ${k.baris_item}) belum punya harga beli, jadi laba kotor di bawah belum akurat. Isi harga beli lewat Barang Masuk.`);
  if (k && k.harga_nol > 0) warnings.push(`${k.harga_nol} baris barang berharga Rp 0 — cek nota terkait.`);
  if (k && k.nota_tanpa_pelanggan > 0) warnings.push(`${k.nota_tanpa_pelanggan} nota belum terhubung ke data pelanggan.`);
  const top = (topBy === "qty" ? data?.top_qty : data?.top_omzet) ?? [];
  const custName = (customers ?? []).find((c) => c.id === customerId)?.name;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Performa penjualan menurut tanggal dan pelanggan."
        actions={
          <>
            <Link href="/barang-masuk/baru">
              <Button variant="secondary">+ Barang masuk</Button>
            </Link>
            <Link href="/nota/baru">
              <Button>+ Nota baru</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Dari">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Sampai">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Pelanggan" className="col-span-2">
            <SearchSelect value={customerId} onChange={setCustomerId} options={customers ?? []} allLabel="Semua pelanggan" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="secondary" size="sm" onClick={() => preset(today(), today())}>Hari ini</Button>
          <Button variant="secondary" size="sm" onClick={() => preset(addDays(today(), -6), today())}>7 hari</Button>
          <Button variant="secondary" size="sm" onClick={() => preset(firstOfMonth(), today())}>Bulan ini</Button>
          <Button variant="secondary" size="sm" onClick={() => { const [a, b] = lastMonth(); preset(a, b); }}>Bulan lalu</Button>
        </div>
      </Card>

      <ErrorBox error={error} />
      {loading && !data ? (
        <Loading />
      ) : s ? (
        <>
          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm px-4 py-3 mb-4">
              <div className="font-semibold mb-1">Perhatikan kualitas data</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Jumlah nota" value={num(s.nota)} sub={custName ?? `${s.pelanggan} pelanggan`} />
            <Stat label="Omzet" value={`Rp ${num(s.omzet)}`} sub={`Rata-rata Rp ${num(s.rata_rata)} / nota`} />
            <Stat label="Barang terjual" value={`${num(s.jenis_barang)} jenis`} sub={`${num(s.baris_item)} baris barang`} />
            <Stat label="Laba kotor" value={`Rp ${num(laba)}`} tone={noCostPct >= 20 ? "warn" : "good"} sub={noCostPct >= 20 ? `Belum lengkap: ${noCostPct}% tanpa harga beli` : `HPP Rp ${num(s.hpp)}`} />
          </div>

          <Card title="Penjualan per hari" className="mb-4">
            {s.nota === 0 ? <Empty>Tidak ada nota pada periode ini.</Empty> : <BarChartRp data={chart} xKey="label" yKey="total" label="Penjualan" />}
          </Card>

          <div className="grid xl:grid-cols-2 gap-4 mb-4">
            <Card
              title="Top produk (per satuan)"
              actions={
                <div className="flex gap-1">
                  <Button size="sm" variant={topBy === "qty" ? "primary" : "secondary"} onClick={() => setTopBy("qty")}>Jumlah</Button>
                  <Button size="sm" variant={topBy === "omzet" ? "primary" : "secondary"} onClick={() => setTopBy("omzet")}>Omzet</Button>
                </div>
              }
            >
              {top.length === 0 ? (
                <Empty>Belum ada penjualan.</Empty>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Barang</th>
                      <th className="text-right">Jumlah</th>
                      <th className="text-right">Omzet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((p, i) => (
                      <tr key={p.product_id + p.unit}>
                        <td>{i + 1}</td>
                        <td>
                          <Link href={`/barang/${p.product_id}`} className="text-brand hover:underline">{p.name}</Link>
                          <div className="text-xs text-muted">{p.nota} nota</div>
                        </td>
                        <td className={cx("num", topBy === "qty" && "font-semibold")}>{fq(p.qty)} {p.unit}</td>
                        <td className={cx("num", topBy === "omzet" && "font-semibold")}>{num(p.omzet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
            {!customerId && (
              <Card title="Top pelanggan">
                {data.top_customers.length === 0 ? (
                  <Empty>Belum ada penjualan.</Empty>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Pelanggan</th>
                        <th className="text-right">Nota</th>
                        <th className="text-right">Omzet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_customers.map((c, i) => (
                        <tr key={c.name + i}>
                          <td>{i + 1}</td>
                          <td>{c.name}</td>
                          <td className="num">{c.nota}</td>
                          <td className="num">{num(c.omzet)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            )}
          </div>
        </>
      ) : null}

      {ops && (
        <>
          <h2 className="text-sm font-semibold text-muted mb-2 mt-6">Ringkasan operasional (saat ini)</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Piutang pelanggan" value={`Rp ${num(ops.stats.receivable)}`} sub={ops.stats.overdue_count ? `${ops.stats.overdue_count} nota lewat tempo` : "Tidak ada yang lewat tempo"} tone={ops.stats.overdue_count ? "bad" : undefined} />
            <Stat label="Hutang ke supplier" value={`Rp ${num(ops.stats.payable)}`} />
            <Stat label="Biaya operasional bulan ini" value={`Rp ${num(ops.stats.month_expenses)}`} />
            <Stat label="Barang stok menipis" value={num(ops.stats.low_stock)} tone={ops.stats.low_stock ? "warn" : undefined} />
          </div>
          <div className="grid xl:grid-cols-2 gap-4">
            <Card title="Nota terbaru" actions={<Link href="/nota" className="text-sm text-brand hover:underline">Lihat semua</Link>}>
              <Table>
                <tbody>
                  {ops.recent.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/nota/${r.id}`} className="text-brand hover:underline font-mono text-[13px]">{r.number}</Link>
                        <div className="text-xs text-muted">{tglPendek(r.date)} · {r.customer_name}</div>
                      </td>
                      <td className="num">{num(r.total)}</td>
                      <td className="text-right">{payStatus(r)}</td>
                    </tr>
                  ))}
                  {ops.recent.length === 0 && (
                    <tr>
                      <td className="text-center text-muted py-6">Belum ada nota.</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card>
            <Card title="Stok menipis" actions={<Link href="/stok" className="text-sm text-brand hover:underline">Lihat stok</Link>}>
              {ops.low.length === 0 ? (
                <div className="text-sm text-muted py-4">Semua stok aman (atur &quot;stok minimal&quot; di data barang untuk mengaktifkan peringatan).</div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Barang</th>
                      <th className="text-right">Stok</th>
                      <th className="text-right">Minimal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ops.low.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/barang/${p.id}`} className="text-brand hover:underline">{p.name}</Link>
                        </td>
                        <td className="num text-amber-700 font-medium">{num(p.stock_total)} {p.base_unit}</td>
                        <td className="num">{num(p.min_stock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
