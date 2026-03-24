-- ============================================================
-- Sleeve Gallery — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text default '',
  bio text default '',
  role text not null default 'user' check (role in ('user', 'curator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- 2. COVERS
create table public.covers (
  id bigint generated always as identity primary key,
  title text not null,
  musician text not null,
  cover_artist text not null default '',
  artist_role text not null default '',
  year int,
  label text default '',
  genre text[] not null default '{}',
  curator_note text default '',
  spotify_id text default '',
  hue int default 0,
  sat int default 0,
  lit int default 25,
  contributors jsonb default '[]',
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  submitted_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.covers enable row level security;

-- Anyone can read approved covers
create policy "Approved covers are public"
  on public.covers for select using (status = 'approved');

-- Users can see their own submissions (any status)
create policy "Users can see own submissions"
  on public.covers for select using (auth.uid() = submitted_by);

-- Curators can see all covers
create policy "Curators can see all covers"
  on public.covers for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'curator')
  );

-- Logged-in users can submit covers (always as pending)
create policy "Authenticated users can submit covers"
  on public.covers for insert with check (
    auth.uid() = submitted_by and status = 'pending'
  );

-- Curators can update cover status
create policy "Curators can update cover status"
  on public.covers for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'curator')
  );

create index idx_covers_status on public.covers(status);
create index idx_covers_submitted_by on public.covers(submitted_by);

-- 3. SAVED COVERS
create table public.saved_covers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cover_id bigint not null references public.covers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, cover_id)
);

alter table public.saved_covers enable row level security;

create policy "Users can read own saves"
  on public.saved_covers for select using (auth.uid() = user_id);

create policy "Users can save covers"
  on public.saved_covers for insert with check (auth.uid() = user_id);

create policy "Users can unsave covers"
  on public.saved_covers for delete using (auth.uid() = user_id);

-- 4. FRIENDSHIPS
create table public.friendships (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "Users can see own friendships"
  on public.friendships for select using (
    auth.uid() = requester_id or auth.uid() = addressee_id
  );

create policy "Users can send friend requests"
  on public.friendships for insert with check (auth.uid() = requester_id);

create policy "Users can update friendships addressed to them"
  on public.friendships for update using (auth.uid() = addressee_id);

create policy "Users can delete own friendships"
  on public.friendships for delete using (
    auth.uid() = requester_id or auth.uid() = addressee_id
  );

create index idx_friendships_addressee on public.friendships(addressee_id);

-- 5. AUTO-CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
