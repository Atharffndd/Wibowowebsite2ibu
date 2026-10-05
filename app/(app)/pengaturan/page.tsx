"use client";

import { useState } from "react";
import { sb, errMsg } from "@/lib/supabase";
import type { Bank, Settings } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { Button, Card, ErrorBox, Field, Input, NumInput, PageHeader, Table, Textarea } from "@/components/ui";

export default function PengaturanPage() {
  const { settings, reloadMaster } = useApp();
  const [f, setF] = useState<Settings>({ ...settings, banks: settings.banks.map((b) => ({ ...b })) });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setBank = (i: number, patch: Partial<Bank>) => setF({ ...f, banks: f.banks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  async function save() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const { id: _id, ...row } = f;
      void _id;
      const { error } = await sb()
        .from("settings")
        .update({ ...row, banks: f.banks.filter((b) => b.bank.trim() || b.number.trim()), updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
      await reloadMaster();
      setMsg("Pengaturan tersimpan.");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadSignature(file: File) {
    setError(null);
    try {
      const path = `ttd-${Date.now()}.${file.name.split(".").pop() || "png"}`;
      const { error } = await sb().storage.from("branding").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const url = sb().storage.from("branding").getPublicUrl(path).data.publicUrl;
      setF((x) => ({ ...x, signature_url: url }));
      setMsg("Gambar TTD diunggah — klik Simpan untuk menerapkan.");
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Data perusahaan yang tampil di nota, rekening, PPN, dan tanda tangan." />
      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <Card title="Kop nota">
          <div className="space-y-3">
            <Field label="Nama perusahaan" hint={`Tampil sebagai "${f.company_name} Supplier"`}>
              <Input value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} />
            </Field>
            <Field label="Alamat">
              <Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
            </Field>
            <Field label="No. HP / telepon">
              <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prefix nomor nota" hint={`Contoh: ${f.invoice_prefix}/2026/10/0001`}>
                <Input value={f.invoice_prefix} onChange={(e) => setF({ ...f, invoice_prefix: e.target.value.toUpperCase() })} />
              </Field>
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
                  <input type="checkbox" checked={f.tax_enabled} onChange={(e) => setF({ ...f, tax_enabled: e.target.checked })} /> PPN aktif default
                </label>
                <div className="flex items-center gap-2">
                  <NumInput value={f.tax_percent} onChange={(n) => setF({ ...f, tax_percent: n })} />%
                </div>
              </div>
            </div>
            <Field label="Catatan kaki nota (opsional)">
              <Input value={f.footer_note} onChange={(e) => setF({ ...f, footer_note: e.target.value })} placeholder="mis. Barang yang sudah dibeli tidak dapat ditukar" />
            </Field>
          </div>
        </Card>

        <Card title="Info pembayaran">
          <div className="space-y-3">
            <Field label="Atas nama rekening (A.N.)">
              <Input value={f.account_name} onChange={(e) => setF({ ...f, account_name: e.target.value })} />
            </Field>
            <Table>
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>No. rekening</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {f.banks.map((b, i) => (
                  <tr key={i}>
                    <td>
                      <Input value={b.bank} onChange={(e) => setBank(i, { bank: e.target.value })} className="py-1.5" />
                    </td>
                    <td>
                      <Input value={b.number} onChange={(e) => setBank(i, { number: e.target.value })} className="py-1.5" />
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => setF({ ...f, banks: f.banks.filter((_, j) => j !== i) })}>
                        ✕
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Button variant="ghost" size="sm" onClick={() => setF({ ...f, banks: [...f.banks, { bank: "", number: "" }] })}>
              + Tambah rekening
            </Button>
          </div>
        </Card>

        <Card title="Tanda tangan & paraf (tampil di setiap nota)">
          <div className="flex flex-wrap gap-4 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.signature_url || "/ttd.png"} alt="TTD" className="h-32 w-auto border border-line rounded-lg bg-white p-2" />
            <div className="space-y-2">
              <label className="inline-block">
                <span className="inline-flex cursor-pointer items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Ganti gambar…</span>
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadSignature(e.target.files[0])} />
              </label>
              {f.signature_url && (
                <div>
                  <Button variant="ghost" size="sm" onClick={() => setF({ ...f, signature_url: null })}>
                    Kembali ke TTD bawaan
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted max-w-xs">Gunakan PNG transparan untuk hasil terbaik. Gambar ini selalu dicetak di bagian &quot;Hormat kami&quot;.</p>
            </div>
          </div>
        </Card>

      </div>
      <div className="sticky bottom-0 mt-4 bg-page/90 backdrop-blur py-3 flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        <ErrorBox error={error} />
      </div>
    </>
  );
}
