"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num } from "@/lib/format";

const short = (n: number) => (Math.abs(n) >= 1e9 ? `${(n / 1e9).toFixed(1)}M` : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}jt` : Math.abs(n) >= 1e3 ? `${Math.round(n / 1e3)}rb` : String(n));

/** Grafik batang satu seri (Rupiah) dengan tooltip */
export function BarChartRp({ data, xKey, yKey, label, height = 260 }: { data: Record<string, unknown>[]; xKey: string; yKey: string; label: string; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            cursor={{ fill: "rgba(10,95,232,0.06)" }}
            formatter={(v) => [`Rp ${num(Number(v))}`, label]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
            labelStyle={{ color: "#0f172a", fontWeight: 600 }}
          />
          <Bar dataKey={yKey} fill="#0a5fe8" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
