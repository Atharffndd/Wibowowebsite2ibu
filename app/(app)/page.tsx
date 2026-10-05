"use client";

import Link from "next/link";
import { sb } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { num, tglPendek } from "@/lib/format";
import type { Sale } from "@/lib/types";
import { BarChartRp } from "@/components/BarChartRp";
import { payStatus } from "@/components/status";
import { Button, Card, ErrorBox, Loading, PageHeader, Stat, Table } from "@/components/ui";

type Stats = {
  today_sales: number;
  today_count: number;
  month_sales: number;
  month_profit: number;
  month_expenses: number;
  receivable: number;
  payable: number;
  overdue_count: number;
  low_stock: number;
  daily: { date: string; total: number }[];
};

export default function Dashboard() {
  const { data, error, loading } = useAsync(async () => {
    const [st, recent, low] = await Promise.all([
      sb().rpc("dashboard_stats"),
      sb().from("sales").select("*").order("created_at", { ascending: false }).limit(8),
      sb().from("v_products").select("id, name, base_unit, stock_total, min_stock").eq("active", true).gt("min_stock", 0).order("stock_total").limit(50),
    ]);
    if (st.error) throw st.error;
    const lowRows = ((low.data ?? []) as { id: string; name: string; base_unit: string; stock_total: number; min_stock: number }[]).filter((p) => Number(p.stock_total) <= Number(p.min_stock)).slice(0, 8);
    return { stats: st.data as Stats, recent: (recent.data as Sale[]) ?? [], low: lowRows };
  }, []);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const s = data.stats;
  const daily = s.daily.map((d) => ({ ...d, label: tglPendek(d.date).slice(0, 5), total: Number(d.total) }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan penjualan, laba, piutang & stok."
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Penjualan hari ini" value={`Rp ${num(s.today_sales)}`} sub={`${s.today_count} nota`} />
        <Stat label="Penjualan bulan ini" value={`Rp ${num(s.month_sales)}`} />
        <Stat label="Laba kotor bulan ini" value={`Rp ${num(s.month_profit)}`} sub={`Laba bersih (− biaya): Rp ${num(Number(s.month_profit) - Number(s.month_expenses))}`} tone="good" />
        <Stat label="Piutang pelanggan" value={`Rp ${num(s.receivable)}`} sub={s.overdue_count ? `${s.overdue_count} nota lewat tempo` : "Tidak ada yang lewat tempo"} tone={s.overdue_count ? "bad" : undefined} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Hutang ke supplier" value={`Rp ${num(s.payable)}`} />
        <Stat label="Biaya operasional bulan ini" value={`Rp ${num(s.month_expenses)}`} />
        <Stat label="Barang stok menipis" value={num(s.low_stock)} tone={s.low_stock ? "warn" : undefined} />
      </div>

      <Card title="Penjualan 30 hari terakhir" className="mb-4">
        <BarChartRp data={daily} xKey="label" yKey="total" label="Penjualan" />
      </Card>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card title="Nota terbaru" actions={<Link href="/nota" className="text-sm text-brand hover:underline">Lihat semua</Link>}>
          <Table>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/nota/${r.id}`} className="text-brand hover:underline font-mono text-[13px]">
                      {r.number}
                    </Link>
                    <div className="text-xs text-muted">
                      {tglPendek(r.date)} · {r.customer_name}
                    </div>
                  </td>
                  <td className="num">{num(r.total)}</td>
                  <td className="text-right">{payStatus(r)}</td>
                </tr>
              ))}
              {data.recent.length === 0 && (
                <tr>
                  <td className="text-center text-muted py-6">Belum ada nota.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
        <Card title="Stok menipis" actions={<Link href="/stok" className="text-sm text-brand hover:underline">Lihat stok</Link>}>
          {data.low.length === 0 ? (
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
                {data.low.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/barang/${p.id}`} className="text-brand hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="num text-amber-700 font-medium">
                      {num(p.stock_total)} {p.base_unit}
                    </td>
                    <td className="num">{num(p.min_stock)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
