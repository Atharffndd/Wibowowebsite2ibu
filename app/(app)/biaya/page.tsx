"use client";

import { useState } from "react";
import { sb, errMsg } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { firstOfMonth, num, tglPendek, today } from "@/lib/format";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, NumInput, PageHeader, Stat, Table } from "@/components/ui";

type Exp = { id: string; date: string; category: string; amount: number; notes: string | null };
const CATS = ["Operasional", "Gaji", "Transportasi / BBM", "Sewa", "Listrik & Air", "Kemasan", "Lainnya"];

export default function BiayaPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [f, setF] = useState({ date: today(), category: "Operasional", amount: 0, notes: "" });
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    const { data, error } = await sb().from("expenses").select("*").gte("date", from).lte("date", to).order("date", { ascending: false });
    if (error) throw error;
    return data as Exp[];
  }, [from, to]);

  async function add() {
    setError(null);
    if (f.amount <= 0) return setError("Isi jumlah biaya.");
    try {
      const { error } = await sb().from("expenses").insert({ ...f, notes: f.notes || null });
      if (error) throw error;
      setF({ ...f, amount: 0, notes: "" });
      reload();
    } catch (e) {
      setError(errMsg(e));
    }
  }
  async function del(id: string) {
    if (!confirm("Hapus biaya ini?")) return;
    await sb().from("expenses").delete().eq("id", id);
    reload();
  }

  const rows = data ?? [];
  const total = rows.reduce((a, r) => a + Number(r.amount), 0);
  const byCat = rows.reduce<Record<string, number>>((m, r) => ((m[r.category] = (m[r.category] ?? 0) + Number(r.amount)), m), {});

  return (
    <>
      <PageHeader title="Biaya Operasional" subtitle="Catat pengeluaran (BBM, gaji, sewa, dll) agar laporan laba bersih akurat." />
      <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
        <Card title="Tambah biaya">
          <div className="space-y-3">
            <Field label="Tanggal">
              <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
            <Field label="Kategori">
              <Input list="exp-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
              <datalist id="exp-cats">
                {CATS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Jumlah (Rp)">
              <NumInput value={f.amount} onChange={(n) => setF({ ...f, amount: n })} />
            </Field>
            <Field label="Keterangan">
              <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
            <ErrorBox error={error} />
            <Button className="w-full" onClick={add}>
              Simpan
            </Button>
          </div>
        </Card>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total periode" value={`Rp ${num(total)}`} />
            {Object.entries(byCat)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([k, v]) => (
                <Stat key={k} label={k} value={`Rp ${num(v)}`} />
              ))}
          </div>
          <Card>
            <div className="grid grid-cols-2 gap-3 mb-4 max-w-md">
              <Field label="Dari">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="Sampai">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
            {loading && !data ? (
              <Loading />
            ) : rows.length === 0 ? (
              <Empty>Belum ada biaya pada periode ini.</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Kategori</th>
                    <th>Keterangan</th>
                    <th className="text-right">Jumlah</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{tglPendek(r.date)}</td>
                      <td>{r.category}</td>
                      <td>{r.notes}</td>
                      <td className="num">{num(r.amount)}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => del(r.id)}>
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
