"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";
import { useAsync } from "@/lib/hooks";
import { useRef } from "react";
import { loadSJSource, suratJalanWAText } from "@/lib/suratJalan";
import type { DeliveryNote } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { SuratJalan } from "@/components/SuratJalan";
import { ShareDoc } from "@/components/ShareDoc";
import { Badge, Button, ErrorBox, Loading } from "@/components/ui";

export default function SuratJalanDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { settings } = useApp();
  const docRef = useRef<HTMLDivElement>(null);

  const { data, error, loading, reload } = useAsync(async () => {
    const { data, error } = await sb().from("delivery_notes").select("*").eq("id", id).single();
    if (error) throw error;
    const sj = data as DeliveryNote;
    return { sj, src: await loadSJSource(sj) };
  }, [id]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "Surat Jalan tidak ditemukan"} />;
  const { sj, src } = data;
  const fileName = `Surat Jalan ${sj.number}`;

  async function cancel() {
    if (!confirm(`Batalkan Surat Jalan ${sj.number}?`)) return;
    const { error } = await sb().from("delivery_notes").update({ status: "batal", updated_at: new Date().toISOString() }).eq("id", sj.id);
    if (error) alert(error.message);
    else reload();
  }

  return (
    <>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          {src.sale ? (
            <Link href={`/nota/${src.sale.id}`} className="text-sm text-brand hover:underline">
              ‹ Nota {src.sale.number}
            </Link>
          ) : (
            <Link href="/surat-jalan" className="text-sm text-brand hover:underline">
              ‹ Surat Jalan (tanpa nota)
            </Link>
          )}
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-xl font-bold">
              Surat Jalan <span className="font-mono">{sj.number}</span>
            </h1>
            {sj.status === "batal" ? <Badge tone="bad">Batal</Badge> : <Badge tone="good">Aktif</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ShareDoc
            docRef={docRef}
            fileName={fileName}
            printLabel="🖨 Cetak Surat Jalan"
            caption={`Surat Jalan ${sj.number} — ${settings.company_name} Supplier`}
            waText={suratJalanWAText(sj, src, settings)}
            phone={src.phone}
          />
          {sj.status === "aktif" && (
            <>
              <Button variant="secondary" onClick={() => router.push(`/surat-jalan/baru?id=${sj.id}`)}>
                Ubah
              </Button>
              <Button variant="danger" onClick={cancel}>
                Batalkan
              </Button>
            </>
          )}
        </div>
      </div>
      {src.sale?.status === "batal" && <div className="no-print mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">Nota sumber sudah dibatalkan.</div>}
      <div className="print-area bg-white border border-line rounded-xl p-6 md:p-10 max-w-[210mm] shadow-sm overflow-x-auto">
        <div ref={docRef}>
          <SuratJalan sj={sj} sale={src.sale} items={src.items} settings={settings} />
        </div>
      </div>
    </>
  );
}
