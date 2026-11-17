-- Lab time tracker: production schema (Postgres / Supabase).
-- The public demo runs the same logic in the browser on sample data; this file
-- shows how the real system stores it. Times are timestamptz; the lab reports
-- on America/Phoenix days (no daylight saving).

create table stations (
  code        text primary key,            -- used in the QR sticker URL: /s/{code}
  name_en     text not null,
  name_es     text not null,
  active      boolean not null default true
);

create table tasks (
  station     text not null references stations(code),
  code        text not null,               -- unique per station only, so key on (station, code)
  name_en     text not null,
  name_es     text not null,
  measure     text not null check (measure in ('oz', 'job', 'stamp', 'batch')),
  machine     boolean not null default false,
  gate_status text,                        -- mandatory checkpoint: scan required before this status
  active      boolean not null default true,
  primary key (station, code)
);

create table workers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  stations    text[],                      -- null = may work anywhere
  active      boolean not null default true
  -- linked to a login through a server-set JWT claim (app_metadata.lab_worker_id)
);

create table time_entries (
  id             uuid primary key default gen_random_uuid(),
  worker_id      uuid not null references workers(id),
  station        text not null,
  task_code      text not null,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,              -- null = still clocked in
  paused_at      timestamptz,
  paused_seconds integer not null default 0,
  machine_id     text,
  lot_number     text,
  is_teamwork    boolean not null default false,
  auto_closed    boolean not null default false,  -- closed by the 6 PM sweep: counts as done, no duration
  edited_by      uuid,
  edited_at      timestamptz,
  deleted_at     timestamptz,
  foreign key (station, task_code) references tasks(station, code)
);
-- At most one open entry per worker, task and machine.
create unique index one_open_entry on time_entries (worker_id, station, task_code, coalesce(machine_id, ''))
  where ended_at is null and deleted_at is null;

create table entry_orders   (entry_id uuid references time_entries(id), order_number text, primary key (entry_id, order_number));
create table entry_partners (entry_id uuid references time_entries(id), worker_id uuid references workers(id), primary key (entry_id, worker_id));

-- Missed-scan ledger. One row per (order, task); never purged.
create table lab_alerts (
  order_number     text not null,
  task_key         text not null,          -- 'station/code'
  rule             text not null,
  status_at_detect text,
  detected_at      timestamptz not null default now(),
  reported_at      timestamptz,            -- included in a digest
  resolved_at      timestamptz,            -- a scan arrived later
  addressed_by     text,                   -- manual "addressed"; never changes compliance stats
  primary key (order_number, task_key)
);

-- Row-level security: workers can only clock themselves in.
alter table time_entries enable row level security;
create policy worker_inserts_own on time_entries for insert
  with check (worker_id = ((auth.jwt() -> 'app_metadata' ->> 'lab_worker_id')::uuid));
create policy open_entries_visible on time_entries for select
  using (ended_at is null or worker_id = ((auth.jwt() -> 'app_metadata' ->> 'lab_worker_id')::uuid));

-- Scheduled jobs (pg_cron, UTC; Arizona is UTC-7 all year).
-- detect_lab_alerts(): inserts new misses (on conflict do nothing) and resolves rows a later scan fixed.
-- send_lab_digest(): emails new and still-open misses to the manager and leads, then stamps reported_at.
-- close_open_entries(): the 6 PM sweep.
select cron.schedule('lab-alerts-detect', '*/15 * * * *', $$select detect_lab_alerts()$$);
select cron.schedule('lab-digest-noon',   '30 19 * * 1-5', $$select send_lab_digest('noon')$$);
select cron.schedule('lab-digest-eod',    '30 23 * * 1-5', $$select send_lab_digest('eod')$$);
select cron.schedule('lab-eod-sweep',     '0 1 * * *',     $$select close_open_entries()$$);
