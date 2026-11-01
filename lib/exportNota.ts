"use client";

import { fetchAll, sb } from "./supabase";

type SaleRow = {
  id: string;
  number: string;
  date: string;
  customer_name: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax_amount: number;
  total: number;
  notes: string | null;
};
type ItemRow = {
  id: string;
  sale_id: string;
  name: string;
  qty: number;
  unit: string;
  factor: number;
  price: number;
  subtotal: number;
  cost_per_base: number;
  products: { avg_cost: number } | { avg_cost: number }[] | null;
};

const RP = "#,##0";
const QTY = "#,##0.###";
const BELUM = "belum ada harga beli";

function safeName(s: string, max = 80) {
  return s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Export nota (satu pelanggan, rentang tanggal) ke Excel: sheet Rekap, sheet Semua Item, dan satu sheet per nomor nota.
 * Nota batal tidak ikut. "Harga supplier" = harga beli (HPP) per satuan jual; barang tanpa harga beli ditandai dan tidak dihitung selisihnya.
 */
export async function exportNotaXlsx(opts: { customerId: string; customerName: string; from: string; to: string }): Promise<{ nota: number; tanpaHargaBeli: number }> {
  const { customerId, customerName, from, to } = opts;
  const sales = await fetchAll<SaleRow>((a, b) =>
    sb()
      .from("sales")
      .select("id, number, date, customer_name, subtotal, discount, shipping, tax_amount, total, notes")
      .eq("customer_id", customerId)
      .eq("status", "aktif")
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("number")
      .range(a, b),
  );
  if (sales.length === 0) return { nota: 0, tanpaHargaBeli: 0 };

  const items: ItemRow[] = [];
  for (let i = 0; i < sales.length; i += 80) {
    const ids = sales.slice(i, i + 80).map((s) => s.id);
    const part = await fetchAll<ItemRow>((a, b) =>
      sb()
        .from("sale_items")
        .select("id, sale_id, name, qty, unit, factor, price, subtotal, cost_per_base, products(avg_cost)")
        .in("sale_id", ids)
        .eq("active", true)
        .order("id")
        .range(a, b),
    );
    items.push(...part);
  }
  const bySale = new Map<string, ItemRow[]>();
  for (const it of items) bySale.set(it.sale_id, [...(bySale.get(it.sale_id) ?? []), it]);

  // harga supplier per satuan jual (null bila belum ada harga beli)
  const supplierPrice = (it: ItemRow): number | null => {
    const base = Number(it.cost_per_base) > 0 ? Number(it.cost_per_base) : Number((Array.isArray(it.products) ? it.products[0] : it.products)?.avg_cost ?? 0);
    return base > 0 ? Math.round(base * Number(it.factor) * 100) / 100 : null;
  };

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const bold = { bold: true };
  const headFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE8EEF9" } };
  const styleHead = (row: import("exceljs").Row) => {
    row.font = bold;
    row.eachCell((c) => {
      c.fill = headFill;
      c.border = { bottom: { style: "thin" } };
      c.alignment = { vertical: "middle", wrapText: true };
    });
  };

  // Urutan sheet: Rekap, Semua Item, lalu satu sheet per nota
  const wsR = wb.addWorksheet("Rekap", { views: [{ state: "frozen", ySplit: 1 }] });
  const wsI = wb.addWorksheet("Semua Item", { views: [{ state: "frozen", ySplit: 1 }] });

  // ---------- Sheet Semua Item ----------
  wsI.columns = [
    { header: "No. Nota", key: "no", width: 20 },
    { header: "Tanggal", key: "tgl", width: 12 },
    { header: "Pelanggan", key: "pel", width: 24 },
    { header: "No", key: "n", width: 5 },
    { header: "Nama Barang", key: "nama", width: 34 },
    { header: "Jumlah", key: "qty", width: 10, style: { numFmt: QTY } },
    { header: "Satuan", key: "sat", width: 9 },
    { header: "Harga", key: "harga", width: 13, style: { numFmt: RP } },
    { header: "Harga Total", key: "total", width: 15, style: { numFmt: RP } },
    { header: "Harga Supplier", key: "sup", width: 15, style: { numFmt: RP } },
    { header: "Selisih / Satuan", key: "sel", width: 15, style: { numFmt: RP } },
    { header: "Total Selisih", key: "tsel", width: 16, style: { numFmt: RP } },
  ];
  styleHead(wsI.getRow(1));

  let sumTotal = 0;
  let sumSelisih = 0;
  let tanpa = 0;
  const perSale = new Map<string, { selisih: number; tanpa: number }>();
  for (const s of sales) {
    const its = bySale.get(s.id) ?? [];
    let sSel = 0;
    let sTanpa = 0;
    its.forEach((it, idx) => {
      const sup = supplierPrice(it);
      const r = wsI.rowCount + 1;
      const qty = Number(it.qty);
      const harga = Number(it.price);
      const selUnit = sup === null ? null : harga - sup;
      const tsel = selUnit === null ? null : qty * selUnit;
      wsI.addRow([
        s.number,
        s.date,
        s.customer_name,
        idx + 1,
        it.name,
        qty,
        it.unit,
        harga,
        { formula: `F${r}*H${r}`, result: Number(it.subtotal) },
        sup === null ? BELUM : sup,
        sup === null ? "" : { formula: `H${r}-J${r}`, result: selUnit ?? 0 },
        sup === null ? "" : { formula: `F${r}*K${r}`, result: tsel ?? 0 },
      ]);
      ["F", "H", "I", "J", "K", "L"].forEach((c) => (wsI.getCell(`${c}${r}`).numFmt = c === "F" ? QTY : RP));
      if (sup === null) {
        sTanpa++;
        wsI.getCell(`J${r}`).font = { italic: true, color: { argb: "FFB45309" } };
      } else sSel += tsel ?? 0;
      sumTotal += Number(it.subtotal);
    });
    sumSelisih += sSel;
    tanpa += sTanpa;
    perSale.set(s.id, { selisih: sSel, tanpa: sTanpa });
  }
  const lastI = wsI.rowCount;
  const totI = wsI.addRow(["TOTAL", "", "", "", "", "", "", "", { formula: `SUM(I2:I${lastI})`, result: sumTotal }, "", "", { formula: `SUM(L2:L${lastI})`, result: sumSelisih }]);
  totI.font = bold;
  totI.getCell(9).numFmt = RP;
  totI.getCell(12).numFmt = RP;
  wsI.addRow([]);
  wsI.addRow([`Barang tanpa harga beli: ${tanpa} baris (tidak dihitung dalam Total Selisih).`]).font = { italic: true };
  wsI.autoFilter = { from: "A1", to: "L1" };

  // ---------- Sheet Rekap ----------
  wsR.columns = [
    { header: "No", key: "n", width: 5 },
    { header: "No. Nota", key: "no", width: 20 },
    { header: "Tanggal", key: "tgl", width: 12 },
    { header: "Pelanggan", key: "pel", width: 26 },
    { header: "Subtotal", key: "sub", width: 15, style: { numFmt: RP } },
    { header: "Diskon", key: "dis", width: 13, style: { numFmt: RP } },
    { header: "Ongkir", key: "ong", width: 13, style: { numFmt: RP } },
    { header: "PPN", key: "ppn", width: 13, style: { numFmt: RP } },
    { header: "Total", key: "tot", width: 16, style: { numFmt: RP } },
    { header: "Total Selisih", key: "sel", width: 16, style: { numFmt: RP } },
    { header: "Baris tanpa harga beli", key: "tp", width: 14 },
    { header: "Catatan", key: "cat", width: 30 },
  ];
  styleHead(wsR.getRow(1));
  sales.forEach((s, i) => {
    const r = wsR.rowCount + 1;
    const ps = perSale.get(s.id)!;
    wsR.addRow([i + 1, s.number, s.date, s.customer_name, Number(s.subtotal), Number(s.discount), Number(s.shipping), Number(s.tax_amount), Number(s.total), ps.selisih, ps.tanpa, s.notes ?? ""]);
    ["E", "F", "G", "H", "I", "J"].forEach((c) => (wsR.getCell(`${c}${r}`).numFmt = RP));
  });
  const lastR = wsR.rowCount;
  const sumCol = (col: string, key: keyof SaleRow) => ({ formula: `SUM(${col}2:${col}${lastR})`, result: sales.reduce((a, s) => a + Number(s[key] ?? 0), 0) });
  const totR = wsR.addRow(["", "TOTAL", "", "", sumCol("E", "subtotal"), sumCol("F", "discount"), sumCol("G", "shipping"), sumCol("H", "tax_amount"), sumCol("I", "total"), { formula: `SUM(J2:J${lastR})`, result: sumSelisih }, { formula: `SUM(K2:K${lastR})`, result: tanpa }, ""]);
  totR.font = bold;
  ["E", "F", "G", "H", "I", "J"].forEach((c) => (totR.getCell(c).numFmt = RP));

  // ---------- Satu sheet per nota ----------
  const used = new Set<string>(["Rekap", "Semua Item"]);
  for (const s of sales) {
    let name = safeName(s.number.replace(/\//g, "-"), 31);
    let k = 2;
    while (used.has(name.toLowerCase()) || used.has(name)) name = safeName(s.number.replace(/\//g, "-"), 27) + "-" + k++;
    used.add(name);
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { width: 5 },
      { width: 36 },
      { width: 10 },
      { width: 9 },
      { width: 13 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 16 },
    ];
    ws.addRow(["NOTA", s.number]).font = { bold: true, size: 13 };
    ws.addRow(["Tanggal", s.date]);
    ws.addRow(["Pelanggan", s.customer_name]);
    ws.addRow([]);
    const head = ws.addRow(["No", "Nama Barang", "Jumlah", "Satuan", "Harga", "Harga Total", "Harga Supplier", "Selisih / Satuan", "Total Selisih"]);
    styleHead(head);
    const first = head.number + 1;
    const its = bySale.get(s.id) ?? [];
    let tot = 0;
    let sel = 0;
    its.forEach((it, idx) => {
      const r = ws.rowCount + 1;
      const sup = supplierPrice(it);
      const qty = Number(it.qty);
      const harga = Number(it.price);
      const selUnit = sup === null ? null : harga - sup;
      ws.addRow([
        idx + 1,
        it.name,
        qty,
        it.unit,
        harga,
        { formula: `C${r}*E${r}`, result: Number(it.subtotal) },
        sup === null ? BELUM : sup,
        sup === null ? "" : { formula: `E${r}-G${r}`, result: selUnit ?? 0 },
        sup === null ? "" : { formula: `C${r}*H${r}`, result: qty * (selUnit ?? 0) },
      ]);
      ws.getCell(`C${r}`).numFmt = QTY;
      ["E", "F", "G", "H", "I"].forEach((c) => (ws.getCell(`${c}${r}`).numFmt = RP));
      if (sup === null) ws.getCell(`G${r}`).font = { italic: true, color: { argb: "FFB45309" } };
      else sel += qty * (selUnit ?? 0);
      tot += Number(it.subtotal);
    });
    const last = ws.rowCount;
    const t = ws.addRow(["", "TOTAL", "", "", "", { formula: `SUM(F${first}:F${last})`, result: tot }, "", "", { formula: `SUM(I${first}:I${last})`, result: sel }]);
    t.font = bold;
    t.getCell("F").numFmt = RP;
    t.getCell("I").numFmt = RP;
    if (Number(s.discount) || Number(s.shipping) || Number(s.tax_amount)) {
      if (Number(s.discount)) ws.addRow(["", "Diskon", "", "", "", -Number(s.discount)]).getCell("F").numFmt = RP;
      if (Number(s.shipping)) ws.addRow(["", "Ongkir", "", "", "", Number(s.shipping)]).getCell("F").numFmt = RP;
      if (Number(s.tax_amount)) ws.addRow(["", "PPN", "", "", "", Number(s.tax_amount)]).getCell("F").numFmt = RP;
      const g = ws.addRow(["", "TOTAL NOTA", "", "", "", Number(s.total)]);
      g.font = bold;
      g.getCell("F").numFmt = RP;
    }
    const ps = perSale.get(s.id)!;
    if (ps.tanpa) ws.addRow([]), ws.addRow([`${ps.tanpa} baris belum ada harga beli (tidak dihitung dalam Total Selisih).`]).font = { italic: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nota-${safeName(customerName, 40)}-${from}-sd-${to}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return { nota: sales.length, tanpaHargaBeli: tanpa };
}
