# Catatan Lengkap — Nota Wibowo Supplier

> "Ingatan" proyek. Claude: baca seluruhnya sebelum mengubah apa pun.
> Pemilik: untuk sesi baru cukup tulis *"Baca catatan.md, lalu …"* di repo **Atharffndd/Wibowowebsite2ibu**.
> Bahasa komunikasi: **Bahasa Indonesia**, singkat, tanpa istilah teknis berlebihan.
> Proyek saudara: **Nota Tiga Putra** (repo `Atharffndd/Wibowowebsite`) — kode sama, database & data terpisah.

---

## 1. Ringkasan

Website internal **Wibowo Supplier / Kios Wibowo** (Pasar Wage, Purwokerto): nota penjualan + Surat Jalan (cetak/PDF/WhatsApp) dengan cap & tanda tangan, barang & harga, stok 2 gudang, pelanggan, supplier, piutang, hutang, retur, biaya, laporan.

| Hal | Nilai |
|---|---|
| Website live | https://notawibowosupplier.vercel.app |
| Repo GitHub | https://github.com/Atharffndd/Wibowowebsite2ibu (branch produksi `main`) |
| Supabase | project **`Wibowowebsite`**, id `taujhusvykjttgdippxj`, region `ap-southeast-1`, org "Atharffndd", paket free |
| Supabase URL | `https://taujhusvykjttgdippxj.supabase.co` |
| Publishable key | `sb_publishable_9X2Gqin4kPoEKz9GL_txVQ_oE4SDq8g` (aman di browser) |
| Vercel | project `wibowo-supplier`, auto-deploy dari `main` |

Catatan kuota: org Supabase "Atharffndd" paket free = maks 2 project aktif (tiga-putra + Wibowowebsite). Project ke-3 butuh upgrade/pause.

---

## 2. Data bisnis

- **Kop nota:** "Wibowo Supplier" (settings.company_name = `Wibowo`, kop menambahkan " Supplier")
- **Alamat (2 baris):** "Wibowo Supplier = Jl Pertabatan 01, Nomor 09" / "Kios Wibowo = Pasar Wage, Pintu Timur Blok C"
- **HP:** 0877-3720-7969 · 0878-3720-7969
- **Rekening A.N. Sugi Hastuti:** BNI 1909444267 · BRI 007701022050531 · BCA 3580291936 · MANDIRI 1800013878311 · BSI 7137081436 · Seabank 901280257070
- **Cap + tanda tangan:** `public/ttd.png` (kotak biru "Kios Wibowo (Blok C-Pasar Wage, Purwokerto) 0878-3720-7969 / 0878-3720-7970" + paraf). Wajib di setiap nota & Surat Jalan.
- **Gudang:** Gudang 1-P (default), Gudang 2-R — dipilih per barang.
- **Nomor:** `INV/YYYY/MM/NNNN` (reset tiap bulan), `BM/…`, `RJ/…`, `RB/…`. PPN tidak dipakai.
- **Kendaraan Surat Jalan:** Mobil / Pick-up · B 2914 WFK, R 8287 AM, Z 9016 HB.
- **Data awal (Excel `Wibowo_Master.xlsx`, 5 Okt 2026):** 605 barang (satu satuan per barang, harga eceran = grosir = "Harga Standar"), 89 pelanggan (tipe eceran), supplier kosong.
  - 46 barang harganya `#NUM!` di Excel → diimpor dengan harga 0 (perlu diisi pemilik).
  - Nama dobel: "Baking Soda" (25.000 & 28.000 → kedua jadi "Baking Soda - 2"), "Lada Putih Bubuk" (110.000 & 185.000 → "Lada Putih Bubuk - 2"), "Bawang Putih Bubuk" kg & pcs → "Bawang Putih Bubuk (pcs)".

---

## 3. Keputusan pemilik (JANGAN diubah tanpa diminta)

