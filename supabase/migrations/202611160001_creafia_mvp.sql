-- Existing catalog prices remain public prices. Provider costs are never inferred.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  whatsapp text not null default '' check (whatsapp ~ '^$|^[0-9]{9,15}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.provider_records (
  id text primary key,
  record jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  request_code text not null unique,
  public_payload jsonb not null,
  state text not null default 'received' check (state in ('received','coordinating','awaiting_customer','completed','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);
create index if not exists quotations_user_created_idx on public.quotations(user_id, created_at desc);
create table if not exists public.quotation_private (
  quotation_id uuid primary key references public.quotations(id) on delete cascade,
  snapshot jsonb not null,
  provider_status jsonb not null default '{}'::jsonb,
  customer_whatsapp text not null,
  consent_at timestamptz not null
);

alter table public.admin_users enable row level security;
alter table public.profiles enable row level security;
alter table public.provider_records enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_private enable row level security;
revoke all on public.admin_users, public.profiles, public.provider_records,
  public.quotations, public.quotation_private from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.quotations to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy quotations_select_own on public.quotations for select to authenticated
  using ((select auth.uid()) = user_id);
-- No client policies for private, admin or catalog tables.
-- Only the server's secret key may insert or update quotations and private snapshots.
create or replace function public.create_quotation_atomic(
  p_user_id uuid, p_idempotency_key uuid, p_request_code text,
  p_public_payload jsonb, p_snapshot jsonb, p_customer_whatsapp text,
  p_consent_at timestamptz
) returns public.quotations
language plpgsql security definer set search_path = '' as $$
declare saved public.quotations;
begin
  insert into public.quotations(user_id, idempotency_key, request_code, public_payload)
  values (p_user_id, p_idempotency_key, p_request_code, p_public_payload)
  returning * into saved;
  insert into public.quotation_private(quotation_id, snapshot, customer_whatsapp, consent_at)
  values (saved.id, p_snapshot, p_customer_whatsapp, p_consent_at);
  return saved;
end;
$$;
revoke all on function public.create_quotation_atomic(uuid, uuid, text, jsonb, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_quotation_atomic(uuid, uuid, text, jsonb, jsonb, text, timestamptz) to service_role;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('provider-images', 'provider-images', false, 5000000, array['image/webp'])
on conflict (id) do nothing;
