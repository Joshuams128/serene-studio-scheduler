-- Studio Scheduler: database schema
-- Applied via Supabase migration once a project is available.

create extension if not exists "pgcrypto";

-- Instructors, each with a unique invite token used for their intake link.
-- No login required — the token in the URL is their access.
create table if not exists instructors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  invite_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  formats_taught text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One submission per instructor per scheduling period (e.g. a given month).
-- Re-submitting for the same period overwrites the previous draft.
create table if not exists availability_submissions (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references instructors(id) on delete cascade,
  period_start date not null,
  available_slots jsonb not null default '[]', -- [{ "day": "Mon", "start": "06:00", "end": "12:00" }, ...]
  preferences text default '',
  submitted_at timestamptz not null default now(),
  unique (instructor_id, period_start)
);

-- The studio's required weekly class slots that need an instructor assigned.
create table if not exists class_requirements (
  id uuid primary key default gen_random_uuid(),
  day_of_week text not null, -- 'Mon' .. 'Sun'
  start_time time not null,
  end_time time not null,
  format text not null,
  room text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Generated / edited schedules, one per scheduling period.
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  period_start date not null unique,
  status text not null default 'draft', -- 'draft' | 'approved'
  assignments jsonb not null default '[]', -- [{ "requirementId", "day", "start", "end", "format", "instructorId", "instructorName" }, ...]
  notes text default '',
  generated_at timestamptz not null default now(),
  approved_at timestamptz
);

create index if not exists idx_availability_period on availability_submissions(period_start);
create index if not exists idx_instructors_token on instructors(invite_token);

-- Row Level Security: this app talks to Supabase only from server-side API
-- routes using the service role key, so RLS stays locked down by default
-- (no anon-key client access to these tables).
alter table instructors enable row level security;
alter table availability_submissions enable row level security;
alter table class_requirements enable row level security;
alter table schedules enable row level security;

-- Emailing the finished schedule out to instructors. Tracked on the schedule
-- itself so the dashboard can show "last sent" and the owner doesn't blast
-- everyone twice by accident. Safe to re-run over an existing database.
alter table schedules add column if not exists sent_at timestamptz;
alter table schedules add column if not exists sent_to_count integer not null default 0;

-- Formats belong to a category: taught classes, or non-teaching shifts like
-- concierge cover. It hangs off the weekly template entry rather than a
-- separate formats table, so this stays a one-column change. Team members
-- deliberately have no category of their own — one person keeps one profile
-- and one availability submission whatever mix of work they cover.
alter table class_requirements add column if not exists category text not null default 'class';
alter table class_requirements drop constraint if exists class_requirements_category_check;
alter table class_requirements add constraint class_requirements_category_check
  check (category in ('class', 'shift'));

-- Who has already been emailed this schedule, so batch sending survives a
-- reload or coming back to the app later. Accumulated and de-duplicated per
-- person; re-sending to someone just updates their timestamp.
-- [{ "instructorId": "...", "name": "...", "email": "...", "sentAt": "..." }, ...]
alter table schedules add column if not exists sent_to jsonb not null default '[]';