1. **Nota & Surat Jalan tetap bisa dibuat walaupun stok 0.** Stok boleh minus; di form tampil peringatan **kuning** "stok kurang — tetap bisa disimpan". Tidak ada trigger stok tidak boleh minus.
2. **Laba ditulis kondisi riil:** nota yang dibuat saat belum ada HPP tercatat modal 0; begitu ada Barang Masuk/Stok awal, modal nota-nota itu otomatis diisi HPP terbaru (laba langsung terhitung).
3. **Tanpa login sama sekali** (policy `open_all`, `is_staff()` = true, Vercel SSO mati). Tidak ingin mengganti password.
4. **Data tidak pernah dihapus** (void/active/status batal). Query item `active = true`, mutasi `void = false`.
5. Gudang per barang; satu barang dari 2 gudang = 2 baris; nota cetak tanpa gudang, baris sama digabung.
6. Website ini terpisah total dari Tiga Putra.

---

## 4. Persiapan sesi baru
- Akun: Claude (claude.ai/code), GitHub (`Atharffndd`), Supabase (org "Atharffndd"), Vercel (`athaberdikari-1355`).
- Connector claude.ai: GitHub, Supabase, Vercel.
- Mulai: claude.ai/code → repo **Atharffndd/Wibowowebsite2ibu** → "Baca catatan.md dan CLAUDE.md. Lalu: …".
- Opsional: izinkan domain `notawibowosupplier.vercel.app` dan `taujhusvykjttgdippxj.supabase.co` di Network access environment agar Claude bisa mengecek langsung.

---

## 5. Arsitektur teknis

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4. Semua halaman *client component* (`"use client"`) yang memanggil Supabase langsung dari browser.
- **Library:** `@supabase/supabase-js`, `recharts` (grafik), `exceljs` (import/export Excel).
- **Backend:** Supabase Postgres. Logika transaksi ada di **fungsi Postgres (RPC)** agar atomik.
- **Hosting:** Vercel (auto-deploy dari `main`). Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (juga ada default di `lib/supabase.ts`).

### Struktur folder
```
app/
  layout.tsx            root (font Inter + JetBrains Mono)
  globals.css           tema (warna brand #0a5fe8), gaya tabel, CSS cetak (@media print, .no-print)
  login/page.tsx        redirect ke "/" (tidak ada login)
  (app)/layout.tsx      Shell (sidebar menu)
  (app)/page.tsx        Dashboard
  (app)/nota/           daftar, baru (?id= untuk ubah), [id] (detail/cetak/bayar/WA/batal)
  (app)/barang-masuk/   daftar, baru (?id= = koreksi), [id]
  (app)/retur/          daftar + modal (?sale= / ?purchase= untuk retur dari dokumen)
  (app)/barang/         daftar + modal edit + import/export Excel, [id] (stok, mutasi, riwayat harga)
  (app)/stok/           posisi stok per gudang, riwayat mutasi, stok awal/opname/transfer
  (app)/pelanggan/      daftar, [id] (riwayat, harga khusus)
  (app)/supplier/       daftar + riwayat pembelian
  (app)/piutang, hutang (komponen Outstanding), biaya, laporan, pengaturan
components/
  Shell.tsx             sidebar + AppProvider
  AppContext.tsx        settings + warehouses global (useApp())
  ItemsEditor.tsx       tabel input barang (gudang per baris, stok semua gudang, ProductSearch, addBack, itemsPayload)
  Invoice.tsx           tampilan nota (cetak) + gabung baris
  Payments.tsx, Outstanding.tsx, status.tsx, CustomerModal.tsx, BarChartRp.tsx, ui.tsx
lib/
  supabase.ts           client + fetchAll (lewati limit 1000 baris)
  hooks.ts              useAsync, loadProducts/Customers/Suppliers, loadStockAll
  types.ts, format.ts (rp, tanggal Indonesia), excel.ts
supabase/migrations/    0001,0002,0004,0005 (dari Tiga Putra) + 0006_wibowo_perbedaan + 0007_ketik_baru_sj_mandiri (diterapkan lewat MCP)
public/ttd.png          cap Kios Wibowo + tanda tangan
```

