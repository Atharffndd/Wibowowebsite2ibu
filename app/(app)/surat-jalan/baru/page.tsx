"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sb, errMsg } from "@/lib/supabase";
import { loadDNItems, loadNotaSource, type NotaSource } from "@/lib/suratJalan";
import { loadCustomers, loadProducts } from "@/lib/hooks";
import { today } from "@/lib/format";
import { VEHICLE_NUMBERS, VEHICLE_TYPES, type Customer, type DeliveryNote, type LineItem, type Product } from "@/lib/types";
import { NameCombo } from "@/components/NameCombo";
import { ItemsEditor, newKey } from "@/components/ItemsEditor";
import { useApp } from "@/components/AppContext";
import { SuratJalan, type SuratJalanData } from "@/components/SuratJalan";
import { Button, Card, ErrorBox, Field, Input, Loading, PageHeader, Select, Textarea } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <SuratJalanForm />
    </Suspense>
  );
}

function SuratJalanForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const editId = sp.get("id");
  const notaId = sp.get("nota");
  const { settings } = useApp();

  const [src, setSrc] = useState<NotaSource | null>(null);
  const [mandiri, setMandiri] = useState<DeliveryNote | "baru" | null>(!editId && !notaId ? "baru" : null);
  const [f, setF] = useState<SuratJalanData>({
    number: "",
    date: "",
    recipient_name: "",
    recipient_address: "",
    vehicle_type: VEHICLE_TYPES[0],
    vehicle_number: VEHICLE_NUMBERS[0],
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (editId) {
          const { data, error } = await sb().from("delivery_notes").select("*").eq("id", editId).single();
          if (error) throw error;
          const sj = data as DeliveryNote;
          if (!sj.sale_id) return setMandiri(sj);
          setSrc(await loadNotaSource(sj.sale_id));
          setF({
            number: sj.number,
            date: sj.date,
            recipient_name: sj.recipient_name,
            recipient_address: sj.recipient_address ?? "",
            vehicle_type: sj.vehicle_type ?? "",
            vehicle_number: sj.vehicle_number ?? "",
            notes: sj.notes ?? "",
          });
        } else if (notaId) {
          const s = await loadNotaSource(notaId);
          if (s.sale.status !== "aktif") throw new Error("Nota ini sudah dibatalkan.");
          setSrc(s);
          // default: nomor & tanggal sama dengan nota, tujuan dari nota/pelanggan
          setF((x) => ({ ...x, number: s.sale.number, date: s.sale.date, recipient_name: s.sale.customer_name, recipient_address: s.address ?? "" }));
        }
      } catch (e) {
        setError(errMsg(e));
      }
    })();
  }, [editId, notaId]);

  async function save() {
    if (!src) return;
    setError(null);
    if (!f.number.trim()) return setError("Nomor Surat Jalan wajib diisi.");
    if (!f.date) return setError("Tanggal wajib diisi.");
    if (!f.recipient_name.trim()) return setError("Nama penerima wajib diisi.");
    setBusy(true);
    const row = {
      sale_id: src.sale.id,
      number: f.number.trim(),
      date: f.date,
      recipient_name: f.recipient_name.trim(),
      recipient_address: f.recipient_address?.trim() || null,
      vehicle_type: f.vehicle_type || null,
      vehicle_number: f.vehicle_number || null,
      notes: f.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const res = editId
      ? await sb().from("delivery_notes").update(row).eq("id", editId).select("id").single()
      : await sb().from("delivery_notes").insert(row).select("id").single();
    setBusy(false);
    if (res.error) return setError(res.error.message);
    router.push(`/surat-jalan/${res.data.id}`);
  }

  if (mandiri) return <SJMandiriForm existing={mandiri === "baru" ? null : mandiri} />;
  if (!src) return error ? <ErrorBox error={error} /> : <Loading />;

  const set = (patch: Partial<SuratJalanData>) => setF((x) => ({ ...x, ...patch }));

  return (
    <>
      <div className="no-print">
        <Link href={`/nota/${src.sale.id}`} className="text-sm text-brand hover:underline">
          ‹ Nota {src.sale.number}
        </Link>
        <PageHeader title={editId ? "Ubah Surat Jalan" : "Buat Surat Jalan"} subtitle={`Dari nota ${src.sale.number} — daftar barang otomatis sama dengan nota.`} />
      </div>
      <div className="grid xl:grid-cols-[360px_1fr] gap-4 items-start">
        <Card title="Informasi pengiriman" className="no-print xl:sticky xl:top-6">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nomor Surat Jalan" hint="Default sama dengan nomor nota">
                <Input value={f.number} onChange={(e) => set({ number: e.target.value })} />
              </Field>
              <Field label="Tanggal">
                <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
              </Field>
            </div>
            <Field label="Penerima / perusahaan">
              <Input value={f.recipient_name} onChange={(e) => set({ recipient_name: e.target.value })} />
            </Field>
            <Field label="Alamat tujuan">
              <Textarea rows={2} value={f.recipient_address ?? ""} onChange={(e) => set({ recipient_address: e.target.value })} placeholder="Alamat pengiriman" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jenis kendaraan">
                <Select value={f.vehicle_type ?? ""} onChange={(e) => set({ vehicle_type: e.target.value })}>
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Nomor kendaraan">
                <Select value={f.vehicle_number ?? ""} onChange={(e) => set({ vehicle_number: e.target.value })}>
                  {VEHICLE_NUMBERS.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                  {f.vehicle_number && !VEHICLE_NUMBERS.includes(f.vehicle_number) && <option>{f.vehicle_number}</option>}
                </Select>
              </Field>
            </div>
            <Field label="Catatan (opsional)">
              <Input value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
            <ErrorBox error={error} />
            <Button className="w-full" onClick={save} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Surat Jalan"}
            </Button>
            <p className="text-xs text-muted">Setelah disimpan, Surat Jalan bisa dicetak, diunduh PDF, atau dikirim lewat WhatsApp.</p>
          </div>
        </Card>
        <div>
          <div className="no-print text-xs font-medium text-muted mb-2">PREVIEW</div>
          <div className="print-area bg-white border border-line rounded-xl p-6 md:p-10 max-w-[210mm] shadow-sm overflow-x-auto">
            <SuratJalan sj={f} sale={src.sale} items={src.items} settings={settings} />
          </div>
        </div>
      </div>
    </>
  );
}

/** Surat Jalan tanpa nota: barang dipilih / diketik sendiri, tidak mengurangi stok */
function SJMandiriForm({ existing }: { existing: DeliveryNote | null }) {
  const router = useRouter();
  const { settings, warehouses } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [f, setF] = useState<SuratJalanData>({
    number: existing?.number ?? "",
    date: existing?.date ?? today(),
    recipient_name: existing?.recipient_name ?? "",
    recipient_address: existing?.recipient_address ?? "",
    vehicle_type: existing ? existing.vehicle_type ?? "" : VEHICLE_TYPES[0],
    vehicle_number: existing ? existing.vehicle_number ?? "" : VEHICLE_NUMBERS[0],
    notes: existing?.notes ?? "",
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([loadProducts(), loadCustomers()]);
        setProducts(p);
        setCustomers(c);
        if (existing) {
          const rows = await loadDNItems(existing.id);
          setItems(rows.map((r) => ({ key: newKey(), product_id: r.product_id ?? "", name: r.name, unit: r.unit, factor: 1, qty: Number(r.qty), price: 0, warehouse_id: "" })));
        }
        setReady(true);
      } catch (e) {
        setError(errMsg(e));
      }
    })();
  }, [existing]);

  const set = (patch: Partial<SuratJalanData>) => setF((x) => ({ ...x, ...patch }));
  const rows = items.filter((it) => it.qty > 0 && it.name.trim());

  function pickRecipient(name: string, id: string | null) {
    const c = id ? customers.find((x) => x.id === id) : undefined;
    setF((x) => ({ ...x, recipient_name: name, recipient_address: c?.address && !x.recipient_address ? c.address : x.recipient_address }));
  }

  async function save() {
    setError(null);
    if (!f.date) return setError("Tanggal wajib diisi.");
    if (!f.recipient_name.trim()) return setError("Nama penerima wajib diisi.");
    if (!rows.length) return setError("Tambahkan minimal 1 barang.");
    setBusy(true);
    const { data, error } = await sb().rpc("save_delivery_note", {
      p: {
        id: existing?.id ?? null,
        number: f.number.trim(),
        date: f.date,
        recipient_name: f.recipient_name.trim(),
        recipient_address: f.recipient_address?.trim() || null,
        vehicle_type: f.vehicle_type || null,
        vehicle_number: f.vehicle_number || null,
        notes: f.notes?.trim() || null,
        items: rows.map((it) => ({ product_id: it.product_id || null, name: it.name.trim(), qty: it.qty, unit: it.unit })),
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.push(`/surat-jalan/${data}`);
  }

  if (!ready) return error ? <ErrorBox error={error} /> : <Loading />;

  const preview = rows.map((it) => ({ id: it.key, product_id: it.product_id, name: it.name, qty: it.qty, unit: it.unit, factor: 1, price: 0, subtotal: 0, warehouse_id: null }));

  return (
    <>
      <div className="no-print">
        <Link href="/surat-jalan" className="text-sm text-brand hover:underline">
          ‹ Surat Jalan
        </Link>
        <PageHeader
          title={existing ? `Ubah Surat Jalan ${existing.number}` : "Surat Jalan tanpa nota"}
          subtitle="Barang dipilih atau diketik langsung. Tidak mengurangi stok — stok berkurang jika nanti dibuatkan nota."
        />
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="no-print space-y-4">
          <Card title="Informasi pengiriman">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nomor Surat Jalan">
                  <Input value={f.number} onChange={(e) => set({ number: e.target.value })} placeholder={`Otomatis SJ/${f.date.slice(0, 4)}/${f.date.slice(5, 7)}/xxxx`} />
                </Field>
                <Field label="Tanggal">
                  <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
                </Field>
              </div>
              <Field label="Penerima — pilih atau ketik nama baru">
                <NameCombo
                  value={f.recipient_name}
                  options={customers.map((c) => ({ id: c.id, name: c.name, sub: c.address }))}
                  onChange={pickRecipient}
                  placeholder="Ketik nama penerima…"
                  newLabel="Pelanggan baru"
                />
              </Field>
              <Field label="Alamat tujuan">
                <Textarea rows={2} value={f.recipient_address ?? ""} onChange={(e) => set({ recipient_address: e.target.value })} placeholder="Alamat pengiriman" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jenis kendaraan">
                  <Select value={f.vehicle_type ?? ""} onChange={(e) => set({ vehicle_type: e.target.value })}>
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nomor kendaraan">
                  <Select value={f.vehicle_number ?? ""} onChange={(e) => set({ vehicle_number: e.target.value })}>
                    {VEHICLE_NUMBERS.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                    {f.vehicle_number && !VEHICLE_NUMBERS.includes(f.vehicle_number) && <option>{f.vehicle_number}</option>}
                  </Select>
                </Field>
              </div>
              <Field label="Catatan (opsional)">
                <Input value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
            </div>
          </Card>
          <Card title="Barang">
            <ItemsEditor items={items} setItems={setItems} products={products} priceFor={() => 0} warehouses={warehouses} showPrice={false} showWarehouse={false} allowNew />
          </Card>
          <Card>
            <div className="space-y-3">
              <ErrorBox error={error} />
              <Button className="w-full" onClick={save} disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan Surat Jalan"}
              </Button>
              <p className="text-xs text-muted">Penerima & barang baru otomatis tersimpan ke daftar. Setelah disimpan, Surat Jalan bisa dicetak, diunduh PDF, atau dikirim lewat WhatsApp.</p>
            </div>
          </Card>
        </div>
        <div>
          <div className="no-print text-xs font-medium text-muted mb-2">PREVIEW</div>
          <div className="print-area bg-white border border-line rounded-xl p-6 md:p-10 max-w-[210mm] shadow-sm overflow-x-auto">
            <SuratJalan sj={{ ...f, number: f.number || "(otomatis)" }} sale={null} items={preview} settings={settings} />
          </div>
        </div>
      </div>
    </>
  );
}
