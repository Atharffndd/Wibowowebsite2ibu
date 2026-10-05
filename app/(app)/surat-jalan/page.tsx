"use client";

import Link from "next/link";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { addDays, tglPendek, today } from "@/lib/format";
import type { DeliveryNote } from "@/lib/types";
import { Badge, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Table } from "@/components/ui";

type Row = DeliveryNote & { sales: { number: string } | null };

export default function SuratJalanList() {
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [q, setQ] = useState("");

  const { data, error, loading } = useAsync(async () => {
    let query = sb().from("delivery_notes").select("*, sales(number)").gte("date", from).lte("date", to).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(500);
    if (q.trim()) query = query.or(`number.ilike.%${q.trim()}%,recipient_name.ilike.%${q.trim()}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data as Row[]) ?? [];
  }, [from, to, q]);

  return (
    <>
      <PageHeader title="Surat Jalan" subtitle="Surat Jalan dibuat dari nota: buka nota → tombol “Buat Surat Jalan”." />
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Dari">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Sampai">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Cari (nomor / penerima)" className="col-span-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
        </div>
        <ErrorBox error={error} />
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <Empty>Belum ada Surat Jalan pada periode ini.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>No. Surat Jalan</th>
                <th>Tanggal</th>
                <th>Penerima</th>
                <th>Kendaraan</th>
                <th>Nota</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/surat-jalan/${r.id}`} className="text-brand font-medium hover:underline font-mono text-[13px]">
                      {r.number}
                    </Link>
                  </td>
                  <td>{tglPendek(r.date)}</td>
                  <td>{r.recipient_name}</td>
                  <td>{[r.vehicle_type, r.vehicle_number].filter(Boolean).join(" · ") || "-"}</td>
                  <td>
                    <Link href={`/nota/${r.sale_id}`} className="text-brand hover:underline font-mono text-[13px]">
                      {r.sales?.number}
                    </Link>
                  </td>
                  <td>{r.status === "batal" ? <Badge tone="bad">Batal</Badge> : <Badge tone="good">Aktif</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