### Tabel database (schema `public`)
| Tabel | Isi penting |
|---|---|
| `settings` (1 baris, id=1) | company_name, address, phone, account_name, banks (jsonb `[{bank,number}]`), invoice_prefix, tax_enabled, tax_percent, footer_note, signature_url |
| `warehouses` | code, name, active |
| `categories` | name |
| `products` | sku, name, category_id, base_unit, **avg_cost** (HPP/satuan dasar), min_stock, active |
| `product_units` | product_id, unit, factor, price_retail, price_wholesale (trigger → `price_history`) |
| `customers` | name, price_type (tidak dipakai lagi, selalu grosir), phone, address, term_days |
| `customer_prices` | harga khusus per pelanggan/produk/satuan |
| `suppliers` | name, contact, phone, address, bank_info |
| `sales` / `sale_items` | header nota / item (`warehouse_id`, `cost_per_base` = HPP saat transaksi, `active`) |
| `purchases` / `purchase_items` | barang masuk / item (`warehouse_id`, `active`) |
| `returns` / `return_items` | retur (kind sale/purchase, `status`, item `warehouse_id`) |
| `payments` | pembayaran nota/barang masuk (trigger sinkron `paid_amount`) |
| `expenses` | biaya operasional |
| `stock_movements` | **sumber kebenaran stok**: product, warehouse, type, qty_base (+/-), unit_cost/unit_price, ref_type/ref_id, `void` |
| `doc_counters` | penomoran per prefix/tahun/bulan |
| `staff` | (tidak dipakai lagi sejak tanpa login) |

**View:** `v_stock` (stok per produk per gudang, non-void), `v_products` (produk + `stock_total`).
Tipe mutasi: `opening, purchase, sale, sale_return, purchase_return, adjust, transfer_in, transfer_out`.

### Fungsi Postgres (RPC)
| Fungsi | Guna |
|---|---|
| `resolve_new(p, kind)` | sale/purchase/return/delivery: cari/buat pelanggan, supplier & barang berdasar nama. Barang baru: satuan diketik, isi 1, harga jual = harga nota. Wibowo tidak memberi stok awal otomatis (`c_auto_stock = false`) |
| `save_sale_ex` / `save_purchase_ex` / `save_return_ex` | `resolve_new` + fungsi asli (dipakai UI) |
| `save_delivery_note(p jsonb)` | Surat Jalan tanpa nota, nomor otomatis `SJ/…`, tidak mengurangi stok |
| `save_sale(p jsonb)` | buat/ubah nota. `p.id` kosong = baru. Item: `{product_id,name,qty,unit,factor,price,warehouse_id}`. Juga `discount, shipping, tax_percent, paid_now, payment_method, due_date, notes, customer_id, customer_name, date` |
| `save_purchase(p jsonb)` | buat/koreksi barang masuk, lalu `recompute_avg_cost` |
| `cancel_document(kind, id)` | batal nota (`sale`) / barang masuk (`purchase`) |
| `save_return(p jsonb)` / `void_return(id)` | retur / batalkan retur |
| `save_adjustment(p jsonb)` | `type`: `opening` (stok awal + harga), `adjust` (opname, qty = selisih), `transfer` (`warehouse_id` → `to_warehouse_id`) |
| `recompute_avg_cost(product)` | putar ulang mutasi untuk HPP rata-rata tertimbang; **Wibowo:** item nota aktif dengan modal 0 ikut memakai HPP baru + `sales.cogs` dihitung ulang |
| `report_sales(from, to, group)` | group: day, month, product, category, customer, warehouse |
| `dashboard_stats()` | angka dashboard |
| `next_doc_number(prefix, date)` | nomor dokumen |
| `default_warehouse()` | gudang kode terkecil |

Ambil definisi terbaru: `select pg_get_functiondef('public.save_sale(jsonb)'::regprocedure);`

---

## 6. Cara kerja Claude di proyek ini (alur standar)

1. Baca `catatan.md` + `CLAUDE.md`. Jika permintaan ambigu → tanya dulu (pakai pilihan berganda, beri rekomendasi).
2. Cek data nyata bila soal bug: `execute_sql` (baca saja) ke project `taujhusvykjttgdippxj`.
3. Perubahan database: `apply_migration` **kecil-kecil** (satu atau beberapa fungsi per panggilan), lalu catat di `supabase/migrations/000N_*.sql`.
4. Uji di database tanpa menyimpan data:
   ```sql
   begin;
   set local role anon;
   set constraints all immediate;   -- agar trigger stok langsung dicek
   ... panggil save_sale / save_purchase dll ...
   select ... hasil ...;
   -- (tanpa commit; transaksi otomatis dibatalkan)
   ```
   Lalu pastikan data uji tidak tersimpan.
