"use client";

import { sb } from "./supabase";
import { tanggal } from "./format";
import type { DeliveryNote, Sale, SaleItem, Settings } from "./types";
import { mergeRows } from "@/components/Invoice";
import { qty } from "./format";

export type NotaSource = { sale: Sale; items: SaleItem[]; address: string | null; phone: string | null };

/** Muat nota sumber + item aktif (urutan sama dengan nota) + alamat/HP pelanggan */
export async function loadNotaSource(saleId: string): Promise<NotaSource> {
  const [s, it] = await Promise.all([
    sb().from("sales").select("*, customers(address, phone)").eq("id", saleId).single(),
    sb().from("sale_items").select("*").eq("sale_id", saleId).eq("active", true).order("id"),
  ]);
  if (s.error) throw s.error;
  if (it.error) throw it.error;
  const row = s.data as Sale & { customers: { address: string | null; phone: string | null } | null };
  return { sale: row, items: (it.data as SaleItem[]) ?? [], address: row.customers?.address ?? null, phone: row.customers?.phone ?? null };
}

export async function loadDeliveryNotes(saleId: string): Promise<DeliveryNote[]> {
  const { data, error } = await sb().from("delivery_notes").select("*").eq("sale_id", saleId).order("created_at");
  if (error) throw error;
  return (data as DeliveryNote[]) ?? [];
}

/** Nama file PDF saat "Simpan sebagai PDF" di dialog cetak */
export function printAs(title: string) {
  const prev = document.title;
  document.title = title.replace(/[\\/:*?"<>|]/g, "-");
  window.print();
  setTimeout(() => (document.title = prev), 1000);
}

/** Kirim ringkasan Surat Jalan lewat WhatsApp (mekanisme sama dengan nota) */
export function shareSuratJalanWA(sj: DeliveryNote, src: NotaSource, settings: Settings) {
  const rows = mergeRows(src.items, src.sale);
  const lines = [
    `*${settings.company_name} Supplier*`,
    `*SURAT JALAN* No: ${sj.number}`,
    `Tanggal: ${tanggal(sj.date)}`,
    `Kepada: ${sj.recipient_name}`,
    sj.recipient_address ? `Alamat: ${sj.recipient_address}` : null,
    sj.vehicle_type || sj.vehicle_number ? `Kendaraan: ${[sj.vehicle_type, sj.vehicle_number].filter(Boolean).join(" — ")}` : null,
    "",
    ...rows.map((r, i) => `${i + 1}. ${qty(r.qty)} ${r.unit} — ${r.name}`),
    sj.notes ? `\nCatatan: ${sj.notes}` : null,
  ].filter((l): l is string => l !== null);
  const to = (src.phone ?? "").replace(/\D/g, "").replace(/^0/, "62");
  window.open(`https://wa.me/${to}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
}
