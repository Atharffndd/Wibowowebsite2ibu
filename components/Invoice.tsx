"use client";

import type { Sale, SaleItem, Settings, Warehouse } from "@/lib/types";
import { num, qty, tanggal } from "@/lib/format";

/** Tampilan nota — mengikuti format nota contoh (cetak A4/A5). TTD + paraf selalu tampil. */
type Row = { key: string; name: string; unit: string; price: number; qty: number; subtotal: number; sources: { wh: string; qty: number }[] };

/** Gabungkan baris barang yang sama (nama, satuan, harga sama) — mis. diambil dari dua gudang.
 *  Dipakai juga oleh Surat Jalan agar daftar barangnya sama persis dengan nota. */
export function mergeRows(items: SaleItem[], sale: Pick<Sale, "warehouse_id"> | null): Row[] {
  const out: Row[] = [];
  const byKey = new Map<string, Row>();
  for (const it of items) {
    const key = `${it.product_id}|${it.name}|${it.unit}|${Number(it.price)}`;
    const wh = it.warehouse_id ?? sale?.warehouse_id ?? "";
    let r = byKey.get(key);
    if (!r) {
      r = { key, name: it.name, unit: it.unit, price: Number(it.price), qty: 0, subtotal: 0, sources: [] };
      byKey.set(key, r);
      out.push(r);
    }
    r.qty += Number(it.qty);
    r.subtotal += Number(it.subtotal);
    const src = r.sources.find((s) => s.wh === wh);
    if (src) src.qty += Number(it.qty);
    else r.sources.push({ wh, qty: Number(it.qty) });
  }
  return out;
}

export function Invoice({ sale, items, settings, warehouses = [] }: { sale: Sale; items: SaleItem[]; settings: Settings; warehouses?: Warehouse[] }) {
  const rows = mergeRows(items, sale);
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "";
  const sig = settings.signature_url || "/ttd.png";
  const showTax = Number(sale.tax_amount) > 0 || Number(sale.tax_percent) > 0;
  const hasExtras = Number(sale.discount) > 0 || Number(sale.shipping) > 0 || showTax;

  return (
    <div className="invoice text-[13px] leading-snug">
      {/* Kop */}
      <div className="flex justify-between items-start gap-6">
        <div>
          <div className="text-[28px] font-extrabold tracking-tight leading-none mb-2">{settings.company_name} Supplier</div>
          {settings.address && <div className="whitespace-pre-line">{settings.address}</div>}
          {settings.phone && <div>{settings.phone}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] tracking-[0.2em] text-neutral-600">NOMOR</div>
          <div className="mono font-bold text-[15px]">{sale.number}</div>
          {sale.status === "batal" && <div className="mt-1 inline-block border-2 border-red-600 text-red-600 font-bold px-2 rotate-[-4deg]">BATAL</div>}
        </div>
      </div>

      <div className="border-t-2 border-black mt-3 mb-3" />

      <div className="flex justify-between items-baseline mb-3">
        <div>
          <span className="font-bold">Kepada:</span> {sale.customer_name}
        </div>
        <div>{tanggal(sale.date)}</div>
      </div>

      {/* Tabel barang */}
      <table className="items-table w-full border-collapse">
        <thead>
          <tr className="mono text-[12px] font-bold border-b-2 border-black">
            <th className="text-left py-1.5 w-8">#</th>
            <th className="text-left py-1.5">NAMA BARANG</th>
            <th className="text-right py-1.5 w-14">JML</th>
            <th className="text-left py-1.5 pl-2 w-14">SAT</th>
            <th className="text-right py-1.5 w-28">HARGA</th>
            <th className="text-right py-1.5 w-32">JUMLAH</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it, i) => (
            <tr key={it.key} className="align-top">
              <td className="py-1.5 mono">{i + 1}</td>
              <td className="py-1.5">
                {it.name}
                {/* info gudang hanya untuk internal — tidak ikut dicetak */}
                {warehouses.length > 0 && (
                  <div className="no-print text-[11px] text-brand">
                    {it.sources.map((s) => (it.sources.length > 1 ? `${whName(s.wh)}: ${qty(s.qty)}` : whName(s.wh))).join(" · ")}
                  </div>
                )}
              </td>
              <td className="py-1.5 text-right mono">{qty(it.qty)}</td>
              <td className="py-1.5 pl-2">{it.unit}</td>
              <td className="py-1.5 text-right mono">{num(it.price)}</td>
              <td className="py-1.5 text-right mono">{num(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-neutral-500" />

      {/* Total */}
      <div className="pdf-keep flex justify-end mt-2">
        <table className="mono text-right">
          <tbody>
            {hasExtras && (
              <tr>
                <td className="pr-6 py-0.5">Subtotal</td>
                <td className="py-0.5">{num(sale.subtotal)}</td>
              </tr>
            )}
            {Number(sale.discount) > 0 && (
              <tr>
                <td className="pr-6 py-0.5">Diskon</td>
                <td className="py-0.5">-{num(sale.discount)}</td>
              </tr>
            )}
            {showTax && (
              <tr>
                <td className="pr-6 py-0.5">PPN {Number(sale.tax_percent)}%</td>
                <td className="py-0.5">{num(sale.tax_amount)}</td>
              </tr>
            )}
            {Number(sale.shipping) > 0 && (
              <tr>
                <td className="pr-6 py-0.5">Ongkir</td>
                <td className="py-0.5">{num(sale.shipping)}</td>
              </tr>
            )}
            <tr className="text-[16px] font-bold">
              <td className="pr-6 pt-1">TOTAL</td>
              <td className="pt-1">Rp {num(sale.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {sale.notes && <div className="mt-3 text-[12px]"><b>Catatan:</b> {sale.notes}</div>}

      <div className="pdf-keep border-t border-neutral-400 mt-5 pt-3">
        <div className="font-bold mb-1.5">Info Pembayaran{settings.account_name ? ` A.N. ${settings.account_name}` : ""}</div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-1 mono text-[12.5px]">
          {settings.banks.map((b, i) => (
            <div key={i}>
              {b.bank} {b.number}
            </div>
          ))}
        </div>
        {sale.due_date && (
          <div className="mt-2 text-[12px]">
            Jatuh tempo: <b>{tanggal(sale.due_date)}</b>
          </div>
        )}
        {settings.footer_note && <div className="mt-2 text-[12px]">{settings.footer_note}</div>}
      </div>

      {/* TTD + paraf (wajib di setiap nota) */}
      <div className="pdf-keep flex justify-end mt-4">
        <div className="text-center w-96">
          <div className="mb-1">Hormat kami,</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sig} alt="Tanda tangan & paraf" className="w-full h-auto max-h-40 object-contain mx-auto" />
        </div>
      </div>
    </div>
  );
}
