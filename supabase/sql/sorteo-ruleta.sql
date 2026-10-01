-- Iberail · sorteo: configuración (fecha, hora, entradas) y ganadores de cada tanda.
-- El sorteo se celebra aparte; aquí se guardan la fecha de revelación y los ganadores,
-- y la web los revela con la ruleta cuando llega la hora. Ver assets/sorteo*.js.

create table if not exists public.sorteo_config (
  id        int primary key default 1,
  fecha     date,                                  -- día de la revelación
  hora      text default '20:00',                  -- hora (HH:MM)
  entradas  int  default 3,                        -- entradas de esta tanda
  total     int  default 10,                       -- entradas del sorteo entero
  tanda     int  default 1,
  publicado boolean default false,                 -- si no, no se revela aunque pase la hora
  acta      text,                                  -- cómo se hizo el sorteo (se enseña en la web)
  constraint sorteo_config_una_fila check (id = 1)
);
insert into public.sorteo_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.sorteo_ganadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tanda   int not null default 1,
  creado  timestamptz not null default now()
);

alter table public.sorteo_config    enable row level security;
alter table public.sorteo_ganadores enable row level security;

-- todo el mundo con cuenta puede leer la configuración
drop policy if exists "sorteo config: leer" on public.sorteo_config;
create policy "sorteo config: leer" on public.sorteo_config for select to authenticated using (true);
drop policy if exists "sorteo config: equipo" on public.sorteo_config;
create policy "sorteo config: equipo" on public.sorteo_config for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- cada uno ve si le ha tocado; el equipo lo ve todo. Solo una vez publicado.
drop policy if exists "sorteo ganadores: leer" on public.sorteo_ganadores;
create policy "sorteo ganadores: leer" on public.sorteo_ganadores for select to authenticated
  using (public.is_admin() or (user_id = auth.uid() and exists (select 1 from public.sorteo_config c where c.id = 1 and c.publicado)));
drop policy if exists "sorteo ganadores: equipo" on public.sorteo_ganadores;
create policy "sorteo ganadores: equipo" on public.sorteo_ganadores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.sorteo_config    replica identity full;
alter table public.sorteo_ganadores replica identity full;
