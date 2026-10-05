"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { sb, fetchAll, errMsg } from "@/lib/supabase";
import { loadProducts, useAsync } from "@/lib/hooks";
import { exportXlsx } from "@/lib/excel";
import { MOVEMENT_LABEL, addDays, num, qty, tglPendek, today } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { ProductSearch } from "@/components/ItemsEditor";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal, NumInput, PageHeader, Select, Stat, Table, cx } from "@/components/ui";

type Tab = "stok" | "mutasi";
type Mode = "opening" | "adjust" | "transfer";

export default function StokPage() {
  const { warehouses } = useApp();
  const [tab, setTab] = useState<Tab>("stok");
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);

  const { data, error, loading, reload } = useAsync(async () => {
    const [products, stock] = await Promise.all([
      loadProducts(),
      fetchAll<{ product_id: string; warehouse_id: string; qty: number }>((f, t) => sb().from("v_stock").select("*").range(f, t)),
    ]);
    const map: Record<string, Record<string, number>> = {};
    for (const s of stock) (map[s.product_id] ??= {})[s.warehouse_id] = Number(s.qty);
    return { products, map };
  }, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.products ?? []).filter(
      (p) => (!s || p.name.toLowerCase().includes(s)) && (!lowOnly || (Number(p.min_stock) > 0 && Number(p.stock_total) <= Number(p.min_stock))),
    );
  }, [data, q, lowOnly]);

  const totalValue = (data?.products ?? []).reduce((s, p) => s + Math.max(Number(p.stock_total), 0) * Number(p.avg_cost), 0);
  const lowCount = (data?.products ?? []).filter((p) => Number(p.min_stock) > 0 && Number(p.stock_total) <= Number(p.min_stock)).length;

  async function doExport() {
    await exportXlsx(
      `stok-${today()}`,
      "Stok",
      [
        { header: "Barang", key: "name", width: 32 },
        { header: "Satuan", key: "unit", width: 10 },
        ...warehouses.map((w) => ({ header: w.name, key: w.id, width: 12 })),
        { header: "Total", key: "total", width: 12 },
        { header: "HPP", key: "hpp", numFmt: "#,##0" },
        { header: "Nilai Stok", key: "value", numFmt: "#,##0" },
      ],
      rows.map((p) => ({
        name: p.name,
        unit: p.base_unit,
        ...Object.fromEntries(warehouses.map((w) => [w.id, data?.map[p.id]?.[w.id] ?? 0])),
        total: Number(p.stock_total),
        hpp: Number(p.avg_cost),
        value: Math.round(Number(p.stock_total) * Number(p.avg_cost)),
      })),
    );
  }

  return (
    <>
      <PageHeader
        title="Stok & Gudang"
        subtitle="Stok dihitung otomatis dari barang masuk, penjualan, retur, dan penyesuaian."
        actions={
          <>
            <Button variant="secondary" onClick={() => setMode("opening")}>
              Stok awal
            </Button>
            <Button variant="secondary" onClick={() => setMode("adjust")}>
              Stok opname
            </Button>
            <Button variant="secondary" onClick={() => setMode("transfer")}>
              Transfer gudang
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <Stat label="Jumlah barang aktif" value={num(data?.products.length ?? 0)} />
        <Stat label="Nilai persediaan (HPP)" value={`Rp ${num(totalValue)}`} />
        <Stat label="Stok menipis" value={num(lowCount)} tone={lowCount ? "warn" : undefined} />
      </div>
      <div className="flex gap-1 mb-3">
        {(["stok", "mutasi"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx("px-4 py-2 rounded-lg text-sm font-medium", tab === t ? "bg-brand text-white" : "bg-white border border-line")}>
            {t === "stok" ? "Stok per gudang" : "Riwayat mutasi"}
          </button>
        ))}
      </div>

      {tab === "stok" ? (
        <Card actions={<Button variant="secondary" size="sm" onClick={doExport}>Export Excel</Button>} title="Posisi stok">
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <Field label="Cari barang" className="flex-1 min-w-48">
              <Input value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm pb-2">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Hanya stok menipis
            </label>
          </div>
          <ErrorBox error={error} />
          {loading && !data ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty>Tidak ada data.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Barang</th>
                  {warehouses.map((w) => (
                    <th key={w.id} className="text-right">
                      {w.name}
                    </th>
                  ))}
                  <th className="text-right">Total</th>
                  <th className="text-right">Nilai (HPP)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const low = Number(p.min_stock) > 0 && Number(p.stock_total) <= Number(p.min_stock);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/barang/${p.id}`} className="text-brand hover:underline">
                          {p.name}
                        </Link>{" "}
                        {low && <Badge tone="warn">min {qty(p.min_stock)}</Badge>}
                      </td>
                      {warehouses.map((w) => {
                        const v = data?.map[p.id]?.[w.id] ?? 0;
                        return (
                          <td key={w.id} className={cx("num", v < 0 && "text-amber-600 font-medium")}>
                            {qty(v)} <span className="text-xs text-muted">{p.base_unit}</span>
                          </td>
                        );
                      })}
                      <td className="num font-semibold">
                        {qty(p.stock_total)} <span className="text-xs text-muted font-normal">{p.base_unit}</span>
                      </td>
                      <td className="num">{num(Number(p.stock_total) * Number(p.avg_cost))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      ) : (
        <Movements products={data?.products ?? []} />
      )}

      {mode && data && (
        <AdjustModal
          mode={mode}
          products={data.products}
          stockMap={data.map}
          onClose={() => setMode(null)}
          onSaved={() => {
            setMode(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function Movements({ products }: { products: Product[] }) {
  const { warehouses } = useApp();
  const [from, setFrom] = useState(addDays(today(), -7));
  const [to, setTo] = useState(today());
  const [wh, setWh] = useState("");
  const [type, setType] = useState("");
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const { data, loading, error } = useAsync(async () => {
    let qy = sb().from("stock_movements").select("*, products(name, base_unit)").eq("void", false).gte("date", from).lte("date", to).order("date", { ascending: false }).order("id", { ascending: false }).limit(1000);
    if (wh) qy = qy.eq("warehouse_id", wh);
    if (type) qy = qy.eq("type", type);
    const { data, error } = await qy;
    if (error) throw error;
    return data as { id: number; date: string; type: string; qty_base: number; unit_cost: number | null; unit_price: number | null; warehouse_id: string; product_id: string; notes: string | null; products: { name: string; base_unit: string } }[];
  }, [from, to, wh, type]);

  return (
    <Card title="Riwayat barang masuk & keluar">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Field label="Dari">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Sampai">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Gudang">
          <Select value={wh} onChange={(e) => setWh(e.target.value)}>
            <option value="">Semua</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jenis">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Semua</option>
            {Object.entries(MOVEMENT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty>Tidak ada mutasi.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Barang</th>
              <th>Jenis</th>
              <th>Gudang</th>
              <th className="text-right">Masuk</th>
              <th className="text-right">Keluar</th>
              <th className="text-right">Harga beli/jual</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => {
              const q = Number(m.qty_base);
              const unit = m.products?.base_unit ?? byId[m.product_id]?.base_unit;
              const price = m.unit_price ?? m.unit_cost;
              return (
                <tr key={m.id}>
                  <td>{tglPendek(m.date)}</td>
                  <td>{m.products?.name}</td>
                  <td>
                    {MOVEMENT_LABEL[m.type] ?? m.type}
                    {m.notes && <div className="text-xs text-muted">{m.notes}</div>}
                  </td>
                  <td>{warehouses.find((w) => w.id === m.warehouse_id)?.name}</td>
                  <td className="num text-emerald-700">{q > 0 ? `${qty(q)} ${unit}` : ""}</td>
                  <td className="num text-red-700">{q < 0 ? `${qty(-q)} ${unit}` : ""}</td>
                  <td className="num">{price != null ? num(price) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

type AdjRow = { product_id: string; name: string; unit: string; qty: number; unit_cost: number };

function AdjustModal({ mode, products, stockMap, onClose, onSaved }: { mode: Mode; products: Product[]; stockMap: Record<string, Record<string, number>>; onClose: () => void; onSaved: () => void }) {
  const { warehouses } = useApp();
  const [wh, setWh] = useState(warehouses[0]?.id ?? "");
  const [toWh, setToWh] = useState(warehouses[1]?.id ?? "");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<AdjRow[]>([]);
  const [counted, setCounted] = useState<Record<string, number | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const title = mode === "opening" ? "Input stok awal" : mode === "adjust" ? "Stok opname (hitung fisik)" : "Transfer antar gudang";

  function add(p: Product) {
    if (rows.some((r) => r.product_id === p.id)) return;
    setRows((rs) => [...rs, { product_id: p.id, name: p.name, unit: p.base_unit, qty: 0, unit_cost: Number(p.avg_cost) }]);
  }

  async function save() {
    setError(null);
    let items: { product_id: string; qty: number; unit_cost?: number }[];
    if (mode === "adjust") {
      items = Object.entries(counted)
        .filter(([, v]) => v !== undefined)
        .map(([pid, v]) => ({ product_id: pid, qty: Number(v) - (stockMap[pid]?.[wh] ?? 0) }))
        .filter((i) => i.qty !== 0);
      if (!items.length) return setError("Tidak ada selisih stok untuk disimpan.");
    } else {
      items = rows.filter((r) => r.qty > 0).map((r) => ({ product_id: r.product_id, qty: r.qty, unit_cost: mode === "opening" ? r.unit_cost : undefined }));
      if (!items.length) return setError("Tambahkan barang dan jumlahnya.");
    }
    setBusy(true);
    try {
      const { error } = await sb().rpc("save_adjustment", {
        p: { type: mode === "transfer" ? "transfer" : mode, date, warehouse_id: wh, to_warehouse_id: mode === "transfer" ? toWh : null, notes: notes || null, items },
      });
      if (error) throw error;
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const opnameRows = products.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Modal open onClose={onClose} title={title} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-3">
          <Field label={mode === "transfer" ? "Dari gudang" : "Gudang"}>
            <Select value={wh} onChange={(e) => setWh(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          {mode === "transfer" && (
            <Field label="Ke gudang">
              <Select value={toWh} onChange={(e) => setToWh(e.target.value)}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Tanggal">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Keterangan" className={mode === "transfer" ? "" : "sm:col-span-2"}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        {mode === "adjust" ? (
          <>
            <p className="text-sm text-muted">Isi kolom &quot;Stok fisik&quot; hanya untuk barang yang dihitung. Selisih akan dicatat sebagai penyesuaian.</p>
            <Input placeholder="Cari barang…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm data-table">
                <thead>
                  <tr>
                    <th>Barang</th>
                    <th className="text-right">Stok sistem</th>
                    <th className="text-right w-36">Stok fisik</th>
                    <th className="text-right">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {opnameRows.map((p) => {
                    const sys = stockMap[p.id]?.[wh] ?? 0;
                    const c = counted[p.id];
                    const diff = c === undefined ? 0 : c - sys;
                    return (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td className="num">
                          {qty(sys)} {p.base_unit}
                        </td>
                        <td>
                          <input
                            type="number"
                            step="any"
                            value={c ?? ""}
                            onChange={(e) => setCounted((m) => ({ ...m, [p.id]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                            className="w-full rounded border border-line px-2 py-1 text-right"
                          />
                        </td>
                        <td className={cx("num", diff > 0 && "text-emerald-700", diff < 0 && "text-red-700")}>{c === undefined ? "" : (diff > 0 ? "+" : "") + qty(diff)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <ProductSearch products={products} onPick={add} />
            {rows.length > 0 && (
              <table className="w-full text-sm data-table">
                <thead>
                  <tr>
                    <th>Barang</th>
                    {mode === "transfer" && <th className="text-right">Stok asal</th>}
                    <th className="text-right w-36">Jumlah (sat. dasar)</th>
                    {mode === "opening" && <th className="text-right w-40">Harga beli / sat.</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.product_id}>
                      <td>
                        {r.name} <span className="text-xs text-muted">({r.unit})</span>
                      </td>
                      {mode === "transfer" && <td className="num">{qty(stockMap[r.product_id]?.[wh] ?? 0)}</td>}
                      <td>
                        <NumInput value={r.qty} onChange={(n) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, qty: n } : x)))} className="py-1" />
                      </td>
                      {mode === "opening" && (
                        <td>
                          <NumInput value={r.unit_cost} onChange={(n) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, unit_cost: n } : x)))} className="py-1" />
                        </td>
                      )}
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                          ✕
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
