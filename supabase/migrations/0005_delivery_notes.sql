-- 0005: (sudah diterapkan) Surat Jalan, terhubung ke nota sumber.
-- Barang TIDAK disalin: selalu dibaca dari sale_items aktif nota sumber (sama persis dengan nota).
create table if not exists public.delivery_notes (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  number text not null,                 -- default = nomor nota, bisa diubah
  date date not null default current_date,
  recipient_name text not null,
  recipient_address text,
  vehicle_type text,                    -- Mobil / Pick-up
  vehicle_number text,                  -- B 2914 WFK / R 8287 AM / Z 9016 HB
  notes text,
  status text not null default 'aktif' check (status in ('aktif','batal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists delivery_notes_sale_idx on public.delivery_notes (sale_id);
alter table public.delivery_notes enable row level security;
create policy open_all on public.delivery_notes for all to anon, authenticated using (true) with check (true);
grant select, insert, update on public.delivery_notes to anon, authenticated;
