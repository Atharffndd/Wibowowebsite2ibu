# Wibowo Supplier — Sistem Nota, Stok & Penjualan

Aplikasi web internal untuk Wibowo Supplier: nota penjualan, barang masuk, stok 2 gudang, piutang/hutang, retur, biaya, dan laporan.

**Teknologi:** Next.js 16 + Tailwind 4 (hosting Vercel), Supabase (database Postgres + login).

## Fitur
- **Barang & harga**: banyak satuan per barang (dus, pcs, kg, …) dengan konversi, harga eceran & grosir, riwayat perubahan harga, import/export Excel.
- **Stok**: Gudang 1-P dan Gudang 2-R. Mutasi barang masuk/keluar lengkap dengan harga, stok awal, stok opname, transfer antar gudang, peringatan stok minimal. HPP dihitung dengan **rata-rata tertimbang**.
- **Nota penjualan**: nomor otomatis `INV/2026/10/0001` (urut per bulan), harga otomatis (harga khusus pelanggan → harga grosir/eceran, dengan petunjuk harga terakhir), diskon, ongkir, PPN opsional, cetak/PDF dengan TTD & paraf, kirim ke WhatsApp, ubah/batalkan.
- **Barang masuk**: pembelian dari supplier beserta harga beli, ongkir, diskon, hutang.
- **Pelanggan & supplier**: kontak, tipe harga, tempo, harga khusus, riwayat transaksi.
- **Piutang & hutang**: cicilan/pelunasan, jatuh tempo, daftar lewat tempo.
- **Retur** penjualan & pembelian (stok dan saldo otomatis menyesuaikan).
- **Biaya operasional** untuk menghitung laba bersih.
- **Laporan**: penjualan, HPP, laba kotor/bersih per hari, bulan, barang, kategori, pelanggan, gudang, plus export Excel.

## Setup
Website **tanpa login** (permintaan pemilik): siapa pun yang tahu alamat https://notawibowosupplier.vercel.app bisa membuka dan mengubah data.

### 1. Supabase (project `Wibowowebsite`)
Semua tabel, fungsi, dan data awal sudah terpasang (`supabase/migrations/`). Tidak ada langkah manual.

### 2. Vercel
Environment variables (sudah ada nilai default di kode, jadi opsional):
```
NEXT_PUBLIC_SUPABASE_URL=https://taujhusvykjttgdippxj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_9X2Gqin4kPoEKz9GL_txVQ_oE4SDq8g
```

### 3. Lokal (opsional)
```bash
npm install
npm run dev   # http://localhost:3000
```

## Struktur
- `app/(app)/*`: halaman aplikasi (dashboard, nota, barang-masuk, stok, …)
- `components/`: UI, nota (`Invoice.tsx`), editor barang, pembayaran
- `supabase/migrations/0001_init.sql`: skema lengkap (referensi / instalasi baru)
- `public/ttd.png`: TTD & paraf bawaan di nota (bisa diganti di Pengaturan)
