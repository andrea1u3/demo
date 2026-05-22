create extension if not exists "pgcrypto";

create type studio_status as enum ('active', 'paused');
create type studio_role as enum ('owner', 'manager', 'front_desk', 'coach_read_only');
create type customer_status as enum ('active', 'inactive', 'blocked');
create type simple_status as enum ('active', 'inactive');
create type session_status as enum ('scheduled', 'cancelled', 'completed');
create type quota_status as enum ('open', 'closed');
create type membership_status as enum ('active', 'expired', 'cancelled');
create type ledger_entry_type as enum (
  'purchase',
  'reservation_hold',
  'consume',
  'release',
  'refund',
  'expire',
  'adjustment'
);
create type reservation_status as enum ('confirmed', 'cancelled', 'late_cancelled', 'no_show', 'attended');
create type hold_status as enum ('active', 'expired', 'converted', 'released');
create type waitlist_status as enum ('waiting', 'notified', 'converted', 'expired', 'cancelled');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'manual_review');
create type attendance_status as enum ('checked_in', 'missed');
create type automation_status as enum ('active', 'paused');
create type automation_run_status as enum ('queued', 'sent', 'failed', 'skipped');

create table studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Mexico_City',
  status studio_status not null default 'active',
  created_at timestamptz not null default now()
);

create table studio_users (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role studio_role not null,
  created_at timestamptz not null default now(),
  unique (studio_id, user_id)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  status customer_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  unique (studio_id, phone)
);

create table coaches (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  name text not null,
  status simple_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (studio_id, name)
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  name text not null,
  capacity integer not null check (capacity > 0),
  status simple_status not null default 'active',
  unique (studio_id, name)
);

create table spots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  spot_number integer not null check (spot_number > 0),
  status text not null default 'active' check (status in ('active', 'maintenance')),
  unique (room_id, spot_number)
);

create table class_templates (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  name text not null,
  default_duration_minutes integer not null check (default_duration_minutes between 15 and 180),
  default_capacity integer not null check (default_capacity > 0),
  status text not null default 'active' check (status in ('active', 'archived'))
);

create table class_sessions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  template_id uuid references class_templates(id) on delete set null,
  coach_id uuid not null references coaches(id),
  room_id uuid not null references rooms(id),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  status session_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create index class_sessions_studio_starts_at_idx on class_sessions(studio_id, starts_at);

create table channel_definitions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  code text not null,
  name text not null,
  status simple_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (studio_id, code),
  check (code in ('direct', 'whatsapp', 'fitpass', 'totalpass', 'wellhub'))
);

create table session_channel_quotas (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references class_sessions(id) on delete cascade,
  channel_id uuid not null references channel_definitions(id),
  quota integer not null check (quota >= 0),
  status quota_status not null default 'open',
  unique (session_id, channel_id)
);

