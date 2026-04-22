-- Quickstart.life schema, v1
-- Run once in Supabase SQL Editor.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  ultimate_goal text,
  created_at timestamptz not null default now()
);

create table if not exists capsules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  tabs jsonb,
  raw_transcript text,
  synthesis text,
  next_move text,
  key_noun text,
  loose_threads jsonb,
  created_at timestamptz not null default now()
);

create index if not exists capsules_project_created_idx
  on capsules (project_id, created_at desc);

alter table projects enable row level security;
alter table capsules enable row level security;

drop policy if exists "own projects" on projects;
create policy "own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own capsules" on capsules;
create policy "own capsules" on capsules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed Greg's real projects
insert into projects (user_id, name, ultimate_goal) values
  ('f4e2ae07-9f35-4563-92aa-7fec9a2def99', 'Quickstart.life',        'Ship v1 of the re-entry tool for Greg himself.'),
  ('f4e2ae07-9f35-4563-92aa-7fec9a2def99', 'GW Consulting',          'Grow the consulting practice.'),
  ('f4e2ae07-9f35-4563-92aa-7fec9a2def99', 'Psily',                  'Build Psily.'),
  ('f4e2ae07-9f35-4563-92aa-7fec9a2def99', 'Beach House Graphics',   'Run and grow Beach House Graphics.'),
  ('f4e2ae07-9f35-4563-92aa-7fec9a2def99', 'Traveling Farm',         'Build Traveling Farm.'),
  ('f4e2ae07-9f35-4563-92aa-7fec9a2def99', 'Splinter Designs',       'Run and grow Splinter Designs.')
on conflict do nothing;
