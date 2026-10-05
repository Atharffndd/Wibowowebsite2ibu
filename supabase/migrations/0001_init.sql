-- Tiga Putra Supplier — skema awal
-- Semua uang dalam Rupiah (numeric 18,2), kuantitas numeric 18,3.

create extension if not exists pgcrypto;

-- =========================================================
-- STAFF (allowlist pengguna internal)
-- =========================================================
create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- =========================================================
-- PENGATURAN
-- =========================================================
create table public.settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'Tiga Putra',
  address text not null default '',
  phone text not null default '',
  account_name text not null default '',
  banks jsonb not null default '[]'::jsonb,
  invoice_prefix text not null default 'INV',
  tax_enabled boolean not null default false,
  tax_percent numeric(5,2) not null default 0,
  footer_note text not null default '',
  signature_url text,
  show_signature boolean not null default true,
  updated_at timestamptz not null default now()
);

-- =========================================================
-- MASTER DATA
-- =========================================================
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  base_unit text not null default 'pcs',
  avg_cost numeric(18,4) not null default 0,   -- HPP rata-rata tertimbang per satuan dasar
  min_stock numeric(18,3) not null default 0,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products (lower(name));

-- Satuan & harga per satuan (satuan dasar selalu factor = 1)
create table public.product_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  unit text not null,
  factor numeric(18,4) not null default 1 check (factor > 0),  -- 1 unit ini = factor x satuan dasar
  price_retail numeric(18,2) not null default 0,               -- harga eceran
  price_wholesale numeric(18,2) not null default 0,            -- harga grosir
  unique (product_id, unit)
);

create table public.price_history (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  unit text not null,
  price_retail numeric(18,2),
  price_wholesale numeric(18,2),
  changed_at timestamptz not null default now(),
  changed_by uuid default auth.uid()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  address text,
  bank_info text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_type text not null default 'eceran' check (price_type in ('eceran','grosir')),
  phone text,
  address text,
  term_days int not null default 0,   -- tempo default (hari)
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Harga khusus per pelanggan
create table public.customer_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit text not null,
  price numeric(18,2) not null,
  updated_at timestamptz not null default now(),
  unique (customer_id, product_id, unit)
);

-- =========================================================
-- PENOMORAN DOKUMEN
-- =========================================================
create table public.doc_counters (
  key text primary key,
  last_no int not null default 0
);

create or replace function public.next_doc_number(p_prefix text, p_date date)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  k text := p_prefix || '/' || to_char(p_date, 'YYYY') || '/' || to_char(p_date, 'MM');
  n int;
begin
  insert into doc_counters (key, last_no) values (k, 1)
  on conflict (key) do update set last_no = doc_counters.last_no + 1
  returning last_no into n;
  return k || '/' || lpad(n::text, 4, '0');
end $$;

