"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAll, sb, errMsg } from "./supabase";
import type { Customer, Product, Supplier } from "./types";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [run]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export async function loadProducts(includeInactive = false): Promise<Product[]> {
  return fetchAll<Product>((from, to) => {
    let q = sb().from("v_products").select("*, product_units(*)").order("name").range(from, to);
    if (!includeInactive) q = q.eq("active", true);
    return q;
  });
}

export async function loadCustomers(): Promise<Customer[]> {
  return fetchAll<Customer>((from, to) => sb().from("customers").select("*").eq("active", true).order("name").range(from, to));
}

export async function loadSuppliers(): Promise<Supplier[]> {
  return fetchAll<Supplier>((from, to) => sb().from("suppliers").select("*").eq("active", true).order("name").range(from, to));
}

/** Stok per produk untuk satu gudang (satuan dasar) */
export async function loadStockMap(warehouseId: string): Promise<Record<string, number>> {
  const rows = await fetchAll<{ product_id: string; qty: number }>((from, to) =>
    sb().from("v_stock").select("product_id, qty").eq("warehouse_id", warehouseId).range(from, to),
  );
  return Object.fromEntries(rows.map((r) => [r.product_id, Number(r.qty)]));
}

/** Stok semua produk di semua gudang: stock[productId][warehouseId] (satuan dasar) */
export type StockAll = Record<string, Record<string, number>>;
export async function loadStockAll(): Promise<StockAll> {
  const rows = await fetchAll<{ product_id: string; warehouse_id: string; qty: number }>((from, to) =>
    sb().from("v_stock").select("product_id, warehouse_id, qty").range(from, to),
  );
  const out: StockAll = {};
  for (const r of rows) (out[r.product_id] ??= {})[r.warehouse_id] = Number(r.qty);
  return out;
}
