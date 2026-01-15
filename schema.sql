-- Create a table for public profiles using Supabase Auth
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  full_name text,
  avatar_url text,
  user_type text check (user_type in ('client', 'provider')),
  phone text,
  cities text, -- Comma separated or JSON array of cities
  bio text
);

-- Turn on RLS
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Services offered by providers
create table services (
  id uuid default uuid_generate_v4() primary key,
  provider_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  price text
);

alter table services enable row level security;

create policy "Services are viewable by everyone."
  on services for select
  using ( true );

create policy "Providers can manage their own services."
  on services for all
  using ( auth.uid() = provider_id );

-- Portfolio photos for providers
create table portfolio_items (
  id uuid default uuid_generate_v4() primary key,
  provider_id uuid references profiles(id) on delete cascade not null,
  image_url text not null,
  description text
);

alter table portfolio_items enable row level security;

create policy "Portfolio is viewable by everyone."
  on portfolio_items for select
  using ( true );

create policy "Providers can manage their own portfolio."
  on portfolio_items for all
  using ( auth.uid() = provider_id );

-- Messages for chat
create table messages (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sender_id uuid references auth.users not null,
  receiver_id uuid references auth.users not null,
  content text not null
);

alter table messages enable row level security;

create policy "Users can see messages they sent or received."
  on messages for select
  using ( auth.uid() = sender_id or auth.uid() = receiver_id );

create policy "Users can insert messages."
  on messages for insert
  with check ( auth.uid() = sender_id );

-- Reviews
create table reviews (
  id uuid default uuid_generate_v4() primary key,
  provider_id uuid references profiles(id) not null,
  client_id uuid references profiles(id) not null,
  rating integer check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table reviews enable row level security;

create policy "Reviews are viewable by everyone."
  on reviews for select
  using ( true );

create policy "Clients can insert reviews."
  on reviews for insert
  with check ( auth.uid() = client_id );

-- View for calculating ratings
create or replace view provider_stats_view as
select
  p.id as provider_id,
  coalesce(count(r.id), 0) as total_reviews,
  coalesce(avg(r.rating), 0) as average_rating
from profiles p
left join reviews r on p.id = r.provider_id
where p.user_type = 'provider'
group by p.id;

-- Storage buckets setup (requires manual creation in Supabase Dashboard usually, but RLS policies can be SQL)
-- Prerequisite: Create buckets 'avatars' and 'portfolio' in Supabase Storage.
