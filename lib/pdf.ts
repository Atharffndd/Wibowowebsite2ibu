"use client";

/**
 * Membuat file PDF A4 dari elemen dokumen (Nota / Surat Jalan) langsung di browser,
 * tanpa header/footer browser. Halaman dipotong di batas baris tabel / blok tanda tangan,
 * dan judul tabel diulang di halaman berikutnya.
 */

const A4_W = 210;
const A4_H = 297;
const MARGIN = 12; // mm
const RENDER_WIDTH = 794; // px ≈ lebar A4 pada 96 dpi
const SCALE = 2;

export async function elementToPdf(el: HTMLElement, fileName: string): Promise<File> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

  // Render salinan dokumen di luar layar dengan lebar A4 tetap (hasil sama di iPad, HP, dan laptop)
  const holder = document.createElement("div");
  const contentWidthPx = RENDER_WIDTH - Math.round((2 * MARGIN * RENDER_WIDTH) / A4_W);
  holder.style.cssText = `position:fixed;left:-20000px;top:0;width:${contentWidthPx}px;background:#fff;z-index:-1;`;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-print").forEach((n) => n.remove());
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    await Promise.all(
      Array.from(clone.querySelectorAll("img")).map((img) =>
        img.complete && img.naturalWidth ? Promise.resolve() : new Promise<void>((res) => ((img.onload = () => res()), (img.onerror = () => res()))),
      ),
    );
    if (document.fonts?.ready) await document.fonts.ready;

    const root = clone.getBoundingClientRect();
    const rootTop = root.top;
    const rel = (n: Element) => {
      const r = n.getBoundingClientRect();
      return { top: r.top - rootTop, bottom: r.bottom - rootTop };
    };

    // Gambar (cap + paraf) tidak ikut dirender html-to-image: Safari iPad sering gagal menggambar <img>
    // di dalam SVG sehingga cap hilang. Gambar disembunyikan lalu digambar langsung ke kanvas.
    const imgs = await Promise.all(
      Array.from(clone.querySelectorAll("img")).map(async (img) => {
        const r = img.getBoundingClientRect();
        const box = { x: r.left - root.left, y: r.top - rootTop, w: r.width, h: r.height };
        img.style.visibility = "hidden";
        return { box, el: await loadImage(img.currentSrc || img.src) };
      }),
    );
    const totalH = clone.scrollHeight;

    // Titik potong yang aman: awal setiap baris barang & blok yang tidak boleh terbelah
    const breaks = Array.from(clone.querySelectorAll("tbody tr, .pdf-keep, .sj-sign"))
      .map((n) => rel(n).top)
      .filter((y) => y > 0)
      .sort((a, b) => a - b);

    // Judul tabel barang (diulang di halaman berikutnya)
    const table = clone.querySelector("table.items-table") as HTMLElement | null;
    const thead = table?.querySelector("thead") as HTMLElement | null;
    const head = thead ? rel(thead) : null;
    const tableBox = table ? rel(table) : null;
    const headH = head ? head.bottom - head.top : 0;

    const canvas = await toCanvas(clone, { pixelRatio: SCALE, backgroundColor: "#ffffff", cacheBust: true });
    const cctx = canvas.getContext("2d")!;
    for (const { box, el } of imgs) {
      if (!el || !el.naturalWidth || !box.w || !box.h) continue;
      // object-contain: pas di dalam kotak, di tengah
      const k = Math.min(box.w / el.naturalWidth, box.h / el.naturalHeight);
      const w = el.naturalWidth * k;
      const h = el.naturalHeight * k;
      cctx.drawImage(el, (box.x + (box.w - w) / 2) * SCALE, (box.y + (box.h - h) / 2) * SCALE, w * SCALE, h * SCALE);
    }

    const pxPerMm = contentWidthPx / (A4_W - 2 * MARGIN);
    const pageH = (A4_H - 2 * MARGIN) * pxPerMm;

    // Hitung potongan halaman
    const slices: { start: number; end: number; repeatHead: boolean }[] = [];
    let start = 0;
    while (start < totalH - 1) {
      const repeatHead = slices.length > 0 && !!head && !!tableBox && start > head.bottom && start < tableBox.bottom;
      const avail = pageH - (repeatHead ? headH : 0);
      let end = start + avail;
      if (end >= totalH) end = totalH;
      else {
        const cand = breaks.filter((b) => b > start + 20 && b <= end);
        if (cand.length) end = cand[cand.length - 1];
      }
      slices.push({ start, end, repeatHead });
      start = end;
    }

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    slices.forEach((s, i) => {
      if (i > 0) pdf.addPage();
      const hdr = s.repeatHead && head ? headH : 0;
      const hPx = hdr + (s.end - s.start);
      const page = document.createElement("canvas");
      page.width = canvas.width;
      page.height = Math.ceil(hPx * SCALE);
      const ctx = page.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, page.width, page.height);
      if (hdr && head) ctx.drawImage(canvas, 0, head.top * SCALE, canvas.width, headH * SCALE, 0, 0, canvas.width, headH * SCALE);
      ctx.drawImage(canvas, 0, s.start * SCALE, canvas.width, (s.end - s.start) * SCALE, 0, hdr * SCALE, canvas.width, (s.end - s.start) * SCALE);
      pdf.addImage(page.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN, A4_W - 2 * MARGIN, hPx / pxPerMm);
    });

    const blob = pdf.output("blob");
    const name = (fileName.replace(/[\\/:*?"<>|]/g, "-") || "dokumen") + ".pdf";
    return new File([blob], name, { type: "application/pdf" });
  } finally {
    holder.remove();
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = async () => {
      try {
        await im.decode();
      } catch {}
      res(im);
    };
    im.onerror = () => res(null);
    im.src = src;
  });
}

export function downloadFile(file: File) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function canShareFile(file: File): boolean {
  return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: [file] });
}

/** Cetak dengan judul = nama file (nama default saat "Simpan sebagai PDF") */
export function printAs(title: string) {
  const prev = document.title;
  document.title = title.replace(/[\\/:*?"<>|]/g, "-");
  window.print();
  setTimeout(() => (document.title = prev), 1000);
}
