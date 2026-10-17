import { fetchAll, sb } from "./supabase";

/**
 * Konteks daftar nota (filter yang sedang dipakai di halaman Nota Penjualan).
 * Disimpan di sessionStorage supaya halaman detail nota bisa pindah ke nota
 * sebelumnya/berikutnya mengikuti daftar yang sama.
 */
export type NotaCtx = { from: string; to: string; q: string; status: string };
export type NotaRef = { id: string; number: string };

const KEY = "nota-nav-ctx";
const TTL_MS = 120_000;

export function saveNotaCtx(ctx: NotaCtx) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {
    /* sessionStorage tidak tersedia (mode privat dsb.) — navigasi memakai semua nota */
  }
}

function readNotaCtx(): NotaCtx | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NotaCtx) : null;
  } catch {
    return null;
  }
}

/** Urutan harus sama persis dengan daftar di app/(app)/nota/page.tsx. */
async function loadRefs(ctx: NotaCtx | null): Promise<NotaRef[]> {
  return fetchAll<NotaRef>((a, b) => {
    let query = sb()
      .from("sales")
      .select("id, number")
      .order("date", { ascending: false })
      .order("number", { ascending: false })
      .order("id")
      .range(a, b);
    if (ctx) {
      query = query.gte("date", ctx.from).lte("date", ctx.to);
      if (ctx.status) query = query.eq("status", ctx.status);
      if (ctx.q.trim()) query = query.or(`number.ilike.%${ctx.q.trim()}%,customer_name.ilike.%${ctx.q.trim()}%`);
    }
    return query;
  });
}

let cache: { key: string; at: number; refs: NotaRef[] } | null = null;

/**
 * Daftar nota (berurutan seperti di daftar) untuk tombol Sebelumnya/Berikutnya.
 * Bila nota yang dibuka tidak ada di daftar tersimpan (mis. dibuka dari halaman lain),
 * dipakai semua nota.
 */
export async function loadNotaNav(currentId: string): Promise<NotaRef[]> {
  const ctx = readNotaCtx();
  const key = JSON.stringify(ctx);
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS && cache.refs.some((r) => r.id === currentId)) {
    return cache.refs;
  }
  let refs = await loadRefs(ctx);
  if (!refs.some((r) => r.id === currentId)) refs = await loadRefs(null);
  cache = { key, at: Date.now(), refs };
  return refs;
}
