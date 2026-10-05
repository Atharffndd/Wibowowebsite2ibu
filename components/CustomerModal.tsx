"use client";

import { useState } from "react";
import { sb, errMsg } from "@/lib/supabase";
import type { Customer } from "@/lib/types";
import { Button, ErrorBox, Field, Input, Modal, NumInput, Select, Textarea } from "./ui";

export function CustomerModal({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: customer?.name ?? "",
    price_type: customer?.price_type ?? "eceran",
    phone: customer?.phone ?? "",
    address: customer?.address ?? "",
    term_days: customer?.term_days ?? 0,
    notes: customer?.notes ?? "",
    active: customer?.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!f.name.trim()) return setError("Nama wajib diisi.");
    setBusy(true);
    try {
      const row = { ...f, name: f.name.trim(), phone: f.phone || null, address: f.address || null, notes: f.notes || null };
      const { error } = customer ? await sb().from("customers").update(row).eq("id", customer.id) : await sb().from("customers").insert(row);
      if (error) throw error;
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={customer ? "Ubah pelanggan" : "Pelanggan baru"}>
      <div className="space-y-3">
        <Field label="Nama">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipe harga">
            <Select value={f.price_type} onChange={(e) => setF({ ...f, price_type: e.target.value as Customer["price_type"] })}>
              <option value="eceran">Eceran</option>
              <option value="grosir">Grosir</option>
            </Select>
          </Field>
          <Field label="Tempo bayar (hari)" hint="0 = tunai">
            <NumInput value={f.term_days} onChange={(n) => setF({ ...f, term_days: Math.max(0, Math.round(n)) })} />
          </Field>
        </div>
        <Field label="Telepon / WhatsApp">
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="08…" />
        </Field>
        <Field label="Alamat">
          <Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
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
          <Button onClick={save} disabled={busy}>
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
