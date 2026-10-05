-- 0002: (sudah diterapkan ke project tiga-putra)
-- 1) Mutasi stok tidak pernah dihapus: nota/barang masuk yang diubah atau dibatalkan
--    ditandai void/active=false (jejak audit tetap lengkap).
-- 2) Website tanpa login (permintaan pemilik): semua tabel dapat diakses role anon.

alter table public.stock_movements add column if not exists void boolean not null default false;
alter table public.sale_items add column if not exists active boolean not null default true;
alter table public.purchase_items add column if not exists active boolean not null default true;
alter table public.returns add column if not exists status text not null default 'aktif';
alter table public.return_items add column if not exists active boolean not null default true;

-- v_stock / v_products: hanya mutasi yang tidak void
create or replace view public.v_stock with (security_invoker = true) as
select p.id as product_id, w.id as warehouse_id, coalesce(sum(m.qty_base), 0)::numeric(18,3) as qty
from public.products p cross join public.warehouses w
left join public.stock_movements m on m.product_id = p.id and m.warehouse_id = w.id and not m.void
group by p.id, w.id;

create or replace view public.v_products with (security_invoker = true) as
select p.*, c.name as category_name,
  coalesce((select sum(m.qty_base) from public.stock_movements m where m.product_id = p.id and not m.void), 0)::numeric(18,3) as stock_total
from public.products p left join public.categories c on c.id = p.category_id;

-- Fungsi yang diperbarui (lihat database untuk definisi lengkap):
--   recompute_avg_cost  : abaikan mutasi void
--   save_sale/save_purchase : saat ubah -> item lama active=false, mutasi lama void=true
--   cancel_document     : status batal + mutasi void
--   void_return         : batalkan retur (pengganti delete_return)
--   report_sales        : hanya item active

-- Akses terbuka tanpa login
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$ select true; $$;
do $$
declare t text;
begin
  foreach t in array array['settings','warehouses','categories','products','product_units','price_history',
    'suppliers','customers','customer_prices','doc_counters','purchases','purchase_items','sales','sale_items',
    'returns','return_items','payments','expenses','stock_movements']
  loop
    execute format('create policy open_all on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
create policy "branding open write" on storage.objects for all to anon, authenticated
  using (bucket_id = 'branding') with check (bucket_id = 'branding');
update public.settings set account_name = 'Muhammad Rizqy' where id = 1;
