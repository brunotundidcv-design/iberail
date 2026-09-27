-- Iberail · correos automáticos
-- Ejecutar UNA vez en Supabase → SQL Editor, después de desplegar la función «correos».
-- ANTES: cambia PON_AQUI_TU_CLAVE (2 veces) por la misma clave que pusiste en el secret CORREOS_KEY.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- correos ya enviados (para no mandar nunca el mismo dos veces)
create table if not exists public.correos_enviados (
  clave text primary key,
  created_at timestamptz not null default now()
);
-- quien se ha dado de baja de la publicidad
create table if not exists public.bajas_publicidad (
  email text primary key,
  created_at timestamptz not null default now()
);
-- solo las funciones del servidor tocan estas tablas
alter table public.correos_enviados enable row level security;
alter table public.bajas_publicidad enable row level security;

-- avisa a la función «correos» de lo que pasa en la base de datos
create or replace function public.ib_correos_evento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := 'https://yyuydlaiiaynqutasxaz.supabase.co/functions/v1/correos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-iberail-key', 'PON_AQUI_TU_CLAVE'),
    body    := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'record', to_jsonb(NEW),
                                  'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) end)
  );
  return NEW;
end $$;

-- ruta nueva → «Hemos recibido tu ruta»
drop trigger if exists ib_correo_ruta_nueva on public.rutas;
create trigger ib_correo_ruta_nueva after insert on public.rutas
  for each row execute function public.ib_correos_evento();

-- ruta pasa a «presupuesto enviado» → «Tu presupuesto está listo»
drop trigger if exists ib_correo_ruta_estado on public.rutas;
create trigger ib_correo_ruta_estado after update of estado on public.rutas
  for each row when (new.estado is distinct from old.estado and new.estado = 'presupuesto_enviado')
  execute function public.ib_correos_evento();

-- alguien entra en un grupo → «Ya estás en el grupo» (+ precio si ya lo tiene)
drop trigger if exists ib_correo_miembro_nuevo on public.grupo_miembros;
create trigger ib_correo_miembro_nuevo after insert on public.grupo_miembros
  for each row execute function public.ib_correos_evento();

-- se le pone o cambia el precio → «Tu viaje ya tiene precio» con botón de pago
drop trigger if exists ib_correo_miembro_precio on public.grupo_miembros;
create trigger ib_correo_miembro_precio after update of importe on public.grupo_miembros
  for each row when (new.importe is distinct from old.importe)
  execute function public.ib_correos_evento();

-- pago apuntado (Stripe o a mano en el panel) → «Hemos recibido tu pago»
drop trigger if exists ib_correo_pago on public.pagos;
create trigger ib_correo_pago after insert on public.pagos
  for each row execute function public.ib_correos_evento();

-- todos los días a las 10:00 (hora de España en verano; 9:00 en invierno):
-- cuenta atrás del viaje (30, 7 y 1 día antes) y, los lunes, recordatorio de lo que falta por pagar
select cron.unschedule('iberail-correos-diarios') where exists (select 1 from cron.job where jobname = 'iberail-correos-diarios');
select cron.schedule('iberail-correos-diarios', '0 8 * * *', $$
  select net.http_post(
    url     := 'https://yyuydlaiiaynqutasxaz.supabase.co/functions/v1/correos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-iberail-key', 'PON_AQUI_TU_CLAVE'),
    body    := '{"action":"diario"}'::jsonb
  );
$$);
