"use client";

import { rp } from "@/lib/format";
import { Button } from "./ui";

/** Bar bawah untuk HP & iPad tegak: total + tombol simpan selalu terlihat (disembunyikan di layar lebar) */
export function MobileSaveBar({ total, label, busy, onSave, error }: { total: number; label: string; busy: boolean; onSave: () => void; error?: string | null }) {
  return (
    <>
      <div className={error ? "h-32 lg:hidden" : "h-20 lg:hidden"} />
      <div className="no-print lg:hidden fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && <div className="mx-auto mb-2 max-w-3xl rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-muted">TOTAL</div>
            <div className="text-lg font-bold tabular-nums">{rp(total)}</div>
          </div>
          <Button onClick={onSave} disabled={busy} className="px-6">
            {busy ? "Menyimpan…" : label}
          </Button>
        </div>
      </div>
    </>
  );
}
