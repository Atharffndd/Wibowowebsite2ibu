-- Perapian data lama (jalankan sekali, dalam transaksi). Cadangan nilai asli ada di schema bak_units.
create schema if not exists bak_units;
do $$
declare r record;
begin
  for r in select * from (values
    ('products','id','base_unit'),('product_units','id','unit'),('price_history','id','unit'),('customer_prices','id','unit'),
    ('sale_items','id','unit'),('purchase_items','id','unit'),('return_items','id','unit'),('delivery_note_items','id','unit')
  ) v(t, k, c) where to_regclass('public.' || v.t) is not null
  loop
    execute format('drop table if exists bak_units.%I', r.t);
    execute format('create table bak_units.%I as select %I::text as id, %I as nilai_asli from public.%I', r.t, r.k, r.c, r.t);
  end loop;
  drop table if exists bak_units.product_units_full;
  create table bak_units.product_units_full as select * from public.product_units;
end $$;

-- 1) Gabungkan baris product_units yang jadi kembar setelah dirapikan, HANYA bila faktor konversinya sama.
--    Yang dipertahankan: baris satuan dasar barang (daftar harga induk); jika bukan, yang terakhir dipakai di nota.
with n as (
  select pu.id, pu.product_id, public.norm_unit(pu.unit) as canon, pu.factor,
         (pu.unit = p.base_unit) as is_base,
         (select max(s.date) from public.sale_items si join public.sales s on s.id = si.sale_id
            where si.product_id = pu.product_id and si.unit = pu.unit) as last_used
  from public.product_units pu join public.products p on p.id = pu.product_id
), g as (
  select product_id, canon from n group by 1, 2 having count(*) > 1 and count(distinct factor) = 1
), ranked as (
  select n.id, row_number() over (partition by n.product_id, n.canon order by n.is_base desc, n.last_used desc nulls last, n.id) as rn
  from n join g using (product_id, canon)
)
delete from public.product_units where id in (select id from ranked where rn > 1);

-- 2) Rapikan satuan (lewati baris yang masih bentrok karena faktor berbeda; dilaporkan terpisah)
update public.product_units pu set unit = public.norm_unit(pu.unit)
where pu.unit <> public.norm_unit(pu.unit)
  and not exists (select 1 from public.product_units o where o.product_id = pu.product_id and o.id <> pu.id and public.norm_unit(o.unit) = public.norm_unit(pu.unit));
update public.customer_prices cp set unit = public.norm_unit(cp.unit)
where cp.unit <> public.norm_unit(cp.unit)
  and not exists (select 1 from public.customer_prices o where o.customer_id = cp.customer_id and o.product_id = cp.product_id and o.id <> cp.id and public.norm_unit(o.unit) = public.norm_unit(cp.unit));
update public.products set base_unit = public.norm_unit(base_unit) where base_unit <> public.norm_unit(base_unit);
update public.price_history set unit = public.norm_unit(unit) where unit <> public.norm_unit(unit);
update public.sale_items set unit = public.norm_unit(unit) where unit <> public.norm_unit(unit);
update public.purchase_items set unit = public.norm_unit(unit) where unit <> public.norm_unit(unit);
update public.return_items set unit = public.norm_unit(unit) where unit <> public.norm_unit(unit);
update public.delivery_note_items set unit = public.norm_unit(unit) where unit <> public.norm_unit(unit);
