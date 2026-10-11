-- Iberail · historial de premios de TODOS los sorteos + «entregado».
-- Va después de supabase/sql/sorteo-ruleta.sql y sorteo-premios.sql. Se puede ejecutar varias veces sin problema.
--
-- sorteo_ganadores solo guarda el sorteo actual (se vacía con «Preparar un sorteo nuevo»).
-- Aquí queda una fila por persona y sorteo, para siempre, con:
--   · qué le tocó (id del catálogo y cómo se llamaba el premio en ese sorteo),
--   · sus datos de contacto copiados (por si un día borra su cuenta: hacen falta para Hacienda o una reclamación),
--   · si ya se le ha entregado, cuándo, quién lo marcó y una nota («descontado del grupo», «entrada enviada»…).
-- Lo rellena el panel (pestaña «Premios»): al publicar, al preparar un sorteo nuevo y al marcar entregado.
-- Solo el equipo lo ve.

create table if not exists public.sorteo_historial (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users(id) on delete set null,
  tanda         int,                                 -- nº de sorteo (sorteo_config.tanda); vacío si se importó de un CSV antiguo
  fecha         date,                                -- día del sorteo
  premio        text,                                -- id del catálogo: entrada, d300, d100…
  premio_label  text,                                -- cómo se llamaba el premio en ese sorteo
  tirada        int,
  visto         timestamptz,                         -- cuándo abrió su resultado en la web
  nombre        text,
  email         text,
  telefono      text,
  entregado_at  timestamptz,
  entregado_por text,                                -- quién del equipo lo marcó
  nota          text,
  created_at    timestamptz not null default now()
);

-- una fila por persona y sorteo (el panel guarda con upsert sobre estas dos columnas)
create unique index if not exists sorteo_historial_user_tanda on public.sorteo_historial (user_id, tanda);
create index if not exists sorteo_historial_pendientes on public.sorteo_historial (entregado_at) where entregado_at is null;

alter table public.sorteo_historial enable row level security;

drop policy if exists "sorteo historial: equipo" on public.sorteo_historial;
create policy "sorteo historial: equipo" on public.sorteo_historial for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- lo que ya hay asignado en el sorteo actual entra en el historial desde ya
insert into public.sorteo_historial (user_id, tanda, fecha, premio, premio_label, visto, nombre, email, telefono)
select g.user_id, coalesce(g.tanda, c.tanda, 1), c.fecha, g.premio,
       coalesce((select p->>'label' from jsonb_array_elements(coalesce(c.premios, '[]'::jsonb)) p where p->>'id' = g.premio limit 1), g.premio),
       g.visto,
       u.raw_user_meta_data->>'nombre', u.email, u.raw_user_meta_data->>'telefono'
from public.sorteo_ganadores g
join public.sorteo_config c on c.id = 1
left join auth.users u on u.id = g.user_id
where g.premio is not null
on conflict (user_id, tanda) do nothing;
