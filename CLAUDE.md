# Nota Wibowo Supplier

Nama proyek: **Nota Wibowo Supplier** (saudara dari "Nota Tiga Putra" — sistem sama persis, data & database terpisah).
Bahasa tampilan & komunikasi dengan pemilik: **Bahasa Indonesia**. Mata uang Rupiah.

**Baca juga `catatan.md`** — catatan lengkap (persiapan sesi, arsitektur, database, alur kerja, riwayat, masalah terbuka). Perbarui setiap ada keputusan/perubahan baru.

## Lokasi & akun
- Live: https://notawibowosupplier.vercel.app (Vercel project `wibowo-supplier`, deploy otomatis dari branch `main`)
- Repo: github.com/Atharffndd/Wibowowebsite2ibu
- Supabase project **`Wibowowebsite`** (id `taujhusvykjttgdippxj`, region ap-southeast-1, org "Atharffndd", paket free). JANGAN tertukar dengan Tiga Putra (`frphemxcondxdbcbnjnh`).
- Perubahan database lewat Supabase MCP (`apply_migration`) dan dicatat di `supabase/migrations/`.

## Data bisnis
- Kop: **Wibowo Supplier** — "Wibowo Supplier = Jl Pertabatan 01, Nomor 09" / "Kios Wibowo = Pasar Wage, Pintu Timur Blok C" — HP 0877-3720-7969 · 0878-3720-7969
- Rekening A.N. **Sugi Hastuti**: BNI 1909444267, BRI 007701022050531, BCA 3580291936, MANDIRI 1800013878311, BSI 7137081436, Seabank 901280257070
- Cap + tanda tangan: `public/ttd.png` (kotak biru "Kios Wibowo" + paraf) — **wajib tampil di setiap nota & Surat Jalan** (bisa diganti di Pengaturan).
- Gudang **Gudang 1-P** & **Gudang 2-R**, dipilih per barang (default 1-P). Nota cetak tidak menampilkan gudang & menggabungkan baris sama.
- Nomor nota `INV/YYYY/MM/NNNN` (reset tiap bulan). PPN tidak dipakai. HPP rata-rata tertimbang.
- Surat Jalan dari nota atau **tanpa nota** (`delivery_note_items`, nomor `SJ/YYYY/MM/NNNN`, tidak mengurangi stok); kendaraan Mobil/Pick-up; B 2914 WFK / R 8287 AM / Z 9016 HB.
- **Satu "Harga jual" per satuan** (opsi grosir/eceran dihapus; `price_retail` = `price_wholesale`).
- **Ketik baru:** pelanggan/supplier/barang belum terdaftar boleh diketik langsung di Nota, Barang Masuk, Retur & Surat Jalan tanpa nota; tersimpan otomatis saat disimpan (`resolve_new`, `c_auto_stock = false` karena stok boleh minus).
- Data awal: 605 barang & 89 pelanggan dari Excel pemilik; supplier masih kosong.

## Keputusan pemilik (jangan diubah tanpa diminta)
- **Nota & Surat Jalan tetap bisa dibuat walaupun stok 0** — stok boleh minus (tanda kuning), dirapikan nanti lewat Barang Masuk / Stok awal / opname. Tidak ada trigger `stock_nonnegative` (beda dengan Tiga Putra).
- **Laba tetap ditulis kondisi riil**: nota yang dibuat saat HPP masih 0 otomatis memakai HPP begitu ada Barang Masuk (`recompute_avg_cost`, migrasi 0006).
- **Tanpa login** (policy `open_all` untuk `anon`, `is_staff()` = true, Vercel SSO mati). Tidak ingin mengganti password apa pun.
- Data tidak pernah dihapus: ubah/batal = `void` / `active=false` / `status='batal'`. Query item wajib `active = true`, mutasi wajib `void = false`.

## Teknis
- Next.js 16 + Tailwind 4 + `@supabase/supabase-js`, recharts, exceljs. Semua halaman client component.
- Fungsi Postgres: `save_sale`, `save_purchase`, `cancel_document`, `save_return`, `void_return`, `save_adjustment`, `recompute_avg_cost`, `report_sales`, `dashboard_stats`, `next_doc_number`, `default_warehouse`, `resolve_new`, `save_delivery_note`; UI memanggil `save_sale_ex` / `save_purchase_ex` / `save_return_ex` (= `resolve_new` + fungsi asli).
- Cek sebelum push: `npx tsc --noEmit && npm run build`. Sandbox Claude tidak bisa membuka vercel.app/supabase.co; verifikasi DB lewat MCP `execute_sql` dalam transaksi tanpa commit.
- Perubahan fitur yang juga relevan untuk Tiga Putra sebaiknya ditawarkan ke repo `Atharffndd/Wibowowebsite` juga.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
