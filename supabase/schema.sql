-- Portale Case Vacanze — schema del database
-- Da eseguire una volta nel SQL Editor di Supabase (Project > SQL Editor > New query).
-- Sostituisce l'approccio Prisma: le tabelle si interrogano a runtime tramite
-- supabase-js (PostgREST), e i permessi (owner vede solo le sue case, admin
-- vede tutto) sono applicati qui a livello di database con Row Level Security,
-- non nel codice dell'app.

-- ============================================================
-- 1. Tipi enum
-- ============================================================
create type profile_role as enum ('OWNER', 'ADMIN');
create type property_status as enum ('DRAFT', 'PUBLISHED', 'SUSPENDED');
create type photo_category as enum ('EXTERIOR', 'BEDROOM', 'BATHROOM', 'KITCHEN', 'VIEW', 'OTHER');
create type ota_platform as enum ('AIRBNB', 'BOOKING', 'OTHER');
create type house_rule_type as enum ('PETS', 'SMOKING', 'PARTIES', 'OTHER');
create type poi_category as enum ('RESTAURANT', 'BEACH', 'ATTRACTION', 'SHOP', 'TRANSPORT', 'OTHER');
create type announcement_type as enum ('INFO', 'WARNING', 'URGENT');
create type request_status as enum ('NEW', 'CONTACTED', 'ACCEPTED', 'REJECTED');

-- ============================================================
-- 2. Tabelle
-- ============================================================

-- Profilo applicativo, 1:1 con auth.users (creato dal trigger più sotto)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  role profile_role not null default 'OWNER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique,
  name text not null,
  property_type text,
  address_line text,
  city text,
  province text,
  latitude double precision,
  longitude double precision,
  short_description text,
  long_description text,
  status property_status not null default 'DRAFT',
  suspension_reason text,
  theme_id text not null default 'default',
  check_in_time text,
  check_out_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suspension_reason_required_when_suspended
    check (status <> 'SUSPENDED' or suspension_reason is not null)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  url text not null,
  -- public_id Cloudinary (nullable): serve solo per poter cancellare l'asset
  -- reale su Cloudinary quando la foto viene eliminata (US-404), evitando
  -- risorse orfane. Aggiunta il 2026-07-07 su una tabella già esistente:
  -- se il tuo progetto Supabase ha già "photos", esegui separatamente
  -- `alter table public.photos add column public_id text;` nello SQL Editor,
  -- perché questo file CREATE TABLE non viene ri-eseguito su un DB esistente.
  public_id text,
  alt_text text,
  category photo_category not null default 'OTHER',
  sort_order int not null default 0,
  is_cover boolean not null default false
);

create table public.ota_links (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  platform ota_platform not null,
  url text not null,
  label text,
  sort_order int not null default 0
);

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.occupancy (
  property_id uuid primary key references public.properties (id) on delete cascade,
  max_guests int not null,
  bedrooms int not null default 0,
  bathrooms int not null default 0,
  beds int not null default 0,
  single_beds int not null default 0,
  double_beds int not null default 0
);

create table public.optionals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2),
  unit text,
  sort_order int not null default 0
);

create table public.house_rules (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  type house_rule_type not null,
  description text,
  sort_order int not null default 0
);

create table public.area_guides (
  property_id uuid primary key references public.properties (id) on delete cascade,
  content text
);

create table public.points_of_interest (
  id uuid primary key default gen_random_uuid(),
  area_guide_id uuid not null references public.area_guides (property_id) on delete cascade,
  name text not null,
  category poi_category not null default 'OTHER',
  distance text,
  description text,
  external_url text,
  latitude double precision,
  longitude double precision
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  title text not null,
  body text not null,
  type announcement_type not null default 'INFO',
  visible_from timestamptz,
  visible_to timestamptz,
  created_at timestamptz not null default now()
);

create table public.availability_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  guest_name text not null,
  email text not null,
  phone text,
  check_in date not null,
  check_out date not null,
  guests_count int not null,
  message text,
  status request_status not null default 'NEW',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. Trigger: crea automaticamente il profilo alla registrazione
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'OWNER');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 4. Funzioni helper per le policy
-- ============================================================

-- SECURITY DEFINER: bypassa la RLS di profiles per evitare ricorsione
-- quando altre policy devono verificare se l'utente corrente è admin.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

create or replace function public.owns_property(target_property_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.properties
    where id = target_property_id and owner_id = auth.uid()
  );
$$;

-- ============================================================
-- 5. Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.photos enable row level security;
alter table public.ota_links enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.occupancy enable row level security;
alter table public.optionals enable row level security;
alter table public.house_rules enable row level security;
alter table public.area_guides enable row level security;
alter table public.points_of_interest enable row level security;
alter table public.announcements enable row level security;
alter table public.availability_requests enable row level security;

-- profiles: ognuno vede/modifica solo il proprio profilo, l'admin vede tutti
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
-- Solo un admin può promuovere/retrocedere il ruolo di un altro utente
-- (es. da Owner ad Admin), tramite la futura UI di amministrazione (US-1702).
create policy "profiles_admin_update_any" on public.profiles
  for update using (public.is_admin());

