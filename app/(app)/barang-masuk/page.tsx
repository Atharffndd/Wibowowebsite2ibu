"use client";

import Link from "next/link";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { addDays, num, tglPendek, today } from "@/lib/format";
import { balance, type Purchase } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { payStatus } from "@/components/status";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Table } from "@/components/ui";

export default function BarangMasukList() {
  const { warehouses } = useApp();
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [q, setQ] = useState("");

  const { data, error, loading } = useAsync(async () => {
    let query = sb().from("purchases").select("*").gte("date", from).lte("date", to).order("date", { ascending: false }).order("number", { ascending: false }).limit(500);
    if (q.trim()) query = query.or(`number.ilike.%${q.trim()}%,supplier_name.ilike.%${q.trim()}%,supplier_ref.ilike.%${q.trim()}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data as Purchase[]) ?? [];
  }, [from, to, q]);

  const wh = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "-";
  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title="Barang Masuk"
        subtitle="Pencatatan pembelian / barang masuk dari supplier beserta harga beli. HPP rata-rata dihitung otomatis."
        actions={
          <Link href="/barang-masuk/baru">
            <Button>+ Barang masuk</Button>
          </Link>
        }
      />
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Dari">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Sampai">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Cari (no. / supplier / no. faktur)" className="col-span-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
        </div>
        <ErrorBox error={error} />
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Belum ada barang masuk pada periode ini.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th>Supplier</th>
                <th>Gudang</th>
                <th className="text-right">Total</th>
                <th className="text-right">Sisa hutang</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/barang-masuk/${p.id}`} className="text-brand font-medium hover:underline font-mono text-[13px]">
                      {p.number}
                    </Link>
                    {p.supplier_ref && <div className="text-xs text-muted">faktur {p.supplier_ref}</div>}
                  </td>
                  <td>{tglPendek(p.date)}</td>
                  <td>{p.supplier_name || "-"}</td>
                  <td>{wh(p.warehouse_id)}</td>
                  <td className="num">{num(p.total)}</td>
                  <td className="num">{p.status === "aktif" ? num(Math.max(balance(p), 0)) : "-"}</td>
                  <td>{payStatus(p)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
