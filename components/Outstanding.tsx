"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { sb, fetchAll } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { exportXlsx } from "@/lib/excel";
import { num, tglPendek, today } from "@/lib/format";
import { balance } from "@/lib/types";
import { PaymentModal } from "./Payments";
import { Badge, Button, Card, Empty, ErrorBox, Input, Loading, PageHeader, Stat, Table, cx } from "./ui";

type Row = { id: string; number: string; date: string; due_date: string | null; party: string; total: number; paid_amount: number; return_amount: number };

/** Daftar piutang (kind=sale) atau hutang (kind=purchase) yang belum lunas */
export function Outstanding({ kind }: { kind: "sale" | "purchase" }) {
  const isSale = kind === "sale";
  const [q, setQ] = useState("");
  const [pay, setPay] = useState<Row | null>(null);
  const [groupBy, setGroupBy] = useState(false);

  const { data, error, loading, reload } = useAsync(async () => {
    const table = isSale ? "sales" : "purchases";
    const party = isSale ? "customer_name" : "supplier_name";
    const rows = await fetchAll<Record<string, unknown>>((f, t) =>
      sb().from(table).select(`id, number, date, due_date, ${party}, total, paid_amount, return_amount`).eq("status", "aktif").order("date").range(f, t),
    );
    return rows
      .map((r) => ({ ...(r as unknown as Row), party: String(r[party] ?? "-") }))
      .filter((r) => balance(r) > 0.5);
  }, [kind]);

  const t = today();
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((r) => !s || r.party.toLowerCase().includes(s) || r.number.toLowerCase().includes(s));
  }, [data, q]);

  const total = rows.reduce((a, r) => a + balance(r), 0);
  const overdue = rows.filter((r) => r.due_date && r.due_date < t);
  const overdueTotal = overdue.reduce((a, r) => a + balance(r), 0);

  const grouped = useMemo(() => {
    const m = new Map<string, { party: string; count: number; total: number; overdue: number }>();
    for (const r of rows) {
      const g = m.get(r.party) ?? { party: r.party, count: 0, total: 0, overdue: 0 };
      g.count++;
      g.total += balance(r);
      if (r.due_date && r.due_date < t) g.overdue += balance(r);
      m.set(r.party, g);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [rows, t]);

  const daysLate = (d: string | null) => (d && d < t ? Math.round((new Date(t).getTime() - new Date(d).getTime()) / 86400000) : 0);

  return (
    <>
      <PageHeader
        title={isSale ? "Piutang Pelanggan" : "Hutang ke Supplier"}
        subtitle={isSale ? "Nota yang belum lunas. Catat pembayaran cicilan / pelunasan di sini." : "Barang masuk yang belum dibayar lunas ke supplier."}
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              exportXlsx(isSale ? "piutang" : "hutang", isSale ? "Piutang" : "Hutang", [
                { header: "No.", key: "number", width: 20 },
                { header: "Tanggal", key: "date", width: 12 },
                { header: isSale ? "Pelanggan" : "Supplier", key: "party", width: 30 },
                { header: "Jatuh tempo", key: "due_date", width: 12 },
                { header: "Total", key: "total", numFmt: "#,##0" },
                { header: "Dibayar", key: "paid_amount", numFmt: "#,##0" },
                { header: "Sisa", key: "sisa", numFmt: "#,##0" },
              ], rows.map((r) => ({ ...r, total: Number(r.total), paid_amount: Number(r.paid_amount), sisa: balance(r) })))
            }
          >
            Export Excel
          </Button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <Stat label={isSale ? "Total piutang" : "Total hutang"} value={`Rp ${num(total)}`} tone="warn" />
        <Stat label="Lewat jatuh tempo" value={`Rp ${num(overdueTotal)}`} sub={`${overdue.length} dokumen`} tone={overdue.length ? "bad" : undefined} />
        <Stat label="Jumlah dokumen" value={num(rows.length)} />
      </div>
      <Card>
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <Input placeholder="Cari nama / nomor…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={groupBy} onChange={(e) => setGroupBy(e.target.checked)} /> Kelompokkan per {isSale ? "pelanggan" : "supplier"}
          </label>
        </div>
        <ErrorBox error={error} />
        {loading && !data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Tidak ada {isSale ? "piutang" : "hutang"}. 🎉</Empty>
        ) : groupBy ? (
          <Table>
            <thead>
              <tr>
                <th>{isSale ? "Pelanggan" : "Supplier"}</th>
                <th className="text-right">Dokumen</th>
                <th className="text-right">Lewat tempo</th>
                <th className="text-right">Total sisa</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <tr key={g.party}>
                  <td>
                    <button className="text-brand hover:underline" onClick={() => (setQ(g.party), setGroupBy(false))}>
                      {g.party}
                    </button>
                  </td>
                  <td className="num">{g.count}</td>
                  <td className={cx("num", g.overdue > 0 && "text-red-600")}>{num(g.overdue)}</td>
                  <td className="num font-semibold">{num(g.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th>{isSale ? "Pelanggan" : "Supplier"}</th>
                <th>Jatuh tempo</th>
                <th className="text-right">Total</th>
                <th className="text-right">Sisa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const late = daysLate(r.due_date);
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={isSale ? `/nota/${r.id}` : `/barang-masuk/${r.id}`} className="text-brand hover:underline font-mono text-[13px]">
                        {r.number}
                      </Link>
                    </td>
                    <td>{tglPendek(r.date)}</td>
                    <td>{r.party}</td>
                    <td>
                      {r.due_date ? tglPendek(r.due_date) : "-"} {late > 0 && <Badge tone="bad">telat {late} hari</Badge>}
                    </td>
                    <td className="num">{num(r.total)}</td>
                    <td className="num font-semibold">{num(balance(r))}</td>
                    <td className="text-right">
                      <Button size="sm" onClick={() => setPay(r)}>
                        Bayar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {pay && <PaymentModal open onClose={() => setPay(null)} kind={kind} docId={pay.id} docLabel={pay.number} remaining={balance(pay)} onSaved={reload} />}
    </>
  );
}
