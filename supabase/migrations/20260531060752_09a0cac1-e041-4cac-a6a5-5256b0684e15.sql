
-- areas.key
alter table public.areas add column if not exists key text unique;

-- key_results: campos adicionales
alter table public.key_results
  add column if not exists baseline numeric,
  add column if not exists status public.initiative_status default 'planeado',
  add column if not exists q1_target text,
  add column if not exists q2_target text,
  add column if not exists q3_target text,
  add column if not exists q4_target text;

-- company_metrics: metas trimestrales + total_label
alter table public.company_metrics
  add column if not exists q1_target numeric,
  add column if not exists q2_target numeric,
  add column if not exists q3_target numeric,
  add column if not exists q4_target numeric,
  add column if not exists total_label text;

-- milestones
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  objective_id uuid references public.objectives(id) on delete set null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.milestones to anon, authenticated;
grant all on public.milestones to service_role;
alter table public.milestones enable row level security;
create policy "public read milestones" on public.milestones for select using (true);
create policy "public write milestones" on public.milestones for all using (true) with check (true);

-- initiative_objectives (objetivos secundarios)
create table if not exists public.initiative_objectives (
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  objective_id  uuid not null references public.objectives(id) on delete cascade,
  primary key (initiative_id, objective_id)
);
grant select, insert, update, delete on public.initiative_objectives to anon, authenticated;
grant all on public.initiative_objectives to service_role;
alter table public.initiative_objectives enable row level security;
create policy "public read initiative_objectives" on public.initiative_objectives for select using (true);
create policy "public write initiative_objectives" on public.initiative_objectives for all using (true) with check (true);

-- fix function search_path warning
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;
