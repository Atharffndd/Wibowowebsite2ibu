"use client";

import Link from "next/link";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { addDays, num, tglPendek, today } from "@/lib/format";
import { balance, type Sale } from "@/lib/types";
import { payStatus } from "@/components/status";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Table } from "@/components/ui";

const PAGE = 50;

export default function NotaList() {
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("aktif");
  const [page, setPage] = useState(0);

  const { data, error, loading } = useAsync(async () => {
    let query = sb()
      .from("sales")
      .select("*", { count: "exact" })
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .order("number", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (status) query = query.eq("status", status);
    if (q.trim()) query = query.or(`number.ilike.%${q.trim()}%,customer_name.ilike.%${q.trim()}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    return { rows: (data as Sale[]) ?? [], count: count ?? 0 };
  }, [from, to, q, status, page]);

  const rows = data?.rows ?? [];
  const total = rows.reduce((s, r) => s + Number(r.total), 0);

  return (
    <>
      <PageHeader
        title="Nota Penjualan"
        subtitle="Daftar semua nota. Nomor nota bertambah otomatis setiap nota baru disimpan."
        actions={
          <Link href="/nota/baru">
            <Button>+ Nota baru</Button>
          </Link>
        }
      />
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Field label="Dari">
            <Input type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(0))} />
          </Field>
          <Field label="Sampai">
            <Input type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(0))} />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => (setStatus(e.target.value), setPage(0))}>
              <option value="aktif">Aktif</option>
              <option value="batal">Batal</option>
              <option value="">Semua</option>
            </Select>
          </Field>
          <Field label="Cari (no. nota / pelanggan)" className="col-span-2">
            <Input value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} placeholder="INV/2026/10/0001 atau nama…" />
          </Field>
        </div>
        <ErrorBox error={error} />
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Tidak ada nota pada periode ini.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>No. Nota</th>
                <th>Tanggal</th>
                <th>Pelanggan</th>
                <th className="text-right">Total</th>
                <th className="text-right">Sisa tagihan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/nota/${s.id}`} className="text-brand font-medium hover:underline font-mono text-[13px]">
                      {s.number}
                    </Link>
                  </td>
                  <td>{tglPendek(s.date)}</td>
                  <td>{s.customer_name}</td>
                  <td className="num">{num(s.total)}</td>
                  <td className="num">{s.status === "aktif" ? num(Math.max(balance(s), 0)) : "-"}</td>
                  <td>{payStatus(s)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={3}>Total halaman ini ({rows.length} nota)</td>
                <td className="num">{num(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </Table>
        )}
        {data && data.count > PAGE && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted">
              {page * PAGE + 1}–{Math.min((page + 1) * PAGE, data.count)} dari {data.count}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                ‹ Sebelumnya
              </Button>
              <Button variant="secondary" size="sm" disabled={(page + 1) * PAGE >= data.count} onClick={() => setPage(page + 1)}>
                Berikutnya ›
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
