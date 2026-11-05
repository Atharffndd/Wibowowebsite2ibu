import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Publishable key memang aman berada di browser; data dilindungi Row Level Security (hanya staff).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://taujhusvykjttgdippxj.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9X2Gqin4kPoEKz9GL_txVQ_oE4SDq8g";

let client: SupabaseClient | null = null;

// Penyimpanan sementara untuk daftar yang jarang berubah (barang, pelanggan, supplier).
// Dikosongkan otomatis setiap ada penulisan ke database, dan kedaluwarsa dalam 30 detik.
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
// panggilan rpc yang hanya membaca tidak perlu mengosongkan cache
const READ_ONLY_RPC = /\/rpc\/(dashboard_report|dashboard_stats|report_sales|customer_stats|supplier_stats|next_doc_number)\b/;

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as Promise<T>;
  const value = load().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, { at: Date.now(), value });
  return value;
}

const trackedFetch: typeof fetch = async (input, init) => {
  const req = input instanceof Request ? input : null;
  const method = (init?.method ?? req?.method ?? "GET").toUpperCase();
  const target = req ? req.url : String(input);
  const res = await fetch(input, init);
  if (method !== "GET" && method !== "HEAD" && !READ_ONLY_RPC.test(target)) cache.clear();
  return res;
};

export function sb(): SupabaseClient {
  if (!client) client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true }, global: { fetch: trackedFetch } });
  return client;
}

/** Ambil semua baris (melewati batas 1000 baris PostgREST). */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
