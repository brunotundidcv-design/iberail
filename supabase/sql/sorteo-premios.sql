-- Iberail · premios del sorteo (catálogo + premio de cada persona)
-- Va después de supabase/sql/sorteo-ruleta.sql.

alter table public.sorteo_config    add column if not exists premios jsonb;
alter table public.sorteo_ganadores add column if not exists premio text;
alter table public.sorteo_ganadores add column if not exists visto  timestamptz;

-- catálogo por defecto (cantidad de cada premio)
update public.sorteo_config set premios = '[
  {"id":"entrada","label":"Entrada Ultra Europe","n":3,"tier":"top"},
  {"id":"d300","label":"300 € de descuento","n":1,"tier":"alto"},
  {"id":"d100","label":"100 € de descuento","n":2,"tier":"alto"},
  {"id":"d50","label":"50 € de descuento","n":3,"tier":"medio"},
  {"id":"copas","label":"Bono de copas en Split","n":5,"tier":"medio"},
  {"id":"d25","label":"25 € de descuento","n":5,"tier":"bajo"},
  {"id":"d5","label":"5 € de descuento","n":10,"tier":"bajo"}
]'::jsonb where id = 1 and premios is null;

-- cuántas entradas quedan por revelar (lo ve todo el mundo, sin saber de quién)
create or replace function public.sorteo_restantes()
returns table (entradas int, dadas int)
language sql security definer set search_path = public as $$
  select
    coalesce((select c.entradas from public.sorteo_config c where c.id = 1), 0)::int,
    (select count(*) from public.sorteo_ganadores g where g.premio = 'entrada' and g.visto is not null)::int;
$$;
revoke all on function public.sorteo_restantes() from public;
grant execute on function public.sorteo_restantes() to authenticated;

-- marcar que ya ha abierto su premio (solo el suyo)
create or replace function public.sorteo_visto()
returns void language sql security definer set search_path = public as $$
  update public.sorteo_ganadores set visto = coalesce(visto, now()) where user_id = auth.uid();
$$;
revoke all on function public.sorteo_visto() from public;
grant execute on function public.sorteo_visto() to authenticated;
