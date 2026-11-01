"use client";

import { SearchSelect } from "@/components/SearchSelect";
import { useState } from "react";
import { loadCustomers, useAsync } from "@/lib/hooks";
import { errMsg } from "@/lib/supabase";
import { exportNotaXlsx } from "@/lib/exportNota";
import { Button, ErrorBox, Field, Input, Modal } from "@/components/ui";

/** Export nota ke Excel untuk akuntan: pilih rentang tanggal dan satu pelanggan. */
export function ExportNotaDialog({ open, onClose, defaultFrom, defaultTo }: { open: boolean; onClose: () => void; defaultFrom: string; defaultTo: string }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [customerId, setCustomerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { data: customers } = useAsync(() => loadCustomers(), []);

  async function run() {
    setError(null);
    setInfo(null);
    if (!customerId) return setError("Pilih satu pelanggan dulu.");
    if (!from || !to || from > to) return setError("Rentang tanggal tidak benar.");
    setBusy(true);
    try {
      const c = (customers ?? []).find((x) => x.id === customerId);
      const r = await exportNotaXlsx({ customerId, customerName: c?.name ?? "pelanggan", from, to });
      if (r.nota === 0) setInfo("Tidak ada nota aktif untuk pelanggan dan tanggal itu.");
      else setInfo(`Selesai: ${r.nota} nota diunduh.${r.tanpaHargaBeli ? ` ${r.tanpaHargaBeli} baris barang belum punya harga beli (ditandai di Excel).` : ""}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Export nota ke Excel">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dari tanggal">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Sampai tanggal">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Pelanggan (pilih satu)" className="col-span-2">
          <SearchSelect value={customerId} onChange={setCustomerId} options={customers ?? []} placeholder="Ketik nama pelanggan…" />
        </Field>
      </div>
      <p className="text-xs text-muted mt-3">File berisi sheet Rekap, sheet Semua Item, dan satu sheet per nomor nota. Nota batal tidak ikut. Harga supplier diambil dari harga beli barang; barang tanpa harga beli ditandai dan tidak dihitung selisihnya.</p>
      <div className="mt-3">
        <ErrorBox error={error} />
        {info && <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2">{info}</div>}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose}>
          Tutup
        </Button>
        <Button onClick={run} disabled={busy}>
          {busy ? "Menyiapkan…" : "Unduh Excel"}
        </Button>
      </div>
    </Modal>
  );
}
