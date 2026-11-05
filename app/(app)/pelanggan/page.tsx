"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { sb, fetchAll } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { exportXlsx } from "@/lib/excel";
import { num } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Table } from "@/components/ui";
import { CustomerModal } from "@/components/CustomerModal";

export default function PelangganPage() {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Customer | "new" | null>(null);

  const { data, error, loading, reload } = useAsync(async () => {
    const [customers, st] = await Promise.all([
      fetchAll<Customer>((f, t) => sb().from("customers").select("*").order("name").range(f, t)),
      sb().rpc("customer_stats"),
    ]);
    if (st.error) throw new Error(st.error.message);
    const stats: Record<string, { omzet: number; piutang: number; count: number }> = {};
    for (const r of (st.data ?? []) as { customer_id: string; omzet: number; piutang: number; cnt: number }[]) {
      stats[r.customer_id] = { omzet: Number(r.omzet), piutang: Number(r.piutang), count: Number(r.cnt) };
    }
    return { customers, stats };
  }, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.customers ?? []).filter((c) => !s || c.name.toLowerCase().includes(s) || (c.phone ?? "").includes(s));
  }, [data, q]);

  return (
    <>
      <PageHeader
        title="Pelanggan"
        subtitle="Data pelanggan, tempo, harga khusus & riwayat belanja."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                exportXlsx("pelanggan", "Pelanggan", [
                  { header: "Nama", key: "name", width: 30 },
                  { header: "Telepon", key: "phone" },
                  { header: "Alamat", key: "address", width: 40 },
                  { header: "Tempo (hari)", key: "term_days" },
                  { header: "Total belanja", key: "omzet", numFmt: "#,##0" },
                  { header: "Piutang", key: "piutang", numFmt: "#,##0" },
                ], rows.map((c) => ({ ...c, omzet: data?.stats[c.id]?.omzet ?? 0, piutang: data?.stats[c.id]?.piutang ?? 0 })))
              }
            >
              Export Excel
            </Button>
            <Button onClick={() => setEdit("new")}>+ Pelanggan</Button>
          </>
        }
      />
      <Card>
        <Field label="Cari nama / telepon" className="mb-4 max-w-md">
          <Input value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <ErrorBox error={error} />
        {loading && !data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Belum ada pelanggan.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Telepon</th>
                <th className="text-right">Jml nota</th>
                <th className="text-right">Total belanja</th>
                <th className="text-right">Piutang</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const st = data?.stats[c.id];
                return (
                  <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                    <td>
                      <Link href={`/pelanggan/${c.id}`} className="text-brand font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.address && <div className="text-xs text-muted truncate max-w-64">{c.address}</div>}
                    </td>
                    <td>{c.phone || "-"}</td>
                    <td className="num">{st?.count ?? 0}</td>
                    <td className="num">{num(st?.omzet ?? 0)}</td>
                    <td className={"num " + ((st?.piutang ?? 0) > 0 ? "text-amber-700 font-medium" : "")}>{num(st?.piutang ?? 0)}</td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEdit(c)}>
                        Ubah
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {edit && <CustomerModal customer={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), reload())} />}
    </>
  );
}

