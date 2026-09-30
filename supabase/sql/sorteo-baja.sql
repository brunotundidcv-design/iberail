-- Sorteo del Ultra: quitar inscritos.
-- · Solo el equipo (is_admin) puede quitar a alguien, desde la pestaña «Sorteo» del panel.
-- · Los participantes NO pueden salirse solos (decisión de Bruno).
-- Ejecutar una vez en Supabase → SQL Editor. Se puede ejecutar varias veces sin problema.

alter table public.sorteo_inscritos enable row level security;

drop policy if exists "sorteo: salir o quitar" on public.sorteo_inscritos;
drop policy if exists "sorteo: quitar (equipo)" on public.sorteo_inscritos;
create policy "sorteo: quitar (equipo)" on public.sorteo_inscritos
  for delete to authenticated
  using (public.is_admin());

-- para que el panel (en directo) sepa a quién se ha quitado
alter table public.sorteo_inscritos replica identity full;
