-- Sorteo del Ultra: permitir desapuntarse.
-- · Cada persona puede salir del sorteo (borrar SU inscripción) desde «Mi cuenta» / «Mis grupos».
-- · El equipo (is_admin) puede quitar a cualquiera desde la pestaña «Sorteo» del panel.
-- Ejecutar una vez en Supabase → SQL Editor. Se puede ejecutar varias veces sin problema.

alter table public.sorteo_inscritos enable row level security;

drop policy if exists "sorteo: salir o quitar" on public.sorteo_inscritos;
create policy "sorteo: salir o quitar" on public.sorteo_inscritos
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- para que el panel (en directo) sepa a quién se ha quitado
alter table public.sorteo_inscritos replica identity full;
