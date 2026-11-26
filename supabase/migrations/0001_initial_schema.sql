-- Document Studio initial schema baseline (isolated workspace-scoped model)
-- Deny-by-default RLS enabled on every tenant-owned table.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  invited_by uuid references public.profiles(id),
  joined_at timestamptz default now(),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete set null,
  name text not null,
  created_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null,
  status text not null default 'active' check (status in ('active', 'trashed')),
  current_version_id uuid,
  created_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  content_json jsonb not null,
  plain_text text not null default '',
  word_count integer not null default 0,
  created_by uuid not null references public.profiles(id),
  source text not null check (source in ('manual', 'import', 'restore', 'export')),
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  content_json jsonb not null,
  created_by uuid not null references public.profiles(id),
  is_shared boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_permissions (
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  granted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_id uuid not null references public.document_versions(id) on delete cascade,
  format text not null check (format in ('pdf', 'docx', 'html')),
  status text not null check (status in ('queued', 'processing', 'ready', 'failed')),
  storage_path text,
  error_code text,
  requested_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata_json jsonb not null default '{}'::jsonb,
  request_id text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_templates enable row level security;
alter table public.document_permissions enable row level security;
alter table public.assets enable row level security;
alter table public.exports enable row level security;
alter table public.audit_events enable row level security;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create policy "members_read_workspace" on public.workspaces
  for select using (public.is_workspace_member(id));

create policy "members_read_documents" on public.documents
  for select using (public.is_workspace_member(workspace_id));
