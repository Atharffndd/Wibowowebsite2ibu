-- 0004: (sudah diterapkan) gudang per barang di nota, barang masuk, dan retur.
alter table public.sale_items add column if not exists warehouse_id uuid references public.warehouses(id);
alter table public.purchase_items add column if not exists warehouse_id uuid references public.warehouses(id);
alter table public.return_items add column if not exists warehouse_id uuid references public.warehouses(id);
update public.sale_items i set warehouse_id = s.warehouse_id from public.sales s where s.id = i.sale_id and i.warehouse_id is null;
update public.purchase_items i set warehouse_id = p.warehouse_id from public.purchases p where p.id = i.purchase_id and i.warehouse_id is null;
update public.return_items i set warehouse_id = r.warehouse_id from public.returns r where r.id = i.return_id and i.warehouse_id is null;

create or replace function public.default_warehouse()
returns uuid language sql stable set search_path = public as $$
  select id from warehouses where active order by code limit 1;
$$;

-- save_sale / save_purchase / save_return: gudang tiap item = items[].warehouse_id,
--   fallback ke warehouse_id header -> gudang item pertama -> default_warehouse().
--   Kolom warehouse_id di header tetap diisi (gudang item pertama) untuk kompatibilitas.
-- report_sales: grup 'warehouse' memakai coalesce(sale_items.warehouse_id, sales.warehouse_id).
-- (Definisi lengkap ada di database; ambil dengan pg_get_functiondef.)
