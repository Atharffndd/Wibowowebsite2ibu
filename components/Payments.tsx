"use client";

import { useState } from "react";
import { sb } from "@/lib/supabase";
import { num, tglPendek, today } from "@/lib/format";
import { Button, ErrorBox, Field, Input, Modal, NumInput, Select, Table } from "./ui";

export type Payment = { id: string; date: string; amount: number; method: string; notes: string | null };

export function PaymentModal({
  open,
  onClose,
  kind,
  docId,
  docLabel,
  remaining,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  kind: "sale" | "purchase";
  docId: string;
  docLabel: string;
  remaining: number;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(remaining);
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("transfer");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (amount <= 0) return setError("Jumlah harus lebih dari 0");
    setBusy(true);
    const { error } = await sb()
      .from("payments")
      .insert({ kind, [kind === "sale" ? "sale_id" : "purchase_id"]: docId, amount, date, method, notes: notes || null });
    setBusy(false);
    if (error) return setError(error.message);
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Catat pembayaran — ${docLabel}`}>
      <div className="space-y-3">
        <div className="text-sm">
          Sisa tagihan: <b>Rp {num(remaining)}</b>
        </div>
        <Field label="Jumlah (Rp)">
          <div className="flex gap-2">
            <NumInput value={amount} onChange={setAmount} />
            <Button variant="secondary" size="sm" onClick={() => setAmount(remaining)}>
              Lunasi
            </Button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Metode">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="transfer">Transfer</option>
              <option value="tunai">Tunai</option>
              <option value="lainnya">Lainnya</option>
            </Select>
          </Field>
        </div>
        <Field label="Keterangan">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="mis. transfer BCA" />
        </Field>
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

export function PaymentList({ payments, onDeleted }: { payments: Payment[]; onDeleted: () => void }) {
  if (payments.length === 0) return <div className="text-sm text-muted">Belum ada pembayaran.</div>;
  async function del(id: string) {
    if (!confirm("Hapus pembayaran ini?")) return;
    const { error } = await sb().from("payments").delete().eq("id", id);
    if (error) alert(error.message);
    else onDeleted();
  }
  return (
    <Table>
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Metode</th>
          <th className="text-right">Jumlah</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {payments.map((p) => (
          <tr key={p.id}>
            <td>
              {tglPendek(p.date)}
              {p.notes && <div className="text-xs text-muted">{p.notes}</div>}
            </td>
            <td className="capitalize">{p.method}</td>
            <td className="num">{num(p.amount)}</td>
            <td className="text-right">
              <Button variant="ghost" size="sm" onClick={() => del(p.id)}>
                Hapus
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