5. Frontend: `npx tsc --noEmit && npm run build` harus lulus.
6. Commit → push ke branch kerja → buat PR ke `main` → merge (pemilik sudah mengizinkan deploy langsung) → cek status deploy Vercel sampai `READY` dan alias `notatigaputra.vercel.app` terpasang.
7. Laporkan ke pemilik dalam Bahasa Indonesia: apa yang berubah, cara mencoba, dan apa yang belum bisa diverifikasi.
8. Perbarui `catatan.md` (bagian 9 & 11) dan `CLAUDE.md` bila ada keputusan baru.

---

## 7. Hal teknis yang perlu diingat (gotcha)

- **Supabase MCP menahan SQL berisi `delete`** (menunggu konfirmasi lalu timeout 60 detik). Karena itu desainnya memakai flag `void`/`active`, bukan delete. Hapus baris lewat REST dari aplikasi (mis. pembayaran, satuan) tetap berjalan.
- **Migrasi besar timeout** → pecah menjadi beberapa `apply_migration`.
- **Sandbox Claude tidak bisa membuka** `*.vercel.app` dan `*.supabase.co` (proxy 403), kecuali network environment diatur (bagian 4). Verifikasi lewat MCP Supabase & status deploy Vercel; tampilan dicek oleh pemilik.
- **`web_fetch_vercel_url` Vercel** mengembalikan 403 untuk akun ini; jangan diandalkan.
- **Vercel API** untuk project ini dipanggil **tanpa** `teamId` (dengan teamId → 403).
- Next.js 16: halaman yang memakai `useSearchParams` dibungkus `<Suspense>`; file `page.tsx` hanya boleh export default (komponen bersama taruh di `components/`).
- Batas 1000 baris PostgREST → gunakan `fetchAll`.
- **Tidak ada pengaman stok minus** di Wibowo (beda dengan Tiga Putra). Jangan pasang trigger `stock_nonnegative` tanpa diminta.
- Pemilik bisa sedang memakai website saat Claude bekerja → **cek ulang data terbaru sebelum memperbaiki data**.
- Perbaikan data dilakukan lewat fungsi resmi (`save_purchase`, `save_sale`, `save_adjustment`) agar HPP & stok konsisten — bukan UPDATE langsung ke mutasi.

- Cetak: `@page { margin: 0 }` + padding 12mm di `.print-area` agar browser tidak mencetak header/footer (URL, tanggal, nomor halaman). Jangan kembalikan margin @page. PDF memotong halaman di `tbody tr`, `.pdf-keep`, `.sj-sign`; tabel barang wajib class `items-table`.

---

## 8. Riwayat
- 5 Okt 2026 — Website dibuat dari Nota Tiga Putra (setelah fitur Surat Jalan, PR #7 di repo Tiga Putra). Perbedaan: stok boleh minus, laba menyusul, data Wibowo.

---

- 5 Okt 2026 — Tampilan ramah iPad (sama dengan PR #8 Tiga Putra): menu ☰ di bawah 1024px, isian barang berbentuk kartu, bar Simpan bawah, kolom isian 16px/44px untuk layar sentuh.
- 5 Okt 2026 — WhatsApp Nota & Surat Jalan kirim file PDF (menu Bagikan), Unduh PDF langsung, hapus header/footer cetak & baris "Nota: …" di Surat Jalan (sama dengan PR #9 Tiga Putra).
- 5 Okt 2026 — Cap & paraf digambar langsung ke kanvas PDF (hilang di Safari iPad).
- 7 Okt 2026 — Opsi grosir/eceran dihapus (1 harga jual); pelanggan/supplier/barang baru bisa diketik langsung; setelah pilih barang kursor ke Jumlah → Enter Harga → Enter cari barang; Surat Jalan tanpa nota. (Sama dengan PR #12 Tiga Putra.)

---

## 9. Masalah terbuka
- 46 barang berharga 0 (dari `#NUM!` di Excel) — perlu diisi harga di menu Barang & Harga.
- Barang dobel ("- 2" / "(pcs)") — pemilik perlu konfirmasi: gabung, ganti nama, atau nonaktifkan.
- Supplier belum diisi.
