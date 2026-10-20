-- ============================================================
-- QR-ATT  Part I  --  Migration (idempotent, safe to re-run)
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste ALL -> Run.
-- It upgrades the Phase 3 schema (profiles / events / attendance)
-- to the full Part I requirements:
--   * Administrator role + account activation
--   * Event: description, venue, status (open/closed)
--   * Attendance: status
--   * audit_logs table (system records)
--   * Tight Row Level Security (no role escalation, only
--     teacher/admin create events, server-side closed-event check)
--
-- HOW TO MAKE YOUR FIRST ADMIN (run once, after registering):
--   update public.profiles set role = 'admin'
--   where email = 'your-admin-email@school.edu';
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES
-- ------------------------------------------------------------
alter table public.profiles add column if not exists id_number  text;
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists is_active  boolean not null default true;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

-- ------------------------------------------------------------
-- 2. HELPER FUNCTIONS (security definer => no RLS recursion)
-- ------------------------------------------------------------
-- Returns the caller's role, or NULL if the account is deactivated.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_role() = 'admin', false);
$$;

-- ------------------------------------------------------------
-- 3. NEW-USER TRIGGER (reads whitelisted metadata from sign-up)
--    'admin' can NEVER be chosen at sign-up.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
begin
  if v_role not in ('student', 'teacher') then
    v_role := 'student';
  end if;

  insert into public.profiles (id, email, full_name, role, id_number)
  values (
    new.id,
    new.email,
    nullif(left(new.raw_user_meta_data ->> 'full_name', 100), ''),
    v_role,
    nullif(left(new.raw_user_meta_data ->> 'id_number', 40), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 4. BLOCK ROLE / ACTIVE-FLAG ESCALATION
--    Only an admin (or the SQL editor, where auth.uid() is null)
--    may change role or is_active.
-- ------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role
          or new.is_active is distinct from old.is_active
          or new.email is distinct from old.email)
     and not public.is_admin() then
    raise exception 'Only an administrator can change role, status or email.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute procedure public.protect_profile_privileges();

-- Profiles policies
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin());

-- ------------------------------------------------------------
-- 5. EVENTS
-- ------------------------------------------------------------
alter table public.events add column if not exists description text;
alter table public.events add column if not exists venue       text;
alter table public.events add column if not exists status      text not null default 'open';
alter table public.events add column if not exists updated_at  timestamptz not null default now();

alter table public.events drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check check (status in ('open', 'closed'));

alter table public.events drop constraint if exists events_time_order_check;
alter table public.events
  add constraint events_time_order_check
  check (start_time is null or end_time is null or start_time < end_time)
  not valid;  -- applies to new/edited rows; old rows are left untouched

drop policy if exists "Users can insert events" on public.events;
drop policy if exists "Teachers and admins can insert events" on public.events;
create policy "Teachers and admins can insert events"
  on public.events for insert
  with check (
    public.get_my_role() in ('teacher', 'admin')
    and created_by = auth.uid()
  );

drop policy if exists "Users can update their own events" on public.events;
drop policy if exists "Owners and admins can update events" on public.events;
create policy "Owners and admins can update events"
  on public.events for update
  using (
    (public.get_my_role() = 'teacher' and created_by = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
  on public.events for delete
  using (public.is_admin());

-- Events are readable only by active signed-in users
drop policy if exists "Events are readable by any authenticated user" on public.events;
create policy "Events are readable by any authenticated user"
  on public.events for select
  using (public.get_my_role() is not null);

-- ------------------------------------------------------------
-- 6. ATTENDANCE
-- ------------------------------------------------------------
alter table public.attendance add column if not exists status text not null default 'present';

alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance
  add constraint attendance_status_check
  check (status in ('present', 'late', 'absent', 'excused'));

-- Students may record ONLY their own attendance, ONLY while the
-- event is open and inside its time window (validated by the DB,
-- not just the app).
drop policy if exists "Students can insert their own attendance" on public.attendance;
create policy "Students can insert their own attendance"
  on public.attendance for insert
  with check (
    auth.uid() = student_id
    and public.get_my_role() = 'student'
    and status = 'present'
    and exists (
      select 1 from public.events e
      where e.id = attendance.event_id
        and e.status = 'open'
        and (e.start_time is null or now() >= e.start_time)
        and (e.end_time   is null or now() <= e.end_time)
    )
  );

drop policy if exists "Admins can view all attendance" on public.attendance;
create policy "Admins can view all attendance"
  on public.attendance for select
  using (public.is_admin());

drop policy if exists "Admins can insert attendance" on public.attendance;
create policy "Admins can insert attendance"
  on public.attendance for insert
  with check (public.is_admin());

drop policy if exists "Admins can update attendance" on public.attendance;
create policy "Admins can update attendance"
  on public.attendance for update
  using (public.is_admin());

drop policy if exists "Admins can delete attendance" on public.attendance;
create policy "Admins can delete attendance"
  on public.attendance for delete
  using (public.is_admin());

-- ------------------------------------------------------------
-- 7. AUDIT LOGS (system records / reports)
-- ------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details text,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (public.is_admin());

drop policy if exists "Staff can write their own audit logs" on public.audit_logs;
create policy "Staff can write their own audit logs"
  on public.audit_logs for insert
  with check (
    actor_id = auth.uid()
    and public.get_my_role() in ('teacher', 'admin')
  );

create index if not exists attendance_event_idx   on public.attendance (event_id);
create index if not exists attendance_student_idx on public.attendance (student_id);
create index if not exists events_created_by_idx  on public.events (created_by);

-- ============================================================
-- END OF PART I MIGRATION
-- ============================================================
