-- Iberail · sonidos del sorteo subidos desde el panel (bucket público «sorteo»)
-- Va después de sorteo-ruleta.sql y sorteo-premios.sql.

alter table public.sorteo_config add column if not exists sonidos jsonb;

-- bucket público: los mp3 los oye cualquiera, pero solo el equipo puede subirlos
insert into storage.buckets (id, name, public) values ('sorteo', 'sorteo', true)
on conflict (id) do update set public = true;

drop policy if exists "sorteo snd: leer"  on storage.objects;
drop policy if exists "sorteo snd: subir" on storage.objects;
drop policy if exists "sorteo snd: borrar" on storage.objects;
drop policy if exists "sorteo snd: actualizar" on storage.objects;

create policy "sorteo snd: leer" on storage.objects for select
  using (bucket_id = 'sorteo');
create policy "sorteo snd: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'sorteo' and public.is_admin());
create policy "sorteo snd: borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'sorteo' and public.is_admin());
create policy "sorteo snd: actualizar" on storage.objects for update to authenticated
  using (bucket_id = 'sorteo' and public.is_admin()) with check (bucket_id = 'sorteo' and public.is_admin());