create table membership_plans (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  name text not null,
  credits integer not null check (credits > 0),
  valid_days integer not null check (valid_days > 0),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'MXN',
  status text not null default 'active' check (status in ('active', 'archived')),
  unique (studio_id, name)
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  plan_id uuid not null references membership_plans(id),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status membership_status not null default 'active',
  created_at timestamptz not null default now(),
  check (starts_at < expires_at)
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  session_id uuid not null references class_sessions(id) on delete cascade,
  customer_id uuid not null references customers(id),
  channel_id uuid not null references channel_definitions(id),
  status reservation_status not null default 'confirmed',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index reservations_one_active_customer_session_idx
  on reservations(session_id, customer_id)
  where status in ('confirmed', 'attended');

create index reservations_session_status_idx on reservations(session_id, status);

create table reservation_holds (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  session_id uuid not null references class_sessions(id) on delete cascade,
  customer_id uuid not null references customers(id),
  channel_id uuid not null references channel_definitions(id),
  status hold_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index reservation_holds_one_active_customer_session_idx
  on reservation_holds(session_id, customer_id)
  where status = 'active';

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  customer_id uuid not null references customers(id),
  membership_id uuid references memberships(id) on delete set null,
  reservation_id uuid references reservations(id) on delete set null,
  entry_type ledger_entry_type not null,
  amount integer not null check (amount <> 0),
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index credit_ledger_customer_idx on credit_ledger(studio_id, customer_id, created_at);

create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  session_id uuid not null references class_sessions(id) on delete cascade,
  customer_id uuid not null references customers(id),
  channel_id uuid references channel_definitions(id),
  status waitlist_status not null default 'waiting',
  position integer not null check (position > 0),
  notified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index waitlist_one_active_customer_session_idx
  on waitlist_entries(session_id, customer_id)
  where status in ('waiting', 'notified');

create table payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  customer_id uuid not null references customers(id),
  plan_id uuid references membership_plans(id),
  provider text not null check (provider in ('mercadopago', 'stripe', 'manual')),
  provider_event_id text unique,
  idempotency_key text not null unique,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'MXN',
  status payment_status not null default 'pending',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  status attendance_status not null,
  checked_at timestamptz not null default now(),
  checked_by uuid references auth.users(id),
  unique (reservation_id)
);

create table automations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  code text not null,
  status automation_status not null default 'active',
  config jsonb not null default '{}'::jsonb,
  unique (studio_id, code)
);

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations(id) on delete cascade,
  idempotency_key text not null unique,
  status automation_run_status not null default 'queued',
  target_type text,
  target_id uuid,
  error text,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function current_user_has_studio_access(target_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from studio_users su
    where su.studio_id = target_studio_id
      and su.user_id = auth.uid()
  );
$$;

