"use client";

import { sb } from "./supabase";
import { tanggal } from "./format";
import type { DeliveryNote, Sale, SaleItem, Settings } from "./types";
import { mergeRows } from "@/components/Invoice";
import { qty } from "./format";

export type NotaSource = { sale: Sale; items: SaleItem[]; address: string | null; phone: string | null };
/** Sumber barang Surat Jalan: nota (sale terisi) atau daftar barang sendiri (sale = null) */
export type SJSource = { sale: Sale | null; items: SaleItem[]; address: string | null; phone: string | null };

export type DNItem = { id: string; product_id: string | null; name: string; qty: number; unit: string; sort: number };

/** Barang Surat Jalan tanpa nota → bentuk baris nota (tanpa harga) */
export const dnToSaleItems = (rows: DNItem[]): SaleItem[] =>
  rows.map((r) => ({ id: r.id, product_id: r.product_id ?? "", name: r.name, qty: Number(r.qty), unit: r.unit, factor: 1, price: 0, subtotal: 0, warehouse_id: null }));

export async function loadDNItems(dnId: string): Promise<DNItem[]> {
  const { data, error } = await sb().from("delivery_note_items").select("*").eq("delivery_note_id", dnId).eq("active", true).order("sort");
  if (error) throw error;
  return (data as DNItem[]) ?? [];
}

/** Muat barang untuk Surat Jalan: dari nota sumber, atau dari Surat Jalan itu sendiri jika tanpa nota */
export async function loadSJSource(sj: DeliveryNote): Promise<SJSource> {
  if (sj.sale_id) return loadNotaSource(sj.sale_id);
  const [items, c] = await Promise.all([
    loadDNItems(sj.id),
    sb().from("customers").select("address, phone").eq("active", true).ilike("name", sj.recipient_name).limit(1),
  ]);
  const cust = (c.data?.[0] as { address: string | null; phone: string | null } | undefined) ?? null;
  return { sale: null, items: dnToSaleItems(items), address: cust?.address ?? null, phone: cust?.phone ?? null };
}

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

/** Teks ringkasan Surat Jalan untuk WhatsApp */
export function suratJalanWAText(sj: DeliveryNote, src: SJSource, settings: Settings): string {
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
  return lines.join("\n");
}