-- properties: owner gestisce le proprie, admin gestisce tutte,
-- chiunque (anche anonimo) può leggere le proprietà pubblicate (mini-sito)
create policy "properties_public_read_published" on public.properties
  for select using (status = 'PUBLISHED');
create policy "properties_owner_read_own" on public.properties
  for select using (owner_id = auth.uid() or public.is_admin());
create policy "properties_owner_write_own" on public.properties
  for insert with check (owner_id = auth.uid());
create policy "properties_owner_update_own" on public.properties
  for update using (owner_id = auth.uid() or public.is_admin());
create policy "properties_owner_delete_own" on public.properties
  for delete using (owner_id = auth.uid() or public.is_admin());

-- Tabelle "figlie" di property: stesso pattern per tutte —
-- lettura pubblica se la property è pubblicata, altrimenti solo owner/admin;
-- scrittura solo owner/admin.
create policy "photos_public_read" on public.photos for select using (
  exists (select 1 from public.properties p where p.id = property_id and p.status = 'PUBLISHED')
  or public.owns_property(property_id) or public.is_admin()
);
create policy "photos_owner_write" on public.photos for all using (
  public.owns_property(property_id) or public.is_admin()
) with check (public.owns_property(property_id) or public.is_admin());

create policy "ota_links_public_read" on public.ota_links for select using (
  exists (select 1 from public.properties p where p.id = property_id and p.status = 'PUBLISHED')
  or public.owns_property(property_id) or public.is_admin()
);
create policy "ota_links_owner_write" on public.ota_links for all using (
  public.owns_property(property_id) or public.is_admin()
) with check (public.owns_property(property_id) or public.is_admin());

create policy "occupancy_public_read" on public.occupancy for select using (
  exists (select 1 from public.properties p where p.id = property_id and p.status = 'PUBLISHED')
  or public.owns_property(property_id) or public.is_admin()
);
create policy "occupancy_owner_write" on public.occupancy for all using (
  public.owns_property(property_id) or public.is_admin()
) with check (public.owns_property(property_id) or public.is_admin());

create policy "optionals_public_read" on public.optionals for select using (
  exists (select 1 from public.properties p where p.id = property_id and p.status = 'PUBLISHED')
  or public.owns_property(property_id) or public.is_admin()
);
create policy "optionals_owner_write" on public.optionals for all using (
  public.owns_property(property_id) or public.is_admin()
) with check (public.owns_property(property_id) or public.is_admin());

create policy "house_rules_public_read" on public.house_rules for select using (
  exists (select 1 from public.properties p where p.id = property_id and p.status = 'PUBLISHED')
  or public.owns_property(property_id) or public.is_admin()
);
create policy "house_rules_owner_write" on public.house_rules for all using (
  public.owns_property(property_id) or public.is_admin()
) with check (public.owns_property(property_id) or public.is_admin());

create policy "area_guides_public_read" on public.area_guides for select using (
  exists (select 1 from public.properties p where p.id = property_id and p.status = 'PUBLISHED')
  or public.owns_property(property_id) or public.is_admin()
);
create policy "area_guides_owner_write" on public.area_guides for all using (
  public.owns_property(property_id) or public.is_admin()
) with check (public.owns_property(property_id) or public.is_admin());

create policy "points_of_interest_public_read" on public.points_of_interest for select using (
  exists (
    select 1 from public.area_guides ag join public.properties p on p.id = ag.property_id
    where ag.property_id = area_guide_id and p.status = 'PUBLISHED'
  )
  or public.owns_property(area_guide_id) or public.is_admin()
);
create policy "points_of_interest_owner_write" on public.points_of_interest for all using (
  public.owns_property(area_guide_id) or public.is_admin()
) with check (public.owns_property(area_guide_id) or public.is_admin());

create policy "announcements_public_read" on public.announcements for select using (
  exists (select 1 from public.properties p where p.id = property_id and p.status = 'PUBLISHED')
  or public.owns_property(property_id) or public.is_admin()
);
create policy "announcements_owner_write" on public.announcements for all using (
  public.owns_property(property_id) or public.is_admin()
) with check (public.owns_property(property_id) or public.is_admin());

-- blocked_dates: lettura pubblica (serve al calendario del mini-sito),
-- scrittura solo owner/admin
create policy "blocked_dates_public_read" on public.blocked_dates for select using (
  exists (select 1 from public.properties p where p.id = property_id and p.status = 'PUBLISHED')
  or public.owns_property(property_id) or public.is_admin()
);
create policy "blocked_dates_owner_write" on public.blocked_dates for all using (
  public.owns_property(property_id) or public.is_admin()
) with check (public.owns_property(property_id) or public.is_admin());

-- availability_requests: chiunque (anche anonimo) può creare una richiesta
-- dal mini-sito, ma solo owner/admin possono leggerle/gestirle
create policy "availability_requests_public_insert" on public.availability_requests
  for insert with check (
    exists (select 1 from public.properties p where p.id = property_id and p.status = 'PUBLISHED')
  );
create policy "availability_requests_owner_read" on public.availability_requests
  for select using (public.owns_property(property_id) or public.is_admin());
create policy "availability_requests_owner_update" on public.availability_requests
  for update using (public.owns_property(property_id) or public.is_admin());
