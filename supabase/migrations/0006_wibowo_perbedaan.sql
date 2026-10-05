-- Nota Wibowo Supplier — perbedaan dari Nota Tiga Putra (sudah diterapkan ke project Supabase "Wibowowebsite").
-- Skema = Tiga Putra (0001, 0002, 0004, 0005) TANPA 0003 (stok gudang boleh minus; nota tetap bisa dibuat saat stok 0).
--
-- recompute_avg_cost(product): setelah menghitung HPP rata-rata tertimbang, item nota aktif yang modalnya masih 0
-- (dibuat saat belum ada barang masuk) ikut memakai HPP terbaru, lalu sales.cogs dihitung ulang
-- => laba di laporan langsung terhitung begitu ada Barang Masuk / Stok awal.
create or replace function public.recompute_avg_cost(p_product uuid)
returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare
  r record;
  v_stock numeric := 0;
  v_avg numeric := 0;
  v_sales uuid[];
begin
  for r in
    select qty_base, unit_cost, type from stock_movements
    where product_id = p_product and not void
    order by date, id
  loop
    if r.qty_base > 0 and r.unit_cost is not null and r.type in ('opening','purchase','adjust') then
      if v_stock <= 0 then v_avg := r.unit_cost;
      else v_avg := (v_stock * v_avg + r.qty_base * r.unit_cost) / (v_stock + r.qty_base);
      end if;
    end if;
    v_stock := v_stock + r.qty_base;
  end loop;
  update products set avg_cost = round(v_avg, 4), updated_at = now() where id = p_product;
  if v_avg > 0 then
    with upd as (
      update sale_items set cost_per_base = round(v_avg, 4)
      where product_id = p_product and active and cost_per_base = 0
      returning sale_id
    ) select array_agg(distinct sale_id) into v_sales from upd;
    if v_sales is not null then
      update sales s set cogs = coalesce((select round(sum(i.qty * i.factor * i.cost_per_base), 2) from sale_items i where i.sale_id = s.id and i.active), 0)
      where s.id = any(v_sales);
    end if;
  end if;
  return v_avg;
end $function$;
