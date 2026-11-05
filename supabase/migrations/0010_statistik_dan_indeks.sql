-- 0010: penjumlahan omzet/piutang/hutang per pelanggan & supplier dihitung di database
-- (sebelumnya semua nota diunduh ke browser), plus indeks untuk relasi yang sering dipakai.
-- Hanya menambah; tidak mengubah atau menghapus data.

create or replace function public.customer_stats()
returns table(customer_id uuid, omzet numeric, piutang numeric, cnt integer)
language sql stable set search_path = public as $$
  select s.customer_id,
         sum(s.total),
         sum(greatest(s.total - s.paid_amount - s.return_amount, 0)),
         count(*)::integer
  from sales s
  where s.status = 'aktif' and s.customer_id is not null
  group by s.customer_id
$$;

create or replace function public.supplier_stats()
returns table(supplier_id uuid, total numeric, hutang numeric, last_date date)
language sql stable set search_path = public as $$
  select p.supplier_id,
         sum(p.total),
         sum(greatest(p.total - p.paid_amount - p.return_amount, 0)),
         max(p.date)
  from purchases p
  where p.status = 'aktif' and p.supplier_id is not null
  group by p.supplier_id
$$;

grant execute on function public.customer_stats() to anon, authenticated;
grant execute on function public.supplier_stats() to anon, authenticated;

create index if not exists sale_items_sale_idx on public.sale_items (sale_id);
create index if not exists purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index if not exists payments_sale_idx on public.payments (sale_id);
create index if not exists payments_purchase_idx on public.payments (purchase_id);
create index if not exists purchases_supplier_idx on public.purchases (supplier_id);
create index if not exists return_items_return_idx on public.return_items (return_id);
