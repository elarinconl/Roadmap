
-- Enum de estado
create type public.initiative_status as enum ('planeado','en_curso','en_riesgo','bloqueado','hecho');
create type public.dependency_type as enum ('finish_to_start','start_to_start','finish_to_finish','start_to_finish');

-- Áreas
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- Objetivos
create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  color text not null default '#4F46E5',
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Key Results
create table public.key_results (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.objectives(id) on delete cascade,
  title text not null,
  target numeric,
  current_value numeric default 0,
  unit text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Iniciativas
create table public.initiatives (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.objectives(id) on delete cascade,
  owner_area_id uuid references public.areas(id) on delete set null,
  title text not null,
  description text,
  status public.initiative_status not null default 'planeado',
  start_date date not null,
  end_date date not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint initiative_dates_valid check (end_date >= start_date)
);

-- Contribuciones de área a iniciativa
create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contribution_dates_valid check (end_date >= start_date),
  unique (initiative_id, area_id)
);

-- Dependencias
create table public.dependencies (
  id uuid primary key default gen_random_uuid(),
  from_initiative_id uuid not null references public.initiatives(id) on delete cascade,
  to_initiative_id uuid not null references public.initiatives(id) on delete cascade,
  type public.dependency_type not null default 'finish_to_start',
  created_at timestamptz not null default now(),
  unique (from_initiative_id, to_initiative_id),
  constraint dependency_not_self check (from_initiative_id <> to_initiative_id)
);

-- Métricas de empresa
create table public.company_metrics (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  value numeric,
  target numeric,
  unit text,
  order_index int not null default 0,
  updated_at timestamptz not null default now()
);

-- GRANTS (acceso público sin auth para MVP)
grant select, insert, update, delete on public.areas to anon, authenticated;
grant select, insert, update, delete on public.objectives to anon, authenticated;
grant select, insert, update, delete on public.key_results to anon, authenticated;
grant select, insert, update, delete on public.initiatives to anon, authenticated;
grant select, insert, update, delete on public.contributions to anon, authenticated;
grant select, insert, update, delete on public.dependencies to anon, authenticated;
grant select, insert, update, delete on public.company_metrics to anon, authenticated;
grant all on public.areas, public.objectives, public.key_results, public.initiatives, public.contributions, public.dependencies, public.company_metrics to service_role;

-- RLS habilitada + políticas públicas (MVP)
alter table public.areas enable row level security;
alter table public.objectives enable row level security;
alter table public.key_results enable row level security;
alter table public.initiatives enable row level security;
alter table public.contributions enable row level security;
alter table public.dependencies enable row level security;
alter table public.company_metrics enable row level security;

create policy "public read areas" on public.areas for select using (true);
create policy "public write areas" on public.areas for all using (true) with check (true);

create policy "public read objectives" on public.objectives for select using (true);
create policy "public write objectives" on public.objectives for all using (true) with check (true);

create policy "public read key_results" on public.key_results for select using (true);
create policy "public write key_results" on public.key_results for all using (true) with check (true);

create policy "public read initiatives" on public.initiatives for select using (true);
create policy "public write initiatives" on public.initiatives for all using (true) with check (true);

create policy "public read contributions" on public.contributions for select using (true);
create policy "public write contributions" on public.contributions for all using (true) with check (true);

create policy "public read dependencies" on public.dependencies for select using (true);
create policy "public write dependencies" on public.dependencies for all using (true) with check (true);

create policy "public read company_metrics" on public.company_metrics for select using (true);
create policy "public write company_metrics" on public.company_metrics for all using (true) with check (true);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_objectives_updated before update on public.objectives for each row execute function public.set_updated_at();
create trigger trg_key_results_updated before update on public.key_results for each row execute function public.set_updated_at();
create trigger trg_initiatives_updated before update on public.initiatives for each row execute function public.set_updated_at();
create trigger trg_contributions_updated before update on public.contributions for each row execute function public.set_updated_at();
create trigger trg_company_metrics_updated before update on public.company_metrics for each row execute function public.set_updated_at();

-- SEED: áreas
insert into public.areas (name, color, order_index) values
  ('Producto',     '#4F46E5', 1),
  ('Growth',       '#0EA5E9', 2),
  ('Educación',    '#A855F7', 3),
  ('Operaciones',  '#F59E0B', 4);

-- SEED: objetivos FY2026 (jul 2025 - jun 2026)
insert into public.objectives (code, title, description, color, order_index) values
  ('O1', 'Crecer ARR a 5M', 'Escalar ingresos recurrentes anuales a 5M USD', '#4F46E5', 1),
  ('O2', 'Activación + Retención', 'Mejorar activación a 7 días y retención a 90 días', '#0EA5E9', 2),
  ('O3', 'Excelencia educativa', 'Subir NPS de programa a 70 y completion rate a 80%', '#A855F7', 3),
  ('O4', 'Eficiencia operativa', 'Bajar CAC 20% y automatizar onboarding interno', '#F59E0B', 4);

