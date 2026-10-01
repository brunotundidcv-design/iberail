-- Iberail · aviso de fecha límite de pago por grupo (assets/panel.js + assets/cuenta.js)
-- El equipo pone la fecha y, si quiere, una nota; todos los del grupo la ven en su ficha.
alter table public.grupos add column if not exists limite_pago date;
alter table public.grupos add column if not exists nota_pago  text;

comment on column public.grupos.limite_pago is 'Fecha límite para pagar; después el precio puede subir. La ve el cliente en su grupo.';
comment on column public.grupos.nota_pago   is 'Texto del aviso de la fecha límite (opcional).';
