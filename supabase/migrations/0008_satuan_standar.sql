-- 0008: standarisasi satuan. Bentuk standar = huruf kecil, tanpa spasi; ejaan umum digabung lewat tabel unit_alias.
-- Dipakai bersama oleh Tiga Putra dan Wibowo. Aman dijalankan ulang.

create table if not exists public.unit_alias (alias text primary key, canon text not null);
alter table public.unit_alias enable row level security;
insert into public.unit_alias (alias, canon) values
  ('ball','bal'),('botol','btl'),('btol','btl'),('btir','butir'),('btit','butir'),
  ('jrigen','jirigen'),('jligen','jirigen'),('ikat','iket'),('lmbr','lembar'),('rcg','renceng'),
  ('l','liter'),('boks','box')
on conflict (alias) do update set canon = excluded.canon;

create or replace function public.norm_unit(u text)
returns text language sql stable security definer set search_path = public as $$
  select case when u is null then null
    else coalesce((select a.canon from public.unit_alias a where a.alias = k.k), k.k) end
  from (select lower(regexp_replace(btrim(coalesce(u,'')), '\s+', '', 'g')) as k) k
$$;
grant execute on function public.norm_unit(text) to anon, authenticated;

-- Pemicu: satuan yang diketik apa pun selalu disimpan dalam bentuk standar
create or replace function public.trg_norm_unit()
returns trigger language plpgsql as $$
declare col text := tg_argv[0]; v text;
begin
  v := to_jsonb(new) ->> col;
  if v is not null then
    new := jsonb_populate_record(new, jsonb_build_object(col, public.norm_unit(v)));
  end if;
  return new;
end $$;

do $$
declare r record;
begin
  for r in select * from (values
    ('products','base_unit'),('product_units','unit'),('price_history','unit'),('customer_prices','unit'),
    ('sale_items','unit'),('purchase_items','unit'),('return_items','unit'),('delivery_note_items','unit')
  ) v(t, c) where to_regclass('public.' || v.t) is not null
  loop
    execute format('drop trigger if exists norm_unit_trg on public.%I', r.t);
    execute format('create trigger norm_unit_trg before insert or update on public.%I for each row execute function public.trg_norm_unit(%L)', r.t, r.c);
  end loop;
end $$;
