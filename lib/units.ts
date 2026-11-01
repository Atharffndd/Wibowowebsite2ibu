/** Standarisasi satuan: huruf kecil, tanpa spasi, dan ejaan umum digabung (sama dengan fungsi norm_unit di database). */
const ALIAS: Record<string, string> = {
  ball: "bal",
  botol: "btl",
  btol: "btl",
  btir: "butir",
  btit: "butir",
  jrigen: "jirigen",
  jligen: "jirigen",
  ikat: "iket",
  lmbr: "lembar",
  rcg: "renceng",
  l: "liter",
  boks: "box",
};

export function normalizeUnit(u: string | null | undefined): string {
  const k = String(u ?? "").trim().replace(/\s+/g, "").toLowerCase();
  return ALIAS[k] ?? k;
}
