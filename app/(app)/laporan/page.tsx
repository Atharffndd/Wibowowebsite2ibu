"use client";

import { useState } from "react";
import { sb } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { exportXlsx } from "@/lib/excel";
import { addDays, firstOfMonth, num, qty, today } from "@/lib/format";
import { BarChartRp } from "@/components/BarChartRp";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Stat, Table, cx } from "@/components/ui";

type Row = { key: string; label: string; qty: number | null; revenue: number; cogs: number; profit: number; invoices: number };

const GROUPS = [
  { v: "day", l: "Per hari" },
  { v: "month", l: "Per bulan" },
  { v: "product", l: "Per barang" },
  { v: "category", l: "Per kategori" },
  { v: "customer", l: "Per pelanggan" },
  { v: "warehouse", l: "Per gudang" },
];

const PRESETS: { l: string; f: () => [string, string] }[] = [
  { l: "Hari ini", f: () => [today(), today()] },
  { l: "7 hari", f: () => [addDays(today(), -6), today()] },
  { l: "Bulan ini", f: () => [firstOfMonth(), today()] },
  {
    l: "Bulan lalu",
    f: () => {
      const end = addDays(firstOfMonth(), -1);
      return [firstOfMonth(end), end];
    },
  },
  { l: "Tahun ini", f: () => [today().slice(0, 4) + "-01-01", today()] },
];

export default function LaporanPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [group, setGroup] = useState("day");
  const [sort, setSort] = useState<"key" | "revenue" | "profit">("key");

  const { data, error, loading } = useAsync(async () => {
    const [r, exp] = await Promise.all([
      sb().rpc("report_sales", { p_from: from, p_to: to, p_group: group }),
      sb().from("expenses").select("amount, category").gte("date", from).lte("date", to),
    ]);
    if (r.error) throw r.error;
    const rows = ((r.data as Row[]) ?? []).map((x) => ({ ...x, revenue: Number(x.revenue), cogs: Number(x.cogs), profit: Number(x.profit) }));
    const expenses = ((exp.data as { amount: number }[]) ?? []).reduce((a, e) => a + Number(e.amount), 0);
    return { rows, expenses };
  }, [from, to, group]);

  const rows = [...(data?.rows ?? [])].sort((a, b) => (sort === "key" ? (group === "day" || group === "month" ? a.key.localeCompare(b.key) : b.revenue - a.revenue) : b[sort] - a[sort]));
  const tot = rows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, cogs: a.cogs + r.cogs, profit: a.profit + r.profit }), { revenue: 0, cogs: 0, profit: 0 });
  const totalInvoices = group === "day" || group === "month" || group === "customer" || group === "warehouse" ? rows.reduce((a, r) => a + Number(r.invoices), 0) : null;
  const margin = tot.revenue ? (tot.profit / tot.revenue) * 100 : 0;
  const chartRows = (group === "day" || group === "month" ? rows : rows.slice(0, 15)).map((r) => ({ label: r.label, revenue: r.revenue }));
  const groupLabel = GROUPS.find((g) => g.v === group)?.l.replace("Per ", "") ?? "";

  return (
    <>
      <PageHeader
        title="Laporan Penjualan & Pendapatan"
        subtitle="Pendapatan dikelompokkan per periode, barang, kategori, pelanggan, atau gudang. Laba = penjualan − HPP (rata-rata tertimbang)."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              exportXlsx(`laporan-${group}-${from}-${to}`, "Laporan", [
                { header: groupLabel, key: "label", width: 32 },
                ...(group === "product" ? [{ header: "Qty (sat. dasar)", key: "qty", width: 14 }] : []),
                { header: "Jml nota", key: "invoices", width: 10 },
                { header: "Penjualan", key: "revenue", numFmt: "#,##0" },
                { header: "HPP", key: "cogs", numFmt: "#,##0" },
                { header: "Laba kotor", key: "profit", numFmt: "#,##0" },
              ], rows.map((r) => ({ ...r, qty: r.qty !== null ? Number(r.qty) : null, invoices: Number(r.invoices) })))
            }
          >
            Export Excel
          </Button>
        }
      />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Dari">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Sampai">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Kelompokkan">
            <Select value={group} onChange={(e) => setGroup(e.target.value)}>
              {GROUPS.map((g) => (
                <option key={g.v} value={g.v}>
                  {g.l}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => {
              const [f, t] = p.f();
              return (
                <button key={p.l} onClick={() => (setFrom(f), setTo(t))} className={cx("px-3 py-2 rounded-lg text-sm border", from === f && to === t ? "bg-brand text-white border-brand" : "bg-white border-line hover:bg-slate-50")}>
                  {p.l}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <ErrorBox error={error} />
      {loading && !data ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <Stat label="Penjualan (setelah diskon)" value={`Rp ${num(tot.revenue)}`} sub={totalInvoices !== null ? `${totalInvoices} nota` : undefined} />
            <Stat label="HPP (modal)" value={`Rp ${num(tot.cogs)}`} />
            <Stat label="Laba kotor" value={`Rp ${num(tot.profit)}`} sub={`Margin ${margin.toFixed(1)}%`} tone="good" />
            <Stat label="Biaya operasional" value={`Rp ${num(data?.expenses ?? 0)}`} />
            <Stat label="Laba bersih" value={`Rp ${num(tot.profit - (data?.expenses ?? 0))}`} tone={tot.profit - (data?.expenses ?? 0) < 0 ? "bad" : "good"} />
          </div>

          {rows.length === 0 ? (
            <Card>
              <Empty>Belum ada penjualan pada periode ini.</Empty>
            </Card>
          ) : (
            <>
              <Card title={`Penjualan ${GROUPS.find((g) => g.v === group)?.l.toLowerCase()}${chartRows.length < rows.length ? " (15 teratas)" : ""}`} className="mb-4">
                <BarChartRp data={chartRows} xKey="label" yKey="revenue" label="Penjualan" />
              </Card>
              <Card
                title="Rincian"
                actions={
                  <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="py-1 text-xs">
                    <option value="key">Urut default</option>
                    <option value="revenue">Penjualan terbesar</option>
                    <option value="profit">Laba terbesar</option>
                  </Select>
                }
              >
                <Table>
                  <thead>
                    <tr>
                      <th>{groupLabel}</th>
                      {group === "product" && <th className="text-right">Qty</th>}
                      <th className="text-right">Nota</th>
                      <th className="text-right">Penjualan</th>
                      <th className="text-right">HPP</th>
                      <th className="text-right">Laba kotor</th>
                      <th className="text-right">Margin</th>
                      <th className="text-right">Porsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <td>{r.label}</td>
                        {group === "product" && <td className="num">{qty(r.qty)}</td>}
                        <td className="num">{r.invoices}</td>
                        <td className="num">{num(r.revenue)}</td>
                        <td className="num">{num(r.cogs)}</td>
                        <td className={cx("num font-medium", r.profit < 0 && "text-red-600")}>{num(r.profit)}</td>
                        <td className="num">{r.revenue ? ((r.profit / r.revenue) * 100).toFixed(1) : "0"}%</td>
                        <td className="num">{tot.revenue ? ((r.revenue / tot.revenue) * 100).toFixed(1) : "0"}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td>Total</td>
                      {group === "product" && <td />}
                      <td className="num">{totalInvoices ?? ""}</td>
                      <td className="num">{num(tot.revenue)}</td>
                      <td className="num">{num(tot.cogs)}</td>
                      <td className="num">{num(tot.profit)}</td>
                      <td className="num">{margin.toFixed(1)}%</td>
                      <td className="num">100%</td>
                    </tr>
                  </tfoot>
                </Table>
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}
