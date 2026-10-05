"use client";

import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md" };
export function Button({ variant = "primary", size = "md", className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
        size === "sm" ? "px-2.5 py-1 text-sm" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-brand text-white hover:bg-brand-dark",
        variant === "secondary" && "bg-white border border-line text-ink hover:bg-slate-50",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        variant === "ghost" && "text-brand hover:bg-brand-soft",
        className,
      )}
    />
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-xs font-medium text-muted mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}

/** Input angka: menerima "1.000" atau "1000" */
export function NumInput({ value, onChange, className, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number; onChange: (n: number) => void }) {
  return (
    <input
      {...p}
      type="number"
      inputMode="decimal"
      step="any"
      value={Number.isFinite(value) ? value : 0}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className={cx(inputCls, "text-right tabular-nums", className)}
    />
  );
}

export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, p.className)} />;
}

export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, p.className)} />;
}

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={cx("bg-white rounded-xl border border-line", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
          <div className="font-semibold">{title}</div>
          <div className="flex gap-2">{actions}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5 no-print">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "warn" | "bad" | "good" }) {
  return (
    <div className="bg-white rounded-xl border border-line p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("text-xl font-bold mt-1 tabular-nums", tone === "bad" && "text-red-600", tone === "warn" && "text-amber-600", tone === "good" && "text-emerald-600")}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-2 md:p-6 overflow-y-auto" onMouseDown={onClose}>
      <div className={cx("bg-white rounded-xl shadow-xl w-full my-4", wide ? "max-w-4xl" : "max-w-lg")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none" aria-label="Tutup">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  return (
    <span
      className={cx(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-slate-100 text-slate-700",
        tone === "good" && "bg-emerald-50 text-emerald-700",
        tone === "warn" && "bg-amber-50 text-amber-700",
        tone === "bad" && "bg-red-50 text-red-700",
        tone === "info" && "bg-brand-soft text-brand-dark",
      )}
    >
      {children}
    </span>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto -mx-4 md:mx-0", className)}>
      <table className="w-full text-sm data-table">{children}</table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-center text-muted text-sm py-10">{children}</div>;
}

export function Loading() {
  return <div className="text-center text-muted text-sm py-10">Memuat…</div>;
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 mb-3">{error}</div>;
}
