"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { sb } from "@/lib/supabase";
import type { Settings, Warehouse } from "@/lib/types";

type Ctx = {
  settings: Settings;
  warehouses: Warehouse[];
  reloadMaster: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp di luar AppProvider");
  return c;
}

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  company_name: "Wibowo",
  address: "",
  phone: "",
  account_name: "",
  banks: [],
  invoice_prefix: "INV",
  tax_enabled: false,
  tax_percent: 0,
  footer_note: "",
  signature_url: null,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const reloadMaster = useCallback(async () => {
    const [s, w] = await Promise.all([
      sb().from("settings").select("*").eq("id", 1).maybeSingle(),
      sb().from("warehouses").select("*").order("code"),
    ]);
    setSettings({ ...DEFAULT_SETTINGS, ...(s.data ?? {}) });
    setWarehouses((w.data as Warehouse[]) ?? []);
  }, []);

  useEffect(() => {
    reloadMaster();
  }, [reloadMaster]);

  if (!settings) return <div className="p-10 text-center text-muted">Memuat…</div>;
  return <AppCtx.Provider value={{ settings, warehouses, reloadMaster }}>{children}</AppCtx.Provider>;
}
