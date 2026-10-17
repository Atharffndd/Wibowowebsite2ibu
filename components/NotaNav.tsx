"use client";

import { useRouter } from "next/navigation";
import type { NotaRef } from "@/lib/notaNav";
import { Button } from "@/components/ui";

/** Tombol pindah ke nota sebelumnya / berikutnya mengikuti urutan daftar nota (berputar di ujung). */
export function NotaNav({ refs, currentId }: { refs: NotaRef[] | null; currentId: string }) {
  const router = useRouter();
  const i = refs ? refs.findIndex((r) => r.id === currentId) : -1;
  if (!refs || i < 0 || refs.length < 2) return null;

  const n = refs.length;
  const prev = refs[(i - 1 + n) % n];
  const next = refs[(i + 1) % n];

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" title={prev.number} onClick={() => router.push(`/nota/${prev.id}`)}>
        ‹ Sebelumnya
      </Button>
      <span className="text-xs text-muted tabular-nums whitespace-nowrap">
        Nota {i + 1} dari {n}
      </span>
      <Button variant="secondary" size="sm" title={next.number} onClick={() => router.push(`/nota/${next.id}`)}>
        Berikutnya ›
      </Button>
    </div>
  );
}
