"use client";

import { useMemo, useState } from "react";
import { sb, fetchAll, errMsg } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { num, tglPendek } from "@/lib/format";
import { balance, type Purchase, type Supplier } from "@/lib/types";
import Link from "next/link";
import { payStatus } from "@/components/status";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal, PageHeader, Table, Textarea } from "@/components/ui";

export default function SupplierPage() {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Supplier | "new" | null>(null);
  const [view, setView] = useState<Supplier | null>(null);

  const { data, error, loading, reload } = useAsync(async () => {
    const [suppliers, purchases] = await Promise.all([
      fetchAll<Supplier>((f, t) => sb().from("suppliers").select("*").order("name").range(f, t)),
      fetchAll<Purchase>((f, t) => sb().from("purchases").select("*").eq("status", "aktif").not("supplier_id", "is", null).order("date", { ascending: false }).range(f, t)),
    ]);
    const stats: Record<string, { total: number; hutang: number; last?: string }> = {};
    for (const p of purchases) {
      const st = (stats[p.supplier_id!] ??= { total: 0, hutang: 0, last: p.date });
      st.total += Number(p.total);
      st.hutang += Math.max(balance(p), 0);
    }
    return { suppliers, purchases, stats };
  }, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.suppliers ?? []).filter((c) => !s || c.name.toLowerCase().includes(s));
  }, [data, q]);

  return (
    <>
      <PageHeader title="Supplier" subtitle="Data supplier, kontak, rekening, total pembelian & hutang." actions={<Button onClick={() => setEdit("new")}>+ Supplier</Button>} />
      <Card>
        <Field label="Cari" className="mb-4 max-w-md">
          <Input value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <ErrorBox error={error} />
        {loading && !data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Belum ada supplier. Klik &quot;+ Supplier&quot; untuk menambahkan.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kontak</th>
                <th>Rekening</th>
                <th className="text-right">Total pembelian</th>
                <th className="text-right">Hutang</th>
                <th>Terakhir</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const st = data?.stats[s.id];
                return (
                  <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                    <td>
                      <button className="text-brand font-medium hover:underline text-left" onClick={() => setView(s)}>
                        {s.name}
                      </button>
                      {s.address && <div className="text-xs text-muted">{s.address}</div>}
                    </td>
                    <td>
                      {s.contact_person}
                      {s.phone && <div className="text-xs text-muted">{s.phone}</div>}
                    </td>
                    <td className="text-xs">{s.bank_info}</td>
                    <td className="num">{num(st?.total ?? 0)}</td>
                    <td className={"num " + ((st?.hutang ?? 0) > 0 ? "text-amber-700 font-medium" : "")}>{num(st?.hutang ?? 0)}</td>
                    <td>{st?.last ? tglPendek(st.last) : "-"}</td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEdit(s)}>
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
      {edit && <SupplierModal supplier={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), reload())} />}
      {view && (
        <Modal open onClose={() => setView(null)} title={`Riwayat pembelian — ${view.name}`} wide>
          <Table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th className="text-right">Total</th>
                <th className="text-right">Sisa</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.purchases ?? [])
                .filter((p) => p.supplier_id === view.id)
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/barang-masuk/${p.id}`} className="text-brand hover:underline font-mono text-[13px]">
                        {p.number}
                      </Link>
                    </td>
                    <td>{tglPendek(p.date)}</td>
                    <td className="num">{num(p.total)}</td>
                    <td className="num">{num(Math.max(balance(p), 0))}</td>
                    <td>{payStatus(p)}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </Modal>
      )}
    </>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: supplier?.name ?? "",
    contact_person: supplier?.contact_person ?? "",
    phone: supplier?.phone ?? "",
    address: supplier?.address ?? "",
    bank_info: supplier?.bank_info ?? "",
    notes: supplier?.notes ?? "",
    active: supplier?.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!f.name.trim()) return setError("Nama wajib diisi.");
    try {
      const row = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v]));
      const { error } = supplier ? await sb().from("suppliers").update(row).eq("id", supplier.id) : await sb().from("suppliers").insert(row);
      if (error) throw error;
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <Modal open onClose={onClose} title={supplier ? "Ubah supplier" : "Supplier baru"}>
      <div className="space-y-3">
        <Field label="Nama supplier">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama kontak">
            <Input value={f.contact_person} onChange={(e) => setF({ ...f, contact_person: e.target.value })} />
          </Field>
          <Field label="Telepon">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="Alamat">
          <Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <Field label="Rekening (bank, no., a.n.)">
          <Input value={f.bank_info} onChange={(e) => setF({ ...f, bank_info: e.target.value })} />
        </Field>
        <Field label="Catatan">
          <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Aktif
        </label>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </div>
    </Modal>
  );
}
