"use client";

export type Col = { header: string; key: string; width?: number; numFmt?: string };

/** Unduh data sebagai file .xlsx */
export async function exportXlsx(filename: string, sheet: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet);
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16, style: c.numFmt ? { numFmt: c.numFmt } : {} }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".xlsx") ? filename : filename + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Baca sheet pertama .xlsx menjadi array objek berdasarkan baris header (header di-lowercase) */
export async function readXlsx(file: File): Promise<Record<string, unknown>[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cell.value ?? "").trim().toLowerCase();
  });
  const out: Record<string, unknown>[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const o: Record<string, unknown> = {};
    let any = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const h = headers[col];
      if (!h) return;
      let v: unknown = cell.value;
      if (v && typeof v === "object" && "result" in (v as object)) v = (v as { result: unknown }).result;
      if (v && typeof v === "object" && "text" in (v as object)) v = (v as { text: unknown }).text;
      o[h] = v;
      if (v !== null && v !== "") any = true;
    });
    if (any) out.push(o);
  });
  return out;
}

/** Ambil nilai pertama yang ada dari beberapa kemungkinan nama kolom */
export function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const n of names) if (row[n] !== undefined && row[n] !== null && row[n] !== "") return row[n];
  return undefined;
}
