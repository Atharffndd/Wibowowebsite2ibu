"use client";

import { today } from "@/lib/format";
import { balance } from "@/lib/types";
import { Badge } from "./ui";

type Doc = { status: string; total: number; paid_amount: number; return_amount: number; due_date: string | null };

export function payStatus(s: Doc) {
  if (s.status === "batal") return <Badge tone="bad">Batal</Badge>;
  const b = balance(s);
  if (b <= 0) return <Badge tone="good">Lunas</Badge>;
  if (s.due_date && s.due_date < today()) return <Badge tone="bad">Lewat tempo</Badge>;
  if (Number(s.paid_amount) > 0) return <Badge tone="warn">Sebagian</Badge>;
  return <Badge tone="warn">Belum bayar</Badge>;
}
