-- 0006: (1) satu Harga jual per satuan, (2) pelanggan/supplier/barang baru bisa diketik langsung di form
--       lalu otomatis tersimpan saat dokumen disimpan, (3) Surat Jalan tanpa nota.

-- (1) Harga jual tunggal: nilai diambil dari harga grosir (yang selama ini dipakai di nota).
--     Kolom price_retail & price_wholesale tetap ada dan selalu diisi sama.
update public.product_units
   set price_wholesale = case when price_wholesale > 0 then price_wholesale else price_retail end
 where price_wholesale = 0 and price_retail > 0;
update public.product_units set price_retail = price_wholesale where price_retail <> price_wholesale;
alter table public.customers alter column price_type set default 'grosir';
update public.customers set price_type = 'grosir' where price_type <> 'grosir';

-- (3) Surat Jalan tanpa nota: sale_id boleh kosong, barang disimpan di delivery_note_items
alter table public.delivery_notes alter column sale_id drop not null;
create table if not exists public.delivery_note_items (
  id uuid primary key default gen_random_uuid(),
  delivery_note_id uuid not null references public.delivery_notes(id),
  product_id uuid references public.products(id),
  name text not null,
  qty numeric not null,
  unit text not null,
  sort int not null default 0,
  active boolean not null default true
);
create index if not exists delivery_note_items_dn_idx on public.delivery_note_items (delivery_note_id);
alter table public.delivery_note_items enable row level security;
create policy open_all on public.delivery_note_items for all to anon, authenticated using (true) with check (true);
grant select, insert, update on public.delivery_note_items to anon, authenticated;