-- SEED: KRs
with o as (select id, code from public.objectives)
insert into public.key_results (objective_id, title, target, current_value, unit, order_index)
select o.id, kr.title, kr.target, kr.current, kr.unit, kr.idx
from o join (values
  ('O1','ARR (USD)', 5000000, 2800000, 'USD', 1),
  ('O1','Nuevos clientes enterprise', 25, 9, 'cuentas', 2),
  ('O2','Activación 7d (%)', 65, 42, '%', 1),
  ('O2','Retención 90d (%)', 80, 64, '%', 2),
  ('O3','NPS de programa', 70, 55, 'pts', 1),
  ('O3','Completion rate (%)', 80, 61, '%', 2),
  ('O4','CAC (USD)', 800, 1100, 'USD', 1),
  ('O4','Tiempo onboarding (días)', 5, 12, 'días', 2)
) as kr(code, title, target, current, unit, idx) on kr.code = o.code;

-- SEED: iniciativas
with o as (select id, code from public.objectives),
     a as (select id, name from public.areas)
insert into public.initiatives (objective_id, owner_area_id, title, status, start_date, end_date, order_index)
select o.id, a.id, i.title, i.status::public.initiative_status, i.start_date::date, i.end_date::date, i.idx
from (values
  -- O1
  ('O1','Growth',      'Lanzamiento plan Enterprise',       'en_curso',   '2025-07-01','2025-10-31', 1),
  ('O1','Growth',      'Outbound a cuentas Fortune 500',    'planeado',   '2025-09-01','2026-02-28', 2),
  ('O1','Producto',    'Pricing & packaging V2',            'en_riesgo',  '2025-08-01','2025-11-30', 3),
  ('O1','Operaciones', 'Integración con CRM Salesforce',    'planeado',   '2025-10-01','2026-01-31', 4),
  -- O2
  ('O2','Producto',    'Rediseño onboarding in-app',        'en_curso',   '2025-07-15','2025-10-15', 1),
  ('O2','Producto',    'Sistema de notificaciones push',    'planeado',   '2025-11-01','2026-01-31', 2),
  ('O2','Growth',      'Campañas reactivación email',       'hecho',      '2025-07-01','2025-08-31', 3),
  ('O2','Educación',   'Academy: módulo "primeros pasos"',  'en_curso',   '2025-08-01','2025-11-30', 4),
  -- O3
  ('O3','Educación',   'Rediseño programa flagship',        'en_curso',   '2025-07-01','2025-12-31', 1),
  ('O3','Educación',   'Plataforma de evaluaciones',        'planeado',   '2025-10-01','2026-03-31', 2),
  ('O3','Producto',    'Dashboard de progreso del alumno',  'planeado',   '2026-01-01','2026-04-30', 3),
  -- O4
  ('O4','Operaciones', 'Automatizar onboarding interno',    'en_curso',   '2025-07-01','2025-11-30', 1),
  ('O4','Growth',      'Optimizar paid acquisition',        'bloqueado',  '2025-09-01','2026-01-31', 2),
  ('O4','Operaciones', 'Migración a data warehouse',        'planeado',   '2025-11-01','2026-04-30', 3)
) as i(obj_code, area_name, title, status, start_date, end_date, idx)
join o on o.code = i.obj_code
join a on a.name = i.area_name;

-- SEED: contribuciones (cada iniciativa: área owner durante todo el rango)
insert into public.contributions (initiative_id, area_id, start_date, end_date)
select i.id, i.owner_area_id, i.start_date, i.end_date
from public.initiatives i where i.owner_area_id is not null;

-- SEED: métricas de empresa
insert into public.company_metrics (key, label, value, target, unit, order_index) values
  ('arr',         'ARR',                  2800000, 5000000, 'USD',     1),
  ('nps',         'NPS',                  55,      70,      'pts',     2),
  ('mrr_growth',  'Crecimiento MRR m/m',  6.2,     10,      '%',       3),
  ('churn',       'Churn anual',          18,      10,      '%',       4),
  ('cac',         'CAC',                  1100,    800,     'USD',     5),
  ('runway',      'Runway',               18,      24,      'meses',   6);

-- SEED: dependencias (ejemplos)
with i as (select id, title from public.initiatives)
insert into public.dependencies (from_initiative_id, to_initiative_id, type)
select f.id, t.id, 'finish_to_start'::public.dependency_type
from i f, i t
where (f.title = 'Pricing & packaging V2'        and t.title = 'Lanzamiento plan Enterprise')
   or (f.title = 'Rediseño onboarding in-app'    and t.title = 'Sistema de notificaciones push')
   or (f.title = 'Rediseño programa flagship'    and t.title = 'Plataforma de evaluaciones');
