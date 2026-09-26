-- Iberail · pagos con Stripe
-- Ejecutar una vez en Supabase → SQL Editor.
-- Cada pago de Stripe guarda su sesión para que no se apunte dos veces si Stripe reenvía el aviso.
alter table public.pagos add column if not exists stripe_session text;
create unique index if not exists pagos_stripe_session_key on public.pagos (stripe_session);
