"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppProvider } from "./AppContext";
import { cx } from "./ui";

const NAV: { group: string; items: { href: string; label: string; icon: string }[] }[] = [
  { group: "", items: [{ href: "/", label: "Dashboard", icon: "▦" }] },
  {
    group: "Transaksi",
    items: [
      { href: "/nota", label: "Nota Penjualan", icon: "🧾" },
      { href: "/surat-jalan", label: "Surat Jalan", icon: "🚛" },
      { href: "/barang-masuk", label: "Barang Masuk", icon: "📥" },
      { href: "/retur", label: "Retur", icon: "↩" },
      { href: "/biaya", label: "Biaya Operasional", icon: "💸" },
    ],
  },
  {
    group: "Keuangan",
    items: [
      { href: "/piutang", label: "Piutang Pelanggan", icon: "📒" },
      { href: "/hutang", label: "Hutang Supplier", icon: "📕" },
      { href: "/laporan", label: "Laporan", icon: "📊" },
    ],
  },
  {
    group: "Data",
    items: [
      { href: "/barang", label: "Barang & Harga", icon: "📦" },
      { href: "/stok", label: "Stok & Gudang", icon: "🏬" },
      { href: "/pelanggan", label: "Pelanggan", icon: "👥" },
      { href: "/supplier", label: "Supplier", icon: "🚚" },
      { href: "/pengaturan", label: "Pengaturan", icon: "⚙" },
    ],
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <AppProvider>
      <div className="min-h-dvh lg:flex">
        {/* Topbar HP & iPad tegak: menu dibuka lewat tombol ☰ */}
        <div className="lg:hidden no-print sticky top-0 z-30 flex items-center justify-between bg-white border-b border-line px-3 py-2">
          <button onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center rounded-lg text-2xl leading-none hover:bg-slate-50" aria-label="Menu">☰</button>
          <span className="font-bold text-brand">Wibowo</span>
          <span className="w-11" />
        </div>

        <aside
          className={cx(
            "no-print fixed lg:sticky top-0 z-40 h-dvh w-64 lg:w-56 xl:w-64 shrink-0 bg-white border-r border-line flex flex-col transition-transform",
            open ? "translate-x-0 shadow-xl" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="px-5 py-4 border-b border-line">
            <div className="text-lg font-extrabold text-brand leading-tight">WIBOWO</div>
            <div className="text-[11px] tracking-[0.3em] text-muted">SUPPLIER</div>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {NAV.map((g) => (
              <div key={g.group}>
                {g.group && <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.group}</div>}
                {g.items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={cx(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 lg:py-2 text-sm",
                      isActive(it.href) ? "bg-brand-soft text-brand-dark font-semibold" : "text-ink hover:bg-slate-50",
                    )}
                  >
                    <span className="w-5 text-center">{it.icon}</span>
                    {it.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="border-t border-line p-3 text-xs text-muted">Wibowo Supplier · Pasar Wage, Purwokerto</div>
        </aside>
        {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden no-print" onClick={() => setOpen(false)} />}

        <main className="flex-1 min-w-0 p-4 md:p-6 xl:p-8">{children}</main>
      </div>
    </AppProvider>
  );
}
