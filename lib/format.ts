const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const nq = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });

export const rp = (n: number | string | null | undefined) => "Rp " + nf.format(Number(n ?? 0));
export const num = (n: number | string | null | undefined) => nf.format(Number(n ?? 0));
export const qty = (n: number | string | null | undefined) => nq.format(Number(n ?? 0));

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-10-02" -> "2 Oktober 2026" */
export function tanggal(d: string | null | undefined): string {
  if (!d) return "-";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return `${day} ${BULAN[m - 1]} ${y}`;
}

/** "2026-10-02" -> "02/10/2026" */
export function tglPendek(d: string | null | undefined): string {
  if (!d) return "-";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

/** Tanggal hari ini (zona lokal) format YYYY-MM-DD */
export function today(): string {
  const d = new Date();
  return localDate(d);
}

export function localDate(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDate(d);
}

export function firstOfMonth(date = today()): string {
  return date.slice(0, 8) + "01";
}

export const MOVEMENT_LABEL: Record<string, string> = {
  opening: "Stok awal",
  purchase: "Barang masuk",
  sale: "Penjualan",
  sale_return: "Retur penjualan",
  purchase_return: "Retur pembelian",
  adjust: "Penyesuaian / opname",
  transfer_in: "Transfer masuk",
  transfer_out: "Transfer keluar",
};