-- =========================================================
-- TRANSAKSI
-- =========================================================
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  date date not null default current_date,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  supplier_ref text,                        -- no. faktur dari supplier
  warehouse_id uuid not null references public.warehouses(id),
  subtotal numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  shipping numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  paid_amount numeric(18,2) not null default 0,
  return_amount numeric(18,2) not null default 0,
  due_date date,
  status text not null default 'aktif' check (status in ('aktif','batal')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  name text not null,
  qty numeric(18,3) not null,
  unit text not null,
  factor numeric(18,4) not null default 1,
  price numeric(18,2) not null,            -- harga beli per unit
  subtotal numeric(18,2) not null
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  date date not null default current_date,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  warehouse_id uuid not null references public.warehouses(id),
  subtotal numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  shipping numeric(18,2) not null default 0,
  tax_percent numeric(5,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  cogs numeric(18,2) not null default 0,
  paid_amount numeric(18,2) not null default 0,
  return_amount numeric(18,2) not null default 0,
  due_date date,
  status text not null default 'aktif' check (status in ('aktif','batal')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.sales (date);
create index on public.sales (customer_id);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  name text not null,
  qty numeric(18,3) not null,
  unit text not null,
  factor numeric(18,4) not null default 1,
  price numeric(18,2) not null,            -- harga jual per unit
  subtotal numeric(18,2) not null,
  cost_per_base numeric(18,4) not null default 0  -- HPP saat transaksi
);
create index on public.sale_items (product_id);

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  kind text not null check (kind in ('sale','purchase')),
  date date not null default current_date,
  sale_id uuid references public.sales(id) on delete set null,
  purchase_id uuid references public.purchases(id) on delete set null,
  party_name text,
  warehouse_id uuid not null references public.warehouses(id),
  total numeric(18,2) not null default 0,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns(id) on delete cascade,
  product_id uuid not null references public.products(id),
  name text not null,
  qty numeric(18,3) not null,
  unit text not null,
  factor numeric(18,4) not null default 1,
  price numeric(18,2) not null,
  subtotal numeric(18,2) not null
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sale','purchase')),
  sale_id uuid references public.sales(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete cascade,
  date date not null default current_date,
  amount numeric(18,2) not null check (amount > 0),
  method text not null default 'transfer',
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category text not null default 'Operasional',
  amount numeric(18,2) not null check (amount >= 0),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Semua mutasi stok (qty_base dalam satuan dasar; + masuk, - keluar)
create table public.stock_movements (
  id bigserial primary key,
  date date not null default current_date,
  product_id uuid not null references public.products(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id),
  type text not null check (type in ('opening','purchase','sale','sale_return','purchase_return','adjust','transfer_in','transfer_out')),
  qty_base numeric(18,3) not null,
  unit_cost numeric(18,4),                 -- harga beli per satuan dasar (untuk barang masuk)
  unit_price numeric(18,4),                -- harga jual per satuan dasar (untuk barang keluar)
  ref_type text,
  ref_id uuid,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.stock_movements (product_id, warehouse_id);
create index on public.stock_movements (ref_type, ref_id);
create index on public.stock_movements (date);

-- =========================================================
-- VIEWS
-- =========================================================
create view public.v_stock with (security_invoker = true) as
select p.id as product_id, w.id as warehouse_id,
       coalesce(sum(m.qty_base), 0)::numeric(18,3) as qty
from public.products p
cross join public.warehouses w
left join public.stock_movements m on m.product_id = p.id and m.warehouse_id = w.id
group by p.id, w.id;

create view public.v_products with (security_invoker = true) as
select p.*, c.name as category_name,
  coalesce((select sum(m.qty_base) from public.stock_movements m where m.product_id = p.id), 0)::numeric(18,3) as stock_total
from public.products p
left join public.categories c on c.id = p.category_id;

-- =========================================================
-- FUNGSI BISNIS
-- =========================================================

-- Hitung ulang HPP rata-rata tertimbang dengan memutar ulang seluruh mutasi
create or replace function public.recompute_avg_cost(p_product uuid)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_stock numeric := 0;
  v_avg numeric := 0;
begin
  for r in
    select qty_base, unit_cost, type from stock_movements
    where product_id = p_product
    order by date, id
  loop
    if r.qty_base > 0 and r.unit_cost is not null and r.type in ('opening','purchase','adjust') then
      if v_stock <= 0 then
        v_avg := r.unit_cost;
      else
        v_avg := (v_stock * v_avg + r.qty_base * r.unit_cost) / (v_stock + r.qty_base);
      end if;
    end if;
    v_stock := v_stock + r.qty_base;
  end loop;
  update products set avg_cost = round(v_avg, 4), updated_at = now() where id = p_product;
  return v_avg;
end $$;

-- Simpan / ubah NOTA penjualan
create or replace function public.save_sale(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := nullif(p->>'id','')::uuid;
  v_date date := coalesce((p->>'date')::date, current_date);
  v_wh uuid := (p->>'warehouse_id')::uuid;
  v_prefix text;
  it jsonb;
  v_sub numeric := 0;
  v_cogs numeric := 0;
  v_cost numeric;
  v_qty numeric; v_factor numeric; v_price numeric; v_line numeric;
  v_disc numeric := coalesce((p->>'discount')::numeric, 0);
  v_ship numeric := coalesce((p->>'shipping')::numeric, 0);
  v_taxp numeric := coalesce((p->>'tax_percent')::numeric, 0);
  v_tax numeric;
  v_paid numeric := coalesce((p->>'paid_now')::numeric, 0);
begin
  if not is_staff() then raise exception 'Tidak diizinkan'; end if;
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then
    raise exception 'Nota harus berisi minimal 1 barang';
  end if;

  if v_id is null then
    select invoice_prefix into v_prefix from settings where id = 1;
    insert into sales (number, date, customer_id, customer_name, warehouse_id, due_date, notes)
    values (next_doc_number(coalesce(v_prefix,'INV'), v_date), v_date,
            nullif(p->>'customer_id','')::uuid, coalesce(p->>'customer_name','Umum'),
            v_wh, nullif(p->>'due_date','')::date, p->>'notes')
    returning id into v_id;
  else
    if not exists (select 1 from sales where id = v_id and status = 'aktif') then
      raise exception 'Nota tidak ditemukan atau sudah dibatalkan';
    end if;
    delete from sale_items where sale_id = v_id;
    delete from stock_movements where ref_type = 'sale' and ref_id = v_id;
    update sales set date = v_date, customer_id = nullif(p->>'customer_id','')::uuid,
      customer_name = coalesce(p->>'customer_name','Umum'), warehouse_id = v_wh,
      due_date = nullif(p->>'due_date','')::date, notes = p->>'notes', updated_at = now()
    where id = v_id;
  end if;

  for it in select * from jsonb_array_elements(p->'items') loop
    v_qty := (it->>'qty')::numeric;
    v_factor := coalesce((it->>'factor')::numeric, 1);
    v_price := (it->>'price')::numeric;
    v_line := round(v_qty * v_price, 2);
    select avg_cost into v_cost from products where id = (it->>'product_id')::uuid;
    insert into sale_items (sale_id, product_id, name, qty, unit, factor, price, subtotal, cost_per_base)
    values (v_id, (it->>'product_id')::uuid, it->>'name', v_qty, it->>'unit', v_factor, v_price, v_line, coalesce(v_cost,0));
    insert into stock_movements (date, product_id, warehouse_id, type, qty_base, unit_price, ref_type, ref_id)
    values (v_date, (it->>'product_id')::uuid, v_wh, 'sale', -(v_qty * v_factor), v_price / v_factor, 'sale', v_id);
    v_sub := v_sub + v_line;
    v_cogs := v_cogs + v_qty * v_factor * coalesce(v_cost, 0);
  end loop;

  v_tax := round((v_sub - v_disc) * v_taxp / 100, 0);
  update sales set subtotal = v_sub, discount = v_disc, shipping = v_ship, tax_percent = v_taxp,
    tax_amount = v_tax, total = v_sub - v_disc + v_tax + v_ship, cogs = round(v_cogs, 2)
  where id = v_id;

  if v_paid > 0 then
    insert into payments (kind, sale_id, date, amount, method)
    values ('sale', v_id, v_date, v_paid, coalesce(p->>'payment_method','tunai'));
  end if;
  return v_id;
end $$;

-- Simpan / ubah BARANG MASUK (pembelian)
create or replace function public.save_purchase(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := nullif(p->>'id','')::uuid;
  v_date date := coalesce((p->>'date')::date, current_date);
  v_wh uuid := (p->>'warehouse_id')::uuid;
  it jsonb;
  v_sub numeric := 0;
  v_qty numeric; v_factor numeric; v_price numeric; v_line numeric;
  v_disc numeric := coalesce((p->>'discount')::numeric, 0);
  v_ship numeric := coalesce((p->>'shipping')::numeric, 0);
  v_paid numeric := coalesce((p->>'paid_now')::numeric, 0);
  v_products uuid[] := '{}';
  v_old uuid[];
  pid uuid;
begin
  if not is_staff() then raise exception 'Tidak diizinkan'; end if;
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then
    raise exception 'Minimal 1 barang';
  end if;

  if v_id is null then
    insert into purchases (number, date, supplier_id, supplier_name, supplier_ref, warehouse_id, due_date, notes)
    values (next_doc_number('BM', v_date), v_date, nullif(p->>'supplier_id','')::uuid, p->>'supplier_name',
            p->>'supplier_ref', v_wh, nullif(p->>'due_date','')::date, p->>'notes')
    returning id into v_id;
  else
    if not exists (select 1 from purchases where id = v_id and status = 'aktif') then
      raise exception 'Data tidak ditemukan atau sudah dibatalkan';
    end if;
    select array_agg(distinct product_id) into v_old from purchase_items where purchase_id = v_id;
    v_products := coalesce(v_old, '{}');
    delete from purchase_items where purchase_id = v_id;
    delete from stock_movements where ref_type = 'purchase' and ref_id = v_id;
    update purchases set date = v_date, supplier_id = nullif(p->>'supplier_id','')::uuid,
      supplier_name = p->>'supplier_name', supplier_ref = p->>'supplier_ref', warehouse_id = v_wh,
      due_date = nullif(p->>'due_date','')::date, notes = p->>'notes'
    where id = v_id;
  end if;

  for it in select * from jsonb_array_elements(p->'items') loop
    v_qty := (it->>'qty')::numeric;
    v_factor := coalesce((it->>'factor')::numeric, 1);
    v_price := (it->>'price')::numeric;
    v_line := round(v_qty * v_price, 2);
    insert into purchase_items (purchase_id, product_id, name, qty, unit, factor, price, subtotal)
    values (v_id, (it->>'product_id')::uuid, it->>'name', v_qty, it->>'unit', v_factor, v_price, v_line);
    insert into stock_movements (date, product_id, warehouse_id, type, qty_base, unit_cost, ref_type, ref_id)
    values (v_date, (it->>'product_id')::uuid, v_wh, 'purchase', v_qty * v_factor, v_price / v_factor, 'purchase', v_id);
    v_sub := v_sub + v_line;
    v_products := array_append(v_products, (it->>'product_id')::uuid);
  end loop;

  update purchases set subtotal = v_sub, discount = v_disc, shipping = v_ship,
    total = v_sub - v_disc + v_ship where id = v_id;

  foreach pid in array (select array_agg(distinct x) from unnest(v_products) x) loop
    perform recompute_avg_cost(pid);
  end loop;

  if v_paid > 0 then
    insert into payments (kind, purchase_id, date, amount, method)
    values ('purchase', v_id, v_date, v_paid, coalesce(p->>'payment_method','tunai'));
  end if;
  return v_id;
end $$;

-- Batalkan nota / barang masuk (stok dikembalikan)
create or replace function public.cancel_document(p_kind text, p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare pid uuid;
begin
  if not is_staff() then raise exception 'Tidak diizinkan'; end if;
  if p_kind = 'sale' then
    update sales set status = 'batal', updated_at = now() where id = p_id;
    delete from stock_movements where ref_type = 'sale' and ref_id = p_id;
  elsif p_kind = 'purchase' then
    update purchases set status = 'batal' where id = p_id;
    delete from stock_movements where ref_type = 'purchase' and ref_id = p_id;
    for pid in select distinct product_id from purchase_items where purchase_id = p_id loop
      perform recompute_avg_cost(pid);
    end loop;
  else
    raise exception 'Jenis tidak dikenal';
  end if;
end $$;

-- Retur penjualan / pembelian
create or replace function public.save_return(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_kind text := p->>'kind';
  v_date date := coalesce((p->>'date')::date, current_date);
  v_wh uuid := (p->>'warehouse_id')::uuid;
  it jsonb;
  v_total numeric := 0;
  v_qty numeric; v_factor numeric; v_price numeric; v_line numeric; v_cost numeric;
  v_sale uuid := nullif(p->>'sale_id','')::uuid;
  v_purchase uuid := nullif(p->>'purchase_id','')::uuid;
begin
  if not is_staff() then raise exception 'Tidak diizinkan'; end if;
  if v_kind not in ('sale','purchase') then raise exception 'Jenis retur tidak valid'; end if;
  insert into returns (number, kind, date, sale_id, purchase_id, party_name, warehouse_id, notes)
  values (next_doc_number(case when v_kind = 'sale' then 'RJ' else 'RB' end, v_date), v_kind, v_date,
          v_sale, v_purchase, p->>'party_name', v_wh, p->>'notes')
  returning id into v_id;

  for it in select * from jsonb_array_elements(p->'items') loop
    v_qty := (it->>'qty')::numeric;
    v_factor := coalesce((it->>'factor')::numeric, 1);
    v_price := (it->>'price')::numeric;
    v_line := round(v_qty * v_price, 2);
    select avg_cost into v_cost from products where id = (it->>'product_id')::uuid;
    insert into return_items (return_id, product_id, name, qty, unit, factor, price, subtotal)
    values (v_id, (it->>'product_id')::uuid, it->>'name', v_qty, it->>'unit', v_factor, v_price, v_line);
    insert into stock_movements (date, product_id, warehouse_id, type, qty_base, unit_cost, unit_price, ref_type, ref_id)
    values (v_date, (it->>'product_id')::uuid, v_wh,
            case when v_kind = 'sale' then 'sale_return' else 'purchase_return' end,
            case when v_kind = 'sale' then v_qty * v_factor else -(v_qty * v_factor) end,
            v_cost, v_price / v_factor, 'return', v_id);
    v_total := v_total + v_line;
  end loop;

  update returns set total = v_total where id = v_id;
  if v_sale is not null then
    update sales set return_amount = return_amount + v_total where id = v_sale;
  end if;
  if v_purchase is not null then
    update purchases set return_amount = return_amount + v_total where id = v_purchase;
  end if;
  return v_id;
end $$;

-- Hapus retur (stok & saldo dikembalikan)
create or replace function public.delete_return(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare r public.returns%rowtype;
begin
  if not is_staff() then raise exception 'Tidak diizinkan'; end if;
  select * into r from returns where id = p_id;
  if r.sale_id is not null then
    update sales set return_amount = greatest(return_amount - r.total, 0) where id = r.sale_id;
  end if;
  if r.purchase_id is not null then
    update purchases set return_amount = greatest(return_amount - r.total, 0) where id = r.purchase_id;
  end if;
  delete from stock_movements where ref_type = 'return' and ref_id = p_id;
  delete from returns where id = p_id;
end $$;

-- Penyesuaian stok (stok awal / opname / transfer)
-- p: {type: 'opening'|'adjust'|'transfer', date, warehouse_id, to_warehouse_id, notes,
--     items:[{product_id, qty (selisih / jumlah, satuan dasar), unit_cost?}]}
create or replace function public.save_adjustment(p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb;
  v_type text := p->>'type';
  v_date date := coalesce((p->>'date')::date, current_date);
  v_wh uuid := (p->>'warehouse_id')::uuid;
  v_to uuid := nullif(p->>'to_warehouse_id','')::uuid;
  v_ref uuid := gen_random_uuid();
  v_qty numeric;
  pid uuid;
begin
  if not is_staff() then raise exception 'Tidak diizinkan'; end if;
  if v_type not in ('opening','adjust','transfer') then raise exception 'Jenis penyesuaian tidak valid'; end if;
  for it in select * from jsonb_array_elements(p->'items') loop
    pid := (it->>'product_id')::uuid;
    v_qty := (it->>'qty')::numeric;
    if v_qty = 0 then continue; end if;
    if v_type = 'transfer' then
      if v_to is null or v_to = v_wh then raise exception 'Gudang tujuan tidak valid'; end if;
      insert into stock_movements (date, product_id, warehouse_id, type, qty_base, ref_type, ref_id, notes)
      values (v_date, pid, v_wh, 'transfer_out', -abs(v_qty), 'transfer', v_ref, p->>'notes'),
             (v_date, pid, v_to, 'transfer_in', abs(v_qty), 'transfer', v_ref, p->>'notes');
    else
      insert into stock_movements (date, product_id, warehouse_id, type, qty_base, unit_cost, ref_type, ref_id, notes)
      values (v_date, pid, v_wh, v_type, v_qty,
              case when v_qty > 0 then coalesce(nullif(it->>'unit_cost','')::numeric, (select avg_cost from products where id = pid)) end,
              v_type, v_ref, p->>'notes');
      perform recompute_avg_cost(pid);
    end if;
  end loop;
end $$;

-- Recalc paid_amount setiap pembayaran berubah
create or replace function public.trg_payments_sync()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if r.sale_id is not null then
    update sales set paid_amount = coalesce((select sum(amount) from payments where sale_id = r.sale_id), 0) where id = r.sale_id;
  end if;
  if r.purchase_id is not null then
    update purchases set paid_amount = coalesce((select sum(amount) from payments where purchase_id = r.purchase_id), 0) where id = r.purchase_id;
  end if;
  return null;
end $$;
create trigger payments_sync after insert or update or delete on public.payments
for each row execute function public.trg_payments_sync();

-- Riwayat harga
create or replace function public.trg_price_history()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.price_retail is distinct from old.price_retail
     or new.price_wholesale is distinct from old.price_wholesale then
    insert into price_history (product_id, unit, price_retail, price_wholesale)
    values (new.product_id, new.unit, new.price_retail, new.price_wholesale);
  end if;
  return new;
end $$;
create trigger product_units_price_history after insert or update on public.product_units
for each row execute function public.trg_price_history();

-- =========================================================
-- LAPORAN
-- =========================================================
-- Ringkasan penjualan dikelompokkan: day | month | product | category | customer | warehouse
create or replace function public.report_sales(p_from date, p_to date, p_group text)
returns table (key text, label text, qty numeric, revenue numeric, cogs numeric, profit numeric, invoices bigint)
language sql stable security invoker set search_path = public
as $$
  with lines as (
    select s.id as sale_id, s.date, s.customer_id, s.customer_name, s.warehouse_id,
           i.product_id, i.name, i.qty, i.unit, i.factor,
           -- alokasikan diskon nota secara proporsional ke tiap baris
           case when s.subtotal > 0 then i.subtotal * (1 - s.discount / s.subtotal) else 0 end as revenue,
           i.qty * i.factor * i.cost_per_base as cogs
    from sales s join sale_items i on i.sale_id = s.id
    where s.status = 'aktif' and s.date between p_from and p_to
  )
  select
    case p_group
      when 'day' then to_char(l.date, 'YYYY-MM-DD')
      when 'month' then to_char(l.date, 'YYYY-MM')
      when 'product' then l.product_id::text
      when 'category' then coalesce(p.category_id::text, '-')
      when 'customer' then coalesce(l.customer_id::text, l.customer_name)
      when 'warehouse' then l.warehouse_id::text
    end as key,
    max(case p_group
      when 'day' then to_char(l.date, 'DD/MM/YYYY')
      when 'month' then to_char(l.date, 'MM/YYYY')
      when 'product' then l.name
      when 'category' then coalesce(c.name, 'Tanpa kategori')
      when 'customer' then l.customer_name
      when 'warehouse' then w.name
    end) as label,
    case when p_group = 'product' then round(sum(l.qty * l.factor), 3) else null end as qty,
    round(sum(l.revenue), 2) as revenue,
    round(sum(l.cogs), 2) as cogs,
    round(sum(l.revenue - l.cogs), 2) as profit,
    count(distinct l.sale_id) as invoices
  from lines l
  join products p on p.id = l.product_id
  left join categories c on c.id = p.category_id
  join warehouses w on w.id = l.warehouse_id
  group by 1
  order by 1;
$$;

create or replace function public.dashboard_stats()
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select jsonb_build_object(
    'today_sales', (select coalesce(sum(total),0) from sales where status='aktif' and date = current_date),
    'today_count', (select count(*) from sales where status='aktif' and date = current_date),
    'month_sales', (select coalesce(sum(total),0) from sales where status='aktif' and date >= date_trunc('month', current_date)),
    'month_profit', (select coalesce(sum(subtotal - discount - cogs),0) from sales where status='aktif' and date >= date_trunc('month', current_date)),
    'month_expenses', (select coalesce(sum(amount),0) from expenses where date >= date_trunc('month', current_date)),
    'receivable', (select coalesce(sum(total - paid_amount - return_amount),0) from sales where status='aktif' and total - paid_amount - return_amount > 0),
    'payable', (select coalesce(sum(total - paid_amount - return_amount),0) from purchases where status='aktif' and total - paid_amount - return_amount > 0),
    'overdue_count', (select count(*) from sales where status='aktif' and total - paid_amount - return_amount > 0 and due_date < current_date),
    'low_stock', (select count(*) from v_products where active and min_stock > 0 and stock_total <= min_stock),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'total', coalesce(t.total,0)) order by d), '[]'::jsonb)
              from generate_series(current_date - 29, current_date, interval '1 day') d
              left join (select date, sum(total) total from sales where status='aktif' and date >= current_date - 29 group by date) t on t.date = d::date)
  );
$$;

-- =========================================================
-- RLS: hanya staff yang terdaftar
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['staff','settings','warehouses','categories','products','product_units','price_history',
    'suppliers','customers','customer_prices','doc_counters','purchases','purchase_items','sales','sale_items',
    'returns','return_items','payments','expenses','stock_movements']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

revoke execute on function public.next_doc_number(text, date) from public, anon, authenticated;
revoke execute on function public.recompute_avg_cost(uuid) from public, anon, authenticated;
revoke execute on function public.save_sale(jsonb) from public, anon;
revoke execute on function public.save_purchase(jsonb) from public, anon;
revoke execute on function public.cancel_document(text, uuid) from public, anon;
revoke execute on function public.save_return(jsonb) from public, anon;
revoke execute on function public.delete_return(uuid) from public, anon;
revoke execute on function public.save_adjustment(jsonb) from public, anon;
revoke execute on function public.report_sales(date, date, text) from public, anon;
revoke execute on function public.dashboard_stats() from public, anon;


create or replace function public.add_staff(p_email text)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare v_id uuid;
begin
  if not public.is_staff() then raise exception 'Tidak diizinkan'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Akun % belum dibuat. Buat dulu di Supabase > Authentication > Users.', p_email;
  end if;
  insert into public.staff (user_id, email) values (v_id, lower(trim(p_email)))
  on conflict (user_id) do nothing;
end $$;
revoke execute on function public.add_staff(text) from public, anon;

-- =========================================================
-- STORAGE (logo / tanda tangan bisa diganti dari Pengaturan)
-- =========================================================
insert into storage.buckets (id, name, public) values ('branding', 'branding', true)
on conflict (id) do nothing;
create policy "branding staff write" on storage.objects for all to authenticated
  using (bucket_id = 'branding' and public.is_staff())
  with check (bucket_id = 'branding' and public.is_staff());
