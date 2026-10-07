"use client";

import type { Sale, SaleItem, Settings } from "@/lib/types";
import { qty, tanggal } from "@/lib/format";
import { mergeRows } from "./Invoice";

export type SuratJalanData = {
  number: string;
  date: string;
  recipient_name: string;
  recipient_address: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  notes: string | null;
  status?: "aktif" | "batal";
};

/**
 * Dokumen Surat Jalan — kop, font & gaya sama dengan nota (Invoice.tsx).
 * Barang diambil dari nota sumber (urutan, jumlah, satuan, nama sama persis; tanpa harga),
 * atau dari daftar barang Surat Jalan sendiri jika dibuat tanpa nota (sale = null).
 * TTD/cap kanan memakai aset yang sama dengan nota.
 */
export function SuratJalan({ sj, sale, items, settings }: { sj: SuratJalanData; sale: Sale | null; items: SaleItem[]; settings: Settings }) {
  const rows = mergeRows(items, sale);
  const sig = settings.signature_url || "/ttd.png";
  const vehicle = [sj.vehicle_type, sj.vehicle_number].filter(Boolean);

  return (
    <div className="invoice surat-jalan text-[13px] leading-snug">
      {/* Kop — sama dengan nota */}
      <div className="flex justify-between items-start gap-6">
        <div>
          <div className="text-[28px] font-extrabold tracking-tight leading-none mb-2">{settings.company_name} Supplier</div>
          {settings.address && <div className="whitespace-pre-line">{settings.address}</div>}
          {settings.phone && <div>{settings.phone}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[22px] font-extrabold tracking-[0.08em] leading-none">SURAT JALAN</div>
          <div className="text-[11px] tracking-[0.2em] text-neutral-600 mt-2">NOMOR</div>
          <div className="mono font-bold text-[15px]">{sj.number || "-"}</div>
          {sj.status === "batal" && <div className="mt-1 inline-block border-2 border-red-600 text-red-600 font-bold px-2 rotate-[-4deg]">BATAL</div>}
        </div>
      </div>

      <div className="border-t-2 border-black mt-3 mb-3" />

      <div className="flex justify-between items-start gap-6 mb-2">
        <div className="min-w-0">
          <div>
            <span className="font-bold">Kepada:</span> {sj.recipient_name || "-"}
          </div>
          {sj.recipient_address && <div className="whitespace-pre-line">{sj.recipient_address}</div>}
        </div>
        <div className="text-right shrink-0">{tanggal(sj.date)}</div>
      </div>

      <div className="mb-3">
        Kami kirimkan barang-barang tersebut di bawah ini. Dikirim dengan kendaraan{vehicle.length ? "" : ":"}{" "}
        {sj.vehicle_type && <b>{sj.vehicle_type}</b>}
        {sj.vehicle_number && (
          <>
            {" "}
            dengan nomor: <b className="mono whitespace-nowrap">{sj.vehicle_number}</b>
          </>
        )}
        {!vehicle.length && <span className="inline-block w-48 border-b border-dotted border-neutral-500" />}
      </div>

      {/* Tabel barang — header berulang di tiap halaman cetak */}
      <table className="sj-table items-table w-full border-collapse">
        <thead>
          <tr className="mono text-[12px] font-bold border-y-2 border-black">
            <th className="text-left py-1.5 w-12">NO.</th>
            <th className="text-right py-1.5 pr-6 w-44">BANYAK BARANG</th>
            <th className="text-left py-1.5">NAMA BARANG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it, i) => (
            <tr key={it.key} className="align-top border-b border-neutral-300">
              <td className="py-1.5 mono">{i + 1}</td>
              <td className="py-1.5 pr-6 text-right">
                <span className="mono">{qty(it.qty)}</span> {it.unit}
              </td>
              <td className="py-1.5">{it.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-neutral-500" />

      {sj.notes && (
        <div className="mt-3 text-[12px]">
          <b>Catatan:</b> {sj.notes}
        </div>
      )}

      {/* Tanda tangan — tidak terpotong antar halaman */}
      <div className="sj-sign grid grid-cols-2 gap-10 mt-6">
        <div className="text-center">
          <div className="mb-1">Tanda Terima,</div>
          <div className="h-32" />
          <div className="mx-auto w-52 border-t border-neutral-600 pt-1 text-[11px] text-neutral-600">nama &amp; tanda tangan penerima</div>
        </div>
        <div className="text-center">
          <div className="mb-1">Hormat kami,</div>
          {/* aset TTD + paraf yang sama persis dengan nota */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sig} alt="Tanda tangan & paraf" className="w-80 h-auto max-h-40 object-contain mx-auto" />
        </div>
      </div>
    </div>
  );
}