-- (2) Lengkapi dokumen dengan pelanggan/supplier/barang baru.
--   p_kind: 'sale' | 'purchase' | 'return' | 'delivery'
--   Pelanggan/supplier dicari berdasar nama (tanpa beda huruf besar/kecil), dibuat jika belum ada.
--   Barang tanpa product_id dicari berdasar nama, dibuat jika belum ada (satuan = satuan yang diketik, isi 1,
--   harga jual = harga di nota). Wibowo: stok boleh minus, jadi barang baru TIDAK diberi stok awal otomatis (c_auto_stock = false).
--   (Di Tiga Putra c_auto_stock = true.)
create or replace function public.resolve_new(p jsonb, p_kind text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  c_auto_stock constant boolean := false;
  v_party text;
  v_key text;
  v_name text;
  v_id uuid;
  it jsonb;
  v_items jsonb := '[]'::jsonb;
  pid uuid;
  v_unit text;
  v_factor numeric;
  v_new uuid[] := '{}';
  v_date date := coalesce((p->>'date')::date, current_date);
  v_ref uuid := gen_random_uuid();
begin
  -- pihak (pelanggan / supplier)
  v_party := case p_kind
    when 'sale' then 'customer'
    when 'delivery' then 'customer'
    when 'purchase' then 'supplier'
    when 'return' then case when p->>'kind' = 'purchase' then 'supplier' else 'customer' end
  end;
  v_key := case p_kind when 'return' then 'party_name' when 'delivery' then 'recipient_name' else v_party || '_name' end;
  v_name := btrim(coalesce(p->>v_key, ''));
  if v_party is not null and v_name <> '' and lower(v_name) <> 'umum'
     and (p_kind in ('return','delivery') or nullif(p->>(v_party || '_id'), '') is null) then
    if v_party = 'customer' then
      select id into v_id from customers where active and lower(btrim(name)) = lower(v_name) order by created_at limit 1;
      if v_id is null then insert into customers (name) values (v_name) returning id into v_id; end if;
    else
      select id into v_id from suppliers where active and lower(btrim(name)) = lower(v_name) order by created_at limit 1;
      if v_id is null then insert into suppliers (name) values (v_name) returning id into v_id; end if;
    end if;
    p := p || jsonb_build_object(v_key, v_name);
    if p_kind in ('sale','purchase') then p := p || jsonb_build_object(v_party || '_id', v_id); end if;
    if p_kind = 'delivery' then p := p || jsonb_build_object('customer_id', v_id); end if;
  end if;

  -- barang
  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    if nullif(it->>'product_id', '') is null then
      v_name := btrim(coalesce(it->>'name', ''));
      if v_name = '' then raise exception 'Nama barang wajib diisi'; end if;
      v_unit := coalesce(nullif(btrim(it->>'unit'), ''), 'pcs');
      select id into pid from products where active and lower(btrim(name)) = lower(v_name) order by created_at limit 1;
      if pid is null then
        insert into products (name, base_unit) values (v_name, v_unit) returning id into pid;
        insert into product_units (product_id, unit, factor, price_retail, price_wholesale)
        values (pid, v_unit, 1,
                case when p_kind = 'sale' then coalesce((it->>'price')::numeric, 0) else 0 end,
                case when p_kind = 'sale' then coalesce((it->>'price')::numeric, 0) else 0 end);
        v_new := array_append(v_new, pid);
        v_factor := 1;
      else
        select name into v_name from products where id = pid;
        select factor into v_factor from product_units where product_id = pid and lower(unit) = lower(v_unit) limit 1;
        v_factor := coalesce(v_factor, 1);
      end if;
      it := it || jsonb_build_object('product_id', pid, 'name', v_name, 'unit', v_unit, 'factor', v_factor);
      if c_auto_stock and p_kind = 'sale' and pid = any (v_new) then
        insert into stock_movements (date, product_id, warehouse_id, type, qty_base, unit_cost, ref_type, ref_id, notes)
        values (v_date, pid, coalesce(nullif(it->>'warehouse_id', '')::uuid, default_warehouse()), 'opening',
                (it->>'qty')::numeric * v_factor, 0, 'opening', v_ref, 'Stok otomatis: barang baru dari nota');
      end if;
    end if;
    v_items := v_items || jsonb_build_array(it);
  end loop;
  if p ? 'items' then p := p || jsonb_build_object('items', v_items); end if;
  return p;
end $$;

create or replace function public.save_sale_ex(p jsonb) returns uuid
language sql security definer set search_path to 'public' as $$ select save_sale(resolve_new(p, 'sale')) $$;
create or replace function public.save_purchase_ex(p jsonb) returns uuid
language sql security definer set search_path to 'public' as $$ select save_purchase(resolve_new(p, 'purchase')) $$;
create or replace function public.save_return_ex(p jsonb) returns uuid
language sql security definer set search_path to 'public' as $$ select save_return(resolve_new(p, 'return')) $$;

-- Surat Jalan tanpa nota (tidak mengurangi stok). Nomor otomatis SJ/YYYY/MM/NNNN bila kosong.
create or replace function public.save_delivery_note(p jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_date date := coalesce((p->>'date')::date, current_date);
  v_number text;
  it jsonb;
  i int := 0;
begin
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then raise exception 'Surat Jalan harus berisi minimal 1 barang'; end if;
  if btrim(coalesce(p->>'recipient_name', '')) = '' then raise exception 'Nama penerima wajib diisi'; end if;
  p := resolve_new(p, 'delivery');
  v_number := nullif(btrim(coalesce(p->>'number', '')), '');
  if v_id is null then
    insert into delivery_notes (sale_id, number, date, recipient_name, recipient_address, vehicle_type, vehicle_number, notes)
    values (null, coalesce(v_number, next_doc_number('SJ', v_date)), v_date, p->>'recipient_name', nullif(p->>'recipient_address', ''),
            nullif(p->>'vehicle_type', ''), nullif(p->>'vehicle_number', ''), nullif(p->>'notes', ''))
    returning id into v_id;
  else
    update delivery_notes set number = coalesce(v_number, number), date = v_date, recipient_name = p->>'recipient_name',
      recipient_address = nullif(p->>'recipient_address', ''), vehicle_type = nullif(p->>'vehicle_type', ''),
      vehicle_number = nullif(p->>'vehicle_number', ''), notes = nullif(p->>'notes', ''), updated_at = now()
    where id = v_id and sale_id is null and status = 'aktif';
    if not found then raise exception 'Surat Jalan tidak ditemukan atau sudah dibatalkan'; end if;
    update delivery_note_items set active = false where delivery_note_id = v_id and active;
  end if;
  for it in select * from jsonb_array_elements(p->'items') loop
    i := i + 1;
    insert into delivery_note_items (delivery_note_id, product_id, name, qty, unit, sort)
    values (v_id, (it->>'product_id')::uuid, it->>'name', (it->>'qty')::numeric, it->>'unit', i);
  end loop;
  return v_id;
end $$;

grant execute on function public.resolve_new(jsonb, text), public.save_sale_ex(jsonb), public.save_purchase_ex(jsonb),
  public.save_return_ex(jsonb), public.save_delivery_note(jsonb) to anon, authenticated;