create or replace function reserve_spot(
  p_session_id uuid,
  p_customer_id uuid,
  p_channel_id uuid,
  p_idempotency_key text default null
)
returns table (
  reservation_id uuid,
  result text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session class_sessions%rowtype;
  v_customer customers%rowtype;
  v_quota session_channel_quotas%rowtype;
  v_reserved_total integer;
  v_reserved_channel integer;
  v_reservation_id uuid;
begin
  select *
  into v_session
  from class_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session.status <> 'scheduled' then
    raise exception 'SESSION_NOT_OPEN';
  end if;

  if not current_user_has_studio_access(v_session.studio_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  select *
  into v_customer
  from customers
  where id = p_customer_id
    and studio_id = v_session.studio_id;

  if not found then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  if v_customer.status = 'blocked' then
    raise exception 'CUSTOMER_BLOCKED';
  end if;

  select *
  into v_quota
  from session_channel_quotas
  where session_id = p_session_id
    and channel_id = p_channel_id
  for update;

  if not found then
    raise exception 'CHANNEL_QUOTA_NOT_FOUND';
  end if;

  if v_quota.status <> 'open' then
    raise exception 'CHANNEL_CLOSED';
  end if;

  if exists (
    select 1
    from reservations
    where session_id = p_session_id
      and customer_id = p_customer_id
      and status in ('confirmed', 'attended')
  ) then
    raise exception 'DUPLICATE_RESERVATION';
  end if;

  select count(*)
  into v_reserved_total
  from reservations
  where session_id = p_session_id
    and status in ('confirmed', 'attended');

  if v_reserved_total >= v_session.capacity then
    raise exception 'SESSION_FULL';
  end if;

  select count(*)
  into v_reserved_channel
  from reservations
  where session_id = p_session_id
    and channel_id = p_channel_id
    and status in ('confirmed', 'attended');

  if v_reserved_channel >= v_quota.quota then
    raise exception 'CHANNEL_FULL';
  end if;

  insert into reservations (
    studio_id,
    session_id,
    customer_id,
    channel_id,
    status,
    created_by
  )
  values (
    v_session.studio_id,
    p_session_id,
    p_customer_id,
    p_channel_id,
    'confirmed',
    auth.uid()
  )
  returning id into v_reservation_id;

  insert into audit_log (
    studio_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_session.studio_id,
    auth.uid(),
    'reservation.created',
    'reservation',
    v_reservation_id,
    jsonb_build_object('session_id', p_session_id, 'channel_id', p_channel_id, 'idempotency_key', p_idempotency_key)
  );

  reservation_id := v_reservation_id;
  result := 'confirmed';
  return next;
end;
$$;

alter table studios enable row level security;
alter table studio_users enable row level security;
alter table customers enable row level security;
alter table coaches enable row level security;
alter table rooms enable row level security;
alter table spots enable row level security;
alter table class_templates enable row level security;
alter table class_sessions enable row level security;
alter table channel_definitions enable row level security;
alter table session_channel_quotas enable row level security;
alter table membership_plans enable row level security;
alter table memberships enable row level security;
alter table credit_ledger enable row level security;
alter table reservations enable row level security;
alter table reservation_holds enable row level security;
alter table waitlist_entries enable row level security;
alter table payments enable row level security;
alter table attendance enable row level security;
alter table automations enable row level security;
alter table automation_runs enable row level security;
alter table audit_log enable row level security;

create policy "studios visible to members"
  on studios for select
  using (current_user_has_studio_access(id));

create policy "studio users visible to members"
  on studio_users for select
  using (current_user_has_studio_access(studio_id));

create policy "customers scoped by studio"
  on customers for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "coaches scoped by studio"
  on coaches for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "rooms scoped by studio"
  on rooms for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "spots visible through room studio"
  on spots for all
  using (
    exists (
      select 1 from rooms r
      where r.id = spots.room_id
        and current_user_has_studio_access(r.studio_id)
    )
  )
  with check (
    exists (
      select 1 from rooms r
      where r.id = spots.room_id
        and current_user_has_studio_access(r.studio_id)
    )
  );

create policy "templates scoped by studio"
  on class_templates for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "sessions scoped by studio"
  on class_sessions for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "channels scoped by studio"
  on channel_definitions for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "quotas visible through session studio"
  on session_channel_quotas for all
  using (
    exists (
      select 1 from class_sessions cs
      where cs.id = session_channel_quotas.session_id
        and current_user_has_studio_access(cs.studio_id)
    )
  )
  with check (
    exists (
      select 1 from class_sessions cs
      where cs.id = session_channel_quotas.session_id
        and current_user_has_studio_access(cs.studio_id)
    )
  );

create policy "plans scoped by studio"
  on membership_plans for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "memberships scoped by studio"
  on memberships for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "ledger scoped by studio"
  on credit_ledger for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "reservations scoped by studio"
  on reservations for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "holds scoped by studio"
  on reservation_holds for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "waitlist scoped by studio"
  on waitlist_entries for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "payments scoped by studio"
  on payments for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "attendance visible through reservation studio"
  on attendance for all
  using (
    exists (
      select 1 from reservations r
      where r.id = attendance.reservation_id
        and current_user_has_studio_access(r.studio_id)
    )
  )
  with check (
    exists (
      select 1 from reservations r
      where r.id = attendance.reservation_id
        and current_user_has_studio_access(r.studio_id)
    )
  );

create policy "automations scoped by studio"
  on automations for all
  using (current_user_has_studio_access(studio_id))
  with check (current_user_has_studio_access(studio_id));

create policy "automation runs visible through automation studio"
  on automation_runs for all
  using (
    exists (
      select 1 from automations a
      where a.id = automation_runs.automation_id
        and current_user_has_studio_access(a.studio_id)
    )
  )
  with check (
    exists (
      select 1 from automations a
      where a.id = automation_runs.automation_id
        and current_user_has_studio_access(a.studio_id)
    )
  );

create policy "audit scoped by studio"
  on audit_log for select
  using (current_user_has_studio_access(studio_id));
