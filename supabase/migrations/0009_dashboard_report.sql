-- 0009: data untuk dashboard performa penjualan (filter tanggal + satu pelanggan opsional)
create or replace function public.dashboard_report(p_from date, p_to date, p_customer uuid default null)
returns jsonb language sql stable set search_path = public as $$
with s as (
  select * from sales where status = 'aktif' and date between p_from and p_to and (p_customer is null or customer_id = p_customer)
), i as (
  select si.id, si.sale_id, si.product_id, si.name, si.qty, si.unit, si.price, si.subtotal, si.factor,
         coalesce(nullif(si.cost_per_base, 0), p.avg_cost, 0) as cost_base
  from sale_items si join s on s.id = si.sale_id join products p on p.id = si.product_id
  where si.active
), by_prod as (
  select i.product_id, i.unit, max(i.name) as name, sum(i.qty) as qty, sum(i.subtotal) as omzet, count(distinct i.sale_id) as nota
  from i group by i.product_id, i.unit
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'nota', (select count(*) from s),
    'pelanggan', (select count(distinct coalesce(customer_id::text, customer_name)) from s),
    'omzet', (select coalesce(sum(total), 0) from s),
    'rata_rata', (select coalesce(round(avg(total)), 0) from s),
    'baris_item', (select count(*) from i),
    'jenis_barang', (select count(distinct product_id) from i),
    'hpp', (select coalesce(sum(round(qty * factor * cost_base, 2)), 0) from i)
  ),
  'daily', coalesce((select jsonb_agg(jsonb_build_object('date', d.date, 'nota', d.nota, 'total', d.total) order by d.date)
                     from (select date, count(*) as nota, sum(total) as total from s group by date) d), '[]'::jsonb),
  'top_qty', coalesce((select jsonb_agg(t) from (select product_id, name, unit, qty, omzet, nota from by_prod order by qty desc, omzet desc limit 10) t), '[]'::jsonb),
  'top_omzet', coalesce((select jsonb_agg(t) from (select product_id, name, unit, qty, omzet, nota from by_prod order by omzet desc limit 10) t), '[]'::jsonb),
  'top_customers', coalesce((select jsonb_agg(t) from (
      select max(customer_name) as name, count(*) as nota, sum(total) as omzet from s group by coalesce(customer_id::text, customer_name) order by sum(total) desc limit 10) t), '[]'::jsonb),
  'kualitas', jsonb_build_object(
    'baris_item', (select count(*) from i),
    'tanpa_harga_beli', (select count(*) from i where cost_base = 0),
    'harga_nol', (select count(*) from i where price = 0),
    'nota_tanpa_pelanggan', (select count(*) from s where customer_id is null)
  )
)
$$;
grant execute on function public.dashboard_report(date, date, uuid) to anon, authenticated;
