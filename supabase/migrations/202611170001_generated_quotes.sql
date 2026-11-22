-- Cotizaciones calculadas para usuarios con cuenta, antes de solicitar coordinación.
create table if not exists public.generated_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  customer_email text not null default '',
  customer_name text not null default '',
  event jsonb not null,
  proposals jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);
create index if not exists generated_quotes_user_created_idx on public.generated_quotes(user_id, created_at desc);
alter table public.generated_quotes enable row level security;
revoke all on public.generated_quotes from anon, authenticated;
grant select on public.generated_quotes to authenticated;
create policy generated_quotes_select_own on public.generated_quotes for select to authenticated
  using ((select auth.uid()) = user_id);
-- Las inserciones se hacen solo en el servidor con una sesión verificada.
