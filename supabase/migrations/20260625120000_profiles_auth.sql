-- Tabla de perfiles vinculada a auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Usuarios autenticados pueden ver todos los perfiles
create policy "profiles_select_authenticated"
  on public.profiles for select
  using (auth.uid() is not null);

-- Cada usuario puede actualizar su propio perfil
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Solo el service role puede insertar (via trigger)
create policy "profiles_insert_service"
  on public.profiles for insert
  with check (true);

-- Trigger: al crear un usuario en auth, crea su perfil
-- El primero que se registre es admin automáticamente
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count integer;
begin
  select count(*) into admin_count from public.profiles where role = 'admin';

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when admin_count = 0 then 'admin' else 'user' end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
