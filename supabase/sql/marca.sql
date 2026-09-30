-- Iberail + Zarping · dos marcas de la misma titular en la misma base de datos
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → pegar → «Run» (se puede repetir sin problema).
--
-- · rutas.marca: de qué web viene la solicitud ('iberail' o 'zarping'). La web de Zarping manda 'zarping'.
-- · grupos.marca: con qué marca sale el contrato, el pago (Stripe) y el seguro del grupo. Se elige en el panel.
-- Hasta ejecutar esto, la web de Zarping guarda igual las solicitudes (sin la columna) y el panel las reconoce
-- por la referencia ZP-XXXXXX.

alter table public.rutas  add column if not exists marca text not null default 'iberail';
alter table public.grupos add column if not exists marca text not null default 'iberail';

alter table public.rutas  drop constraint if exists rutas_marca_check;
alter table public.rutas  add constraint rutas_marca_check  check (marca in ('iberail', 'zarping'));
alter table public.grupos drop constraint if exists grupos_marca_check;
alter table public.grupos add constraint grupos_marca_check check (marca in ('iberail', 'zarping'));

-- solicitudes de Zarping guardadas antes de tener la columna
update public.rutas set marca = 'zarping' where ref like 'ZP-%' and marca <> 'zarping';

create index if not exists rutas_marca_idx on public.rutas (marca);

-- Las solicitudes de Zarping pueden ser de 1–2 días (fin de semana) o de cursos enteros (más de 30 personas).
-- El planificador de Iberail limitaba a 3–60 días y 30 personas: si la tabla tiene esos límites, se amplían.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.rutas'::regclass and contype = 'c'
             and conname not in ('rutas_marca_check', 'rutas_dias_rango', 'rutas_viajeros_rango')
             and (pg_get_constraintdef(oid) ~* '\mdias\M' or pg_get_constraintdef(oid) ~* '\mviajeros\M')
  loop
    execute format('alter table public.rutas drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.rutas drop constraint if exists rutas_dias_rango;
alter table public.rutas add constraint rutas_dias_rango check (dias between 1 and 90);
alter table public.rutas drop constraint if exists rutas_viajeros_rango;
alter table public.rutas add constraint rutas_viajeros_rango check (viajeros between 1 and 500);
