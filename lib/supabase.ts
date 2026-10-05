import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Publishable key memang aman berada di browser; data dilindungi Row Level Security (hanya staff).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://taujhusvykjttgdippxj.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9X2Gqin4kPoEKz9GL_txVQ_oE4SDq8g";

let client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (!client) client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
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
